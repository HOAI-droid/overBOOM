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

/** Abstand der Boss-Spawns von der Mitte (siehe enemies.ts spawnBoss) */
const BOSS_RING = 7;

/**
 * Baut die Arena einer Insel prozedural aus dem Seed: gleicher Seed → gleiche Arena
 * (wichtig für Koop – Host und Clients bauen sie nach). Der Stil bestimmt die Gefahren.
 * Garantien: Mitte frei, alles Begehbare von der Mitte aus erreichbar, zwischen
 * Hindernissen mindestens 2 Kacheln Platz, genug freie Boss-Spawnpunkte.
 */
export function createArena(seed: number, style: ArenaStyle = 'festung', size = 28): Arena {
  // Stil mit in den Seed mischen, damit verschiedene Inseln mit gleichem Seed nicht gleich aussehen
  let mix = seed >>> 0;
  for (let k = 0; k < style.length; k++) mix = Math.imul(mix ^ style.charCodeAt(k), 0x9e3779b1) >>> 0;
  const rng = new Rng(mix ^ (mix >>> 15));
  const N = size * size;
  const tiles = new Uint8Array(N);
  const heights = new Uint8Array(N);
  const idx = (x: number, z: number) => z * size + x;
  const c = size / 2;
  /** feste Hindernisse nur in diesem Bereich: 2 Kacheln Rand zu Mauer und Klippe bleiben frei */
  const LO = 3, HI = size - 4;

  const blocked = (x: number, z: number) => Math.abs(x - c) < 3.5 && Math.abs(z - c) < 3.5;
  /** Chebyshev-Abstand der Kachelmitte zur Arenamitte */
  const centerDist = (x: number, z: number) => Math.max(Math.abs(x + 0.5 - c), Math.abs(z + 0.5 - c));
  /** fest zum Laufen (Lava zählt mit, auch wenn man mit Dash darüber kommt) */
  const solidI = (i: number) => { const t = tiles[i]; return t === Tile.Wall || t === Tile.Pillar || t === Tile.Crate || t === Tile.Lava; };
  const isSolid = (x: number, z: number) => solidI(idx(x, z));
  /** wie isSolidTile: Mauern, Säulen, Kisten und der Klippenrand */
  const hard = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= size - 1 || z >= size - 1) return true;
    const t = tiles[idx(x, z)];
    return t === Tile.Wall || t === Tile.Pillar || t === Tile.Crate;
  };
  const plain = (x: number, z: number) => { const t = tiles[idx(x, z)]; return t === Tile.Floor || t === Tile.Moss; };

  // --- Prüfungen ---------------------------------------------------------------
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  /** Begehbare Kacheln, die von der Mitte aus nicht erreichbar sind (Flood-Fill, 4er-Nachbarschaft) */
  const unreachable = (): number[] => {
    seen.fill(0);
    let sp = 0;
    const s0 = idx(Math.floor(c), Math.floor(c));
    seen[s0] = 1; stack[sp++] = s0;
    while (sp > 0) {
      const i = stack[--sp], x = i % size, z = (i - x) / size;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), nz = z + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 1 || nz < 1 || nx > size - 2 || nz > size - 2) continue;
        const j = idx(nx, nz);
        if (seen[j] || solidI(j)) continue;
        seen[j] = 1; stack[sp++] = j;
      }
    }
    const out: number[] = [];
    for (let z = 1; z <= size - 2; z++) for (let x = 1; x <= size - 2; x++) {
      const j = idx(x, z);
      if (!seen[j] && !solidI(j)) out.push(j);
    }
    return out;
  };
  /** Mindestens die Hälfte der möglichen Boss-Spawnpunkte (Ring um die Mitte) bleibt frei */
  const ringOk = () => {
    let free = 0;
    const n = 48;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = c + Math.cos(a) * BOSS_RING, z = c + Math.sin(a) * BOSS_RING;
      const tx = Math.floor(x), tz = Math.floor(z), t = tiles[idx(tx, tz)];
      if (hard(tx, tz) || t === Tile.Lava || t === Tile.Poison) continue;
      if (hard(Math.floor(x + 0.8), tz) || hard(Math.floor(x - 0.8), tz) || hard(tx, Math.floor(z + 0.8)) || hard(tx, Math.floor(z - 0.8))) continue;
      free++;
    }
    return free >= n / 2;
  };

  /**
   * Setzt ein festes Hindernis (Zellen einer Gruppe). Abgelehnt, wenn es in die Mitte/den Rand
   * ragt, näher als 2 Kacheln an anderen Hindernissen steht oder Bereiche abschneidet.
   * Kleine Löcher im Hindernis (z. B. in einem Lavaklecks) werden mit aufgefüllt.
   */
  const place = (cells: number[], t: TileId, hs: number[]): boolean => {
    if (cells.length === 0) return false;
    const own = new Set(cells);
    if (own.size !== cells.length) return false;
    let x0 = size, x1 = 0, z0 = size, z1 = 0;
    for (const i of cells) {
      const x = i % size, z = (i - x) / size;
      if (x < LO || z < LO || x > HI || z > HI || blocked(x, z) || solidI(i)) return false;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
        const j = idx(nx, nz);
        if (!own.has(j) && solidI(j)) return false;
      }
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const changed = cells.slice();
    const prevT = cells.map((i) => tiles[i]), prevH = cells.map((i) => heights[i]);
    cells.forEach((i, k) => { tiles[i] = t; heights[i] = hs[k] ?? hs[0]; });
    let lost = unreachable();
    if (lost.length > 0 && lost.length <= 4 && lost.every((j) => { const x = j % size, z = (j - x) / size; return x >= x0 && x <= x1 && z >= z0 && z <= z1; })) {
      for (const j of lost) { changed.push(j); prevT.push(tiles[j]); prevH.push(heights[j]); tiles[j] = t; heights[j] = hs[0]; }
      lost = unreachable();
    }
    if (lost.length > 0 || !ringOk()) {
      changed.forEach((i, k) => { tiles[i] = prevT[k]; heights[i] = prevH[k]; });
      return false;
    }
    return true;
  };

  /** Zellen eines runden Kleckses mit ausgefranstem Rand */
  const blobCells = (cx: number, cz: number, r: number, fill: number, lo: number, hi: number): number[] => {
    const out: number[] = [];
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < lo || z < lo || x > hi || z > hi || blocked(x, z)) continue;
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d < r && (d < r - 1 || rng.chance(fill))) out.push(idx(x, z));
    }
    if (out.length === 0) return out;
    // nur das zusammenhängende Stück um die Mitte behalten (keine losen Einzelkacheln mit Engstellen)
    const rest = new Set(out);
    let best = out[0], bd = Infinity;
    for (const i of out) { const d = Math.hypot((i % size) + 0.5 - cx, Math.floor(i / size) + 0.5 - cz); if (d < bd) { bd = d; best = i; } }
    const keep = [best];
    rest.delete(best);
    for (let k = 0; k < keep.length; k++) {
      const i = keep[k];
      for (const j of [i + 1, i - 1, i + size, i - size]) if (rest.has(j) && Math.abs((j % size) - (i % size)) <= 1) { rest.delete(j); keep.push(j); }
    }
    return keep;
  };
  /** Spezialboden auf freie Bodenkacheln malen; gibt die gemalten Kacheln zurück */
  const paint = (cells: number[], t: TileId): number[] => {
    const done: number[] = [];
    for (const i of cells) if (tiles[i] === Tile.Floor) { tiles[i] = t; done.push(i); }
    return done;
  };
  const count = (t: TileId) => { let n = 0; for (let i = 0; i < N; i++) if (tiles[i] === t) n++; return n; };

  // --- Hintere Mauern (Norden = z 0, Westen = x 0) mit Türmen; vordere Ränder sind Klippen ---
  const towers = (): number[] => {
    const out: number[] = [];
    for (let i = rng.int(2, 4); i < size; i += rng.int(5, 7)) out.push(i);
    return out;
  };
  const towersN = towers(), towersW = towers();
  for (let i = 0; i < size; i++) {
    tiles[idx(i, 0)] = Tile.Wall; heights[idx(i, 0)] = towersN.includes(i) ? 4 : rng.int(2, 3);
    tiles[idx(0, i)] = Tile.Wall; heights[idx(0, i)] = towersW.includes(i) ? 4 : rng.int(2, 3);
  }
  heights[idx(0, 0)] = rng.int(2, 3);

  // --- Lavagräben (Festung, Lavakessel): gerade, 2 breit, mit Abstand zur Mitte ---
  if (style === 'festung' || style === 'lava') {
    let trenches = 0;
    for (let tries = 0; tries < 200 && trenches < 2; tries++) {
      const len = rng.int(style === 'festung' ? 6 : 5, 9), horizontal = rng.chance(0.5);
      const w = horizontal ? len : 2, h = horizontal ? 2 : len;
      const x0 = rng.int(LO, HI - w + 1), z0 = rng.int(LO, HI - h + 1);
      const cells: number[] = [];
      let near = false;
      for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) { cells.push(idx(x, z)); if (centerDist(x, z) < 5) near = true; }
      if (near) continue;
      if (place(cells, Tile.Lava, [0])) trenches++;
    }
  }
  // Lavakessel: zusätzliche Lavakleckse
  if (style === 'lava') {
    const target = rng.int(58, 70);
    for (let tries = 0; tries < 200 && count(Tile.Lava) < target; tries++) {
      const r = rng.range(1.6, 2.5);
      const cx = rng.range(LO + 1, HI), cz = rng.range(LO + 1, HI);
      if (centerDist(Math.floor(cx), Math.floor(cz)) < 5) continue;
      place(blobCells(cx, cz, r, 0.85, LO, HI), Tile.Lava, [0]);
    }
  }

  // --- Kistenstapel in kleinen Gruppen ---
  const CRATE_SHAPES: [number, number][][] = [
    [[0, 0], [1, 0]], [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]]
  ];
  const groups = rng.int(2, 3) + (style === 'schrott' ? 1 : 0);
  for (let g = 0, tries = 0; g < groups && tries < 120; tries++) {
    const shape = rng.pick(CRATE_SHAPES);
    const x0 = rng.int(LO, HI), z0 = rng.int(LO, HI);
    if (shape.some(([dx, dz]) => x0 + dx > HI || z0 + dz > HI)) continue;
    if (place(shape.map(([dx, dz]) => idx(x0 + dx, z0 + dz)), Tile.Crate, shape.map(() => rng.int(1, 2)))) g++;
  }

  // --- Säulen (Rostgrat: zusätzliche Schrotthaufen) ---
  const pillars: number[] = [];
  const nPillars = rng.int(5, 7), nScrap = style === 'schrott' ? rng.int(5, 7) : 0;
  for (let k = 0; k < nPillars + nScrap; k++) {
    for (let tries = 0; tries < 80; tries++) {
      const x = rng.int(LO, HI), z = rng.int(LO, HI);
      const i = idx(x, z);
      // nicht zu dicht an anderen Säulen, damit sie sich über die Arena verteilen
      if (pillars.some((j) => Math.hypot((j % size) - x, Math.floor(j / size) - z) < 4)) continue;
      if (place([i], Tile.Pillar, [k < nPillars ? rng.int(1, 3) : rng.int(1, 2)])) { pillars.push(i); break; }
    }
  }

  // --- Spezialboden je Stil (nur auf freien Bodenkacheln) ---
  if (style === 'eis') {
    const target = rng.int(92, 112);
    const centers: [number, number, number][] = [];
    for (let tries = 0; tries < 60 && count(Tile.Ice) < target; tries++) {
      const r = rng.range(2.4, 3.4);
      const cx = rng.range(3, size - 3), cz = rng.range(3, size - 3);
      if (centers.some(([mx, mz, mr]) => Math.hypot(mx - cx, mz - cz) < (mr + r) * 0.8)) continue;
      paint(blobCells(cx, cz, r, 0.9, 2, size - 3), Tile.Ice);
      centers.push([cx, cz, r]);
    }
  }
  if (style === 'gift') {
    const target = rng.int(38, 50);
    const centers: [number, number, number][] = [];
    for (let tries = 0; tries < 80 && count(Tile.Poison) < target; tries++) {
      const r = rng.range(1.4, 2.3);
      const cx = rng.range(3, size - 3), cz = rng.range(3, size - 3);
      // Abstand zwischen den Tümpeln, damit Wege dazwischen bleiben
      if (centers.some(([mx, mz, mr]) => Math.hypot(mx - cx, mz - cz) < mr + r + 2)) continue;
      const done = paint(blobCells(cx, cz, r, 0.85, 2, size - 3), Tile.Poison);
      if (!ringOk()) { for (const i of done) tiles[i] = Tile.Floor; continue; }
      centers.push([cx, cz, r]);
    }
  }
  if (style === 'strom') {
    const shockNear = (x: number, z: number) => {
      for (let dz = -2; dz <= 3; dz++) for (let dx = -2; dx <= 3; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < size && nz < size && tiles[idx(nx, nz)] === Tile.Shock) return true;
      }
      return false;
    };
    for (let k = 0, tries = 0; k < 8 && tries < 300; tries++) {
      const x = rng.int(3, size - 5), z = rng.int(3, size - 5);
      const cells = [idx(x, z), idx(x + 1, z), idx(x, z + 1), idx(x + 1, z + 1)];
      if (cells.some((i) => tiles[i] !== Tile.Floor) || blocked(x, z) || blocked(x + 1, z) || blocked(x, z + 1) || blocked(x + 1, z + 1) || shockNear(x, z)) continue;
      paint(cells, Tile.Shock);
      k++;
    }
  }

  // --- Moosfleck (Gackerfeld: Wiese, Pilzmoor: Grasflecken) ---
  // Mitte des Flecks auf freiem Boden mit Platz rundherum (dort stehen die Kristalle)
  let mx = 5, mz = 8;
  for (let tries = 0; tries < 80; tries++) {
    const x = rng.int(4, size - 5), z = rng.int(4, size - 5);
    if (centerDist(x, z) < 5 || tiles[idx(x, z)] !== Tile.Floor) continue;
    let clear = true;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (isSolid(x + dx, z + dz)) clear = false;
    mx = x; mz = z;
    if (clear) break;
  }
  for (let z = 1; z < size - 1; z++) for (let x = 1; x < size - 1; x++) {
    const i = idx(x, z);
    if (tiles[i] !== Tile.Floor) continue;
    const dx = x - mx, dz = z - mz;
    const grass = style === 'heu' ? rng.chance(0.55) : style === 'gift' ? rng.chance(0.25) : false;
    if (grass || (dx * dx + dz * dz < 16 && rng.chance(0.75))) tiles[i] = Tile.Moss;
  }

  // --- Props ---
  const props: Prop[] = [];
  // Fackeln auf den Türmen
  for (const i of towersN) props.push({ kind: 'torch', x: i + 0.5, z: 0.5, y: 4, r: 0, seed: i });
  for (const i of towersW) props.push({ kind: 'torch', x: 0.5, z: i + 0.5, y: 4, r: 0, seed: i + 100 });

  /** freie Stelle für ein festes Objekt: normaler Boden, nicht in der Mitte, Umgebung ohne Hindernisse */
  const spotOk = (x: number, z: number, r: number, margin: number): boolean => {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (tx < 2 || tz < 2 || tx > size - 3 || tz > size - 3 || blocked(tx, tz) || !plain(tx, tz)) return false;
    for (let dz = -margin; dz <= margin; dz++) for (let dx = -margin; dx <= margin; dx++) if (isSolid(tx + dx, tz + dz)) return false;
    for (const p of props) if (p.r > 0 && Math.hypot(p.x - x, p.z - z) < p.r + r + 0.1) return false;
    return true;
  };
  // Kristalle im Moos: erst dicht beieinander im Fleck suchen, notfalls irgendwo
  let kx = mx + 0.5, kz = mz + 0.5;
  for (const [r, pseed, dMin, dMax] of [[0.6, 1, 0, 1.5], [0.45, 2, 1.5, 2.2]] as const) {
    for (let tries = 0; tries < 300; tries++) {
      let x: number, z: number;
      if (tries < 60) {
        const a = rng.next() * Math.PI * 2, d = rng.range(dMin, dMax);
        x = kx + Math.cos(a) * d; z = kz + Math.sin(a) * d;
      } else {
        x = rng.range(2.5, size - 2.5); z = rng.range(2.5, size - 2.5);
      }
      if (!spotOk(x, z, r, 2)) continue;
      props.push({ kind: 'crystal', x, z, y: 0, r, seed: pseed });
      kx = x; kz = z;
      break;
    }
  }
  /** Fässer/Heuballen verstreut, gern paarweise */
  const scatter = (kind: 'barrel' | 'heu', n: number, r: number, pair: number) => {
    let last: Prop | null = null;
    for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
      let x: number, z: number;
      if (last && rng.chance(pair)) {
        const a = rng.next() * Math.PI * 2, d = rng.range(0.85, 1.0);
        x = last.x + Math.cos(a) * d; z = last.z + Math.sin(a) * d;
      } else {
        x = rng.int(2, size - 3) + rng.range(0.3, 0.7); z = rng.int(2, size - 3) + rng.range(0.3, 0.7);
      }
      if (!spotOk(x, z, r, 1)) { last = null; continue; }
      const p: Prop = { kind, x, z, y: 0, r, seed: Math.floor(x * 10 + z) };
      props.push(p);
      last = k % 2 === 0 ? p : null;
      k++;
    }
  };
  // Explosive Fässer (Rostgrat: viele Ölfässer, Festung: Pulverfässer, Gackerfeld: Heuballen)
  if (style !== 'heu' && style !== 'eis') {
    scatter('barrel', rng.int(3, 5) + (style === 'schrott' ? rng.int(3, 5) : 0) + (style === 'festung' ? 2 : 0), 0.3, 0.4);
  }
  if (style === 'heu') scatter('heu', rng.int(9, 11), 0.42, 0.3);
  // Geröll (nur Deko)
  for (let i = 0; i < 26; i++) {
    const x = rng.range(1.5, size - 1.5), z = rng.range(1.5, size - 1.5);
    const tx = Math.floor(x), tz = Math.floor(z);
    if (!blocked(x, z) && plain(tx, tz)) props.push({ kind: 'rubble', x, z, y: 0, r: 0, seed: i });
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
