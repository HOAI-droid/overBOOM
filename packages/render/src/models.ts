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
/** Schild-Symbol für gepanzerte Gegner: kleines Wappenschild, steht aufrecht und zeigt zur Kamera */
export function panzerSchild(): Vox[] {
  const r = '#c9ced8', d = '#8d93a3', c = '#3de8ff';
  const b = new VoxBuilder();
  for (let y = 0; y < 5; y++) {
    const w = y === 0 ? 1 : 2;
    for (let x = -w; x <= w; x++) b.v(x, y, 0, Math.abs(x) === w || y === 4 ? r : d);
  }
  return b.v(0, 2, 1, c, 1).v(0, 3, 1, c, 1).list();
}

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
  morchella: ['#9a3ab0', '#ffffff', '#f2e2c8', '#7dff5a', '#ffd23f'],
  baronin_gackerella: ['#f4ecff', '#c8327e', '#4a2370', '#ffd23f', '#ff3df0', '#3de8ff'],
  baron_blitzbirne: ['#ffe680', '#fff3c4', '#3b2b66', '#d8a04a', '#3de8ff', '#ff3df0'],
  baronin_schraubella: ['#c9ced8', '#8d93a3', '#ffd23f', '#d8a04a', '#ff3df0', '#6b707a'],
  baronin_sporella: ['#1f7a72', '#ffd23f', '#f2e2c8', '#5dbb3a', '#3d8a2a', '#ff3df0'],
  baron_glutbauch: ['#3a2a2a', '#ff7a1a', '#ffd23f', '#9a90a8', '#c8c0d0', '#2a2140'],
  baronin_frostine: ['#a8f6ff', '#e8fdff', '#f4f8ff', '#3de8ff', '#6ad0f0', '#d8ecff'],
  kawumm: ['#ff7a1a', '#ffd23f', '#fff3c4', '#ff5a14', '#6a1e1a', '#2b1440', '#ff3df0']
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

/* ------------------------------------------------------------------ */
/* Inselbarone, -baroninnen und das Große Kawumm                         */
/* ------------------------------------------------------------------ */

/** VoxBuilder, der weiß, welche Zellen belegt sind (für Gesichter auf runden Formen). */
class Bau extends VoxBuilder {
  private belegt = new Set<string>();
  override v(x: number, y: number, z: number, c: string, glow = 0): this {
    this.belegt.add(x + ',' + y + ',' + z);
    return super.v(x, y, z, c, glow);
  }
  override box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string, glow = 0): this {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.v(x, y, z, c, glow);
    return this;
  }
  override del(x: number, y: number, z: number): this {
    this.belegt.delete(x + ',' + y + ',' + z);
    return super.del(x, y, z);
  }
  hat(x: number, y: number, z: number): boolean {
    return this.belegt.has(x + ',' + y + ',' + z);
  }
  /** Vorderste belegte z-Zelle der Spalte (x, y), sonst NaN */
  vorne(x: number, y: number): number {
    for (let z = 40; z >= -40; z--) if (this.hat(x, y, z)) return z;
    return NaN;
  }
  /** Vordersten Voxel der Spalte umfärben (dz = 0) oder davor setzen (dz = 1) */
  vorn(x: number, y: number, c: string, glow = 0, dz = 0): this {
    const z = this.vorne(x, y);
    return Number.isNaN(z) ? this : this.v(x, y, z + dz, c, glow);
  }
  /** Ellipsoid; `farbe` liefert Farbe (oder [Farbe, Leuchten]) je Zelle, null = leer */
  kugel(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number,
    farbe: (x: number, y: number, z: number) => string | [string, number] | null): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz > 1) continue;
          const f = farbe(x, y, z);
          if (f === null) continue;
          if (typeof f === 'string') this.v(x, y, z, f);
          else this.v(x, y, z, f[0], f[1]);
        }
    return this;
  }
}

/** kleiner Pseudo-Zufall aus Koordinaten (0..1), für Muster */
function rausch(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Grimmiges Gesicht auf einer runden Vorderseite: Augen und Mund werden auf die
 * Oberfläche gemalt, die schrägen Brauen stehen einen Voxel vor (gut lesbar von schräg oben).
 * `dame`: Wimpern, Lippenstift-Schmollmund und Rouge statt Hauern.
 */
function rundGesicht(b: Bau, cx: number, y: number, o: {
  gap?: number; brow?: string; eye?: string; pupil?: string; eyeGlow?: number; mouth?: string; tusks?: boolean;
  dame?: { lippen: string; rouge: string; wimpern?: string };
} = {}): Bau {
  const g = o.gap ?? 1, brow = o.brow ?? '#2b1d14', eye = o.eye ?? '#ffffff', pup = o.pupil ?? INK, eg = o.eyeGlow ?? 0;
  const L = cx - g - 1, R = cx + g;
  b.vorn(L, y, eye, eg).vorn(L + 1, y, pup).vorn(R, y, pup).vorn(R + 1, y, eye, eg);
  // Augen zwei Voxel hoch: oben weiß, damit sie rund wirken
  b.vorn(L, y - 1, eye, eg).vorn(L + 1, y - 1, eye, eg).vorn(R, y - 1, eye, eg).vorn(R + 1, y - 1, eye, eg);
  b.vorn(L - 1, y + 2, brow, 0, 1).vorn(L, y + 2, brow, 0, 1).vorn(L + 1, y + 1, brow, 0, 1)
    .vorn(R, y + 1, brow, 0, 1).vorn(R + 1, y + 2, brow, 0, 1).vorn(R + 2, y + 2, brow, 0, 1);
  if (o.dame) {
    const w = o.dame.wimpern ?? INK;
    b.vorn(L - 1, y, w).vorn(L - 1, y - 1, w).vorn(R + 2, y, w).vorn(R + 2, y - 1, w);
    b.vorn(L - 1, y - 3, o.dame.rouge).vorn(R + 2, y - 3, o.dame.rouge);
    if (o.dame.lippen) {
      for (let x = L + 1; x <= R; x++) b.vorn(x, y - 4, o.dame.lippen);
      b.vorn(cx, y - 5, o.dame.lippen);
      if (g === 1) b.vorn(cx - 1, y - 5, o.dame.lippen);
    }
  } else if (o.mouth !== '') {
    for (let x = L; x <= R + 1; x++) b.vorn(x, y - 4, o.mouth ?? '#5a1a2a');
    if (o.tusks !== false) b.vorn(L, y - 3, '#fff6d8').vorn(R + 1, y - 3, '#fff6d8');
  }
  return b;
}

/** Baronin Gackerella von Federstein: hochnäsige Riesenhenne im Rüschenkleid, Federhut, Lorgnette. Blick +z. */
export function baroninGackerella(): Vox[] {
  const fed = '#f4ecff', fedD = '#ddd2ec', kleid = '#c8327e', kleidD = '#9a2266', gold = '#ffd23f', hut = '#4a2370';
  const b = new Bau();
  // Hühnerbeine mit Krallen
  b.box(-3, -2, 0, 2, 0, 1, '#ff9a1a').box(2, 3, 0, 2, 0, 1, '#ff9a1a').box(-4, -1, 0, 0, 2, 3, '#ff9a1a').box(1, 4, 0, 0, 2, 3, '#ff9a1a');
  // Rüschenrock (Glocke) mit goldenem Saum
  b.kugel(0, 3, 0, 7.5, 6, 7.5, (x, y, z) => {
    if (y < 1 || y > 8) return null;
    if (y === 1) return gold;
    const a = Math.atan2(x, z);
    return Math.floor(a * 2.5 + 10) % 2 ? kleidD : kleid;
  });
  b.box(-1, 1, 3, 8, 6, 7, fed); // Schürzchen aus Federn vorne
  // gefiederter Oberkörper, Brust nach vorne gereckt
  b.kugel(0, 12, 0.5, 5.5, 4.5, 5.5, (x, y, z) => (z < -2 && (x + y) % 3 === 0 ? fedD : fed));
  // Perlenkette
  for (let x = -3; x <= 3; x++) b.vorn(x, 14 - (Math.abs(x) > 2 ? 0 : 1), '#fff6f0', 0, 1);
  b.vorn(0, 12, '#ff3df0', 1, 1);
  // Schwanzfedern hinten als Fächer
  for (let i = -3; i <= 3; i++) for (let k = 0; k < 6 - Math.abs(i); k++) b.v(i * 1, 11 + k, -6 - (k >> 1), i % 2 ? kleid : fed);
  // Flügel: links angelegt, rechts erhoben mit der Lorgnette
  b.box(-7, -6, 9, 13, -2, 2, fedD).box(-7, -7, 8, 9, -1, 1, fed);
  b.box(6, 7, 11, 14, -1, 1, fedD).box(7, 8, 15, 17, 0, 2, fedD);
  // Lorgnette: goldener Stiel, zwei Gläser vor dem Gesicht
  b.box(8, 8, 18, 20, 3, 3, gold);
  // großer Kopf
  b.kugel(0, 20, 1.5, 5, 5, 5, () => fed);
  rundGesicht(b, 0, 20, { gap: 1, brow: '#4a1a3a', mouth: '', dame: { lippen: '', rouge: '#ff9ac8' } });
  // Schnabel hochnäsig nach oben gereckt
  b.vorn(-1, 17, '#ffb02e', 0, 1).vorn(0, 17, '#ffb02e', 0, 1).vorn(-1, 18, '#ffb02e', 0, 1).vorn(0, 18, '#ffb02e', 0, 1);
  b.vorn(-1, 18, '#ff9a1a', 0, 1).vorn(0, 18, '#ff9a1a', 0, 1).vorn(0, 19, '#ffb02e', 0, 1);
  // Kehllappen
  b.vorn(-1, 16, '#ff3d3d', 0, 1).vorn(0, 16, '#ff3d3d', 0, 1).vorn(0, 15, '#ff3d3d', 0, 1).vorn(-1, 15, '#ff3d3d', 0, 1);
  // Lorgnette neben dem Gesicht (Goldrahmen, Gläser leuchten)
  const lz = b.vorne(4, 20) + 1;
  b.box(4, 7, 22, 22, lz, lz, gold).box(4, 7, 18, 18, lz, lz, gold).box(4, 4, 18, 22, lz, lz, gold).box(7, 7, 18, 22, lz, lz, gold).box(5, 6, 20, 20, lz, lz, gold);
  b.box(5, 6, 21, 21, lz, lz, '#a8f6ff', 1).box(5, 6, 19, 19, lz, lz, '#a8f6ff', 1);
  b.box(8, 8, 15, 19, lz - 1, lz - 1, gold);
  // Federhut, nach hinten gerückt und vorne hochgeklappt, damit das Gesicht frei bleibt
  for (let x = -6; x <= 6; x++) for (let z = -7; z <= 5; z++) {
    const d2 = x * x + (z + 1) * (z + 1);
    if (d2 > 34) continue;
    b.v(x, 25 + (z > 2 ? 1 : 0) + (z > 4 ? 1 : 0), z, d2 > 24 ? '#2e1450' : hut);
  }
  b.kugel(0, 27, -1.5, 3.6, 2.4, 3.6, (x, y) => (y <= 26 ? gold : hut));
  // Riesenfedern: Magenta, Cyan, Gelb
  const feder = (x0: number, z0: number, c: string, h: number, dx: number) => {
    for (let k = 0; k < h; k++) {
      const x = x0 + Math.round(dx * (k / h) ** 2 * 4), y = 28 + Math.round(k * (1 - k / (h * 2.2))), z = z0 - Math.round((k / h) ** 2 * h * 0.9);
      const f = k >= h - 2 ? shade(c, 1.15) : c;
      b.box(x, x + 1, y, y, z, z + 1, f);
    }
  };
  feder(-3, -2, '#ff3df0', 9, -1);
  feder(1, -3, '#3de8ff', 7, 1);
  feder(-1, -4, gold, 5, 0);
  b.v(-3, 27, 2, '#ff3df0', 1).v(-4, 27, 2, '#ffd23f'); // Brosche am Hut
  return b.list();
}

/** Baron Blitzbirne: eitler Edelmann im Frack voller Kabel, riesige leuchtende Glühbirne als Kopf. Blick +z. */
export function baronBlitzbirne(): Vox[] {
  const frack = '#3b2b66', frackD = '#2a1f45', hemd = '#f4ecff', messing = '#d8a04a', messingD = '#a87828';
  const b = new Bau();
  // Lackschuhe und Röhrenhosen
  b.box(-3, -1, 0, 0, -1, 2, '#141018').box(1, 3, 0, 0, -1, 2, '#141018').v(-2, 0, 2, '#5a5468').v(2, 0, 2, '#5a5468');
  b.box(-3, -1, 1, 5, -1, 1, frackD).box(1, 3, 1, 5, -1, 1, frackD);
  // Frack mit Schwalbenschwänzen
  b.kugel(0, 10, 0, 5, 5, 3.5, (x, y, z) => (y < 6 ? null : z > 1 && Math.abs(x) <= 1 ? hemd : frack));
  b.box(-4, -1, 3, 8, -4, -3, frack).box(1, 4, 3, 8, -4, -3, frack).box(-4, -2, 2, 2, -4, -4, frackD).box(2, 4, 2, 2, -4, -4, frackD);
  // Revers, Fliege, Knöpfe
  b.vorn(-2, 13, frackD, 0, 1).vorn(-2, 12, frackD, 0, 1).vorn(2, 13, frackD, 0, 1).vorn(2, 12, frackD, 0, 1);
  b.vorn(-2, 14, '#ff3df0', 0, 1).vorn(-1, 14, '#ff3df0', 0, 1).vorn(1, 14, '#ff3df0', 0, 1).vorn(2, 14, '#ff3df0', 0, 1).vorn(0, 14, '#c42a9a', 0, 1);
  for (const y of [8, 10, 12]) b.vorn(0, y, '#ffd23f');
  // Kabel winden sich um den Frack (gelb und cyan, mit Funken)
  for (let a = 0; a < 26; a++) {
    const w = a / 26 * Math.PI * 2;
    const x = Math.round(Math.sin(w) * 5.2), z = Math.round(Math.cos(w) * 3.8);
    b.v(x, 7 + Math.round(a / 9), z, '#ffd23f');
    b.v(Math.round(Math.sin(w + 2) * 5.2), 11 - Math.round(a / 13), Math.round(Math.cos(w + 2) * 3.8), '#3de8ff');
  }
  // Ärmchen mit weißen Handschuhen, ein Kabel als Peitsche
  b.box(-7, -6, 9, 13, -1, 1, frack).box(-7, -6, 7, 8, -1, 1, hemd);
  b.box(6, 7, 9, 13, -1, 1, frack).box(6, 7, 7, 8, -1, 1, hemd);
  b.box(8, 8, 6, 6, 0, 1, '#ffd23f').box(9, 9, 4, 5, 2, 2, '#ffd23f').v(9, 3, 3, '#a8f6ff', 1).v(10, 3, 2, '#3de8ff', 1);
  // Kabel vom Rücken in die Fassung
  b.box(-3, -3, 13, 16, -4, -4, '#3de8ff').box(3, 3, 12, 16, -4, -4, '#ffd23f');
  // Schraubfassung aus Messing mit Gewinderillen
  for (let y = 15; y <= 18; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    if (x * x + z * z > 10) continue;
    b.v(x, y, z, y % 2 ? messing : messingD);
  }
  // riesige Glühbirne (leuchtet), heller Glanzpunkt
  b.kugel(0, 25, 0.5, 6.5, 7, 6.5, (x, y, z) => {
    if (y < 19) return null;
    if (y <= 20 && x * x + (z - 0.5) * (z - 0.5) > 12) return null;
    const hell = x < -2 && y > 27;
    return [hell ? '#fffbe6' : y > 29 ? '#fff3c4' : '#ffe680', 1];
  });
  // Glühfaden schimmert durch den Scheitel
  b.v(-1, 32, 0, '#ff7a1a', 1).v(0, 32, 0, '#ff7a1a', 1).v(1, 32, 0, '#ff7a1a', 1);
  // Gesicht auf dem Glas: dunkle Augen mit Glanz, dicke Brauen, gezwirbelter Draht-Schnurrbart
  const d = '#2a1f45';
  b.vorn(-3, 25, d).vorn(-2, 25, d).vorn(-3, 24, d).vorn(-2, 24, '#ffffff', 1);
  b.vorn(2, 25, d).vorn(3, 25, d).vorn(3, 24, d).vorn(2, 24, '#ffffff', 1);
  b.vorn(-5, 28, d, 0, 1).vorn(-4, 28, d, 0, 1).vorn(-3, 27, d, 0, 1).vorn(-2, 27, d, 0, 1).vorn(-1, 26, d, 0, 1);
  b.vorn(5, 28, d, 0, 1).vorn(4, 28, d, 0, 1).vorn(3, 27, d, 0, 1).vorn(2, 27, d, 0, 1).vorn(1, 26, d, 0, 1);
  for (let x = -3; x <= 3; x++) b.vorn(x, 22, d, 0, 1);
  b.vorn(-4, 23, d, 0, 1).vorn(4, 23, d, 0, 1).vorn(-5, 24, d, 0, 1).vorn(5, 24, d, 0, 1);
  b.vorn(-1, 21, '#7a2a3a').vorn(0, 21, '#7a2a3a').vorn(1, 21, '#7a2a3a');
  // eitles Zylinderchen schräg auf dem Glas
  b.box(-2, 3, 33, 33, -2, 3, '#141018').box(-1, 2, 34, 36, -1, 2, '#141018').box(-1, 2, 34, 34, -1, 2, '#ff3df0');
  return b.list();
}

/** Baronin Schraubella: elegante Blechdame im Glockenrock, Zahnrad-Krone, Schrauben-Monokel, Aufziehschlüssel. Blick +z. */
export function baroninSchraubella(): Vox[] {
  const chrom = '#c9ced8', chromD = '#8d93a3', stahl = '#6b707a', gold = '#ffd23f', goldD = '#d8a04a';
  const b = new Bau();
  // Glockenrock mit Nieten und Goldbändern
  for (let y = 0; y <= 10; y++) {
    const r = 7.5 - y * 0.33;
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
      const d = Math.hypot(x, z);
      if (d > r) continue;
      const a = Math.atan2(x, z);
      const bahn = Math.floor(a * 3 + 20) % 2;
      const c = y === 0 || y === 6 ? goldD : d > r - 1.2 && y % 3 === 1 && bahn ? '#e8ecf2' : bahn ? chrom : chromD;
      b.v(x, y, z, c);
    }
  }
  // Mieder mit Juwel
  b.kugel(0, 12.5, 0, 3.2, 2, 3, () => stahl);
  // Oberkörper
  b.kugel(0, 15.5, 0, 4, 2.5, 3.2, () => chrom);
  // Röhrenärmchen, Hände in die Hüfte gestemmt
  b.box(-6, -5, 13, 16, -1, 0, chromD).box(-6, -5, 10, 12, 0, 1, stahl).box(-4, -4, 10, 10, 0, 1, stahl);
  b.box(5, 6, 13, 16, -1, 0, chromD).box(5, 6, 10, 12, 0, 1, stahl).box(4, 4, 10, 10, 0, 1, stahl);
  b.v(-6, 16, 0, gold).v(6, 16, 0, gold);
  // Aufziehschlüssel im Rücken
  b.box(0, 0, 16, 16, -4, -5, stahl).box(-3, 3, 15, 17, -6, -6, goldD).box(-2, 2, 16, 16, -6, -6, '#2a2e38');
  // Hals
  b.box(-1, 1, 18, 18, -1, 1, stahl);
  // großer runder Blechkopf
  b.kugel(0, 23.5, 0.5, 5.5, 5, 5, (x, y, z) => (z < -2 && (x + y) % 4 === 0 ? chromD : '#e2e6ee'));
  rundGesicht(b, 0, 23, { gap: 1, brow: INK, eye: '#ffffff', eyeGlow: 1, dame: { lippen: '#ff3df0', rouge: '#ff9ac8' } });
  // Nieten auf den Wangen, Mutter-Ohrringe mit leuchtenden Tropfen
  b.v(-5, 23, 1, stahl).v(5, 23, 1, stahl).box(-6, -6, 20, 21, 0, 0, gold).box(6, 6, 20, 21, 0, 0, gold).v(-6, 19, 0, '#3de8ff', 1).v(6, 19, 0, '#3de8ff', 1);
  // Schrauben-Monokel über dem rechten Auge: Goldring, leuchtendes Glas, hochgezogene Braue, Schraube und Kettchen
  const mz = b.vorne(2, 22) + 1;
  for (let x = 0; x <= 3; x++) for (let y = 21; y <= 24; y++) {
    const rand = x === 0 || x === 3 || y === 21 || y === 24;
    b.v(x, y, mz, rand ? gold : x === 1 && y === 23 ? INK : '#a8f6ff', rand ? 0 : x === 1 && y === 23 ? 0 : 1);
  }
  b.v(1, 25, mz, INK).v(2, 26, mz, INK).v(3, 26, mz, INK).v(4, 26, mz, INK);
  b.v(4, 22, mz, goldD).v(5, 22, mz, gold).v(5, 23, mz, gold).v(5, 21, mz, gold);
  b.v(3, 20, mz, goldD).v(3, 19, mz, goldD).v(4, 18, mz, goldD);
  // Seidenschärpe mit Schleife (Magenta)
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (b.hat(x, 12, z) && !(b.hat(x + 1, 12, z) && b.hat(x - 1, 12, z) && b.hat(x, 12, z + 1) && b.hat(x, 12, z - 1))) b.v(x, 12, z, '#ff3df0');
  b.vorn(0, 12, '#ffb0f8', 1, 1);
  b.box(-3, -1, 11, 13, -4, -4, '#ff3df0').box(1, 3, 11, 13, -4, -4, '#ff3df0').v(0, 12, -4, '#c42a9a').box(-1, 1, 8, 10, -4, -4, '#c42a9a');
  // Zahnrad-Krone: Goldreif und ein stehendes Zahnrad (Ring mit Zähnen und Speichen), Edelstein in der Nabe
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    const d = Math.hypot(x, z + 0.5);
    if (d <= 4.4 && d > 3) b.v(x, 28, z, (Math.round(Math.atan2(x, z) * 2.5) & 1) ? gold : goldD);
  }
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) {
    const d = Math.hypot(x, y), a = Math.atan2(y, x);
    const zahn = Math.cos(a * 8) > 0.3;
    // drei Speichen im Y (90°, 210°, 330°)
    const speiche = d < 3.6 && [Math.PI / 2, Math.PI * 7 / 6, -Math.PI / 6].some((w) => Math.abs(x * Math.sin(w) - y * Math.cos(w)) < 0.55 && x * Math.cos(w) + y * Math.sin(w) > 0);
    if (!(speiche || (d >= 3.2 && d <= (zahn ? 5.9 : 4.6)))) continue;
    if (y < -3) continue;
    b.v(x, 32 + y, -2, gold).v(x, 32 + y, -3, goldD);
  }
  b.v(0, 32, -1, '#ff3df0', 1).v(0, 32, -2, '#ff3df0', 1);
  return b.list();
}

/** Baronin Sporella: Pilzbaronin, Hut so groß wie ein Gartenteich, Moos-Schleier, Sporen-Kette. Blick +z. */
export function baroninSporella(): Vox[] {
  const stiel = '#fff0dc', stielD = '#e8d4b4', kleid = '#a04ac0', kleidH = '#c070e0', hut = '#1f7a72', hutD = '#155a56', punkt = '#ffd23f', moos = ['#5dbb3a', '#3d8a2a', '#7dcc4a'];
  const b = new Bau();
  // Rock wie ein Pilzstiel mit Moos-Saum
  b.kugel(0, 2, 0, 6.5, 8, 6.5, (x, y, z) => {
    if (y < 0 || y > 9) return null;
    if (y <= 1) return moos[Math.floor(rausch(x, y, z) * 3)];
    return Math.floor(Math.atan2(x, z) * 3 + 20) % 2 ? kleid : kleidH;
  });
  // Ärmchen mit Moos-Handschuhen
  b.box(-6, -5, 8, 11, -1, 1, kleid).box(-6, -5, 6, 7, -1, 1, moos[1]);
  b.box(5, 6, 8, 11, -1, 1, kleid).box(5, 6, 6, 7, -1, 1, moos[1]);
  // Kopf
  b.kugel(0, 14, 0.5, 4.5, 4.5, 4.5, () => stiel);
  rundGesicht(b, 0, 14, { gap: 1, brow: '#2b1440', eyeGlow: 1, dame: { lippen: '#ff3df0', rouge: '#ff9ac8' } });
  // Kette aus leuchtenden Sporen
  for (const [x, c] of [[-3, '#ff3df0'], [-1, '#3de8ff'], [1, '#ff3df0'], [3, '#3de8ff']] as [number, string][]) b.vorn(x, 10 - (Math.abs(x) < 2 ? 1 : 0), c, 1, 1);
  // Riesenhut, nach hinten gekippt (vorne höher), mit goldenen Tupfen
  const R = 10.5;
  const kipp = (z: number) => Math.round(z * 0.22);
  for (let x = -11; x <= 11; x++) for (let z = -11; z <= 11; z++) {
    const d = Math.hypot(x, z);
    if (d > R) continue;
    const h = Math.round(Math.sqrt(1 - (d / R) ** 2) * 6);
    const y0 = 20 + kipp(z);
    // Lamellen unten
    b.v(x, y0, z, d > R - 1.2 ? hutD : '#e8d0b8');
    for (let y = 1; y <= h; y++) {
      const tupf = y === h && ((x * 7 + z * 13) & 7) === 0 && d < R - 1.5;
      b.v(x, y0 + y, z, tupf ? punkt : d > R - 1.6 || ((x + z) & 3) === 0 && y === h ? hutD : hut);
    }
    // Moos-Schleier hängt vom Rand – vorne frei fürs Gesicht
    if (d > R - 1 && Math.abs(Math.atan2(x, z)) > 0.75) {
      const len = 3 + Math.floor(rausch(x, 0, z) * 6);
      for (let k = 1; k <= len; k++) b.v(x, y0 - k, z, moos[(k + x) % 3 < 0 ? 0 : (k + x) % 3]);
    }
  }
  // feiner Schleier vor der Stirn
  for (let x = -4; x <= 4; x += 2) b.vorn(x, 19, moos[2], 0, 1);
  // Sporenwölkchen über dem Hut
  b.v(-4, 29, 2, '#c9a0ff', 1).v(3, 30, -2, '#c9a0ff', 1).v(6, 28, 3, '#ff8af0', 1).v(-7, 27, -3, '#c9a0ff', 1);
  // Stiel-Hals verbindet Kopf und Hut
  b.box(-2, 2, 19, 20, -2, 1, stielD);
  return b.list();
}

/** Baron Glutbauch: kugelrunder Magma-Fürst, glühender Bauch, Rauch-Schnauzbart, Obsidian-Krönchen. Blick +z. */
export function baronGlutbauch(): Vox[] {
  const kruste = '#3a2a2a', krusteD = '#2a1f25', glut = '#ff7a1a', hell = '#ffd23f', rauch = '#9a90a8', rauchH = '#c8c0d0';
  const b = new Bau();
  // Stummelfüße
  b.box(-5, -2, 0, 1, -1, 3, krusteD).box(2, 5, 0, 1, -1, 3, krusteD).v(-4, 1, 3, glut, 1).v(3, 1, 3, glut, 1);
  // Kugelkörper aus Kruste mit glühenden Rissen, vorne der glühende Bauch
  b.kugel(0, 11, 0, 9.5, 9.5, 9, (x, y, z) => {
    const bx = x / 6, by = (y - 8) / 5;
    if (z > 4 && bx * bx + by * by < 1) {
      const k = bx * bx + by * by;
      return [k < 0.3 ? '#fff3c4' : k < 0.65 ? hell : glut, 1];
    }
    if (z > 3 && bx * bx + by * by < 1.35) return '#5a2a1a';
    if (z > 4 && y >= 13 && y <= 19 && Math.abs(x) <= 7) return '#a8502e';
    const riss = Math.abs(Math.sin(x * 0.9 + y * 0.6) + Math.cos(z * 0.8 - y * 0.5)) < 0.18;
    if (riss) return [glut, 1];
    return rausch(x, y, z) < 0.3 ? krusteD : kruste;
  });
  // Ärmchen mit glühenden Knöcheln
  b.box(-11, -9, 9, 11, -1, 1, kruste).box(-12, -11, 7, 8, -1, 1, krusteD).v(-12, 8, 1, glut, 1);
  b.box(9, 11, 9, 11, -1, 1, kruste).box(11, 12, 7, 8, -1, 1, krusteD).v(12, 8, 1, glut, 1);
  // Gesicht: glühende Augen, Wutbrauen aus Obsidian
  rundGesicht(b, 0, 16, { gap: 1, brow: '#141018', eye: hell, eyeGlow: 1, pupil: INK, mouth: '' });
  b.vorn(-4, 18, '#141018', 0, 1).vorn(3, 18, '#141018', 0, 1);
  // Rauch-Schnauzbart: zwei dicke Wölkchen-Hälften, an den Enden hochgezwirbelt
  for (let x = -7; x <= 7; x++) {
    const ax = Math.abs(x);
    if (ax === 0) { b.vorn(x, 13, rauch, 0, 1); continue; }
    if (ax <= 5) b.vorn(x, 13, rauchH, 0, 1).vorn(x, 12, rauch, 0, 1);
    if (ax >= 2 && ax <= 4) b.vorn(x, 11, rauch, 0, 1);
    if (ax >= 5) b.vorn(x, 14, rauchH, 0, 1);
    if (ax >= 6) b.vorn(x, 15, rauchH, 0, 1);
  }
  b.vorn(-7, 16, rauch, 0, 1).vorn(7, 16, rauch, 0, 1).vorn(-6, 16, rauchH, 0, 1).vorn(6, 16, rauchH, 0, 1);
  // Hauer unterm Bart
  b.vorn(-2, 10, '#fff6d8', 0, 1).vorn(1, 10, '#fff6d8', 0, 1);
  // Obsidian-Krönchen mit Lavasteinen
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (x * x + z * z <= 10) b.v(x, 20, z, '#2a2140');
  for (const [x, z] of [[-3, 0], [3, 0], [0, 3], [0, -3], [-2, 2], [2, 2]]) b.v(x, 21, z, '#2a2140').v(x, 22, z, (x + z) % 2 ? '#ff5a14' : hell, 1);
  b.v(0, 21, 3, '#ff3df0', 1);
  // Rauchwölkchen
  b.box(-6, -5, 22, 23, -3, -2, rauch).v(-5, 24, -3, rauchH).box(5, 6, 23, 24, -4, -3, rauch).v(5, 25, -4, rauchH).v(-2, 25, -5, rauch);
  return b.list();
}

/** Baronin Frostine von Bibberstein: Eiskristall-Kleid, Pelzkragen, Schneeflocken-Diadem, Eiszepter. Blick +z. */
export function baroninFrostine(): Vox[] {
  const eis = '#7ad8f8', eisD = '#3d9bd8', eisH = '#c8f4ff', pelz = '#ffffff', pelzD = '#dfe6f2', haut = '#f4e8f4';
  const b = new Bau();
  // facettiertes Eiskleid (Achteck, nach oben schmaler)
  for (let y = 0; y <= 11; y++) {
    const r = 7 - y * 0.33;
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
      const ax = Math.abs(x), az = Math.abs(z);
      if (Math.max(ax, az, (ax + az) * 0.72) > r) continue;
      const facette = (x > 0 ? 1 : 0) + (z > 0 ? 2 : 0);
      const c = (x * 5 + y * 3 + z * 7) % 11 === 0 ? eisH : facette === 3 ? eis : facette === 2 ? eisH : facette === 1 ? eisD : eis;
      b.v(x, y, z, c, (x * 5 + y * 3 + z * 7) % 23 === 0 ? 1 : 0);
    }
  }
  // Eiszacken am Saum
  for (const [x, z] of [[-6, 3], [6, 3], [0, 7], [-5, -4], [5, -4], [0, -7]]) {
    const sx = Math.sign(x), sz = Math.sign(z);
    b.v(x, 1, z, '#3de8ff', 1).v(x + sx, 2, z + sz, '#3de8ff', 1).v(x + sx, 3, z + sz, eisH, 1);
  }
  // Mieder
  b.kugel(0, 13, 0, 3.5, 2, 3, (x, y) => (y === 12 ? '#2a3a8a' : eisD));
  b.vorn(0, 12, '#3de8ff', 1, 1);
  // Pelzkragen, flauschig
  b.kugel(0, 16, 0, 6, 2, 5, (x, y, z) => (rausch(x, y, z) < 0.25 ? null : rausch(z, x, y) < 0.35 ? pelzD : pelz));
  // Ärmel mit Pelzstulpen
  b.box(-7, -6, 10, 15, -1, 1, eis).box(-7, -6, 9, 10, -1, 1, pelz).box(-7, -6, 8, 8, 0, 1, haut);
  b.box(6, 7, 10, 15, -1, 1, eis).box(6, 7, 9, 10, -1, 1, pelz).box(6, 7, 8, 8, 0, 1, haut);
  // Eiszepter mit Schneeflocke
  b.box(8, 8, 6, 15, 2, 2, eisD).v(8, 16, 2, '#3de8ff', 1).v(8, 17, 2, eisH, 1).v(7, 17, 2, '#3de8ff', 1).v(9, 17, 2, '#3de8ff', 1).v(8, 18, 2, '#3de8ff', 1);
  // Kopf
  b.kugel(0, 21, 0.5, 5, 4.8, 4.8, () => haut);
  rundGesicht(b, 0, 21, { gap: 1, brow: '#1a2a5a', pupil: '#1a2a5a', eyeGlow: 1, dame: { lippen: '#c04ad8', rouge: '#f0b8d8', wimpern: '#1a2a5a' } });
  // Hochsteckfrisur (silberweiß-blau)
  b.kugel(0, 25, -1, 4.8, 2.5, 4.5, (x, y, z) => (z > 3 && y < 25 ? null : (x + y) % 3 === 0 ? '#5a8ad0' : '#7aa8e8'));
  b.kugel(0, 28.5, -2, 2.5, 2, 2.5, (x, y) => ((x + y) % 2 ? '#5a8ad0' : '#7aa8e8'));
  // Schneeflocken-Diadem (leuchtend, steht vor der Frisur)
  const dz = b.vorne(0, 26) + 1;
  for (let k = -3; k <= 3; k++) b.v(k, 26 + Math.round(Math.abs(k) * -0.34), dz, '#e8fdff', 1);
  const fy = 29, fz = dz;
  b.v(0, fy, fz, '#ffffff', 1);
  for (let k = 1; k <= 3; k++) {
    b.v(0, fy + k, fz, '#3de8ff', 1).v(0, fy - k, fz, '#3de8ff', 1).v(k, fy + (k > 2 ? 1 : 0), fz, '#3de8ff', 1).v(-k, fy + (k > 2 ? 1 : 0), fz, '#3de8ff', 1);
  }
  b.v(1, fy + 1, fz, '#a8f6ff', 1).v(-1, fy + 1, fz, '#a8f6ff', 1).v(1, fy - 1, fz, '#a8f6ff', 1).v(-1, fy - 1, fz, '#a8f6ff', 1);
  // Ohrstecker aus Eis
  b.v(-5, 20, 1, '#3de8ff', 1).v(5, 20, 1, '#3de8ff', 1);
  return b.list();
}

/**
 * Das Große Kawumm (Finale): brodelnder Feuerball mit Wutbrauen, riesigem Maul
 * und einer Lunte als Haarschopf; Flammenzungen und schwebende Glutbrocken. Blick +z.
 */
export function grossesKawumm(): Vox[] {
  const b = new Bau();
  const R = 12, cy = 13;
  // Feuerball: Hülle beleuchtet (gibt Form), glühende Adern und oben lodernde Glut
  b.kugel(0, cy, 0, R, R, R, (x, y, z) => {
    const h = (y - cy) / R;
    const n = rausch(x, y, z);
    const s = Math.sin(Math.atan2(x, z) * 3 + y * 0.45) + Math.sin(y * 0.3 - x * 0.2) * 0.6;
    if (s > 1.2) return h < -0.1 ? '#5a1420' : '#8a2a1a';
    if (Math.abs(s) < 0.12) return [h > 0.3 ? '#fff3c4' : '#ffd23f', 1];
    if (h > 0.55) return [n < 0.3 ? '#ff9a1a' : '#ffd23f', 1];
    if (h > 0.25) return n < 0.3 ? ['#ffd23f', 1] : '#ffc02e';
    if (h > -0.15) return n < 0.25 ? '#ffd23f' : '#ff9a1a';
    if (h > -0.55) return n < 0.3 ? '#ff9a1a' : '#ff7a1a';
    return n < 0.4 ? '#ff5a14' : '#d8401a';
  });
  // Gesicht frei von Schlieren: vorne glatt ausmalen
  for (let x = -9; x <= 9; x++) for (let y = 4; y <= 22; y++) {
    const z = b.vorne(x, y);
    if (Number.isNaN(z) || z < 6) continue;
    b.v(x, y, z, y > 17 ? '#ffd23f' : y > 11 ? '#ffb02e' : '#ff9a1a', 1);
  }
  // große Augen (3×3) mit Pupillen nach innen
  const auge = (x0: number, innen: number) => {
    for (let x = x0; x <= x0 + 2; x++) for (let y = 14; y <= 16; y++) b.vorn(x, y, '#ffffff', 1);
    b.vorn(innen, 14, INK).vorn(innen, 15, INK).vorn(innen + (innen > x0 + 1 ? -1 : 1), 14, INK).vorn(innen + (innen > x0 + 1 ? -1 : 1), 15, INK);
  };
  auge(-6, -4); auge(4, 4);
  // dicke Wutbrauen (zwei Voxel stark, stehen vor)
  const braue = '#2b1440';
  for (let i = 0; i <= 6; i++) {
    const y = 20 - Math.round(i * 0.55);
    for (const k of [0, 1, 2]) b.vorn(-8 + i, y - k + 1, braue, 0, 1).vorn(8 - i, y - k + 1, braue, 0, 1);
  }
  // riesiges, grimmig gebogenes Maul mit Zähnen, Zunge und zwei knuffigen Hauern
  for (let x = -7; x <= 7; x++) {
    const ax = Math.abs(x);
    const top = 11 - (ax > 5 ? 1 : 0);
    const bot = 5 + (ax > 3 ? 1 : 0) + (ax > 5 ? 1 : 0);
    for (let y = bot; y <= top; y++) b.vorn(x, y, y <= bot + 1 && ax <= 2 ? '#ff3d6a' : '#3a0a1a');
  }
  for (const x of [-5, -4, -2, -1, 1, 2, 4, 5]) b.vorn(x, 11, '#fff6d8');
  b.vorn(-6, 7, '#fff6d8', 0, 1).vorn(-6, 8, '#fff6d8', 0, 1).vorn(6, 7, '#fff6d8', 0, 1).vorn(6, 8, '#fff6d8', 0, 1);
  // Bäckchen
  b.vorn(-8, 12, '#ff5a6a', 1).vorn(-9, 12, '#ff5a6a', 1).vorn(8, 12, '#ff5a6a', 1).vorn(9, 12, '#ff5a6a', 1);
  // Flammenzungen am oberen Rand, nach außen lodernd (vorne frei fürs Gesicht)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    if (Math.cos(a) > 0.75) continue;
    const rr = R * (0.72 + (i % 3) * 0.06);
    const h = 4 + ((i * 5) % 4);
    const base = Math.round(cy + Math.sqrt(Math.max(0, R * R - rr * rr))) - 1;
    for (let k = 0; k < h; k++) {
      const r2 = rr + k * 0.45;
      const fx = Math.round(Math.sin(a) * r2), fz = Math.round(Math.cos(a) * r2);
      const c = k >= h - 1 ? '#ffd23f' : k >= h - 3 ? '#ff9a1a' : '#ff5a14';
      b.v(fx, base + k, fz, c, 1);
      if (k < h - 2) b.v(fx + 1, base + k, fz, c, 1).v(fx, base + k, fz + 1, c, 1).v(fx + 1, base + k, fz + 1, c, 1);
    }
  }
  // Lunte als Haarschopf: steht hoch und kringelt sich nach vorne, mit sprühendem Funken
  b.box(-2, 1, 25, 25, -3, 0, '#5a5468').box(-1, 0, 25, 25, -2, -1, '#24202e');
  const lunte: [number, number][] = [[26, -2], [27, -2], [28, -2], [29, -2], [30, -2], [31, -2], [32, -2], [33, -2], [34, -1], [35, -1], [36, 0], [37, 1], [37, 2]];
  lunte.forEach(([y, z], i) => b.box(-1, 0, y, y, z, z + 1, i % 2 ? '#a87848' : '#6b4b2e'));
  const fy = 38, fz = 3;
  b.box(-2, 1, fy, fy + 1, fz - 1, fz + 1, '#fff3c4', 1).box(-1, 0, fy - 1, fy + 2, fz, fz, '#ffffff', 1);
  for (const [dx, dy, dz, c] of [[-3, 1, 0, '#ffd23f'], [2, 1, 0, '#ffd23f'], [0, 3, 0, '#ffd23f'], [-1, 4, 0, '#ff7a1a'], [-3, 3, 1, '#ff7a1a'], [2, 3, -1, '#ff3df0'], [3, -1, 1, '#ffd23f'], [-4, -1, 0, '#ff3df0'], [0, -2, 2, '#ffd23f'], [1, 2, 2, '#ff7a1a'], [-4, 3, 0, '#ffd23f'], [3, 4, 0, '#ff3df0']] as [number, number, number, string][]) b.v(dx, fy + dy, fz + dz, c, 1);
  // schwebende Glutbrocken
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const x = Math.round(Math.sin(a) * 16), z = Math.round(Math.cos(a) * 15), y = 6 + ((i * 7) % 4) * 3;
    b.box(x, x + 1, y, y + 1, z, z + 1, '#3a2a2a').v(x, y + 1, z + 1, '#ff7a1a', 1).v(x + 1, y + 1, z, '#ffd23f', 1).v(x + 1, y, z + 1, '#ff5a14', 1);
  }
  return b.list();
}
