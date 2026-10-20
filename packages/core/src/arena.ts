import { Rng } from './rng.ts';

/** Kachel-Typen der Arena. Koordinaten: Kachel (x, z) belegt [x, x+1) × [z, z+1). */
export const Tile = {
  Floor: 0,
  Moss: 1,
  Lava: 2,
  Wall: 3,
  Pillar: 4,
  Crate: 5,
  /** spiegelglatt (Frostfass) */
  Ice: 6,
  /** Gifttümpel: verlangsamt und schadet (Pilzmoor) */
  Poison: 7,
  /** Tesla-Platte: lädt sich auf und entlädt sich (Funkenschlund) */
  Shock: 8
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

export type PropKind = 'barrel' | 'crystal' | 'torch' | 'rubble' | 'heu';

/** Arena-Gefahr der Insel (siehe data/islands.ts) */
export type ArenaStyle = 'heu' | 'strom' | 'schrott' | 'gift' | 'lava' | 'eis' | 'festung';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  /** Höhe, auf der das Objekt steht (Fackeln sitzen auf Mauern) */
  y: number;
  /** Kollisionsradius; 0 = nicht fest */
  r: number;
  seed: number;
  /** zerstört (explosive Fässer); kommt mit der nächsten Welle zurück */
  broken?: boolean;
}

export interface Arena {
  size: number;
  seed: number;
  style: ArenaStyle;
  tiles: Uint8Array;
  heights: Uint8Array;
  props: Prop[];
  spawn: { x: number; z: number };
  tile(x: number, z: number): TileId;
  height(x: number, z: number): number;
  isSolidTile(x: number, z: number): boolean;
}

export function createArena(seed: number, style: ArenaStyle = 'festung', size = 28): Arena {
  const rng = new Rng(seed);
  const tiles = new Uint8Array(size * size);
  const heights = new Uint8Array(size * size);
  const idx = (x: number, z: number) => z * size + x;
  const c = size / 2;

  const blocked = (x: number, z: number) => Math.abs(x - c) < 3.5 && Math.abs(z - c) < 3.5;
  /** Klecks aus Spezialboden (nicht in der Mitte, nicht auf festen Kacheln) */
  const blob = (cx: number, cz: number, r: number, t: number, fill = 0.85) => {
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 2 || z < 2 || x > size - 3 || z > size - 3 || blocked(x, z)) continue;
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d < r && (d < r - 1 || rng.chance(fill))) tiles[idx(x, z)] = t;
    }
  };

  // Grundboden mit Moosfleck (auf Gackerfeld: Wiese)
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const mx = x - 5, mz = z - 8;
      const grass = style === 'heu' ? rng.chance(0.55) : style === 'gift' ? rng.chance(0.25) : false;
      tiles[idx(x, z)] = grass || (mx * mx + mz * mz < 16 && rng.chance(0.75)) ? Tile.Moss : Tile.Floor;
    }
  }

  // Hintere Mauern (Norden = z 0, Westen = x 0); vordere Ränder sind Klippen
  for (let i = 0; i < size; i++) {
    const tower = i % 6 === 3;
    const h1 = tower ? 4 : rng.int(2, 3);
    const h2 = tower ? 4 : rng.int(2, 3);
    tiles[idx(i, 0)] = Tile.Wall; heights[idx(i, 0)] = h1;
    tiles[idx(0, i)] = Tile.Wall; heights[idx(0, i)] = h2;
  }

  // Inselgefahren
  if (style === 'festung' || style === 'lava') {
    for (let z = 3; z <= 11; z++) { tiles[idx(20, z)] = Tile.Lava; tiles[idx(21, z)] = Tile.Lava; }
    for (let x = 3; x <= 9; x++) { tiles[idx(x, 20)] = Tile.Lava; tiles[idx(x, 21)] = Tile.Lava; }
  }
  if (style === 'lava') { blob(6, 6, 2.2, Tile.Lava); blob(22, 22, 2.4, Tile.Lava); blob(15, 4, 1.6, Tile.Lava); }
  if (style === 'eis') { blob(7, 7, 3.2, Tile.Ice, 0.9); blob(20, 8, 2.8, Tile.Ice, 0.9); blob(8, 20, 3, Tile.Ice, 0.9); blob(20, 20, 3.4, Tile.Ice, 0.9); blob(14, 14, 2.2, Tile.Ice, 1); }
  if (style === 'gift') { blob(6, 9, 2, Tile.Poison); blob(20, 6, 1.8, Tile.Poison); blob(9, 21, 2.2, Tile.Poison); blob(21, 19, 1.9, Tile.Poison); blob(14, 23, 1.4, Tile.Poison); }
  if (style === 'strom') {
    for (const [x, z] of [[5, 5], [20, 5], [5, 20], [21, 21], [12, 8], [8, 13], [18, 13], [13, 19]] as const) {
      for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) if (!blocked(x + dx, z + dz)) tiles[idx(x + dx, z + dz)] = Tile.Shock;
    }
  }

  // Säulen und Kisten, nicht in der Mitte (Rostgrat: zusätzliche Schrotthaufen)
  const pillars: [number, number, number][] = [[8, 8, 3], [19, 18, 2], [7, 15, 2], [17, 6, 3], [23, 23, 1], [13, 22, 2]];
  if (style === 'schrott') pillars.push([5, 11, 1], [11, 4, 2], [22, 11, 1], [16, 24, 2], [10, 18, 1], [24, 15, 2]);
  for (const [x, z, h] of pillars) { tiles[idx(x, z)] = Tile.Pillar; heights[idx(x, z)] = h; }
  const crates: [number, number, number][] = [[4, 23, 1], [5, 23, 2], [4, 24, 1], [23, 4, 1], [24, 4, 1], [24, 5, 2]];
  for (const [x, z, h] of crates) if (!blocked(x, z)) { tiles[idx(x, z)] = Tile.Crate; heights[idx(x, z)] = h; }

  const isSolid = (x: number, z: number) => { const t = tiles[idx(x, z)]; return t === Tile.Wall || t === Tile.Pillar || t === Tile.Crate || t === Tile.Lava; };
  const props: Prop[] = [];
  // Fackeln auf den Türmen
  for (let i = 3; i < size; i += 6) {
    props.push({ kind: 'torch', x: i + 0.5, z: 0.5, y: 4, r: 0, seed: i });
    props.push({ kind: 'torch', x: 0.5, z: i + 0.5, y: 4, r: 0, seed: i + 100 });
  }
  // Kristalle im Moos
  props.push({ kind: 'crystal', x: 4.6, z: 8.2, y: 0, r: 0.6, seed: 1 });
  props.push({ kind: 'crystal', x: 6.3, z: 9.6, y: 0, r: 0.45, seed: 2 });
  // Explosive Fässer (Rostgrat: viele Ölfässer, Gackerfeld: Heuballen)
  const barrels: [number, number][] = [[22.5, 15.4], [23.3, 16.2], [10.6, 5.5], [15.5, 24.4]];
  if (style === 'schrott') barrels.push([6.5, 12.5], [12.5, 5.5], [21.5, 12.5], [17.5, 22.5]);
  if (style === 'festung') barrels.push([4.5, 16.5], [16.5, 3.5]);
  if (style !== 'heu' && style !== 'eis') for (const [x, z] of barrels) {
    if (!isSolid(Math.floor(x), Math.floor(z))) props.push({ kind: 'barrel', x, z, y: 0, r: 0.3, seed: Math.floor(x * 10 + z) });
  }
  if (style === 'heu') {
    for (const [x, z] of [[6.5, 6.5], [7.4, 6.8], [21.5, 6.5], [6.5, 21.5], [21.5, 21.5], [22.4, 21.2], [11.5, 4.5], [4.5, 12.5], [23.5, 13.5], [13.5, 23.5]] as const) {
      props.push({ kind: 'heu', x, z, y: 0, r: 0.42, seed: Math.floor(x * 10 + z) });
    }
  }
  // Geröll
  for (let i = 0; i < 26; i++) {
    const x = rng.range(1.5, size - 1.5), z = rng.range(1.5, size - 1.5);
    if (!blocked(x, z)) props.push({ kind: 'rubble', x, z, y: 0, r: 0, seed: i });
  }

  const arena: Arena = {
    size,
    seed,
    style,
    tiles,
    heights,
    props,
    spawn: { x: c, z: c },
    tile(x, z) {
      if (x < 0 || z < 0 || x >= size || z >= size) return Tile.Wall;
      return tiles[idx(x, z)] as TileId;
    },
    height(x, z) {
      if (x < 0 || z < 0 || x >= size || z >= size) return 0;
      return heights[idx(x, z)];
    },
    isSolidTile(x, z) {
      if (x < 0 || z < 0 || x >= size - 1 || z >= size - 1) return true; // Klippenrand
      const t = tiles[idx(x, z)];
      return t === Tile.Wall || t === Tile.Pillar || t === Tile.Crate;
    }
  };
  return arena;
}
