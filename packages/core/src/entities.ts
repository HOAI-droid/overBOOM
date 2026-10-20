import type { GegnerDef, Waffe } from '../../data/src/index.ts';

/** Feste Pool-Größen – alles wird beim Start angelegt, im Spiel nur wiederverwendet. */
export const MAX_ENEMIES = 200;
export const MAX_PROJECTILES = 512;
export const MAX_CRYSTALS = 320;
export const MAX_BLASTS = 160;
export const MAX_WARNINGS = 48;

export const EnemyState = { Walk: 0, Windup: 1, Jump: 2, Aim: 3 } as const;

/** Dauer des Kröten-Sprungs in s */
export const JUMP_TIME = 0.5;

export interface Enemy {
  slot: number;
  /** fortlaufende, eindeutige Nummer (für Schadenszahlen usw.) */
  id: number;
  alive: boolean;
  def: GegnerDef;
  /** Index in GEGNER */
  type: number;
  x: number; z: number; y: number;
  /** Position im vorigen Tick (für Interpolation im Renderer) */
  px: number; pz: number; py: number;
  vx: number; vz: number;
  /** Rückstoß-Geschwindigkeit, klingt ab */
  kbx: number; kbz: number;
  r: number;
  hp: number;
  maxHp: number;
  facing: number;
  /** Treffer-Blitz (s) */
  flash: number;
  age: number;
  state: number;
  stateT: number;
  /** Abklingzeit für Angriffe */
  cd: number;
  jx0: number; jz0: number; jx1: number; jz1: number;
  /** ≥ 0: Countdown bis zur Wellenende-Explosion */
  doom: number;
  /** Seitwärts-Richtung beim Umkreisen (±1) */
  strafe: number;
}

export interface Projectile {
  alive: boolean;
  /** Geschoss eines Gegners (trifft Spieler) */
  hostile: boolean;
  player: number;
  geschoss: string;
  antrieb: string;
  ladung: string;
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
  vx: number; vz: number;
  speed: number;
  dmg: number;
  crit: boolean;
  /** Ziel (Pool-Slot) und dessen id, damit ein wiederverwendeter Slot nicht verfolgt wird */
  target: number;
  targetId: number;
  life: number;
  t: number;
  dur: number;
  sx: number; sz: number;
  tx: number; tz: number;
  r: number;
}

export interface Crystal {
  alive: boolean;
  x: number; z: number;
  px: number; pz: number;
  vx: number; vz: number;
  value: number;
  age: number;
  /** fliegt unabhängig von der Distanz zum Spieler */
  magnet: boolean;
}

export type BlastSource = 'waffe' | 'fass' | 'kroete' | 'welle';

/** Explosion, die nach `delay` Sekunden zündet (Ketten laufen so sichtbar nacheinander ab). */
export interface Blast {
  active: boolean;
  x: number; z: number;
  r: number;
  dmg: number;
  delay: number;
  chain: number;
  group: number;
  hurtsPlayer: boolean;
  source: BlastSource;
}

/** Rotes Kreuz am Boden: hier erscheint gleich ein Gegner. */
export interface Warning {
  active: boolean;
  x: number; z: number;
  t: number;
  type: number;
}

export interface WeaponSlot {
  waffe: Waffe;
  cd: number;
  /** Zielrichtung in Radiant, 0 = +z */
  aim: number;
  /** feste Position relativ zur Figur */
  ox: number; oz: number;
  /** Ziel-Slot oder -1 */
  target: number;
}

export function makeEnemy(slot: number, def: GegnerDef): Enemy {
  return {
    slot, id: 0, alive: false, def, type: 0,
    x: 0, z: 0, y: 0, px: 0, pz: 0, py: 0, vx: 0, vz: 0, kbx: 0, kbz: 0,
    r: def.radius, hp: 0, maxHp: 0, facing: 0, flash: 0, age: 0,
    state: 0, stateT: 0, cd: 0, jx0: 0, jz0: 0, jx1: 0, jz1: 0, doom: -1, strafe: 1
  };
}

export function makeProjectile(): Projectile {
  return {
    alive: false, hostile: false, player: 0, geschoss: '', antrieb: '', ladung: '',
    x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vz: 0, speed: 0, dmg: 0, crit: false,
    target: -1, targetId: 0, life: 0, t: 0, dur: 0, sx: 0, sz: 0, tx: 0, tz: 0, r: 0.15
  };
}

export function makeCrystal(): Crystal {
  return { alive: false, x: 0, z: 0, px: 0, pz: 0, vx: 0, vz: 0, value: 1, age: 0, magnet: false };
}

export function makeBlast(): Blast {
  return { active: false, x: 0, z: 0, r: 0, dmg: 0, delay: 0, chain: 0, group: 0, hurtsPlayer: false, source: 'waffe' };
}

export function makeWarning(): Warning {
  return { active: false, x: 0, z: 0, t: 0, type: 0 };
}
