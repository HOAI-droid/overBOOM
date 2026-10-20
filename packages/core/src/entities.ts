import type { GegnerDef, Waffe } from '../../data/src/index.ts';

/** Feste Pool-Größen – alles wird beim Start angelegt, im Spiel nur wiederverwendet. */
export const MAX_ENEMIES = 200;
export const MAX_PROJECTILES = 512;
export const MAX_CRYSTALS = 320;
export const MAX_BLASTS = 160;
export const MAX_WARNINGS = 48;
export const MAX_HAZARDS = 48;

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
  elite: boolean;
  /** Schaden-Multiplikator (Welle, Elite) */
  dmgMul: number;
  /** Verlangsamt (s) */
  slow: number;
  /** Betäubt (s) – keine Bewegung, keine Angriffe */
  stun: number;
  burnT: number;
  burnDps: number;
  poisonT: number;
  poisonDps: number;
  /** Tick-Uhr für Schaden über Zeit */
  dotClock: number;
  /** lässt doppelt Kristalle fallen */
  lucky: boolean;
  /** Boss: Phase 1/2 und Abklingzeit für Beschwörungen */
  bossPhase: number;
  summonCd: number;
  /** nass (s): Kettenblitze springen doppelt so weit */
  wet: number;
  /** Säure-Stapel: +5 % Schaden je Stapel */
  acid: number;
  acidT: number;
  /** Frost-Treffer; bei 3 friert der Gegner ein */
  frost: number;
  /** verwirrt (s): läuft ziellos, greift nicht an */
  confuse: number;
  /** verhühnert (s): harmloses Huhn */
  chicken: number;
  /** Laufrichtung, solange verwirrt */
  cdx: number; cdz: number;
  /** vergiftet von einer Giftwolken-Waffe → hinterlässt eine Pfütze */
  cloud: boolean;
  /** elektrisch geladen (s) – für Reaktionen */
  shockT: number;
  /** im Sog (s) – für Reaktionen */
  gravT: number;
  /** Pause zwischen zwei Reaktionen am selben Gegner */
  reactT: number;
  /** unterkühlt (s) – Eis-Zustand für Reaktionen */
  frostT: number;
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
  /** Waffe, die geschossen hat (für Statistik/MVP) */
  src: string;
  /** Explosionsradius-Multiplikator des Schützen */
  blastMul: number;
  /** wie viele Gegner es noch durchschlagen darf */
  pierce: number;
  lastHit: number;
  /** Waffen-Slot des Schützen (-1 = keiner), für Begleiter/Türme */
  slot: number;
  /** Sonderwirkungen (Bitmaske, siehe weapons.ts) */
  mask: number;
  instabil: number;
  /** übrige Abpraller/Hüpfer */
  bounces: number;
  /** Zustand (Bumerang: hin/zurück, Schwarm: warten/angreifen/zurück) */
  mode: number;
  /** Winkel und Radius (Orbit, Spirale, Schwarm) */
  ang: number;
  rad: number;
  /** Abklingzeit (Turm, Schwarm, Orbit-Treffer) */
  cd: number;
  /** Feuerintervall des Turms */
  rate: number;
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

export type BlastSource = 'waffe' | 'fass' | 'kroete' | 'welle' | 'boss' | 'weste' | 'kawumm' | 'reaktion' | 'nuke';

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
  src: string;
}

/** Rotes Kreuz am Boden: hier erscheint gleich ein Gegner. */
export interface Warning {
  active: boolean;
  x: number; z: number;
  t: number;
  type: number;
  elite: boolean;
}

export interface WeaponSlot {
  waffe: Waffe;
  /** Stufe 1–5 */
  tier: number;
  cd: number;
  /** Zielrichtung in Radiant, 0 = +z */
  aim: number;
  /** feste Position relativ zur Figur */
  ox: number; oz: number;
  /** Ziel-Slot oder -1 */
  target: number;
  /** Sonderwirkungen (Bitmaske) */
  mask: number;
}

/** Bodeneffekt: Lava- oder Giftpfütze, Schwerkraft-Sog */
export interface Hazard {
  active: boolean;
  kind: 'lava' | 'gift' | 'sog';
  x: number; z: number;
  r: number;
  t: number;
  max: number;
  dps: number;
  clock: number;
  src: string;
  /** Sog explodiert am Ende */
  implode: boolean;
  blastMul: number;
  /** feindlich: schadet Spielern statt Gegnern (Pilzling, Lavaklops, Boss-Sporen) */
  hostile: boolean;
}

export function makeHazard(): Hazard {
  return { active: false, kind: 'lava', x: 0, z: 0, r: 1, t: 0, max: 1, dps: 0, clock: 0, src: '', implode: false, blastMul: 1, hostile: false };
}

export function makeEnemy(slot: number, def: GegnerDef): Enemy {
  return {
    slot, id: 0, alive: false, def, type: 0,
    x: 0, z: 0, y: 0, px: 0, pz: 0, py: 0, vx: 0, vz: 0, kbx: 0, kbz: 0,
    r: def.radius, hp: 0, maxHp: 0, facing: 0, flash: 0, age: 0,
    state: 0, stateT: 0, cd: 0, jx0: 0, jz0: 0, jx1: 0, jz1: 0, doom: -1, strafe: 1,
    elite: false, dmgMul: 1, slow: 0, stun: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, dotClock: 0, lucky: false, bossPhase: 1, summonCd: 0,
    wet: 0, acid: 0, acidT: 0, frost: 0, confuse: 0, chicken: 0, cdx: 0, cdz: 0, cloud: false, shockT: 0, gravT: 0, reactT: 0, frostT: 0
  };
}

export function makeProjectile(): Projectile {
  return {
    alive: false, hostile: false, player: 0, geschoss: '', antrieb: '', ladung: '',
    x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vz: 0, speed: 0, dmg: 0, crit: false,
    target: -1, targetId: 0, life: 0, t: 0, dur: 0, sx: 0, sz: 0, tx: 0, tz: 0, r: 0.15,
    src: '', blastMul: 1, pierce: 0, lastHit: 0, slot: -1, mask: 0, instabil: 0, bounces: 0, mode: 0, ang: 0, rad: 0, cd: 0, rate: 1
  };
}

export function makeCrystal(): Crystal {
  return { alive: false, x: 0, z: 0, px: 0, pz: 0, vx: 0, vz: 0, value: 1, age: 0, magnet: false };
}

export function makeBlast(): Blast {
  return { active: false, x: 0, z: 0, r: 0, dmg: 0, delay: 0, chain: 0, group: 0, hurtsPlayer: false, source: 'waffe', src: '' };
}

export function makeWarning(): Warning {
  return { active: false, x: 0, z: 0, t: 0, type: 0, elite: false };
}

/** Ein Angebot im Shop */
export interface Offer {
  kind: 'waffe' | 'item';
  id: string;
  /** Stufe der Waffe bzw. Seltenheit des Items (1–4) */
  tier: number;
  price: number;
  locked: boolean;
  sold: boolean;
}

/** Ein Level-Up-Angebot */
export interface UpgradeOffer {
  id: string;
  /** Seltenheit 1–4 */
  tier: number;
}
