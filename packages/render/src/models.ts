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

/** Farben je Waffengruppe für das Grundmodell */
const GROUP_COLORS: Record<string, [string, string, string]> = {
  'Feuerwaffen': ['#7d8597', '#5a5f68', '#ffd23f'],
  'Explosiv': ['#5b6b3a', '#3a4426', '#ff7a1a'],
  'Elementar': ['#7a4a28', '#d8a04a', '#3de8ff'],
  'Nahkampf': ['#8a6038', '#5a3a1e', '#ffd23f'],
  'Energie': ['#3b2b66', '#5d4f86', '#ff3df0'],
  'Drohnen & Türme': ['#5a5f68', '#2a2e38', '#3de8ff'],
  'Beschwörung': ['#6cc24a', '#3b2a1e', '#ffd23f'],
  'Werfer': ['#8a5a2a', '#5a3a1e', '#ffffff'],
  'Exotisch': ['#ff3df0', '#6a1068', '#ffd23f'],
  'Support': ['#e8e2f0', '#9aa3b5', '#5dff7a']
};

/** Schwebende Waffen-Modelle (Lauf zeigt nach +z). `glow` = Farbe der Stufe. */
export function weaponModel(id: string, gruppe = 'Feuerwaffen', glow = '#3de8ff'): Vox[] {
  switch (id) {
    case 'raketenwerfer':
      return new VoxBuilder()
        .box(-1, 0, 1, 2, -3, 3, '#5b6b3a').box(-1, 0, 1, 2, 4, 4, '#ff7a1a')
        .box(-1, 0, 1, 2, -4, -4, '#2a2e38').v(0, 3, 0, '#3a4426').v(-1, 0, 0, '#5a3a1e').v(-1, -1, 0, '#5a3a1e')
        .v(-1, 2, 4, glow, 1)
        .list();
    case 'teslastab':
      return new VoxBuilder()
        .box(0, 0, 0, 0, -4, 2, '#7a4a28')
        .box(-1, 1, 0, 0, 0, 0, '#d8a04a').box(-1, 1, 0, 0, 2, 2, '#d8a04a')
        .box(0, 1, 0, 1, 3, 4, '#3de8ff', 1).v(0, 2, 4, '#e8fdff', 1).v(0, -1, -4, glow, 1)
        .list();
    case 'schrotflinte':
      return new VoxBuilder()
        .box(0, 0, -1, 0, -3, -1, '#6b4b2e').box(-1, 0, 1, 1, -1, 4, '#5a5f68').box(-1, 0, 2, 2, 0, 2, '#7d8597')
        .v(0, 2, -1, glow, 1)
        .list();
    case 'pistole':
      return new VoxBuilder()
        .box(0, 0, -2, 0, -1, -1, '#5a3a1e')
        .box(0, 0, 1, 2, -2, 3, '#7d8597').box(0, 0, 2, 2, -2, 0, '#5a5f68')
        .v(0, 2, 4, '#2a2e38').v(0, 3, -1, glow, 1)
        .list();
    default: {
      // Grundmodell nach Gruppe: Griff, Körper, Lauf, Leuchtpunkt
      const [a, b, c] = GROUP_COLORS[gruppe] ?? GROUP_COLORS['Feuerwaffen'];
      const v = new VoxBuilder().box(0, 0, -2, 0, -1, -1, b).box(-1, 0, 1, 2, -2, 2, a).box(0, 0, 1, 1, 3, 4, b).v(0, 2, 4, c, 1).v(0, 3, -1, glow, 1);
      // etwas Abwechslung aus der ID
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      if (h % 2) v.box(-1, -1, 0, 1, -1, 1, c);
      if (h % 3 === 0) v.box(0, 0, 3, 3, -1, 0, b);
      return v.list();
    }
  }
}

/** Farbe je Geschoss: [Grundfarbe, Lichtkante, leuchtet?] */
const SHOT_COLORS: Record<string, [string, string, number]> = {
  kugel: ['#ffd23f', '#fff3c4', 1],
  nagel: ['#c9ced8', '#ffffff', 0],
  kartoffel: ['#c9a05a', '#e8c88a', 0],
  granate: ['#3a4426', '#ff7a1a', 0],
  dynamit: ['#c42a28', '#ffd23f', 0],
  schleim: ['#6cc24a', '#a8ff7a', 1],
  meteor: ['#ff7a1a', '#ffd23f', 1],
  eiszapfen: ['#a8f6ff', '#ffffff', 1],
  blase: ['#ff8af0', '#ffffff', 1],
  wasser: ['#3d9bff', '#a8f6ff', 1],
  faust: ['#ff3d3d', '#ffffff', 0],
  note: ['#ff3df0', '#ffd23f', 1],
  schwarzloch: ['#141018', '#b05dff', 1],
  stern: ['#e8e2f0', '#ffd23f', 1],
  schneeball: ['#ffffff', '#a8f6ff', 0],
  ei: ['#fff6d8', '#ffffff', 0],
  spore: ['#9a6cc2', '#c9a0ff', 1],
  luftballon: ['#ff3df0', '#ffd23f', 0],
  pflaster: ['#f2c08a', '#ffffff', 0],
  laser: ['#ff3df0', '#ffffff', 1]
};

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
    case 'bombe':
      return new VoxBuilder()
        .box(-1, 1, -1, 1, -1, 1, '#24202e').del(-1, -1, -1).del(1, -1, 1).del(-1, 1, 1).del(1, 1, -1)
        .v(0, 2, 0, '#6b4b2e').v(0, 3, 0, '#ffd23f', 1).v(0, 1, 1, '#5a5468')
        .list();
    default: {
      const [a, b, g] = SHOT_COLORS[geschoss] ?? SHOT_COLORS.kugel;
      return new VoxBuilder().box(-1, 0, -1, 0, -1, 0, a, g).v(0, 0, 0, b, g).list();
    }
  }
}

/** Alle Geschoss-IDs mit eigenem Modell */
export const PROJECTILE_IDS = ['rakete', 'blitzkugel', 'toast', 'bombe', ...Object.keys(SHOT_COLORS)];

/** Baron von Bumm: rund, Zylinder, Monokel, Schnurrbart, Bombe auf dem Hut. Blick +z. */
export function baron(): Vox[] {
  const coat = '#6a1f3a', coatD = '#4a1428', skin = '#f2c08a', ink = '#141018', hat = '#1c1530';
  const b = new VoxBuilder();
  // runder Bauch (Kugel-artig aus Scheiben)
  for (let y = 1; y <= 9; y++) {
    const r = y < 3 ? 3 + y : y > 7 ? 13 - y : 5.5;
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
      if (x * x + z * z <= r * r) b.v(x, y, z, Math.abs(x) <= 1 && z > 0 ? '#ffd23f' : (x + y) % 5 === 0 ? coatD : coat);
    }
  }
  // goldene Knöpfe
  for (const y of [3, 5, 7]) b.v(0, y, Math.floor(y > 7 ? 5 : 6), '#fff3c4');
  // kleine Stiefel
  b.box(-3, -2, 0, 0, -1, 2, ink).box(2, 3, 0, 0, -1, 2, ink);
  // Kopf
  b.box(-4, 4, 10, 15, -4, 4, skin);
  // Monokel (rechts) + Auge links, böse Brauen
  b.v(-2, 13, 5, ink).v(-3, 13, 5, '#ffffff');
  b.box(1, 3, 12, 14, 5, 5, '#ffd23f').v(2, 13, 5, ink).v(2, 13, 6, '#a8f6ff', 1).v(3, 11, 5, '#ffd23f').v(3, 10, 5, '#ffd23f');
  b.v(-4, 15, 5, ink).v(-3, 15, 5, ink).v(-2, 14, 5, ink).v(1, 14, 6, ink).v(2, 15, 6, ink).v(3, 15, 6, ink);
  // Schnurrbart + grimmiges Grinsen
  b.box(-4, 4, 11, 11, 5, 5, '#3b2a1e').v(-5, 12, 5, '#3b2a1e').v(5, 12, 5, '#3b2a1e').v(-5, 13, 4, '#3b2a1e').v(5, 13, 4, '#3b2a1e');
  b.box(-2, 1, 10, 10, 5, 5, '#5a1a2a').v(-2, 10, 6, '#fff6d8').v(1, 10, 6, '#fff6d8');
  // Zylinder
  b.box(-6, 6, 16, 16, -6, 6, hat).box(-4, 4, 17, 22, -4, 4, hat).box(-4, 4, 17, 17, -4, 4, '#c42a28');
  // Bombe mit Lunte auf dem Hut
  b.box(-2, 2, 23, 26, -2, 2, '#24202e').del(-2, 23, -2).del(2, 23, 2).del(-2, 26, 2).del(2, 26, -2).del(-2, 23, 2).del(2, 26, 2);
  b.v(1, 25, 2, '#5a5468').v(0, 27, 0, '#6b4b2e').v(0, 28, 0, '#ff7a1a', 1).v(0, 29, 0, '#ffd23f', 1).v(1, 28, 0, '#ff3d3d', 1);
  // Ärmchen
  b.box(-8, -7, 5, 7, -1, 1, coat).box(-8, -8, 4, 4, -1, 1, '#ffffff').box(7, 8, 5, 7, -1, 1, coat).box(8, 8, 4, 4, -1, 1, '#ffffff');
  return b.list();
}

/** Goldene Krone für Elite-Gegner */
export function crown(): Vox[] {
  const g = '#ffd23f';
  return new VoxBuilder()
    .box(-2, 2, 0, 0, -2, 2, g)
    .v(-2, 1, -2, g).v(2, 1, -2, g).v(-2, 1, 2, g).v(2, 1, 2, g).v(0, 1, 0, g)
    .v(0, 2, -2, '#ff3d6a', 1).v(-2, 2, 0, '#3de8ff', 1).v(2, 2, 0, '#ff3df0', 1)
    .list();
}

/** Flacher Ring am Boden (Einschlag-Markierung), Radius ~1 bei Voxelgröße 1/9 */
export function targetRing(): Vox[] {
  const b = new VoxBuilder();
  for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) {
    const d = Math.hypot(x, z);
    if (d >= 7.6 && d <= 9.2) b.v(x, 0, z, '#ff2a4a', 1);
  }
  b.box(-1, 1, 0, 0, 0, 0, '#ff2a4a', 1).box(0, 0, 0, 0, -1, 1, '#ff2a4a', 1);
  return b.list();
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
  toastomat: ['#c9ced8', '#8d93a3', '#c98a3a', '#ff2a4a', '#2a2e38'],
  baron: ['#6a1f3a', '#ffd23f', '#1c1530', '#f2c08a', '#c42a28']
};
