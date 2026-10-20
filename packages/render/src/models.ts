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

/* ------------------------------------------------------------------ */
/* Phase 2: Gegner, Waffen, Geschosse, Pickups                          */
/* ------------------------------------------------------------------ */

/** Bomben-Kröte (Sumpfbande): dick, lila, Glupschaugen, Bombe auf dem Rücken. Blick +z. */
export function kroete(): Vox[] {
  const p = '#8a4fd8', pd = '#6a38b0', belly = '#c9a0ff', ink = '#141018', brow = '#2b1440';
  const b = new VoxBuilder()
    // Beinchen
    .box(-4, -3, 0, 0, 1, 3, pd).box(2, 3, 0, 0, 1, 3, pd).box(-4, -3, 0, 0, -3, -2, pd).box(2, 3, 0, 0, -3, -2, pd)
    // Körper
    .box(-4, 3, 1, 5, -3, 3, p)
    .box(-3, 2, 1, 2, 4, 4, belly)
    // breites Maul mit Unterbiss und zwei Hauern
    .box(-3, 2, 3, 3, 4, 4, '#3a1a4a').v(-2, 4, 4, '#fff6d8').v(1, 4, 4, '#fff6d8')
    // Glupschaugen
    .box(-4, -2, 5, 7, 1, 3, '#ffffff').box(1, 3, 5, 7, 1, 3, '#ffffff')
    .v(-2, 6, 4, ink).v(-3, 6, 4, '#ffffff').v(1, 6, 4, ink).v(2, 6, 4, '#ffffff')
    // schräge Wut-Brauen (innen tief)
    .v(-4, 8, 3, brow).v(-3, 8, 3, brow).v(-2, 7, 4, brow).v(3, 8, 3, brow).v(2, 8, 3, brow).v(1, 7, 4, brow)
    // Bombe auf dem Rücken
    .box(-2, 1, 5, 8, -5, -2, '#24202e').box(-1, 0, 9, 9, -4, -3, '#24202e')
    .v(-2, 7, -2, '#5a5468')
    .v(0, 10, -3, '#6b4b2e').v(0, 11, -3, '#ff7a1a', 1).v(0, 12, -3, '#ffd23f', 1);
  for (const [x, y, z] of [[-2, 5, -5], [1, 5, -5], [-2, 8, -5], [1, 8, -5], [-2, 5, -2], [1, 5, -2], [-2, 8, -2], [1, 8, -2]]) b.del(x, y, z);
  return b.list();
}

/** Toastomat (Blechbrut): wütender Toaster auf Stelzen, rote LED-Brauen. Blick +z. */
export function toastomat(): Vox[] {
  const chrome = '#c9ced8', dark = '#8d93a3', led = '#ff2a4a';
  return new VoxBuilder()
    // Stelzenbeine
    .box(-2, -2, 0, 3, 0, 0, '#5a5f68').box(1, 1, 0, 3, 0, 0, '#5a5f68')
    .box(-2, -2, 0, 0, 1, 1, '#3a3e46').box(1, 1, 0, 0, 1, 1, '#3a3e46')
    // Gehäuse
    .box(-3, 2, 4, 10, -2, 2, chrome)
    .box(-3, -3, 4, 10, -2, 2, dark).box(2, 2, 4, 10, -2, 2, dark)
    .box(-3, 2, 4, 4, -2, 2, '#6b707a')
    // Toastschlitze mit glühendem Toast
    .box(-2, 1, 10, 10, -1, -1, '#2a2e38').box(-2, 1, 10, 10, 1, 1, '#2a2e38')
    .box(-2, 1, 11, 12, -1, -1, '#c98a3a').box(-2, 1, 11, 11, 1, 1, '#c98a3a').box(-2, 1, 12, 12, 1, 1, '#ff7a1a', 1)
    // Gesicht: LED-Augen und schräge LED-Brauen
    .v(-2, 7, 3, '#ffffff', 1).v(1, 7, 3, '#ffffff', 1)
    .v(-3, 9, 3, led, 1).v(-2, 8, 3, led, 1).v(2, 9, 3, led, 1).v(1, 8, 3, led, 1)
    // Grill-Mund mit Hauern
    .box(-2, 1, 5, 5, 3, 3, '#2a2e38').v(-2, 6, 3, '#fff6d8').v(1, 6, 3, '#fff6d8')
    // Hebel an der Seite
    .box(3, 3, 7, 7, 0, 0, '#5a5f68').v(4, 7, 0, '#ff3d3d')
    .list();
}

/** Schwebende Waffen-Modelle (Lauf zeigt nach +z). */
export function weaponModel(id: string): Vox[] {
  switch (id) {
    case 'raketenwerfer':
      return new VoxBuilder()
        .box(-1, 0, 1, 2, -3, 3, '#5b6b3a').box(-1, 0, 1, 2, 4, 4, '#ff7a1a')
        .box(-1, 0, 1, 2, -4, -4, '#2a2e38').v(0, 3, 0, '#3a4426').v(-1, 0, 0, '#5a3a1e').v(-1, -1, 0, '#5a3a1e')
        .v(-1, 2, 4, '#ff3d3d', 1)
        .list();
    case 'teslastab':
      return new VoxBuilder()
        .box(0, 0, 0, 0, -4, 2, '#7a4a28')
        .box(-1, 1, 0, 0, 0, 0, '#d8a04a').box(-1, 1, 0, 0, 2, 2, '#d8a04a')
        .box(0, 1, 0, 1, 3, 4, '#3de8ff', 1).v(0, 2, 4, '#e8fdff', 1)
        .list();
    default: // Pistole
      return new VoxBuilder()
        .box(0, 0, -2, 0, -1, -1, '#5a3a1e')
        .box(0, 0, 1, 2, -2, 3, '#7d8597').box(0, 0, 2, 2, -2, 0, '#5a5f68')
        .v(0, 2, 4, '#2a2e38').v(0, 3, -1, '#3de8ff', 1)
        .list();
  }
}

/** Geschoss-Modelle nach Geschoss-Bauteil (Flugrichtung +z). */
export function projectileModel(geschoss: string): Vox[] {
  switch (geschoss) {
    case 'rakete':
      return new VoxBuilder()
        .box(0, 0, 0, 0, -2, 2, '#e8e2f0').v(0, 0, 3, '#ff3d3d')
        .v(-1, 0, -2, '#ff3d3d').v(1, 0, -2, '#ff3d3d').v(0, 1, -2, '#ff3d3d')
        .v(0, 0, -3, '#ffd23f', 1)
        .list();
    case 'blitzkugel':
      return new VoxBuilder().box(-1, 0, -1, 0, -1, 0, '#3de8ff', 1).v(0, 0, 0, '#e8fdff', 1).v(-1, -1, -1, '#a8f6ff', 1).list();
    case 'toast':
      return new VoxBuilder().box(-1, 1, 0, 0, -1, 1, '#c98a3a').box(-1, 1, 1, 1, -1, 1, '#ff7a1a', 1).v(0, 1, 0, '#ffd23f', 1).list();
    default: // Kugel
      return new VoxBuilder().box(0, 0, 0, 0, -1, 1, '#ffd23f', 1).v(0, 0, 1, '#fff3c4', 1).list();
  }
}

/** Kleiner Kristall zum Einsammeln. */
export function gem(): Vox[] {
  return new VoxBuilder()
    .box(0, 1, 1, 2, 0, 1, '#3de8ff', 1).box(0, 1, 0, 0, 0, 1, '#1aa8d8', 1).v(0, 3, 0, '#a8f6ff', 1).v(1, 3, 1, '#e8fdff', 1)
    .list();
}

/** Rotes Spawn-Kreuz, flach am Boden. */
export function spawnMarker(): Vox[] {
  const b = new VoxBuilder();
  for (let i = -3; i <= 3; i++) { b.v(i, 0, i, '#ff2a4a', 1); b.v(i, 0, -i, '#ff2a4a', 1); }
  return b.list();
}

/** Farben, in die ein Gegner zerplatzt. */
export const ENEMY_DEBRIS: Record<string, string[]> = {
  grummelbold: ['#6cc24a', '#5aa83c', '#7d8597', '#8a5a2a', '#ffffff'],
  bombenkroete: ['#8a4fd8', '#6a38b0', '#c9a0ff', '#24202e', '#ff7a1a'],
  toastomat: ['#c9ced8', '#8d93a3', '#c98a3a', '#ff2a4a', '#2a2e38']
};
