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
  laser: ['#ff3df0', '#ffffff', 1],
  flamme: ['#ff7a1a', '#ffd23f', 1],
  schlaeger: ['#c98a3a', '#e8c88a', 0],
  hammer: ['#7d8597', '#c9ced8', 0],
  pfanne: ['#2a2e38', '#5a5f68', 0],
  grummel: ['#6cc24a', '#7d8597', 0],
  kuckuck: ['#8a5a2a', '#ffd23f', 0],
  muenze: ['#ffd23f', '#fff3c4', 1],
  keks: ['#c98a3a', '#5a3a1e', 0]
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
      if (SHAPED[geschoss]) return SHAPED[geschoss]();
      const [a, b, g] = SHOT_COLORS[geschoss] ?? SHOT_COLORS.kugel;
      return new VoxBuilder().box(-1, 0, -1, 0, -1, 0, a, g).v(0, 0, 0, b, g).list();
    }
  }
}

/** Geschosse mit eigener Form */
const SHAPED: Record<string, () => Vox[]> = {
  huhn: () => chicken(0),
  kueken: () => new VoxBuilder().box(-1, 0, 0, 1, -1, 0, '#ffe04a').v(0, 2, 0, '#ffe04a').v(0, 2, 1, '#ff9a1a').v(-1, 2, 0, '#141018').list(),
  biene: () => new VoxBuilder().box(-1, 0, 0, 0, -1, 1, '#ffd23f').box(-1, 0, 0, 0, 0, 0, '#141018').v(-1, 1, 0, '#e8fdff', 1).v(0, 1, 0, '#e8fdff', 1).v(0, 0, -2, '#141018').list(),
  gummiente: () => new VoxBuilder().box(-1, 0, 0, 0, -1, 1, '#ffe04a').box(-1, 0, 1, 2, 1, 1, '#ffe04a').v(0, 2, 2, '#ff7a1a').v(-1, 2, 1, '#141018').list(),
  saege: () => {
    const b = new VoxBuilder();
    for (let x = -2; x <= 1; x++) for (let z = -2; z <= 1; z++) if (Math.abs(x + 0.5) + Math.abs(z + 0.5) < 3) b.v(x, 0, z, (x + z) % 2 ? '#c9ced8' : '#9aa3b5');
    return b.v(-1, 0, -1, '#5a5f68').v(-3, 0, 0, '#e8e2f0').v(2, 0, -1, '#e8e2f0').v(0, 0, 2, '#e8e2f0').v(-1, 0, -3, '#e8e2f0').list();
  },
  bowling: () => new VoxBuilder().box(-1, 1, 0, 2, -1, 1, '#2a1f45').del(-1, 0, -1).del(1, 2, 1).del(-1, 2, 1).del(1, 0, -1).v(0, 2, 1, '#141018').v(1, 2, 0, '#141018').list(),
  banane: () => new VoxBuilder().v(-2, 1, 0, '#ffe04a').v(-1, 0, 0, '#ffe04a').v(0, 0, 0, '#ffe04a').v(1, 0, 0, '#ffe04a').v(2, 1, 0, '#ffe04a').v(-2, 2, 0, '#6b4b2e').list(),
  axt: () => new VoxBuilder().box(0, 0, -2, 1, 0, 0, '#8a6038').box(-1, 1, 1, 2, 1, 1, '#c9ced8').list(),
  drohne: () => new VoxBuilder().box(-1, 0, 0, 0, -1, 0, '#5a5f68').v(-2, 1, -2, '#3de8ff', 1).v(1, 1, 1, '#3de8ff', 1).v(-2, 1, 1, '#3de8ff', 1).v(1, 1, -2, '#3de8ff', 1).v(0, 0, 1, '#ff3d3d', 1).list(),
  feder: () => new VoxBuilder().box(0, 0, 0, 0, -2, 1, '#f4ecff').v(-1, 0, 0, '#e8e2f0').v(1, 0, -1, '#e8e2f0').v(0, 0, 2, '#ff7a1a').list(),
  funke: () => new VoxBuilder().v(0, 0, 0, '#a8f6ff', 1).v(1, 1, 0, '#3de8ff', 1).v(-1, 0, 1, '#3de8ff', 1).v(0, 0, -1, '#ffd23f', 1).list(),
  mine: () => new VoxBuilder().box(-2, 1, 0, 0, -2, 1, '#3a4426').box(-1, 0, 1, 1, -1, 0, '#5b6b3a').v(0, 2, 0, '#ff3d3d', 1).list()
};

/** Alle Geschoss-IDs mit eigenem Modell */
export const PROJECTILE_IDS = ['rakete', 'blitzkugel', 'toast', 'bombe', ...Object.keys(SHOT_COLORS), ...Object.keys(SHAPED)];

/** Huhn: weiß, roter Kamm, gelber Schnabel. scale 0 = Geschoss, 1 = Riesenhuhn */
export function chicken(big: number): Vox[] {
  const b = new VoxBuilder();
  const s = big ? 2 : 1;
  b.box(-s, s - 1, 0, 2 * s - 1, -s, s, '#f4ecff');                 // Körper
  b.box(-Math.ceil(s / 2), Math.floor(s / 2) - (s === 1 ? 1 : 0), 2 * s, 3 * s - 1, s, s + Math.max(0, s - 1), '#f4ecff'); // Kopf
  b.v(0, 3 * s, s, '#ff3d3d').v(-1 + (s === 1 ? 1 : 0), 3 * s, s + 1, '#ff3d3d');  // Kamm
  b.v(0, 3 * s - 1, s + s, '#ffb02e');                               // Schnabel
  b.v(-1, 3 * s - 1, s + s - 1, '#141018');                          // Auge
  if (big) b.box(-2, 1, 0, 1, -3, -3, '#e8e2f0').v(-1, 0, 0, '#ffb02e').v(0, 0, 0, '#ffb02e');
  return b.list();
}

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
  baron: ['#6a1f3a', '#ffd23f', '#1c1530', '#f2c08a', '#c42a28'],
  kampfhuhn: ['#f4ecff', '#ff3d3d', '#ffb02e', '#e8e2f0'],
  vogelscheuche: ['#e8c860', '#c8a878', '#3a6a9a', '#d8b048'],
  funkenkobold: ['#ffd23f', '#3de8ff', '#3d4a8a', '#a8f6ff'],
  teslaritter: ['#c9ced8', '#8d93a3', '#d8a04a', '#3de8ff'],
  schrottgolem: ['#7a5a3a', '#8d93a3', '#e8e2f0', '#5a4a3e', '#c42a28'],
  minenbot: ['#5b6b3a', '#2a2e38', '#ff3d3d', '#4a5a2e'],
  pilzling: ['#c42a28', '#ffffff', '#f2e2c8'],
  schleimi: ['#5dbb3a', '#7dff5a', '#3d8a2a'],
  schleimchen: ['#5dbb3a', '#7dff5a'],
  lavaklops: ['#ff7a1a', '#3a2a2a', '#5a2a1a', '#ffb02e'],
  kultist: ['#4a1a3a', '#5a2248', '#ff3df0', '#ffd23f'],
  schneemann: ['#ffffff', '#e8f4ff', '#c42a28', '#ff7a1a'],
  bombenpinguin: ['#24202e', '#ffffff', '#ff9a1a', '#ff7a1a'],
  koenig_gockel: ['#f4ecff', '#ffd23f', '#8a1a3a', '#ff3d3d', '#ff9a1a'],
  megatoaster: ['#c9ced8', '#8d93a3', '#c98a3a', '#ff2a4a', '#2a2e38'],
  morchella: ['#9a3ab0', '#ffffff', '#f2e2c8', '#7dff5a', '#ffd23f']
};

/* ------------------------------------------------------------------ */
/* Phase 4: Fusionen                                                    */
/* ------------------------------------------------------------------ */

/** Leuchtfarbe je Ladung (Kern einer Fusionswaffe, Strahlen, Effekte) */
export const LADUNG_FARBE: Record<string, string> = {
  explosion: '#ff7a1a', kettenblitz: '#3de8ff', brand: '#ff5a14', gift: '#7dff5a', frost: '#a8f6ff', wasser: '#3d9bff',
  schwerkraft: '#b05dff', splitter: '#c9ced8', konfetti: '#ff3df0', rueckstoss: '#ffffff', saeure: '#c8ff3a', kueken: '#ffe04a',
  ranken: '#5dff7a', magnet: '#ff3d3d', schall: '#ff8af0', verhuehnern: '#fff6d8', glueck: '#ffd23f', lava: '#ff7a1a',
  kleister: '#d8ffb0', lebensraub: '#ff3d6a', plasma: '#ff3df0', heilung: '#5dff7a'
};

/** Farbe eines Geschosses (für Strahlen und Kegel) */
export function shotColor(geschoss: string): string {
  return SHOT_COLORS[geschoss]?.[0] ?? (geschoss === 'blitzkugel' ? '#3de8ff' : geschoss === 'toast' ? '#ff7a1a' : '#ffd23f');
}

function shifted(vox: Vox[], dx: number, dy: number, dz: number): Vox[] {
  return vox.map(([x, y, z, c, g]) => [x + dx, y + dy, z + dz, c, g] as Vox);
}

/**
 * Zusammengesteckte Fusionswaffe: Lauf/Körper vom Antriebs-Spender, Aufsatz = Geschoss,
 * Leuchtkern in der Ladungsfarbe. Je instabiler, desto mehr Funken-Voxel.
 */
export function fusionModel(antriebWaffe: string, antriebGruppe: string, geschoss: string, ladung: string, instabil: number, glow: string): Vox[] {
  const b = new VoxBuilder();
  for (const v of weaponModel(antriebWaffe, antriebGruppe, glow)) b.v(v[0], v[1], v[2], v[3], v[4]);
  for (const v of shifted(projectileModel(geschoss), 0, 3, 0)) b.v(v[0], v[1], v[2], v[3], v[4]);
  const core = LADUNG_FARBE[ladung] ?? '#ffd23f';
  b.box(-1, 0, 1, 2, -3, -2, core, 1);
  // Instabilität: lose Funken
  const n = Math.round(instabil / 18);
  for (let i = 0; i < n; i++) b.v(i % 2 ? 2 : -2, 1 + (i % 3), -1 + i, i % 2 ? '#ff3df0' : '#ffd23f', 1);
  return b.list();
}

/** Eigene Modelle der geheimen Rezepte */
export const REZEPT_MODELLE: Record<string, () => Vox[]> = {
  huhnageddon: () => chicken(1),
  kawummageddon: () => new VoxBuilder()
    .box(-2, -2, 0, 0, -3, 3, '#5b6b3a').box(0, 0, 1, 1, -3, 3, '#5b6b3a').box(2, 2, 0, 0, -3, 3, '#5b6b3a')
    .v(-2, 0, 4, '#ff3d3d', 1).v(0, 1, 4, '#ff3d3d', 1).v(2, 0, 4, '#ff3d3d', 1).box(-2, 2, -1, -1, -1, 1, '#3a4426').v(0, 2, -3, '#ff7a1a', 1).list(),
  donnertoaster: () => new VoxBuilder()
    .box(-2, 2, 0, 3, -2, 2, '#c9ced8').box(-1, 1, 4, 4, -1, -1, '#c98a3a').box(-1, 1, 4, 4, 1, 1, '#c98a3a')
    .box(0, 0, 4, 7, 0, 0, '#d8a04a').v(0, 8, 0, '#3de8ff', 1).v(-1, 7, 0, '#3de8ff', 1).v(1, 6, 0, '#3de8ff', 1).v(-1, 2, 3, '#ff2a4a', 1).v(1, 2, 3, '#ff2a4a', 1).list(),
  schwarzesbuffet: () => {
    const b = new VoxBuilder();
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) if (x * x + y * y + z * z <= 5) b.v(x, y + 2, z, '#141018');
    for (let a = 0; a < 12; a++) b.v(Math.round(Math.cos(a / 12 * 6.28) * 3.4), 2, Math.round(Math.sin(a / 12 * 6.28) * 3.4), '#b05dff', 1);
    return b.v(0, 2, 3, '#ff3df0', 1).list();
  },
  omasgeheimrezept: () => new VoxBuilder()
    .box(-2, 2, 0, 3, -2, 2, '#3d9bff').box(-2, 2, 4, 4, -2, 2, '#e8e2f0').v(0, 5, 0, '#c98a3a').v(-1, 5, 1, '#c98a3a')
    .box(0, 0, 1, 1, 3, 5, '#2a2e38').v(0, 1, 6, '#5a3a1e').v(1, 2, 3, '#ff3d6a', 1).list(),
  entensturm: () => new VoxBuilder()
    .box(-2, 1, 0, 2, -2, 2, '#ffe04a').box(-1, 0, 3, 4, 1, 2, '#ffe04a').v(-1, 4, 3, '#141018').box(-1, 0, 3, 3, 3, 3, '#ff7a1a')
    .v(0, 5, 0, '#ff7a1a', 1).v(0, 6, 0, '#ffd23f', 1).v(-1, 5, -1, '#ff5a14', 1).list(),
  frostfeuerwerk: () => new VoxBuilder()
    .box(0, 0, -3, 1, 0, 0, '#a8f6ff').v(0, 2, 0, '#ffffff', 1).v(-1, 3, 0, '#a8f6ff', 1).v(1, 3, 0, '#a8f6ff', 1).v(0, 4, 0, '#a8f6ff', 1).v(0, 3, 0, '#ffd23f', 1)
    .v(-2, 4, 0, '#ff3df0', 1).v(2, 2, 0, '#3de8ff', 1).v(1, 5, 0, '#ffd23f', 1).list(),
  saegenkarussell: () => {
    const b = new VoxBuilder();
    for (let a = 0; a < 16; a++) b.v(Math.round(Math.cos(a / 16 * 6.28) * 3), 1, Math.round(Math.sin(a / 16 * 6.28) * 3), a % 2 ? '#e8e2f0' : '#9aa3b5');
    return b.box(-1, 1, 1, 1, -1, 1, '#ff3d6a').v(0, 2, 0, '#ff3d6a', 1).list();
  },
  bienenkoenigin: () => new VoxBuilder()
    .box(-2, 1, 0, 2, -2, 2, '#ffd23f').box(-2, 1, 1, 1, -2, 2, '#141018').box(-2, 1, 0, 0, -1, 1, '#ffd23f')
    .v(-3, 3, 0, '#e8fdff', 1).v(2, 3, 0, '#e8fdff', 1).v(-1, 3, 3, '#141018').v(0, 3, 3, '#141018')
    .box(-1, 0, 3, 3, -1, 1, '#ffd23f').v(-1, 4, 0, '#ffd23f', 1).v(0, 4, 0, '#ff3d6a', 1).v(-1, 4, 1, '#ffd23f', 1).list(),
  gackerchaos: () => {
    const b = new VoxBuilder();
    for (const v of chicken(0)) b.v(v[0] * 2, v[1] * 2, v[2] * 2, v[3], v[4]);
    return b.v(-2, 4, 4, '#ff3df0', 1).v(-2, 4, 5, '#ff3df0', 1).list();
  }
};

/**
 * Modell einer Rezept-Waffe: eigenes Modell, falls vorhanden – sonst das
 * zusammengesteckte Fusionsmodell mit goldener Krone und Leuchtring.
 */
export function rezeptModell(id: string, antriebWaffe: string, antriebGruppe: string, geschoss: string, ladung: string, instabil: number): Vox[] {
  const mk = REZEPT_MODELLE[id];
  if (mk) return mk();
  const b = new VoxBuilder();
  const glow = LADUNG_FARBE[ladung] ?? '#ff3df0';
  for (const v of fusionModel(antriebWaffe, antriebGruppe, geschoss, ladung, instabil, glow)) b.v(v[0], v[1], v[2], v[3], v[4]);
  let top = 0;
  for (const v of b.list()) top = Math.max(top, v[1]);
  // kleine goldene Krone mit Edelstein in Ladungsfarbe
  b.v(-1, top + 1, 0, '#e8b030').v(0, top + 1, 0, '#e8b030').v(1, top + 1, 0, '#e8b030').v(-1, top + 2, 0, '#ffd23f').v(1, top + 2, 0, '#ffd23f').v(0, top + 2, 0, glow, 1);
  return b.list();
}

/** Turm (Antrieb „Turm"): Sockel + Drehkopf, Blick +z */
export function turret(): Vox[] {
  return new VoxBuilder()
    .box(-2, 1, 0, 0, -2, 1, '#3a3e46').box(-1, 0, 1, 2, -1, 0, '#5a5f68')
    .box(-2, 1, 3, 4, -2, 1, '#7d8597').box(0, 0, 3, 3, 2, 4, '#2a2e38').v(-1, 5, -1, '#3de8ff', 1)
    .list();
}

/** Flache Scheibe am Boden (Pfützen), Radius 1 bei Voxelgröße 1/8 */
export function disc(color: string, edge: string): Vox[] {
  const b = new VoxBuilder();
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
    const d = Math.hypot(x, z);
    if (d <= 8.2) b.v(x, 0, z, d > 6.8 ? edge : ((x * 3 + z * 7) & 3) === 0 ? edge : color, 1);
  }
  return b.list();
}

/** Farbenblind-Modus: Pfütze mit klarem Muster (Streifen bzw. Punkte) und hellem Rand */
export function discMuster(color: string, mark: string, muster: 'streifen' | 'punkte' | 'ring'): Vox[] {
  const b = new VoxBuilder();
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
    const d = Math.hypot(x, z);
    if (d > 8.2) continue;
    const m = muster === 'streifen' ? ((x + z) & 3) < 2 : muster === 'punkte' ? (x & 3) === 0 && (z & 3) === 0 : Math.round(d) % 3 === 0;
    b.v(x, 0, z, d > 7 ? '#ffffff' : m ? mark : color, 1);
  }
  return b.list();
}

/* ------------------------------------------------------------------ */
/* Phase 5: Fraktionen und Bosse                                         */
/* ------------------------------------------------------------------ */

const INK = '#141018';

/**
 * Grimmiges Gesicht auf der Vorderseite (z): weiße Augen mit Pupillen nach innen,
 * schräg nach innen abfallende Brauen, Mund mit zwei Hauern (Unterbiss).
 */
function angryFace(b: VoxBuilder, cx: number, y: number, z: number, o: { brow?: string; mouth?: string; tusks?: boolean; gap?: number; eye?: string } = {}): VoxBuilder {
  const g = o.gap ?? 1, brow = o.brow ?? '#2b1d14', eye = o.eye ?? '#ffffff';
  const L = cx - g - 1, R = cx + g;
  b.v(L, y, z, eye).v(L + 1, y, z, INK).v(R, y, z, INK).v(R + 1, y, z, eye);
  b.v(L, y + 2, z, brow).v(L + 1, y + 1, z, brow).v(R, y + 1, z, brow).v(R + 1, y + 2, z, brow);
  if (o.mouth !== '') {
    b.box(L + 1, R, y - 2, y - 2, z, z, o.mouth ?? '#5a1a2a');
    if (o.tusks !== false) b.v(L + 1, y - 1, z, '#fff6d8').v(R, y - 1, z, '#fff6d8');
  }
  return b;
}

export function hayBale(): Vox[] {
  const b = new VoxBuilder().box(-3, 3, 0, 4, -2, 2, '#e8c860');
  for (let x = -3; x <= 3; x++) for (let y = 0; y <= 4; y++) if ((x * 3 + y * 5) % 4 === 0) b.v(x, y, 2, '#c89a38');
  return b.box(-3, 3, 2, 2, -2, 2, '#a87828').list();
}

/** Kampfhuhn: wütendes Huhn mit rotem Stirnband */
export function kampfhuhn(): Vox[] {
  const b = new VoxBuilder()
    .box(-1, -1, 0, 1, 0, 0, '#ff9a1a').box(1, 1, 0, 1, 0, 0, '#ff9a1a')
    .box(-2, 2, 2, 5, -3, 1, '#f4ecff').box(-1, 1, 2, 4, -4, -4, '#e8e2f0').v(0, 6, -4, '#d8d2e0')
    .box(-2, 2, 6, 10, -1, 2, '#f4ecff')
    .box(-2, 2, 9, 9, -1, 2, '#ff3d3d').v(-3, 9, -1, '#ff3d3d').v(-3, 8, -2, '#ff3d3d')
    .box(-1, 0, 11, 12, 0, 1, '#ff3d3d').v(1, 11, 1, '#ff3d3d')
    .box(-1, 0, 6, 7, 3, 4, '#ffb02e').v(-1, 5, 3, '#ff3d3d');
  return angryFace(b, 0, 8, 3, { mouth: '', gap: 0 }).list();
}

/** Vogelscheuche: Kürbiskopf? Nein – Sackgesicht mit Strohhut, Arme ausgebreitet */
export function vogelscheuche(): Vox[] {
  const b = new VoxBuilder()
    .box(0, 0, 0, 5, 0, 0, '#6b4b2e')
    .box(-2, 2, 4, 8, -1, 1, '#3a6a9a').box(-6, 6, 7, 7, 0, 0, '#6b4b2e')
    .v(-7, 6, 0, '#e8c860').v(-7, 8, 0, '#e8c860').v(7, 6, 0, '#e8c860').v(7, 8, 0, '#e8c860')
    .box(-3, 3, 9, 13, -2, 2, '#c8a878')
    .box(-5, 5, 14, 14, -4, 4, '#d8b048').box(-2, 2, 15, 17, -2, 2, '#d8b048').box(-2, 2, 15, 15, -2, 2, '#c42a28')
    .v(-4, 12, 0, '#e8c860').v(4, 12, 0, '#e8c860').v(-3, 9, 2, '#e8c860').v(3, 10, 2, '#e8c860');
  angryFace(b, 0, 11, 3, { mouth: '#3b2a1e', tusks: false });
  return b.box(-1, 1, 5, 6, 2, 2, '#5dff7a', 1).list();
}

/** Funkenkobold: winzig, gelb, Haare aus Blitzen */
export function funkenkobold(): Vox[] {
  const b = new VoxBuilder()
    .box(-1, -1, 0, 1, 0, 0, '#2a2e38').box(1, 1, 0, 1, 0, 0, '#2a2e38')
    .box(-2, 2, 2, 3, -1, 1, '#3d4a8a')
    .box(-3, 3, 4, 8, -2, 2, '#ffd23f')
    .v(-2, 9, 0, '#3de8ff', 1).v(-1, 10, 0, '#a8f6ff', 1).v(0, 9, 0, '#3de8ff', 1).v(1, 10, 1, '#a8f6ff', 1).v(2, 9, -1, '#3de8ff', 1)
    .v(-4, 6, 0, '#ffd23f').v(4, 6, 0, '#ffd23f');
  return angryFace(b, 0, 6, 3, { brow: '#7a4a00' }).list();
}

/** Tesla-Ritter: Blechrüstung, Spulenschild vorne, Federbusch */
export function teslaritter(): Vox[] {
  const b = new VoxBuilder()
    .box(-2, -1, 0, 2, -1, 0, '#5a5f68').box(1, 2, 0, 2, -1, 0, '#5a5f68')
    .box(-3, 3, 3, 7, -2, 1, '#8d93a3')
    .box(-3, 3, 8, 13, -3, 2, '#c9ced8').box(-3, 3, 10, 10, 3, 3, '#2a2e38')
    .box(-1, 0, 14, 16, -1, 0, '#3de8ff', 1).v(0, 17, -1, '#a8f6ff', 1)
    // Schild mit Spule
    .box(-4, 4, 2, 9, 4, 4, '#5a5f68').box(-3, 3, 3, 8, 5, 5, '#d8a04a').box(-1, 1, 5, 6, 6, 6, '#3de8ff', 1).v(0, 7, 6, '#e8fdff', 1);
  // Visier-Schlitz mit LED-Augen und Brauen
  return b.v(-2, 11, 3, '#ff2a4a', 1).v(1, 11, 3, '#ff2a4a', 1).v(-2, 12, 3, INK).v(-1, 11, 3, INK).v(1, 12, 3, INK).v(0, 11, 3, INK).list();
}

/** Schrottgolem: Kühlschranktür-Brust, rostige Arme, kleiner Topf-Kopf */
export function schrottgolem(): Vox[] {
  const b = new VoxBuilder()
    .box(-4, -2, 0, 3, -2, 1, '#5a4a3e').box(2, 4, 0, 3, -2, 1, '#5a4a3e')
    .box(-5, 5, 4, 12, -3, 3, '#7a5a3a').box(-4, 4, 5, 11, 4, 4, '#e8e2f0').box(3, 3, 7, 9, 5, 5, '#9aa3b5')
    .box(-8, -6, 5, 11, -1, 1, '#8a6a48').box(6, 8, 5, 11, -1, 1, '#6b707a').box(-8, -6, 3, 4, -1, 1, '#5a5f68').box(6, 8, 3, 4, -1, 1, '#5a5f68')
    .box(-3, 3, 13, 17, -2, 3, '#8d93a3').box(-4, 4, 18, 18, -3, 4, '#5a5f68')
    .v(-4, 8, 4, '#c42a28').v(4, 10, 4, '#3d9bff').v(-2, 6, 4, '#ffd23f');
  return angryFace(b, 0, 15, 4, { eye: '#ffd23f' }).list();
}

/** Minenbot: runder Roboter auf Kette mit Antenne und Minenschacht */
export function minenbot(): Vox[] {
  const b = new VoxBuilder()
    .box(-3, 3, 0, 1, -3, 3, '#2a2e38').box(-3, 3, 0, 0, -3, 3, '#3a3e46')
    .box(-3, 3, 2, 6, -2, 2, '#5b6b3a').box(-2, 2, 7, 7, -2, 2, '#4a5a2e')
    .v(0, 8, 0, '#9aa3b5').v(0, 9, 0, '#ff3d3d', 1)
    .box(-1, 1, 2, 3, -3, -3, '#141018').v(0, 3, -3, '#ff3d3d', 1);
  return angryFace(b, 0, 5, 3, { eye: '#ff2a4a', brow: '#ff2a4a', mouth: '#2a2e38', tusks: false }).list();
}

/** Pilzling: rote Kappe mit Punkten, Schmollmund */
export function pilzling(): Vox[] {
  const b = new VoxBuilder()
    .box(-1, -1, 0, 0, 0, 0, '#e8d8c0').box(1, 1, 0, 0, 0, 0, '#e8d8c0')
    .box(-2, 2, 1, 5, -2, 2, '#f2e2c8')
    .box(-4, 4, 6, 7, -4, 4, '#c42a28').box(-3, 3, 8, 8, -3, 3, '#c42a28').box(-1, 1, 9, 9, -1, 1, '#c42a28')
    .v(-3, 7, 4, '#ffffff').v(2, 7, 4, '#ffffff').v(0, 9, 0, '#ffffff').v(3, 7, -2, '#ffffff').v(-2, 8, -2, '#ffffff');
  angryFace(b, 0, 4, 3, { mouth: '#a8505a', tusks: false });
  return b.v(-1, 2, 3, '#a8505a').v(0, 2, 3, '#a8505a').list();
}

/** Schleimi: grüner Glibber-Würfel, durchscheinend leuchtend */
export function schleimi(): Vox[] {
  const b = new VoxBuilder().box(-3, 3, 0, 5, -3, 3, '#5dbb3a').box(-2, 2, 6, 6, -2, 2, '#5dbb3a').del(-3, 5, -3).del(3, 5, 3).del(-3, 5, 3).del(3, 5, -3);
  b.v(-2, 1, 4, '#7dff5a', 1).v(2, 3, -4, '#7dff5a', 1).v(1, 0, 4, '#3d8a2a');
  return angryFace(b, 0, 4, 4, { brow: '#1e4a10' }).list();
}

/** Lavaklops: brodelnder Klumpen mit Grummelgesicht */
export function lavaklops(): Vox[] {
  const b = new VoxBuilder();
  for (let x = -3; x <= 3; x++) for (let y = 0; y <= 6; y++) for (let z = -3; z <= 3; z++) {
    if (x * x + (y - 3) * (y - 3) + z * z > 12) continue;
    const hot = (x * 7 + y * 3 + z * 5) % 5 === 0;
    b.v(x, y, z, hot ? '#ff7a1a' : y > 4 ? '#3a2a2a' : '#5a2a1a', hot ? 1 : 0);
  }
  b.v(0, 7, 0, '#ffb02e', 1).v(1, 7, -1, '#ff5a0a', 1);
  return angryFace(b, 0, 4, 3, { eye: '#ffd23f', brow: '#141018', mouth: '#ff5a0a' }).list();
}

/** Kawumm-Kultist: Kutte, Kapuze, leuchtende Bombe als Amulett */
export function kultist(): Vox[] {
  const b = new VoxBuilder()
    .box(-3, 3, 0, 7, -2, 2, '#4a1a3a').box(-2, 2, 0, 0, -3, 3, '#4a1a3a')
    .box(-3, 3, 8, 12, -3, 2, '#5a2248').box(-2, 2, 13, 13, -2, 1, '#5a2248').v(0, 14, -1, '#5a2248')
    .box(-2, 2, 8, 11, 3, 3, '#2a0e20')
    .v(0, 5, 3, '#24202e').v(0, 6, 3, '#ff7a1a', 1).v(0, 7, 3, '#ffd23f', 1)
    .box(-5, -4, 4, 6, -1, 0, '#4a1a3a').box(4, 5, 4, 6, -1, 0, '#4a1a3a').v(-5, 7, 0, '#ff3df0', 1).v(5, 7, 0, '#ff3df0', 1);
  return angryFace(b, 0, 9, 4, { eye: '#ff3df0', brow: '#ff3df0', mouth: '' }).list();
}

/** Schneemann: drei Kugeln, Möhrennase, Kohleaugen, Zylinder schief */
export function schneemann(): Vox[] {
  const b = new VoxBuilder();
  const ball = (cy: number, r: number) => { for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) if (x * x + y * y + z * z <= r * r + 1) b.v(x, cy + y, z, (x + y + z) % 3 === 0 ? '#e8f4ff' : '#ffffff'); };
  ball(3, 3); ball(8, 2); ball(12, 2);
  b.v(0, 7, 3, INK).v(0, 9, 3, INK).box(-6, -3, 8, 8, 0, 0, '#6b4b2e').box(3, 6, 9, 9, 0, 0, '#6b4b2e');
  b.box(-2, 2, 14, 14, -2, 2, INK).box(-1, 1, 15, 17, -1, 1, INK).box(-1, 1, 15, 15, -1, 1, '#c42a28');
  b.v(0, 12, 3, '#ff7a1a').v(0, 12, 4, '#ff7a1a').v(0, 12, 5, '#ff9a3a');
  b.v(-1, 13, 2, INK).v(1, 13, 2, INK).v(-2, 14, 2, '#3a3a4a').v(2, 14, 2, '#3a3a4a').v(-1, 14, 2, '#3a3a4a').v(1, 14, 2, '#3a3a4a');
  b.v(-1, 11, 2, INK).v(0, 10, 2, INK).v(1, 11, 2, INK);
  return b.box(-2, 2, 10, 10, -2, 2, '#c42a28').list();
}

/** Bombenpinguin: schwarz-weiß, Bombe auf dem Rücken, Fliegerbrille */
export function bombenpinguin(): Vox[] {
  const b = new VoxBuilder()
    .box(-1, -1, 0, 0, 0, 1, '#ff9a1a').box(1, 1, 0, 0, 0, 1, '#ff9a1a')
    .box(-3, 3, 1, 7, -2, 2, '#24202e').box(-2, 2, 1, 6, 3, 3, '#ffffff')
    .box(-4, -4, 3, 5, -1, 1, '#24202e').box(4, 4, 3, 5, -1, 1, '#24202e')
    .box(-2, 2, 8, 9, -2, 2, '#24202e').box(-2, 1, 7, 7, 3, 4, '#ff9a1a')
    .box(-3, 3, 9, 9, 3, 3, '#7a5a3a').v(-2, 9, 3, '#a8f6ff', 1).v(1, 9, 3, '#a8f6ff', 1)
    .box(-1, 1, 3, 6, -4, -3, '#3a3a4a').v(0, 7, -4, '#6b4b2e').v(0, 8, -4, '#ff7a1a', 1);
  return b.v(-2, 10, 3, INK).v(-1, 10, 2, INK).v(1, 10, 2, INK).v(2, 10, 3, INK).list();
}

/** König Gockel: Riesenhahn mit Krone und Umhang */
export function koenigGockel(): Vox[] {
  const b = new VoxBuilder();
  b.box(-2, -1, 0, 3, 0, 1, '#ff9a1a').box(1, 2, 0, 3, 0, 1, '#ff9a1a').box(-3, -1, 0, 0, 2, 3, '#ff9a1a').box(1, 3, 0, 0, 2, 3, '#ff9a1a');
  b.box(-5, 5, 4, 12, -5, 4, '#f4ecff');
  b.box(-6, 6, 5, 13, -6, -6, '#8a1a3a').box(-6, -6, 5, 12, -5, 2, '#8a1a3a').box(6, 6, 5, 12, -5, 2, '#8a1a3a');
  for (const [x, y] of [[-3, 14], [0, 15], [3, 14], [-2, 16], [2, 16]]) b.box(x, x, y, y + 4, -8, -7, ['#ff7a1a', '#3d9bff', '#5dff7a', '#ff3df0', '#ffd23f'][(x + 3) % 5]);
  b.box(-4, 4, 13, 20, -1, 5, '#f4ecff');
  b.box(-1, 1, 15, 16, 6, 8, '#ffb02e').v(0, 14, 6, '#ff3d3d').v(0, 13, 6, '#ff3d3d');
  angryFace(b, 0, 18, 6, { mouth: '', gap: 2 });
  b.box(-4, 4, 21, 21, -1, 5, '#ffd23f');
  for (const x of [-4, -2, 0, 2, 4]) b.v(x, 22, 2, '#ffd23f').v(x, 23, 2, x === 0 ? '#ff3d6a' : '#ffd23f', x === 0 ? 1 : 0);
  return b.box(-1, 1, 22, 24, -2, -2, '#ff3d3d').list();
}

/** Toastomat 3000: großer Toaster mit vier Schlitzen, Raupenfüßen und Krone aus Toast */
export function megatoaster(): Vox[] {
  const chrome = '#c9ced8', dark = '#8d93a3', led = '#ff2a4a';
  const b = new VoxBuilder()
    .box(-6, -3, 0, 2, -4, 4, '#2a2e38').box(3, 6, 0, 2, -4, 4, '#2a2e38')
    .box(-6, 6, 3, 15, -4, 4, chrome).box(-6, -6, 3, 15, -4, 4, dark).box(6, 6, 3, 15, -4, 4, dark)
    .box(-4, 4, 15, 15, -3, -3, '#2a2e38').box(-4, 4, 15, 15, -1, -1, '#2a2e38').box(-4, 4, 15, 15, 1, 1, '#2a2e38').box(-4, 4, 15, 15, 3, 3, '#2a2e38')
    .box(-4, 4, 16, 18, -3, -3, '#c98a3a').box(-4, 4, 16, 17, 1, 1, '#c98a3a').box(-4, 4, 16, 19, 3, 3, '#c98a3a').box(-4, 4, 16, 16, -1, -1, '#ff7a1a', 1)
    .v(-3, 11, 5, '#ffffff', 1).v(2, 11, 5, '#ffffff', 1).v(-4, 11, 5, '#ffffff', 1).v(3, 11, 5, '#ffffff', 1)
    .v(-5, 14, 5, led, 1).v(-4, 13, 5, led, 1).v(-3, 12, 5, led, 1).v(5, 14, 5, led, 1).v(4, 13, 5, led, 1).v(3, 12, 5, led, 1)
    .box(-4, 4, 6, 7, 5, 5, '#2a2e38').v(-3, 8, 5, '#fff6d8').v(3, 8, 5, '#fff6d8')
    .box(7, 8, 9, 10, -1, 0, '#5a5f68').box(9, 9, 9, 12, -1, 0, '#ff3d3d');
  return b.list();
}

/** Pilzkönigin Morchella: riesiger Pilz, Spitzenkragen, Krone */
export function morchella(): Vox[] {
  const b = new VoxBuilder();
  b.box(-3, 3, 0, 10, -3, 3, '#f2e2c8');
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (x * x + z * z <= 26 && (x + z) % 2 === 0) b.v(x, 9, z, '#ffffff');
  for (let y = 11; y <= 16; y++) {
    const r = y < 14 ? 8 : 18 - y + 3;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r) b.v(x, y, z, (x * 3 + z * 5 + y) % 9 === 0 ? '#ffffff' : '#9a3ab0');
  }
  b.box(-2, 2, 17, 17, -2, 2, '#ffd23f').v(-2, 18, 0, '#ffd23f').v(0, 18, 0, '#7dff5a', 1).v(2, 18, 0, '#ffd23f');
  angryFace(b, 0, 6, 4, { mouth: '#a8505a', tusks: false, gap: 1 });
  return b.v(-1, 3, 4, '#a8505a').v(0, 3, 4, '#a8505a').v(-8, 12, 0, '#7dff5a', 1).v(8, 12, 2, '#7dff5a', 1).list();
}
