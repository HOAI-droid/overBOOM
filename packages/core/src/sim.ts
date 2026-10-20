import { createArena, type Arena } from './arena.ts';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

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
}

export type SimEvent =
  | { type: 'dash'; player: number; x: number; z: number; dirX: number; dirZ: number }
  | { type: 'step'; player: number; x: number; z: number }
  | { type: 'bump'; player: number; x: number; z: number };

export const PLAYER_RADIUS = 0.3;
export const MOVE_SPEED = 4.4;
export const ACCEL = 38;
export const DASH_SPEED = 15;
export const DASH_TIME = 0.17;
export const DASH_COOLDOWN = 0.75;

export const PLAYER_COLORS = ['#3de8ff', '#ff3df0', '#ffd23f', '#5dff7a'] as const;

/**
 * Die Spielwelt. Läuft mit festem Tick, deterministisch und ohne DOM –
 * im Browser, im Web Worker, in Node oder später auf einem Server.
 */
export class World {
  readonly arena: Arena;
  tick = 0;
  players: Player[] = [];
  events: SimEvent[] = [];

  constructor(seed = 1337, playerCount = 1) {
    this.arena = createArena(seed);
    for (let i = 0; i < playerCount; i++) this.addPlayer();
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
      stride: 0
    };
    this.players.push(p);
    return p;
  }

  step(inputs: readonly InputState[]): void {
    this.events = [];
    for (const p of this.players) this.stepPlayer(p, inputs[p.id] ?? NO_INPUT);
    this.tick++;
  }

  private stepPlayer(p: Player, inp: InputState): void {
    let mx = inp.mx, mz = inp.mz;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

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
      bumped = this.resolve(p) || bumped;
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

  /** Schiebt den Spieler aus festen Kacheln und Objekten. Gibt true zurück, wenn es eine Kollision gab. */
  private resolve(p: Player): boolean {
    const r = PLAYER_RADIUS, a = this.arena;
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r);
      const z0 = Math.floor(p.z - r), z1 = Math.floor(p.z + r);
      for (let tz = z0; tz <= z1; tz++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (!a.isSolidTile(tx, tz)) continue;
          const cx = Math.max(tx, Math.min(p.x, tx + 1));
          const cz = Math.max(tz, Math.min(p.z, tz + 1));
          const dx = p.x - cx, dz = p.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          if (d < 1e-6) {
            // Mittelpunkt steckt in der Kachel: über die nächste Kante hinausschieben
            const left = p.x - tx, right = tx + 1 - p.x, top = p.z - tz, bottom = tz + 1 - p.z;
            const m = Math.min(left, right, top, bottom);
            if (m === left) p.x = tx - r;
            else if (m === right) p.x = tx + 1 + r;
            else if (m === top) p.z = tz - r;
            else p.z = tz + 1 + r;
          } else {
            const push = r - d;
            p.x += (dx / d) * push; p.z += (dz / d) * push;
          }
          pushed = hit = true;
        }
      }
      for (const o of a.props) {
        if (o.r <= 0) continue;
        const dx = p.x - o.x, dz = p.z - o.z, min = r + o.r, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-6) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); pushed = hit = true; }
      }
      if (!pushed) break;
    }
    return hit;
  }

  /** Kompakter Zustand für Netzwerk-Snapshots und Tests. */
  snapshot(): string {
    return JSON.stringify({ t: this.tick, p: this.players.map((p) => [p.x.toFixed(4), p.z.toFixed(4), p.facing.toFixed(4)]) });
  }
}
