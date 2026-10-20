import { createArena, type Arena, type Prop } from './arena.ts';
import { Rng } from './rng.ts';
import { SpatialHash } from './spatial.ts';
import {
  MAX_BLASTS, MAX_CRYSTALS, MAX_ENEMIES, MAX_PROJECTILES, MAX_WARNINGS,
  makeBlast, makeCrystal, makeEnemy, makeProjectile, makeWarning,
  type Blast, type BlastSource, type Crystal, type Enemy, type Projectile, type Warning, type WeaponSlot
} from './entities.ts';
import { stepEnemies, stepWaves } from './enemies.ts';
import { stepProjectiles, stepWeapons } from './weapons.ts';
import { GEGNER, KAMPF, SPIELER, W, WELLEN } from '../../data/src/index.ts';

import { ACCEL, BARREL_RADIUS, DASH_COOLDOWN, DASH_SPEED, DASH_TIME, DT, MOVE_SPEED, PLAYER_COLORS, PLAYER_RADIUS } from './constants.ts';
export * from './constants.ts';

/** Eingabe eines Spielers für einen Tick – in Weltkoordinaten (x/z-Ebene). */
export interface InputState {
  mx: number;
  mz: number;
  /** true nur im Tick, in dem Dash ausgelöst wird */
  dash: boolean;
}

export const NO_INPUT: InputState = { mx: 0, mz: 0, dash: false };

export interface Player {
  id: number;
  color: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Blickrichtung in Radiant, 0 = +z */
  facing: number;
  dashTime: number;
  dashCooldown: number;
  dashDirX: number;
  dashDirZ: number;
  /** zurückgelegter Weg, treibt die Laufanimation */
  stride: number;
  hp: number;
  maxHp: number;
  /** Unverwundbarkeit nach Treffer (s) */
  invuln: number;
  alive: boolean;
  crystals: number;
  weapons: WeaponSlot[];
}

export type Phase = 'welle' | 'pause' | 'ende';

export type SimEvent =
  | { type: 'dash'; player: number; x: number; z: number; dirX: number; dirZ: number }
  | { type: 'step'; player: number; x: number; z: number }
  | { type: 'bump'; player: number; x: number; z: number }
  | { type: 'fire'; player: number; slot: number; weapon: string; x: number; z: number; dirX: number; dirZ: number }
  | { type: 'hit'; id: number; x: number; y: number; z: number; dmg: number; crit: boolean }
  | { type: 'kill'; id: number; enemy: string; x: number; z: number; doomed: boolean }
  | { type: 'explosion'; x: number; z: number; r: number; chain: number; source: BlastSource }
  | { type: 'zap'; pts: number[] }
  | { type: 'spark'; x: number; y: number; z: number; hostile: boolean }
  | { type: 'spawn'; enemy: string; x: number; z: number }
  | { type: 'windup'; enemy: string; x: number; z: number }
  | { type: 'enemyShot'; x: number; z: number }
  | { type: 'pickup'; player: number; x: number; z: number; value: number }
  | { type: 'hurt'; player: number; dmg: number; x: number; z: number }
  | { type: 'death'; player: number; x: number; z: number }
  | { type: 'chain'; count: number; x: number; z: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number };


export interface WorldOptions {
  /** Kampf aus: nur Bewegung (für Tests und Menü-Hintergründe) */
  combat?: boolean;
  /** Startwelle (Debug) */
  wave?: number;
  /** Spieler nimmt keinen Schaden (Debug) */
  god?: boolean;
}

interface ChainSlot { group: number; count: number; t: number }

/**
 * Die Spielwelt. Läuft mit festem Tick, deterministisch und ohne DOM –
 * im Browser, im Web Worker, in Node oder später auf einem Server.
 */
export class World {
  readonly arena: Arena;
  rng: Rng;
  tick = 0;
  players: Player[] = [];
  /** Ereignisse dieses Ticks; Effekte im Renderer entstehen nur hieraus */
  readonly events: SimEvent[] = [];

  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  readonly crystals: Crystal[] = [];
  readonly blasts: Blast[] = [];
  readonly warnings: Warning[] = [];
  readonly barrels: Prop[];
  readonly hash: SpatialHash;

  phase: Phase = 'welle';
  wave = 0;
  waveTime = 0;
  pauseTime = 0;
  spawnAcc = 0;
  enemyCount = 0;
  nextId = 1;
  nextGroup = 1;
  /** Kettengruppe für die große Wellenende-Explosion */
  doomGroup = 0;
  readonly stats = { kills: 0, maxChain: 0, explosions: 0, damage: 0, crystals: 0 };
  readonly opt: Required<WorldOptions>;

  private chains: ChainSlot[] = [];
  private scratch = new Int32Array(MAX_ENEMIES);
  private readonly seed: number;
  private readonly playerCount: number;

  constructor(seed = 1337, playerCount = 1, opt: WorldOptions = {}) {
    this.seed = seed;
    this.playerCount = playerCount;
    this.opt = { combat: opt.combat ?? true, wave: opt.wave ?? 1, god: opt.god ?? false };
    this.arena = createArena(seed);
    this.rng = new Rng(seed ^ 0x5eed);
    this.barrels = this.arena.props.filter((p) => p.kind === 'barrel');
    this.hash = new SpatialHash(this.arena.size, 2, MAX_ENEMIES);
    for (let i = 0; i < MAX_ENEMIES; i++) this.enemies.push(makeEnemy(i, GEGNER[0]));
    for (let i = 0; i < MAX_PROJECTILES; i++) this.projectiles.push(makeProjectile());
    for (let i = 0; i < MAX_CRYSTALS; i++) this.crystals.push(makeCrystal());
    for (let i = 0; i < MAX_BLASTS; i++) this.blasts.push(makeBlast());
    for (let i = 0; i < MAX_WARNINGS; i++) this.warnings.push(makeWarning());
    for (let i = 0; i < 8; i++) this.chains.push({ group: 0, count: 0, t: 99 });
    this.reset();
  }

  /** Neuer Run in derselben Arena (gleicher Seed → gleicher Ablauf). */
  reset(): void {
    this.rng = new Rng(this.seed ^ 0x5eed);
    this.tick = 0;
    this.events.length = 0;
    this.players = [];
    for (const e of this.enemies) e.alive = false;
    for (const p of this.projectiles) p.alive = false;
    for (const c of this.crystals) c.alive = false;
    for (const b of this.blasts) b.active = false;
    for (const w of this.warnings) w.active = false;
    for (const c of this.chains) { c.group = 0; c.count = 0; c.t = 99; }
    this.restoreBarrels();
    Object.assign(this.stats, { kills: 0, maxChain: 0, explosions: 0, damage: 0, crystals: 0 });
    this.enemyCount = 0;
    this.nextId = 1;
    this.nextGroup = 1;
    for (let i = 0; i < this.playerCount; i++) this.addPlayer();
    if (this.opt.combat) this.startWave(this.opt.wave);
    else { this.phase = 'pause'; this.pauseTime = Infinity; }
  }

  addPlayer(): Player {
    const i = this.players.length;
    const a = (i / 4) * Math.PI * 2;
    const p: Player = {
      id: i,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      x: this.arena.spawn.x + (i ? Math.cos(a) * 1.5 : 0),
      z: this.arena.spawn.z + (i ? Math.sin(a) * 1.5 : 0),
      vx: 0, vz: 0,
      facing: Math.PI * 0.25,
      dashTime: 0, dashCooldown: 0, dashDirX: 0, dashDirZ: 1,
      stride: 0,
      hp: SPIELER.maxHp, maxHp: SPIELER.maxHp, invuln: 0, alive: true, crystals: 0,
      weapons: []
    };
    if (this.opt.combat) {
      const ids = SPIELER.startWaffen;
      ids.forEach((id, k) => {
        // Waffen schweben im Halbkreis über/neben der Figur (Bildschirm: links, oben, rechts)
        const ang = Math.PI * 0.25 + Math.PI + ((k + 0.5) / ids.length - 0.5) * Math.PI * 1.3;
        p.weapons.push({
          waffe: W[id], cd: 0.3 + k * 0.17, aim: ang,
          ox: Math.sin(ang) * SPIELER.waffenAbstand, oz: Math.cos(ang) * SPIELER.waffenAbstand, target: -1
        });
      });
    }
    this.players.push(p);
    return p;
  }

  step(inputs: readonly InputState[]): void {
    this.events.length = 0;
    for (const e of this.enemies) if (e.alive) { e.px = e.x; e.pz = e.z; e.py = e.y; }
    for (const p of this.projectiles) if (p.alive) { p.px = p.x; p.py = p.y; p.pz = p.z; }
    for (const c of this.crystals) if (c.alive) { c.px = c.x; c.pz = c.z; }

    for (const p of this.players) if (p.alive) this.stepPlayer(p, inputs[p.id] ?? NO_INPUT);

    if (this.opt.combat) {
      if (this.phase === 'welle') {
        this.waveTime -= DT;
        stepWaves(this);
        if (this.waveTime <= 0) this.clearWave();
      } else if (this.phase === 'pause') {
        this.pauseTime -= DT;
        if (this.pauseTime <= 0) this.startWave(this.wave + 1);
      }

      this.hash.clear();
      for (const e of this.enemies) if (e.alive) this.hash.insert(e.slot, e.x, e.z);
      stepEnemies(this);
      if (this.phase !== 'ende') stepWeapons(this);
      stepProjectiles(this);
      this.stepBlasts();
      this.stepCrystals();
      for (const c of this.chains) c.t += DT;
    }
    this.tick++;
  }

  /* ---------------------------------------------------------------- */
  /* Wellen                                                             */
  /* ---------------------------------------------------------------- */

  startWave(n: number): void {
    this.wave = n;
    this.phase = 'welle';
    this.waveTime = WELLEN.dauer(n);
    this.spawnAcc = 1.6;
    this.restoreBarrels();
    for (const p of this.players) if (p.alive) p.hp = p.maxHp;
    this.events.push({ type: 'waveStart', wave: n });
  }

  /** Welle vorbei: alle Gegner explodieren nacheinander – vom Spieler aus nach außen. */
  clearWave(): void {
    this.phase = 'pause';
    this.pauseTime = WELLEN.pause;
    this.doomGroup = this.nextGroup++;
    const p = this.players.find((q) => q.alive) ?? this.players[0];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = p ? Math.hypot(e.x - p.x, e.z - p.z) : 0;
      e.doom = 0.3 + d * 0.045 + this.rng.next() * 0.12;
    }
    for (const w of this.warnings) w.active = false;
    for (const pr of this.projectiles) if (pr.alive && pr.hostile) { pr.alive = false; this.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: true }); }
    for (const c of this.crystals) if (c.alive) c.magnet = true;
    this.events.push({ type: 'waveClear', wave: this.wave });
  }

  private restoreBarrels(): void {
    for (const b of this.barrels) { b.broken = false; b.r = BARREL_RADIUS; }
  }

  /* ---------------------------------------------------------------- */
  /* Spieler                                                            */
  /* ---------------------------------------------------------------- */

  private stepPlayer(p: Player, inp: InputState): void {
    let mx = inp.mx, mz = inp.mz;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    p.invuln = Math.max(0, p.invuln - DT);
    p.dashCooldown = Math.max(0, p.dashCooldown - DT);
    if (inp.dash && p.dashCooldown <= 0 && p.dashTime <= 0) {
      let dx = mx, dz = mz;
      if (Math.hypot(dx, dz) < 0.2) { dx = Math.sin(p.facing); dz = Math.cos(p.facing); }
      const dl = Math.hypot(dx, dz) || 1;
      p.dashDirX = dx / dl; p.dashDirZ = dz / dl;
      p.dashTime = DASH_TIME;
      p.dashCooldown = DASH_COOLDOWN;
      this.events.push({ type: 'dash', player: p.id, x: p.x, z: p.z, dirX: p.dashDirX, dirZ: p.dashDirZ });
    }

    if (p.dashTime > 0) {
      p.dashTime -= DT;
      p.vx = p.dashDirX * DASH_SPEED;
      p.vz = p.dashDirZ * DASH_SPEED;
    } else {
      const tx = mx * MOVE_SPEED, tz = mz * MOVE_SPEED;
      const k = Math.min(1, ACCEL * DT / MOVE_SPEED);
      p.vx += (tx - p.vx) * k;
      p.vz += (tz - p.vz) * k;
      if (len < 0.05 && Math.hypot(p.vx, p.vz) < 0.05) { p.vx = 0; p.vz = 0; }
    }

    const speed = Math.hypot(p.vx, p.vz);
    if (speed > 0.3) {
      const target = Math.atan2(p.vx, p.vz);
      let d = target - p.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.facing += d * Math.min(1, DT * 18);
    }

    const ox = p.x, oz = p.z;
    // Bewegung in Teilschritten, damit der Dash nicht durch Wände tunnelt
    const sub = Math.max(1, Math.ceil((speed * DT) / 0.15));
    let bumped = false;
    for (let s = 0; s < sub; s++) {
      p.x += (p.vx * DT) / sub;
      p.z += (p.vz * DT) / sub;
      bumped = this.collideCircle(p, PLAYER_RADIUS, true) || bumped;
    }
    if (bumped && p.dashTime > 0) {
      p.dashTime = 0;
      this.events.push({ type: 'bump', player: p.id, x: p.x, z: p.z });
    }

    const moved = Math.hypot(p.x - ox, p.z - oz);
    const before = Math.floor(p.stride / 0.9);
    p.stride += moved;
    if (p.dashTime <= 0 && Math.floor(p.stride / 0.9) !== before) {
      this.events.push({ type: 'step', player: p.id, x: p.x, z: p.z });
    }
  }

  /** Schaden am Spieler. Dash und Schutzzeit machen unverwundbar. */
  hurtPlayer(p: Player, dmg: number, fromX: number, fromZ: number): void {
    if (!p.alive || p.invuln > 0 || p.dashTime > 0 || this.phase !== 'welle') return;
    if (!this.opt.god) p.hp -= dmg;
    p.invuln = SPIELER.schutzzeit;
    const dx = p.x - fromX, dz = p.z - fromZ, d = Math.hypot(dx, dz) || 1;
    p.vx += (dx / d) * 7; p.vz += (dz / d) * 7;
    this.events.push({ type: 'hurt', player: p.id, dmg, x: p.x, z: p.z });
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this.events.push({ type: 'death', player: p.id, x: p.x, z: p.z });
      if (!this.players.some((q) => q.alive)) this.phase = 'ende';
    }
  }

  nearestPlayer(x: number, z: number): Player | null {
    let best: Player | null = null, bd = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Nächster angreifbarer Gegner im Radius oder -1. */
  nearestEnemy(x: number, z: number, range: number, skipId = -1): number {
    let best = -1, bd = range * range;
    for (const e of this.enemies) {
      if (!e.alive || e.doom >= 0 || e.id === skipId) continue;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) { bd = d; best = e.slot; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- */
  /* Schaden, Tod, Explosionen                                          */
  /* ---------------------------------------------------------------- */

  newGroup(): number {
    return this.nextGroup++;
  }

  damageEnemy(e: Enemy, dmg: number, crit: boolean, kbx: number, kbz: number, chain = 0, group = 0): void {
    if (!e.alive || e.doom >= 0) return;
    e.hp -= dmg;
    e.flash = 0.12;
    e.kbx += kbx / e.def.masse;
    e.kbz += kbz / e.def.masse;
    this.stats.damage += dmg;
    this.events.push({ type: 'hit', id: e.id, x: e.x, y: e.y + 0.9, z: e.z, dmg: Math.round(dmg), crit });
    if (e.hp <= 0) this.killEnemy(e, chain, group, false);
  }

  /** Gegner stirbt. Bomben-Kröten nehmen ihre Umgebung mit – so entstehen Ketten. */
  killEnemy(e: Enemy, chain: number, group: number, selfDestruct: boolean): void {
    if (!e.alive) return;
    e.alive = false;
    this.enemyCount--;
    this.stats.kills++;
    this.events.push({ type: 'kill', id: e.id, enemy: e.def.id, x: e.x, z: e.z, doomed: e.doom >= 0 });
    for (let i = 0; i < e.def.kristalle; i++) this.spawnCrystal(e.x, e.z, 1);
    if (e.def.verhalten === 'kamikaze' && !selfDestruct && e.doom < 0) {
      const g = group || this.newGroup();
      this.queueBlast(e.x, e.z, e.def.explosionsRadius ?? 1.8, (e.def.explosionsSchaden ?? 15) * 1.5, KAMPF.kettenVerzoegerung, group ? chain + 1 : 0, g, false, 'kroete');
    }
  }

  /** Wellenende: Gegner zerplatzt ohne Schaden für den Spieler, aber Fässer gehen mit hoch. */
  doomEnemy(e: Enemy): void {
    const x = e.x, z = e.z;
    this.killEnemy(e, 1, this.doomGroup, true);
    this.queueBlast(x, z, 1.3, 0, 0, 1, this.doomGroup, false, 'welle');
  }

  queueBlast(x: number, z: number, r: number, dmg: number, delay: number, chain: number, group: number, hurtsPlayer: boolean, source: BlastSource): void {
    for (const b of this.blasts) {
      if (b.active) continue;
      b.active = true;
      b.x = x; b.z = z; b.r = r; b.dmg = dmg; b.delay = delay;
      b.chain = chain; b.group = group; b.hurtsPlayer = hurtsPlayer; b.source = source;
      return;
    }
    // Pool voll: Explosion fällt aus – lieber zusammenfassen als ruckeln
  }

  breakBarrel(b: Prop, chain: number, group: number): void {
    if (b.broken) return;
    b.broken = true;
    b.r = 0;
    this.queueBlast(b.x, b.z, KAMPF.fassRadius, KAMPF.fassSchaden, group ? KAMPF.kettenVerzoegerung : 0, group ? chain + 1 : 0, group || this.newGroup(), false, 'fass');
  }

  private stepBlasts(): void {
    for (const b of this.blasts) {
      if (!b.active) continue;
      b.delay -= DT;
      if (b.delay <= 0) {
        b.active = false;
        this.detonate(b);
      }
    }
  }

  private detonate(b: Blast): void {
    this.stats.explosions++;
    this.events.push({ type: 'explosion', x: b.x, z: b.z, r: b.r, chain: b.chain, source: b.source });
    this.registerChain(b.group, b.x, b.z);

    if (b.dmg > 0) {
      const n = this.hash.query(b.x, b.z, b.r + 0.6);
      this.scratch.set(this.hash.result.subarray(0, n));
      for (let i = 0; i < n; i++) {
        const e = this.enemies[this.scratch[i]];
        if (!e.alive) continue;
        const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz);
        if (d > b.r + e.r) continue;
        const k = Math.min(1, d / b.r);
        const dmg = b.dmg * (1 - k * (1 - KAMPF.randSchaden));
        const push = 3 + 6 * (1 - k);
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        this.damageEnemy(e, dmg, false, nx * push, nz * push, b.chain, b.group);
      }
    }
    for (const bar of this.barrels) {
      if (!bar.broken && Math.hypot(bar.x - b.x, bar.z - b.z) < b.r + BARREL_RADIUS) this.breakBarrel(bar, b.chain, b.group);
    }
    if (b.hurtsPlayer) {
      for (const p of this.players) if (Math.hypot(p.x - b.x, p.z - b.z) < b.r * 0.85 + PLAYER_RADIUS) this.hurtPlayer(p, b.dmg, b.x, b.z);
    }
    // Kristalle fliegen durch die Druckwelle
    for (const c of this.crystals) {
      if (!c.alive) continue;
      const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r * 1.5 && d > 1e-4) { c.vx += (dx / d) * 4; c.vz += (dz / d) * 4; }
    }
  }

  private registerChain(group: number, x: number, z: number): void {
    let slot = this.chains[0];
    let found = false;
    for (const c of this.chains) if (c.group === group) { slot = c; found = true; break; }
    if (!found) {
      for (const c of this.chains) if (c.t > slot.t) slot = c;
      slot.group = group; slot.count = 0;
    }
    slot.count++;
    slot.t = 0;
    if (slot.count >= KAMPF.kettenAnzeige) {
      this.events.push({ type: 'chain', count: slot.count, x, z });
      if (slot.count > this.stats.maxChain) this.stats.maxChain = slot.count;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Kristalle                                                          */
  /* ---------------------------------------------------------------- */

  spawnCrystal(x: number, z: number, value: number): void {
    const a = this.rng.next() * Math.PI * 2, s = 1.5 + this.rng.next() * 2.5;
    for (const c of this.crystals) {
      if (c.alive) continue;
      c.alive = true;
      c.x = c.px = x; c.z = c.pz = z;
      c.vx = Math.cos(a) * s; c.vz = Math.sin(a) * s;
      c.value = value; c.age = 0;
      c.magnet = this.phase !== 'welle';
      return;
    }
    // Pool voll: Wert auf einen vorhandenen Kristall packen
    const c = this.crystals[Math.floor(this.rng.next() * this.crystals.length)];
    c.value += value;
  }

  private stepCrystals(): void {
    const drag = Math.pow(0.04, DT);
    for (const c of this.crystals) {
      if (!c.alive) continue;
      c.age += DT;
      const p = this.nearestPlayer(c.x, c.z);
      if (p) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
        if (d < SPIELER.sammelRadius) {
          c.alive = false;
          p.crystals += c.value;
          this.stats.crystals += c.value;
          this.events.push({ type: 'pickup', player: p.id, x: c.x, z: c.z, value: c.value });
          continue;
        }
        if (c.age > 0.35 && (c.magnet || d < SPIELER.magnetRadius)) {
          const sp = c.magnet ? 13 : 9;
          const k = Math.min(1, DT * 9);
          c.vx += ((dx / d) * sp - c.vx) * k;
          c.vz += ((dz / d) * sp - c.vz) * k;
        } else {
          c.vx *= drag; c.vz *= drag;
        }
      } else {
        c.vx *= drag; c.vz *= drag;
      }
      c.x += c.vx * DT;
      c.z += c.vz * DT;
      if (!c.magnet) this.collideCircle(c, 0.12, false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Kollision                                                          */
  /* ---------------------------------------------------------------- */

  /** Schiebt einen Kreis aus festen Kacheln (und optional Fässern). true = es gab eine Kollision. */
  collideCircle(o: { x: number; z: number }, r: number, props: boolean): boolean {
    const a = this.arena;
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      const x0 = Math.floor(o.x - r), x1 = Math.floor(o.x + r);
      const z0 = Math.floor(o.z - r), z1 = Math.floor(o.z + r);
      for (let tz = z0; tz <= z1; tz++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (!a.isSolidTile(tx, tz)) continue;
          const cx = Math.max(tx, Math.min(o.x, tx + 1));
          const cz = Math.max(tz, Math.min(o.z, tz + 1));
          const dx = o.x - cx, dz = o.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          if (d < 1e-6) {
            // Mittelpunkt steckt in der Kachel: über die nächste Kante hinausschieben
            const left = o.x - tx, right = tx + 1 - o.x, top = o.z - tz, bottom = tz + 1 - o.z;
            const m = Math.min(left, right, top, bottom);
            if (m === left) o.x = tx - r;
            else if (m === right) o.x = tx + 1 + r;
            else if (m === top) o.z = tz - r;
            else o.z = tz + 1 + r;
          } else {
            const push = r - d;
            o.x += (dx / d) * push; o.z += (dz / d) * push;
          }
          pushed = hit = true;
        }
      }
      if (props) {
        for (const p of a.props) {
          if (p.r <= 0) continue;
          const dx = o.x - p.x, dz = o.z - p.z, min = r + p.r, d = Math.hypot(dx, dz);
          if (d < min && d > 1e-6) { o.x += (dx / d) * (min - d); o.z += (dz / d) * (min - d); pushed = hit = true; }
        }
      }
      if (!pushed) break;
    }
    return hit;
  }

  /** Ist der Punkt in einer festen Kachel? */
  solidAt(x: number, z: number): boolean {
    return this.arena.isSolidTile(Math.floor(x), Math.floor(z));
  }

  /** Kompakter Zustand für Netzwerk-Snapshots und Tests. */
  snapshot(): string {
    const f = (v: number) => v.toFixed(4);
    return JSON.stringify({
      t: this.tick,
      ph: this.phase, w: this.wave,
      p: this.players.map((p) => [f(p.x), f(p.z), f(p.facing), f(p.hp), p.crystals]),
      e: this.enemies.filter((e) => e.alive).map((e) => [e.type, f(e.x), f(e.z), f(e.hp)]),
      s: this.stats
    });
  }
}
