import { VoxBuilder, type Vox } from './voxel.ts';

/** Farbe abdunkeln/aufhellen (sRGB-Hex). */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const HERO_VOXEL = 0.1;

export interface HeroParts {
  body: Vox[];
  legL: Vox[];
  legR: Vox[];
  armL: Vox[];
  armR: Vox[];
  /** Drehpunkte in Voxel-Einheiten */
  pivots: { legL: [number, number, number]; legR: [number, number, number]; armL: [number, number, number]; armR: [number, number, number] };
}

/** Held (Kawumm-Jäger) in Spielerfarbe. Blickrichtung +z. */
export function heroParts(color: string): HeroParts {
  const dark = shade(color, 0.62), skin = '#f2c08a', pants = '#2b2140', boot = '#1d1530';
  const leg = (x0: number) => new VoxBuilder().box(x0, x0 + 1, 0, 3, -1, 0, pants).box(x0, x0 + 1, 0, 0, -1, 1, boot).list();
  const body = new VoxBuilder()
    // Rumpf
    .box(-2, 1, 4, 8, -1, 1, color)
    .box(-2, 1, 4, 4, -1, 1, '#5a3a1a').box(-1, 0, 4, 4, 2, 2, '#ffd23f')
    .box(-2, 1, 7, 8, 1, 1, dark).box(-1, 0, 6, 6, 2, 2, '#3de8ff', 1)
    // Rucksack mit Treibstofftank
    .box(-2, 1, 5, 8, -2, -2, '#6b4b2e').box(-1, 0, 6, 9, -3, -3, '#7d8597').v(-1, 10, -3, '#ff7a1a', 1)
    // Kopf
    .box(-3, 2, 9, 13, -3, 2, skin)
    .box(-2, -2, 10, 11, 2, 2, '#141018').box(1, 1, 10, 11, 2, 2, '#141018')
    .v(-2, 11, 2, '#ffffff').v(1, 11, 2, '#ffffff')
    .box(-1, 0, 9, 9, 2, 2, '#a8505a')
    .box(-3, -3, 10, 10, 1, 1, '#f0a090').box(2, 2, 10, 10, 1, 1, '#f0a090')
    // Helm mit Schirm und Federbusch
    .box(-3, 2, 13, 14, -3, 2, color).box(-3, 2, 13, 13, 3, 3, dark).box(-3, 2, 12, 13, -3, -3, color)
    .box(-1, 0, 15, 16, -1, 0, '#ffd23f').box(-1, 0, 17, 17, -2, -1, '#ff7a1a')
    .list();
  const armL = new VoxBuilder().box(-3, -3, 5, 8, -1, 0, color).box(-3, -3, 5, 5, -1, 0, skin).list();
  const armR = new VoxBuilder()
    .box(2, 2, 5, 8, -1, 0, color).box(2, 2, 5, 5, -1, 0, skin)
    // Blaster in der Hand
    .box(2, 3, 5, 6, 1, 3, '#7d8597').box(2, 3, 6, 6, 4, 4, '#2a2e38').v(3, 7, 2, '#3de8ff', 1)
    .list();
  return {
    body,
    legL: leg(-2),
    legR: leg(0),
    armL,
    armR,
    pivots: { legL: [-1, 4, 0], legR: [1, 4, 0], armL: [-2.5, 9, 0], armR: [2.5, 9, 0] }
  };
}

/** Grummelbold: grimmig, aber knuffig. Blickrichtung +z. */
export function grummel(): Vox[] {
  const g = '#6cc24a', gd = '#5aa83c';
  return new VoxBuilder()
    .box(-2, 1, 0, 0, -2, 1, '#3b2a1e')
    .box(-2, 1, 1, 2, -2, 1, '#8a5a2a').box(-2, 1, 1, 1, -2, 1, '#5a3a1a')
    .box(-3, -3, 1, 2, -1, 0, gd).box(2, 2, 1, 2, -1, 0, gd)
    .box(-3, 2, 3, 7, -3, 2, g)
    // wütende Augen mit schrägen Brauen
    .v(-2, 5, 2, '#ffffff').v(-1, 5, 2, '#141018').v(0, 5, 2, '#141018').v(1, 5, 2, '#ffffff')
    .v(-2, 7, 2, '#2b1d14').v(-1, 6, 2, '#2b1d14').v(0, 6, 2, '#2b1d14').v(1, 7, 2, '#2b1d14')
    // Unterbiss mit Hauern
    .v(-2, 4, 2, '#fff6d8').v(-1, 4, 2, '#5a1a2a').v(0, 4, 2, '#5a1a2a').v(1, 4, 2, '#fff6d8')
    // spitze Ohren
    .box(-4, -4, 5, 6, -1, 0, gd).v(-5, 6, -1, gd).box(3, 3, 5, 6, -1, 0, gd).v(4, 6, -1, gd)
    // Kochtopf-Helm
    .box(-4, 3, 8, 8, -4, 3, '#7d8597').box(-2, 1, 9, 9, -2, 1, '#9aa3b5').v(1, 9, -2, '#6b707a').v(4, 8, 0, '#5a5f68')
    .list();
}

export function barrel(): Vox[] {
  const b = new VoxBuilder().box(-2, 2, 0, 6, -2, 2, '#c42a28').box(-2, 2, 2, 2, -2, 2, '#ffd23f').box(-2, 2, 5, 5, -2, 2, '#ffd23f');
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = 0; y <= 6; y++) b.del(x, y, z);
  b.box(-1, 1, 7, 7, -1, 1, '#3b2d55').v(0, 8, 0, '#2a2e38').v(0, 9, 0, '#ffd23f', 1);
  return b.list();
}

export function crystal(seed: number): Vox[] {
  const b = new VoxBuilder();
  const cols: [number, number, number][] = seed % 2 ? [[0, 0, 4], [1, 0, 2], [-1, 1, 3], [0, -1, 2], [1, 1, 1]] : [[0, 0, 3], [-1, 0, 2], [1, -1, 2], [0, 1, 1]];
  for (const [x, z, h] of cols) for (let y = 0; y < h; y++) b.v(x, y, z, y === h - 1 ? '#a8f6ff' : '#3de8ff', 1);
  return b.list();
}

export function torch(): Vox[] {
  return new VoxBuilder()
    .box(0, 0, 0, 1, 0, 0, '#3b2a1e')
    .v(0, 2, 0, '#ff7a1a', 1).v(0, 3, 0, '#ffd23f', 1).v(1, 2, 0, '#ff5a14', 1).v(-1, 2, 0, '#ff5a14', 1).v(0, 2, 1, '#ff7a1a', 1).v(0, 4, 0, '#fff3c4', 1)
    .list();
}

export function rubble(seed: number): Vox[] {
  const c = ['#4b3f6e', '#544777', '#463a66', '#5d4f86'];
  const b = new VoxBuilder().v(0, 0, 0, c[seed % 4]);
  if (seed % 3) b.v(1, 0, 0, c[(seed + 1) % 4]);
  if (seed % 4 === 0) b.v(0, 1, 0, c[(seed + 2) % 4]).v(0, 0, 1, c[(seed + 3) % 4]);
  return b.list();
}
