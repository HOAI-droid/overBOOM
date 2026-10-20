import type { Command } from '../../core/src/index.ts';
import type { WorldState } from './state.ts';

/** Protokoll-Version – Host lehnt ältere/neuere Clients mit Hinweis ab */
export const PROTO = 1;

/** Wie lange ein Platz nach Verbindungsabbruch frei gehalten wird (ms) */
export const RECONNECT_MS = 30000;

export type Route = 'direct' | 'relay' | 'local' | 'unknown';

export interface LobbySpieler {
  slot: number;
  name: string;
  held: string;
  bereit: boolean;
  verbunden: boolean;
  route: Route;
  ping: number;
}

/** Alle Nachrichten zwischen Host und Clients */
export type Msg =
  | { t: 'hello'; token: string; name: string; proto: number }
  | { t: 'welcome'; slot: number }
  | { t: 'reject'; grund: string }
  | { t: 'lobby'; spieler: LobbySpieler[]; insel: string; gefahr: number; laeuft: boolean }
  | { t: 'pick'; held: string; bereit: boolean }
  | { t: 'start'; seed: number; insel: string; namen: string[]; helden: string[] }
  | { t: 'input'; seq: number; mx: number; mz: number; dash: boolean; boom: boolean }
  | { t: 'cmd'; cmd: Command }
  | { t: 'state'; st: WorldState }
  | { t: 'snap'; data: ArrayBuffer }
  | { t: 'lobbyzurueck' }
  | { t: 'bye'; grund: string };

/**
 * Transport-Schicht: das Spiel kennt nur dieses Interface. Implementierungen:
 * Speicher (Tests), BroadcastChannel (mehrere Tabs), Trystero (WebRTC + TURN).
 */
export interface Transport {
  readonly selfId: string;
  readonly roomCode: string;
  /** an einen Peer oder (ohne `to`) an alle */
  send(msg: Msg, to?: string): void;
  onMessage: ((msg: Msg, from: string) => void) | null;
  onPeerJoin: ((id: string) => void) | null;
  onPeerLeave: ((id: string) => void) | null;
  peerInfo(id: string): Promise<{ pingMs: number; route: Route }>;
  leave(): Promise<void>;
}

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Raumcode: 6 Zeichen ohne verwechselbare Zeichen (kein 0/O, 1/I) */
export function makeRoomCode(rand: () => number): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ABC[Math.floor(rand() * CODE_ABC.length)];
  return s;
}

/** Eingabe säubern: Großbuchstaben, nur gültige Zeichen, höchstens 6 */
export function normalizeRoomCode(code: string): string {
  return [...code.toUpperCase()].filter((c) => CODE_ABC.includes(c)).join('').slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* Speicher-Transport (Tests in Node): Zustellung erst bei hub.flush()  */
/* ------------------------------------------------------------------ */

interface Pending { from: string; to?: string; msg: Msg }

export class MemoryHub {
  private rooms = new Map<string, Map<string, MemoryTransport>>();
  private queue: Pending[] = [];
  private next = 1;

  join(code: string): MemoryTransport {
    const room = this.rooms.get(code) ?? new Map<string, MemoryTransport>();
    this.rooms.set(code, room);
    const t = new MemoryTransport(`peer${this.next++}`, code, this);
    const others = [...room.values()];
    room.set(t.selfId, t);
    for (const o of others) { o.onPeerJoin?.(t.selfId); t.onPeerJoin?.(o.selfId); }
    return t;
  }

  /** nach dem Setzen der Handler: bekannte Peers melden */
  announce(t: MemoryTransport): void {
    for (const o of this.rooms.get(t.roomCode)?.values() ?? []) if (o !== t) t.onPeerJoin?.(o.selfId);
  }

  post(p: Pending): void { this.queue.push(p); }

  leave(t: MemoryTransport): void {
    const room = this.rooms.get(t.roomCode);
    if (!room) return;
    room.delete(t.selfId);
    for (const o of room.values()) o.onPeerLeave?.(t.selfId);
  }

  /** alle Nachrichten zustellen (auch die dabei neu entstehenden) */
  flush(max = 10000): number {
    let n = 0;
    while (this.queue.length && n < max) {
      const p = this.queue.shift()!;
      for (const [code, room] of this.rooms) {
        const sender = room.get(p.from);
        if (!sender) continue;
        for (const t of room.values()) {
          if (t.selfId === p.from || (p.to && p.to !== t.selfId)) continue;
          // Binärdaten werden wie über das Netz kopiert
          const msg = p.msg.t === 'snap' ? { t: 'snap' as const, data: p.msg.data.slice(0) } : JSON.parse(JSON.stringify(p.msg)) as Msg;
          t.onMessage?.(msg, p.from);
        }
        void code;
      }
      n++;
    }
    return n;
  }
}

export class MemoryTransport implements Transport {
  onMessage: Transport['onMessage'] = null;
  onPeerJoin: Transport['onPeerJoin'] = null;
  onPeerLeave: Transport['onPeerLeave'] = null;
  readonly selfId: string;
  readonly roomCode: string;
  private hub: MemoryHub;

  constructor(selfId: string, roomCode: string, hub: MemoryHub) {
    this.selfId = selfId;
    this.roomCode = roomCode;
    this.hub = hub;
  }

  send(msg: Msg, to?: string): void { this.hub.post({ from: this.selfId, to, msg }); }
  async peerInfo(): Promise<{ pingMs: number; route: Route }> { return { pingMs: 1, route: 'local' }; }
  async leave(): Promise<void> { this.hub.leave(this); }
}

/* ------------------------------------------------------------------ */
/* BroadcastChannel: mehrere Tabs desselben Browsers (Test, Entwicklung) */
/* ------------------------------------------------------------------ */

interface BcPacket { from: string; to?: string; msg?: Msg; ctl?: 'join' | 'here' | 'bye' | 'beat' }

export class LocalTransport implements Transport {
  onMessage: Transport['onMessage'] = null;
  onPeerJoin: Transport['onPeerJoin'] = null;
  onPeerLeave: Transport['onPeerLeave'] = null;
  readonly selfId: string;
  readonly roomCode: string;
  private ch: BroadcastChannel;
  private seen = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;

  constructor(roomCode: string, selfId: string) {
    this.roomCode = roomCode;
    this.selfId = selfId;
    this.ch = new BroadcastChannel('overboom:' + roomCode);
    this.ch.onmessage = (e: MessageEvent<BcPacket>) => this.receive(e.data);
    this.post({ from: selfId, ctl: 'join' });
    this.timer = setInterval(() => {
      this.post({ from: selfId, ctl: 'beat' });
      const now = Date.now();
      for (const [id, t] of this.seen) if (now - t > 4000) { this.seen.delete(id); this.onPeerLeave?.(id); }
    }, 1000);
  }

  private post(p: BcPacket): void { this.ch.postMessage(p); }

  private touch(id: string): void {
    const known = this.seen.has(id);
    this.seen.set(id, Date.now());
    if (!known) this.onPeerJoin?.(id);
  }

  private receive(p: BcPacket): void {
    if (p.from === this.selfId || (p.to && p.to !== this.selfId)) return;
    if (p.ctl === 'bye') { if (this.seen.delete(p.from)) this.onPeerLeave?.(p.from); return; }
    if (p.ctl === 'join') this.post({ from: this.selfId, to: p.from, ctl: 'here' });
    this.touch(p.from);
    if (p.msg) this.onMessage?.(p.msg, p.from);
  }

  send(msg: Msg, to?: string): void { this.post({ from: this.selfId, to, msg }); }
  async peerInfo(): Promise<{ pingMs: number; route: Route }> { return { pingMs: 0, route: 'local' }; }
  async leave(): Promise<void> {
    clearInterval(this.timer);
    this.post({ from: this.selfId, ctl: 'bye' });
    this.ch.close();
  }
}
