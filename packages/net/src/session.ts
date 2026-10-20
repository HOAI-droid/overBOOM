import { World, DT, NO_INPUT, type Command, type InputState, type SimEvent } from '../../core/src/index.ts';
import { decodeSnapshot, encodeSnapshot, applySnapshot, Snapshot } from './snapshot.ts';
import { applyWorldState, worldState } from './state.ts';
import { PROTO, RECONNECT_MS, type LobbySpieler, type Msg, type Route, type Transport } from './transport.ts';
import { KOOP, t, tx } from '../../data/src/index.ts';

/** Snapshot nur jeden 2. Tick (15 Hz) – Ereignisse dazwischen werden gesammelt */
export const SNAP_EVERY = 2;
/** Interpolationspuffer des Clients in Ticks (≈ 100 ms) */
export const INTERP_TICKS = 3;

interface Slot {
  token: string;
  name: string;
  peer: string | null;
  held: string;
  bereit: boolean;
  /** Zeitpunkt des Verbindungsabbruchs (ms) oder 0 */
  weg: number;
  route: Route;
  ping: number;
  input: InputState;
  /** Dash bleibt gemerkt, bis ein Tick ihn verarbeitet hat */
  dash: boolean;
  boom: boolean;
  seq: number;
}

export interface HostHooks {
  /** Lobby hat sich geändert (Spieler, Helden, Verbindungen) */
  lobby?: (spieler: LobbySpieler[]) => void;
  /** Ereignisse aus Befehlen anderer Spieler (für lokale Effekte) */
  events?: (events: SimEvent[]) => void;
  /** Spieler weg/zurück (für Meldungen) */
  info?: (text: string) => void;
}

/**
 * Host: simuliert die Welt für alle (30 Hz), nimmt Eingaben und Befehle der Clients an
 * und verschickt Snapshots (15 Hz) plus Inventar-Zustand, wenn er sich ändert.
 */
export class HostSession {
  world: World | null = null;
  readonly slots: Slot[] = [];
  insel = 'gackerfeld';
  gefahr = 0;
  private pending: SimEvent[] = [];
  private lastState = '';
  private stateDirty = true;
  private ticks = 0;
  private acks: number[] = [];
  private t: Transport;
  private hooks: HostHooks;
  private now: () => number;

  constructor(t: Transport, name: string, token: string, hooks: HostHooks = {}, now: () => number = () => Date.now()) {
    this.t = t;
    this.hooks = hooks;
    this.now = now;
    this.slots.push(this.newSlot(token, name, null));
    t.onMessage = (m, from) => this.receive(m, from);
    t.onPeerLeave = (id) => this.peerLeft(id);
  }

  get laeuft(): boolean { return this.world !== null; }

  private newSlot(token: string, name: string, peer: string | null): Slot {
    return { token, name, peer, held: 'kawummkid', bereit: false, weg: 0, route: peer ? 'unknown' : 'local', ping: 0, input: { ...NO_INPUT }, dash: false, boom: false, seq: 0 };
  }

  lobbyList(): LobbySpieler[] {
    return this.slots.map((s, i) => ({ slot: i, name: s.name, held: s.held, bereit: i === 0 || s.bereit, verbunden: i === 0 || !!s.peer, route: s.route, ping: s.ping }));
  }

  private broadcastLobby(): void {
    const spieler = this.lobbyList();
    this.t.send({ t: 'lobby', spieler, insel: this.insel, gefahr: this.gefahr, laeuft: this.laeuft });
    this.hooks.lobby?.(spieler);
  }

  /** Host wählt Held/Insel in der Lobby */
  pick(held: string, insel?: string, gefahr?: number): void {
    this.slots[0].held = held;
    if (insel) this.insel = insel;
    if (gefahr !== undefined) this.gefahr = gefahr;
    this.broadcastLobby();
  }

  /** Ping und Verbindungsart (direkt/Relay) aller Clients auffrischen */
  async refreshPeers(): Promise<void> {
    for (const s of this.slots) {
      if (!s.peer) continue;
      try { const info = await this.t.peerInfo(s.peer); s.ping = Math.round(info.pingMs); s.route = info.route; } catch { /* egal */ }
    }
    this.broadcastLobby();
  }

  private receive(m: Msg, from: string): void {
    const i = this.slots.findIndex((s) => s.peer === from);
    switch (m.t) {
      case 'hello': {
        if (m.proto !== PROTO) { this.t.send({ t: 'reject', grund: tx('Andere Spielversion – bitte beide Seiten neu laden.') }, from); return; }
        // Wiederverbinden: gleicher Token bekommt seinen Platz zurück
        let slot = this.slots.findIndex((s, k) => k > 0 && s.token === m.token);
        if (slot < 0) {
          if (this.laeuft) { this.t.send({ t: 'reject', grund: tx('Das Spiel läuft schon.') }, from); return; }
          if (this.slots.length >= KOOP.maxSpieler) { this.t.send({ t: 'reject', grund: tx('Der Raum ist voll (4 Spieler).') }, from); return; }
          this.slots.push(this.newSlot(m.token, m.name.slice(0, 16) || 'Gast', from));
          slot = this.slots.length - 1;
        } else {
          const s = this.slots[slot];
          if (s.weg) this.hooks.info?.(t('{name} ist wieder da', { name: s.name }));
          s.peer = from; s.weg = 0; s.name = m.name.slice(0, 16) || s.name;
        }
        this.t.send({ t: 'welcome', slot }, from);
        if (this.world) {
          const w = this.world;
          this.t.send({ t: 'start', seed: this.seed, insel: w.insel.id, namen: w.players.map((p) => p.name), helden: w.players.map((p) => p.held) }, from);
          this.stateDirty = true;
          this.lastState = '';
        }
        this.broadcastLobby();
        return;
      }
      case 'pick':
        if (i > 0) { this.slots[i].held = m.held; this.slots[i].bereit = m.bereit; this.broadcastLobby(); }
        return;
      case 'input':
        if (i > 0 && m.seq > this.slots[i].seq) {
          const s = this.slots[i];
          s.seq = m.seq;
          s.input.mx = Math.max(-1, Math.min(1, m.mx)); s.input.mz = Math.max(-1, Math.min(1, m.mz));
          s.dash = s.dash || m.dash;
          s.boom = s.boom || m.boom;
        }
        return;
      case 'cmd':
        if (i > 0 && this.world) {
          const r = this.command(i, m.cmd);
          if (r.events.length) this.hooks.events?.(r.events);
        }
        return;
    }
  }

  private peerLeft(id: string): void {
    const i = this.slots.findIndex((s) => s.peer === id);
    if (i <= 0) return;
    const s = this.slots[i];
    if (!this.laeuft) { this.slots.splice(i, 1); this.broadcastLobby(); return; }
    s.peer = null;
    s.weg = this.now();
    s.input.mx = s.input.mz = 0;
    this.hooks.info?.(t('{name} hat die Verbindung verloren – wartet 30 s', { name: s.name }));
    this.broadcastLobby();
  }

  private seed = 1;

  /** Spiel starten: alle Spieler mit ihren Helden, Insel vom Host */
  start(seed: number): World {
    this.seed = seed;
    const w = new World(seed, this.slots.length, { choose: true });
    this.world = w;
    this.slots.forEach((s, i) => { w.players[i].name = s.name; s.seq = 0; s.dash = false; });
    this.acks = this.slots.map(() => 0);
    this.t.send({ t: 'start', seed, insel: this.insel, namen: this.slots.map((s) => s.name), helden: this.slots.map((s) => s.held) });
    this.slots.forEach((s, i) => w.command(i, i === 0 ? { type: 'start', held: s.held, insel: this.insel, gefahr: this.gefahr } : { type: 'start', held: s.held }));
    this.pending.push(...w.events);
    this.stateDirty = true;
    this.lastState = '';
    this.broadcastLobby();
    return w;
  }

  /** zurück in die Lobby (nach Run-Ende) */
  backToLobby(): void {
    this.world = null;
    for (const s of this.slots) s.bereit = false;
    // Plätze ohne Verbindung fallen weg
    for (let i = this.slots.length - 1; i > 0; i--) if (!this.slots[i].peer) this.slots.splice(i, 1);
    this.t.send({ t: 'lobbyzurueck' });
    this.broadcastLobby();
  }

  /** Befehl eines Spielers ausführen; Ereignisse gehen an alle */
  command(slot: number, cmd: Command): { ok: boolean; events: SimEvent[] } {
    const w = this.world;
    if (!w) return { ok: false, events: [] };
    w.events.length = 0;
    const ok = w.command(slot, cmd);
    const events = w.events.slice();
    w.events.length = 0;
    this.pending.push(...events);
    this.stateDirty = true;
    return { ok, events };
  }

  /** Ein Simulations-Tick mit der Eingabe des Hosts; danach liegen die Ereignisse in world.events */
  tick(local: InputState): void {
    const w = this.world;
    if (!w) return;
    const now = this.now();
    const inputs: InputState[] = this.slots.map((s, i) => {
      if (i === 0) return local;
      const inp = { mx: s.peer ? s.input.mx : 0, mz: s.peer ? s.input.mz : 0, dash: s.dash, boom: s.boom };
      s.dash = false; s.boom = false;
      this.acks[i] = s.seq;
      return inp;
    });
    // Zu lange weg: Platz aufgeben (Spieler scheidet aus, blockiert den Shop nicht mehr)
    this.slots.forEach((s, i) => {
      if (i > 0 && s.weg && now - s.weg > RECONNECT_MS) {
        const p = w.players[i];
        if (p.alive || p.downed) {
          p.alive = false; p.downed = false;
          this.hooks.info?.(t('{name} ist raus', { name: s.name }));
          if (!w.players.some((q) => q.alive || q.downed) && w.phase !== 'sieg') w.phase = 'ende';
        }
        if (w.phase === 'shop') p.ready = true;
      }
    });
    w.step(inputs);
    this.pending.push(...w.events);
    this.ticks++;
    if (this.ticks % SNAP_EVERY === 0) {
      this.t.send({ t: 'snap', data: encodeSnapshot(w, this.pending, this.acks) });
      this.pending.length = 0;
    }
    if (this.stateDirty || this.ticks % 10 === 0) this.sendState();
  }

  /** Inventar/Shop-Zustand senden, wenn er sich geändert hat */
  sendState(): void {
    const w = this.world;
    if (!w) return;
    this.stateDirty = false;
    const st = worldState(w);
    const key = JSON.stringify(st);
    if (key === this.lastState) return;
    this.lastState = key;
    this.t.send({ t: 'state', st });
  }

  async leave(grund = tx('Der Host hat das Spiel beendet.')): Promise<void> {
    this.t.send({ t: 'bye', grund });
    await this.t.leave();
  }
}

export interface ClientHooks {
  welcome?: (slot: number) => void;
  reject?: (grund: string) => void;
  lobby?: (spieler: LobbySpieler[], insel: string, laeuft: boolean, gefahr: number) => void;
  start?: (world: World) => void;
  lobbyzurueck?: () => void;
  bye?: (grund: string) => void;
}

/**
 * Client: schickt Eingaben und Befehle, sagt die eigene Bewegung vorher und zeigt
 * alles andere 100 ms verzögert, zwischen zwei Snapshots interpoliert.
 */
export class ClientSession {
  slot = -1;
  world: World | null = null;
  hostId = '';
  /** gemessene Snapshot-Rate und Größe (Diagnose) */
  bytes = 0;
  private snaps: Snapshot[] = [];
  private seq = 0;
  private history: { seq: number; x: number; z: number }[] = [];
  private lastRecv = 0;
  private lastTick = 0;
  private haveSnap = false;
  private t: Transport;
  private hooks: ClientHooks;
  private now: () => number;
  private token: string;
  private name: string;
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  /** Spiegelwelt neu? → erster Snapshot setzt die Position hart */
  private fresh = true;

  constructor(t: Transport, name: string, token: string, hooks: ClientHooks = {}, now: () => number = () => Date.now()) {
    this.t = t;
    this.hooks = hooks;
    this.now = now;
    this.token = token;
    this.name = name;
    for (let i = 0; i < 8; i++) this.snaps.push(new Snapshot());
    t.onMessage = (m, from) => this.receive(m, from);
    t.onPeerJoin = () => { if (this.slot < 0) this.hello(); };
    t.onPeerLeave = (id) => { if (id === this.hostId) this.hooks.bye?.(tx('Verbindung zum Host verloren.')); };
  }

  /** beim Host melden (wiederholt, bis er antwortet) */
  hello(): void {
    this.t.send({ t: 'hello', token: this.token, name: this.name, proto: PROTO });
  }

  startHello(intervalMs = 1500): void {
    this.hello();
    this.helloTimer = setInterval(() => { if (this.slot < 0) this.hello(); else this.stopHello(); }, intervalMs);
  }

  private stopHello(): void {
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.helloTimer = null;
  }

  pick(held: string, bereit: boolean): void {
    if (this.hostId) this.t.send({ t: 'pick', held, bereit }, this.hostId);
  }

  private receive(m: Msg, from: string): void {
    switch (m.t) {
      case 'welcome': this.hostId = from; this.slot = m.slot; this.stopHello(); this.hooks.welcome?.(m.slot); return;
      case 'reject': this.stopHello(); this.hooks.reject?.(m.grund); return;
      case 'lobby': if (from === this.hostId || !this.hostId) this.hooks.lobby?.(m.spieler, m.insel, m.laeuft, m.gefahr); return;
      case 'start': {
        if (from !== this.hostId) return;
        const w = new World(m.seed, m.namen.length, { choose: true });
        w.startReise(m.insel);
        m.namen.forEach((n, i) => { w.players[i].name = n; if (m.helden[i]) w.setHero(w.players[i], m.helden[i]); });
        w.phase = 'welle';
        this.world = w;
        this.fresh = true;
        this.haveSnap = false;
        for (const s of this.snaps) { s.tick = -1; s.played = true; }
        this.history.length = 0;
        this.hooks.start?.(w);
        return;
      }
      case 'state': if (this.world && from === this.hostId) applyWorldState(this.world, m.st); return;
      case 'snap': {
        if (!this.world || from !== this.hostId) return;
        this.bytes = m.data.byteLength;
        // ältesten Puffer-Platz wiederverwenden
        let slot = this.snaps[0];
        for (const s of this.snaps) if (s.tick < slot.tick) slot = s;
        decodeSnapshot(m.data, slot);
        if (slot.tick < this.lastTick) { slot.played = true; return; }
        this.lastTick = slot.tick;
        this.lastRecv = this.now();
        this.haveSnap = true;
        return;
      }
      case 'lobbyzurueck': this.world = null; this.hooks.lobbyzurueck?.(); return;
      case 'bye': this.hooks.bye?.(m.grund); return;
    }
  }

  command(cmd: Command): void {
    if (this.hostId) this.t.send({ t: 'cmd', cmd }, this.hostId);
  }

  /** Ein Eingabe-Tick (30 Hz): senden und eigene Bewegung vorhersagen */
  input(inp: InputState & { boom?: boolean }): void {
    const w = this.world;
    if (!w || !this.hostId) return;
    this.seq++;
    this.t.send({ t: 'input', seq: this.seq, mx: inp.mx, mz: inp.mz, dash: inp.dash, boom: !!inp.boom }, this.hostId);
    const p = w.players[this.slot];
    if (!p || !p.alive || w.phase === 'ende') return;
    w.predictPlayer(p, inp);
    this.history.push({ seq: this.seq, x: p.x, z: p.z });
    if (this.history.length > 90) this.history.shift();
  }

  /** geschätzter aktueller Host-Tick */
  private hostTick(): number {
    return this.lastTick + (this.now() - this.lastRecv) / 1000 / DT;
  }

  /**
   * Pro Frame: Welt zwischen zwei Snapshots einsetzen, eigene Position abgleichen.
   * Gibt die Ereignisse zurück, die jetzt abgespielt werden sollen.
   */
  update(out: SimEvent[]): void {
    out.length = 0;
    const w = this.world;
    if (!w || !this.haveSnap) return;
    const render = this.hostTick() - INTERP_TICKS;
    let a: Snapshot | null = null, b: Snapshot | null = null;
    for (const s of this.snaps) {
      if (s.tick < 0) continue;
      if (s.tick <= render && (!a || s.tick > a.tick)) a = s;
      if (s.tick > render && (!b || s.tick < b.tick)) b = s;
    }
    if (!a && b) a = b;
    if (!b && a) b = a;
    if (!a || !b) return;
    // Ereignisse aller erreichten Snapshots abspielen (in Reihenfolge)
    const due = this.snaps.filter((s) => s.tick >= 0 && !s.played && s.tick <= Math.max(render, a!.tick)).sort((x, y) => x.tick - y.tick);
    for (const s of due) {
      s.played = true;
      for (const e of s.events) {
        // eigene Schritte/Dashes zeigt die Vorhersage schon
        if ((e.type === 'dash' || e.type === 'step' || e.type === 'bump') && e.player === this.slot) continue;
        // Reise und zerbrechende Arena in der Spiegelwelt nachbauen (deterministisch aus dem Seed)
        if (e.type === 'inselWechsel' && e.index !== w.reiseIndex) w.geheZuInsel(e.index);
        if (e.type === 'arenaBricht') w.zerbrichArena(e.stufe);
        out.push(e);
      }
    }
    const t = a === b ? 1 : Math.max(0, Math.min(1, (render - a.tick) / (b.tick - a.tick)));
    applySnapshot(w, a, b, t, this.slot);
    w.ordneWelleEin(w.wave);
    this.reconcile(w, b);
  }

  /** eigene Vorhersage mit der Host-Position abgleichen */
  private reconcile(w: World, s: Snapshot): void {
    const p = w.players[this.slot], q = s.players[this.slot];
    if (!p || !q) return;
    if (this.fresh || !q.alive || w.phase !== 'welle') {
      p.x = q.x; p.z = q.z; p.vx = q.vx; p.vz = q.vz; p.facing = q.facing; p.dashTime = q.dashTime;
      this.fresh = false;
      this.history.length = 0;
      return;
    }
    const h = this.history.find((e) => e.seq === q.ack);
    if (!h) return;
    const ex = q.x - h.x, ez = q.z - h.z;
    const err = Math.hypot(ex, ez);
    if (err > 2.5) { p.x += ex; p.z += ez; for (const e of this.history) { e.x += ex; e.z += ez; } return; }
    if (err > 0.02) {
      // weich nachziehen (Rückstoß, kleine Abweichungen)
      const k = 0.15;
      p.x += ex * k; p.z += ez * k;
      for (const e of this.history) if (e.seq >= q.ack) { e.x += ex * k; e.z += ez * k; }
    }
  }

  async leave(): Promise<void> {
    this.stopHello();
    await this.t.leave();
  }
}
