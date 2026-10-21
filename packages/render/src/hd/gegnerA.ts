/**
 * Feine Modelle (HD) der ersten Gegnergruppe: Grummelbold, Bomben-Kröte, Toastomat,
 * Kampfhuhn, Vogelscheuche, Funkenkobold, Tesla-Ritter, Schrottgolem.
 * Halbe Voxelgröße, doppelte Voxelzahl pro Achse – gleiche Figur, gleiche Höhe in Metern.
 * Blickrichtung +z, Mitte liegt auf der Zellgrenze x = 0 (Spiegeln: x → -1 - x).
 */
import { VoxBuilder, type Vox } from '../voxel.ts';
import { shade } from '../models.ts';
import type { HdModell } from './index.ts';

type Farbe = string | [string, number] | null;
type FarbFn = (x: number, y: number, z: number) => Farbe;

/** Baukasten für feine Modelle: merkt sich belegte Zellen, kann spiegeln, Kugeln, Walzen und Gesichter. */
export class HdBau extends VoxBuilder {
  private belegt = new Map<string, Vox>();
  override v(x: number, y: number, z: number, c: string, glow = 0): this {
    this.belegt.set(x + ',' + y + ',' + z, [x, y, z, c, glow]);
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
  farbe(x: number, y: number, z: number): string | undefined {
    return this.belegt.get(x + ',' + y + ',' + z)?.[3];
  }
  /** Voxel und sein Spiegelbild (x → -1 - x) */
  v2(x: number, y: number, z: number, c: string, glow = 0): this {
    return this.v(x, y, z, c, glow).v(-1 - x, y, z, c, glow);
  }
  /** Quader und sein Spiegelbild */
  box2(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string, glow = 0): this {
    return this.box(x0, x1, y0, y1, z0, z1, c, glow).box(-1 - x1, -1 - x0, y0, y1, z0, z1, c, glow);
  }
  /** Zelle und Spiegelbild löschen */
  del2(x: number, y: number, z: number): this {
    return this.del(x, y, z).del(-1 - x, y, z);
  }
  private setze(x: number, y: number, z: number, f: Farbe | FarbFn): void {
    const c = typeof f === 'function' ? f(x, y, z) : f;
    if (c === null) return;
    if (typeof c === 'string') this.v(x, y, z, c);
    else this.v(x, y, z, c[0], c[1]);
  }
  /** Ellipsoid um (cx, cy, cz) – Mittelpunkte dürfen auf Zellgrenzen liegen (z. B. -0,5) */
  kugel(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, f: Farbe | FarbFn): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) this.setze(x, y, z, f);
        }
    return this;
  }
  /** Quader mit abgerundeten Kanten (Radius r) – flache Vorderseite für Gesichter */
  rbox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r: number, f: Farbe | FarbFn): this {
    const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const dx = x - cl(x, x0 + r, x1 - r), dy = y - cl(y, y0 + r, y1 - r), dz = z - cl(z, z0 + r, z1 - r);
      if (dx * dx + dy * dy + dz * dz <= (r + 0.35) * (r + 0.35)) this.setze(x, y, z, f);
    }
    return this;
  }
  /** Senkrechte elliptische Walze von y0 bis y1 */
  walze(cx: number, cz: number, rx: number, rz: number, y0: number, y1: number, f: Farbe | FarbFn): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        const dx = (x - cx) / rx, dz = (z - cz) / rz;
        if (dx * dx + dz * dz <= 1) for (let y = y0; y <= y1; y++) this.setze(x, y, z, f);
      }
    return this;
  }
  /** Vorderste belegte z-Zelle der Spalte (x, y), sonst NaN */
  vorne(x: number, y: number): number {
    for (let z = 60; z >= -60; z--) if (this.hat(x, y, z)) return z;
    return NaN;
  }
  /** Vordersten Voxel der Spalte umfärben (dz = 0) oder davor setzen (dz = 1) */
  vorn(x: number, y: number, c: string, glow = 0, dz = 0): this {
    const z = this.vorne(x, y);
    return Number.isNaN(z) ? this : this.v(x, y, z + dz, c, glow);
  }
  /** wie vorn, gespiegelt */
  vorn2(x: number, y: number, c: string, glow = 0, dz = 0): this {
    return this.vorn(x, y, c, glow, dz).vorn(-1 - x, y, c, glow, dz);
  }
  /** Alle Voxel umfärben (null = unverändert) */
  male(f: (x: number, y: number, z: number, c: string, glow: number) => string | null): this {
    for (const [x, y, z, c, g] of [...this.belegt.values()]) {
      const n = f(x, y, z, c, g ?? 0);
      if (n !== null && n !== c) this.v(x, y, z, n, g ?? 0);
    }
    return this;
  }
}

/** Farbverlauf: t = 0 (unten/dunkel) … 1 (oben/hell) */
export function stufe(c: string, t: number, lo = 0.8, hi = 1.08): string {
  return shade(c, lo + (hi - lo) * Math.max(0, Math.min(1, t)));
}

/** kleiner Pseudo-Zufall aus Koordinaten (0..1) */
export function rausch(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export const TINTE = '#141018';

export interface GesichtOpt {
  /** Augenbreite/-höhe in Voxeln */
  w?: number; h?: number;
  /** Abstand der Augen-Innenkante von der Mitte */
  gap?: number;
  eye?: string; pupil?: string; eyeGlow?: number;
  /** Glanzpunkt im Auge */
  glanz?: string | null;
  brow?: string; browDick?: number;
  /** Brauen-Neigung (Voxel Höhenunterschied außen/innen) */
  neigung?: number;
  /** Brauen stehen vor (1) oder sind aufgemalt (0) */
  browVor?: number;
  mouth?: string | null; mouthY?: number; mouthW?: number; mouthH?: number;
  tusks?: string | null;
}

/**
 * Grimmiges Gesicht auf der Vorderseite (+z), auf runde Formen gemalt:
 * Augen mit Pupille nach innen-unten und Glanzpunkt, dicke schräge Brauen (innen tief),
 * Mund mit Unterbiss-Hauern. yEye = Unterkante der Augen.
 */
export function gesicht(b: HdBau, yEye: number, o: GesichtOpt = {}): HdBau {
  const w = o.w ?? 3, h = o.h ?? 3, gap = o.gap ?? 1;
  const eye = o.eye ?? '#f6f2ff', pup = o.pupil ?? TINTE, eg = o.eyeGlow ?? 0;
  const brow = o.brow ?? '#2b1d14', dick = o.browDick ?? 2, neig = o.neigung ?? 2, vor = o.browVor ?? 0;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) b.vorn2(gap + i, yEye + j, eye, eg);
  // Pupille innen-unten
  const pw = Math.min(2, w - 1), ph = Math.min(2, h - 1);
  for (let i = 0; i < pw; i++) for (let j = 0; j < ph; j++) b.vorn2(gap + i, yEye + j, pup);
  if (o.glanz !== null) b.vorn2(gap + pw - 1, yEye + ph - 1, o.glanz ?? '#ffffff', 1);
  // Brauen: von innen (über der Augen-Innenkante, tief) nach außen (hoch)
  const n = w + 2;
  for (let i = 0; i < n; i++) {
    const x = gap - 1 + i;
    const yb = yEye + h - 1 + Math.round((i * neig) / (n - 1));
    for (let t = 0; t < dick; t++) b.vorn2(x, yb + t, brow, 0, i === 0 && vor ? 0 : vor);
  }
  if (o.mouth !== null && o.mouth !== undefined) {
    const mw = o.mouthW ?? gap + 1, my = o.mouthY ?? yEye - 3, mh = o.mouthH ?? 1;
    for (let x = 0; x < mw; x++) for (let j = 0; j < mh; j++) b.vorn2(x, my + j, o.mouth);
    if (o.tusks) b.vorn2(mw - 1, my + mh, o.tusks, 0, 0);
  }
  return b;
}

/* ------------------------------------------------------------------ */

/** Grummelbold: grüner Kobold mit Kochtopf-Helm, spitzen Ohren und Unterbiss. */
function grummelboldHd(): Vox[] {
  const g = '#6cc24a', gd = '#5aa83c', topf = '#7d8597';
  const b = new HdBau();
  // Stiefel und Beinchen
  b.box2(1, 3, 0, 1, -2, 3, '#3b2a1e').box2(1, 3, 1, 1, 2, 3, '#4e3828');
  b.box2(1, 3, 2, 3, -2, 1, gd);
  // Lederhose mit Gürtel
  b.rbox(-5, 4, 4, 7, -4, 4, 1.6, (x, y) => (y === 7 ? '#5a3a1a' : stufe('#8a5a2a', (y - 4) / 3, 0.85, 1.05)));
  b.box(-1, 0, 7, 7, 5, 5, '#ffd23f');
  // Körper = Kopf: dicke grüne Knolle mit flachem Gesicht
  b.rbox(-7, 6, 8, 16, -5, 6, 1.6, (x, y, z) => {
    if (z >= 5 && y <= 9 && Math.abs(x + 0.5) < 4) return stufe('#a8d878', (y - 8) / 3, 0.92, 1.02);
    return stufe(g, (y - 8) / 8, 0.84, 1.08);
  });
  // Ärmchen mit Fäustchen
  b.box2(7, 8, 5, 9, -1, 1, gd).box2(7, 8, 5, 6, -1, 1, g);
  // spitze Ohren
  b.box2(7, 9, 11, 13, -1, 0, gd).box2(10, 11, 12, 14, -1, 0, gd).box2(12, 12, 14, 15, -1, 0, gd);
  b.box2(8, 11, 12, 12, 0, 0, '#c87a8a').v2(11, 13, 0, '#c87a8a');
  // Gesicht
  gesicht(b, 11, { w: 3, h: 3, gap: 1, mouth: '#5a1a2a', mouthY: 8, mouthW: 4, mouthH: 1, tusks: '#fff6d8' });
  b.vorn2(3, 10, '#fff6d8');
  // Knollennase
  b.box(-1, 0, 10, 10, 7, 7, gd).v(-1, 11, 7, gd).v(0, 11, 7, gd);
  // Kochtopf-Helm, verbeult, mit Griffen
  b.walze(-0.5, -0.5, 7.2, 6.8, 16, 17, (x, y, z) => (y === 16 ? '#5a5f68' : rausch(x, y, z) < 0.12 ? '#6b707a' : topf));
  b.walze(-0.5, -0.5, 6.2, 5.8, 18, 18, (x, y, z) => (rausch(x, y, z) < 0.15 ? '#8d95a7' : '#9aa3b5'));
  b.box(-2, 1, 19, 19, -2, 1, '#c9ced8').box(-1, 0, 19, 19, -1, 0, '#e8ecf4');
  b.box(7, 9, 17, 17, -1, 0, '#5a5f68').box(-10, -8, 17, 17, -1, 0, '#5a5f68');
  // Delle vorne
  b.vorn(-4, 17, '#5f6470').vorn(-3, 17, '#5f6470');
  return b.list();
}

/** Bomben-Kröte: dick, lila, Glupschaugen, Bombe auf dem Rücken. */
function bombenkroeteHd(): Vox[] {
  const p = '#8a4fd8', pd = '#6a38b0', bauch = '#c9a0ff', brow = '#2b1440';
  const b = new HdBau();
  // Beine: dicke Schenkel hinten, Füße mit Zehen
  b.box2(5, 7, 1, 4, -5, -1, pd);
  b.box2(3, 7, 0, 1, 1, 6, pd).box2(3, 5, 2, 3, 3, 5, pd).v2(3, 0, 7, '#9a6ae0').v2(6, 0, 7, '#9a6ae0');
  // Körper
  b.kugel(-0.5, 7.5, 0.5, 8.4, 6.4, 7.2, (x, y, z) => {
    if (z >= 4 && y <= 7) return stufe(bauch, (y - 2) / 5, 0.88, 1.04);
    if (z < 2 && y > 9 && rausch(x, y, z) < 0.12) return '#7a44c4';
    return stufe(p, (y - 2) / 12, 0.78, 1.08);
  });
  // breites Maul mit Hauern
  for (let x = 0; x <= 5; x++) b.vorn2(x, 7, '#3a1a4a');
  b.vorn2(5, 8, '#3a1a4a').vorn2(6, 8, '#3a1a4a');
  b.vorn2(4, 8, '#fff6d8').vorn2(4, 9, '#fff6d8', 0, 1);
  // Nasenlöcher
  b.vorn2(1, 10, '#5a2a8a');
  // Glupschaugen oben auf dem Kopf
  for (const cx of [3.5, -4.5]) b.kugel(cx, 13.5, 3, 3.3, 3.3, 3, (x, y, z) => (y <= 11 && z < 3 ? p : '#f6f2ff'));
  // große Pupillen nach innen-unten, mit Glanzpunkt
  for (let x = 1; x <= 3; x++) for (let y = 12; y <= 14; y++) b.vorn2(x, y, TINTE);
  b.vorn2(3, 14, '#ffffff', 1);
  // dicke Wut-Brauen oben auf den Augäpfeln (innen tief)
  for (let x = 0; x <= 7; x++) {
    const y = 15 + Math.round((x * 2.5) / 7);
    b.vorn2(x, y, brow).vorn2(x, y + 1, brow);
  }
  // Bombe auf dem Rücken, mit Gurt
  b.kugel(-0.5, 14, -6.5, 4.4, 4.4, 4.4, (x, y, z) => {
    const hl = x <= -2 && y >= 16 && z >= -6;
    return hl ? '#4a4458' : stufe('#24202e', (y - 9) / 10, 0.85, 1.15);
  });
  b.v(-3, 17, -4, '#8a84a0').v(-2, 18, -4, '#6a6480');
  b.box(-5, 4, 9, 10, 2, 2, '#6b4b2e');
  b.box(-1, 0, 19, 19, -8, -7, '#5a5468');
  b.box(-1, 0, 20, 21, -8, -7, '#6b4b2e').v(0, 22, -8, '#6b4b2e');
  b.v(0, 23, -8, '#ff7a1a', 1).v(-1, 23, -8, '#ff5a14', 1).v(0, 24, -8, '#ffd23f', 1).v(0, 23, -9, '#ffd23f', 1).v(1, 24, -9, '#fff3c4', 1).v(0, 25, -8, '#fff3c4', 1);
  return b.list();
}

/** Toastomat: wütender Toaster auf Stelzen, rote LED-Brauen, glühender Toast. */
function toastomatHd(): Vox[] {
  const chrome = '#c9ced8', dunkel = '#8d93a3', led = '#ff2a4a';
  const b = new HdBau();
  // Stelzenbeine mit Gelenk und Füßen
  b.box2(2, 3, 2, 7, -1, 0, '#5a5f68').box2(2, 3, 4, 4, -1, 0, '#3a3e46');
  b.box2(1, 4, 0, 1, -2, 3, '#3a3e46').box2(1, 4, 1, 1, 2, 3, '#4a4e58');
  // Gehäuse mit abgerundeten Kanten und Chrom-Glanzstreifen
  b.box(-6, 5, 8, 21, -4, 5, chrome);
  for (const x of [-6, 5]) for (const z of [-4, 5]) for (let y = 8; y <= 21; y++) b.del(x, y, z);
  b.male((x, y, z) => {
    if (y <= 9) return '#6b707a';
    if (x === -6 || x === 5) return stufe(dunkel, (y - 8) / 13, 0.85, 1.05);
    if (y === 21) return '#e8ecf4';
    if (z === 5 && (x === -4 || x === -3)) return '#eef1f8';
    if (z === 5 && x === 4) return '#a8aebb';
    return null;
  });
  // Toastschlitze und Toast
  b.box(-4, 3, 21, 21, -2, -1, '#2a2e38').box(-4, 3, 21, 21, 2, 3, '#2a2e38');
  b.box(-4, 3, 22, 24, -2, -1, '#c98a3a').box(-4, 3, 22, 23, 2, 3, '#c98a3a');
  b.del(-4, 24, -2).del(-4, 24, -1).del(3, 24, -2).del(3, 24, -1);
  b.box(-3, 2, 25, 25, -2, -1, '#a86a2a').box(-3, 2, 24, 24, -2, -1, '#d89a4a');
  b.box(-4, 3, 24, 24, 2, 3, '#ff7a1a', 1).box(-3, 2, 24, 24, 2, 3, '#ffd23f', 1);
  // Gesicht: LED-Bildschirm-Augen, rote LED-Brauen
  b.box2(1, 4, 13, 16, 6, 6, '#2a2e38');
  b.box2(1, 2, 13, 14, 6, 6, '#ffffff', 1).v2(3, 13, 6, '#ffd0d8', 1);
  for (let i = 0; i < 6; i++) {
    const x = i, y = 16 + Math.round((i * 3) / 5);
    b.v2(x, y, 6, led, 1).v2(x, y + 1, 6, led, 1);
  }
  // Grill-Mund mit Hauern
  b.box(-4, 3, 9, 11, 6, 6, '#2a2e38');
  for (let x = -4; x <= 3; x += 2) b.box(x, x, 9, 11, 6, 6, '#4a4e58');
  b.v2(3, 12, 6, '#fff6d8').v2(3, 11, 6, '#fff6d8');
  // Hebel und Drehknopf an der Seite
  b.box(6, 7, 15, 15, -1, 0, '#5a5f68').box(8, 9, 15, 16, -1, 0, '#ff3d3d');
  b.box(6, 6, 11, 12, 1, 2, '#ffd23f');
  // Kabelschwanz hinten
  b.box(-1, 0, 9, 9, -6, -5, '#2a2e38').box(-1, 0, 8, 8, -8, -7, '#2a2e38').v(-1, 7, -9, '#c42a28');
  return b.list();
}

/** Kampfhuhn: wütendes Huhn mit rotem Stirnband. */
function kampfhuhnHd(): Vox[] {
  const w = '#f4ecff', wd = '#ddd4ea', rot = '#ff3d3d', orange = '#ff9a1a';
  const b = new HdBau();
  // Beine und Krallen
  b.box2(1, 2, 1, 5, -1, 0, orange).box2(0, 3, 0, 0, -1, 2, '#e8801a').v2(1, 0, -2, '#e8801a');
  // Körper mit Flügeln
  b.kugel(-0.5, 9.5, -2, 5.6, 5, 6.5, (x, y) => stufe(y < 7 ? wd : w, (y - 5) / 9, 0.86, 1.04));
  b.kugel(5, 9.5, -2.5, 1.6, 3.6, 4.6, (x, y, z) => (z < -5 || y < 8 ? '#cfc6e0' : '#e8e2f0'));
  b.kugel(-6, 9.5, -2.5, 1.6, 3.6, 4.6, (x, y, z) => (z < -5 || y < 8 ? '#cfc6e0' : '#e8e2f0'));
  // Schwanzfedern
  b.box(-3, 2, 10, 14, -9, -8, w).box(-2, 1, 15, 17, -9, -9, w).box(-3, -3, 15, 16, -10, -10, wd).box(2, 2, 15, 16, -10, -10, wd);
  b.box(-1, 0, 18, 18, -10, -10, '#cfc6e0');
  // Hals und Kopf
  b.rbox(-5, 4, 12, 21, -3, 5, 1.6, (x, y) => stufe(w, (y - 12) / 10, 0.9, 1.04));
  // Gesicht: Augen links und rechts vom Schnabel
  gesicht(b, 15, { w: 2, h: 3, gap: 2, brow: TINTE, neigung: 1, browDick: 1 });
  // Stirnband mit flatternden Enden
  b.male((x, y, z, c) => (y >= 19 && y <= 20 && c !== TINTE ? (y === 20 ? rot : '#d82a2a') : null));
  b.box(-2, -1, 19, 20, -4, -4, '#c42a28').box(-3, -2, 19, 19, -5, -5, rot).box(-4, -3, 18, 18, -6, -6, rot).v(-4, 17, -7, '#c42a28');
  b.box(0, 1, 20, 20, -5, -5, rot).v(1, 19, -6, rot).v(2, 19, -7, '#c42a28');
  // Kamm
  b.box(-1, 0, 22, 22, -2, 4, rot).box(-1, 0, 23, 24, 2, 4, rot).box(-1, 0, 23, 23, -1, 0, '#e82a2a').box(-1, 0, 25, 25, 3, 3, '#ff6a6a').v(-1, 24, -1, rot).v(0, 24, -1, rot);
  // Schnabel, aufgerissen
  b.box(-2, 1, 15, 16, 6, 7, '#ffb02e').box(-1, 0, 15, 15, 8, 8, '#ffb02e').box(-2, 1, 16, 16, 6, 7, '#ffc24a');
  b.box(-1, 0, 14, 14, 6, 6, '#5a1a2a').box(-1, 0, 13, 13, 6, 7, '#e8901a');
  // Kehllappen
  b.box(-1, 0, 11, 12, 6, 6, rot);
  return b.list();
}

/** Vogelscheuche Stroh-Udo: Sackgesicht, Strohhut, ausgebreitete Arme, grünes Heilkreuz. */
function vogelscheucheHd(): Vox[] {
  const holz = '#6b4b2e', hemd = '#3a6a9a', sack = '#c8a878', stroh = '#e8c860', hut = '#d8b048';
  const b = new HdBau();
  // Pfahl
  b.box(-1, 0, 0, 11, -1, 0, holz).box(-1, 0, 3, 3, -1, 0, '#5a3a22').box(-2, 1, 0, 0, -2, 1, '#5a3a22');
  // Hemd mit Flicken und Strick-Gürtel
  b.box(-5, 4, 10, 19, -2, 2, hemd);
  b.male((x, y, z, c) => (c === hemd ? stufe(hemd, (y - 10) / 9, 0.82, 1.06) : null));
  b.box(-5, 4, 11, 11, -2, 2, '#c8a878').v(-1, 11, 3, '#a8885a');
  b.box(1, 3, 15, 17, 3, 3, '#c42a28').v(2, 16, 3, '#e8605a');
  b.box(-4, -3, 12, 13, 3, 3, '#d8b048');
  // Stroh guckt unten raus
  b.box(-5, 4, 9, 9, -1, 1, stroh).box(-4, -3, 8, 8, 0, 1, stroh).box(2, 3, 8, 8, 0, 1, stroh);
  // Querlatte mit Ärmeln und Strohhänden
  b.box(-14, 13, 14, 15, -1, 0, holz);
  b.box2(5, 9, 13, 17, -2, 1, hemd).box2(9, 9, 13, 17, -2, 1, '#2a5a8a');
  b.box2(10, 12, 13, 16, -1, 0, stroh).box2(13, 13, 12, 13, -1, 0, stroh).box2(13, 14, 16, 16, -1, 0, '#d8b048');
  // Heilkreuz auf der Brust (leuchtet)
  b.box(-1, 0, 13, 17, 3, 3, '#5dff7a', 1).box(-3, 2, 14, 15, 3, 3, '#5dff7a', 1).box(-1, 0, 14, 15, 4, 4, '#c8ffd0', 1);
  // Sackkopf mit Strick am Hals
  b.box(-6, 5, 20, 28, -4, 3, sack);
  for (const x of [-6, 5]) for (const z of [-4, 3]) for (let y = 20; y <= 28; y++) b.del(x, y, z);
  b.male((x, y, z, c) => (c === sack ? ((x + y + z) % 2 ? '#bf9e6c' : stufe(sack, (y - 20) / 8, 0.92, 1.04)) : null));
  b.box(-5, 4, 20, 20, -3, 2, '#8a6a48');
  b.v2(5, 19, 0, stroh).v2(6, 20, 1, stroh).v2(6, 19, -1, stroh);
  gesicht(b, 23, { w: 3, h: 3, gap: 1, brow: '#3b2a1e', browDick: 2 });
  // genähter Zickzack-Mund
  for (let x = -4; x <= 3; x++) b.vorn(x, (x & 1) ? 21 : 22, '#3b2a1e');
  // Strohhut: Krempe mit zerfranstem Rand, Hutband
  b.walze(-0.5, -0.5, 8.8, 7.4, 29, 29, (x, y, z) => {
    const r = ((x + 0.5) / 8.8) ** 2 + ((z + 0.5) / 7.4) ** 2;
    return r > 0.72 ? (rausch(x, 0, z) < 0.4 ? '#b8862a' : '#c89a38') : hut;
  });
  b.walze(-0.5, -0.5, 5.2, 4.6, 30, 33, (x, y) => (y <= 31 ? '#c42a28' : stufe(hut, (y - 31) / 3, 0.95, 1.08)));
  b.walze(-0.5, -0.5, 3.2, 2.6, 34, 34, '#c89a38');
  b.v2(6, 28, 0, stroh).v2(7, 27, -1, stroh).v(-3, 28, 4, stroh).v(2, 28, 4, stroh);
  return b.list();
}

/** Funkenkobold: winzig, gelb, Haare aus Blitzen. */
function funkenkoboldHd(): Vox[] {
  const gelb = '#ffd23f', anzug = '#3d4a8a';
  const b = new HdBau();
  b.box2(1, 3, 0, 1, -1, 2, '#2a2e38').box2(1, 2, 2, 3, -1, 0, '#2a2e38');
  b.kugel(-0.5, 6, -0.5, 4, 3, 3.2, (x, y) => stufe(anzug, (y - 3) / 6, 0.85, 1.1));
  b.vorn(-1, 5, gelb, 1).vorn(0, 6, gelb, 1).vorn(-1, 6, gelb, 1).vorn(0, 7, gelb, 1);
  // Ärmchen mit Funken an den Händen
  b.box2(4, 5, 5, 7, -1, 0, gelb).v2(5, 8, 0, '#a8f6ff', 1).v2(6, 9, 1, '#3de8ff', 1);
  // großer Kopf
  b.rbox(-7, 6, 7, 16, -4, 4, 1.6, (x, y) => stufe(gelb, (y - 7) / 9, 0.86, 1.06));
  // spitze Ohren
  b.box2(7, 8, 12, 13, -1, 0, gelb).box2(9, 9, 13, 14, -1, 0, '#e8b830').v2(10, 15, -1, '#e8b830');
  gesicht(b, 11, { w: 3, h: 3, gap: 1, brow: '#7a4a00', browDick: 1, neigung: 2, mouth: '#5a1a2a', mouthY: 8, mouthW: 3, tusks: '#fff6d8' });
  b.vorn2(4, 9, '#ff9a3a');
  // Blitz-Haare: gezackte Strähnen, oben weiß glühend
  const blitz = (x: number, z: number, h: number, dx: number) => {
    for (let i = 0; i < h; i++) {
      const xx = x + (i % 2) * dx, c = i === h - 1 ? '#e8fdff' : i % 2 ? '#1ab8e8' : '#3de8ff';
      b.box(xx, xx + 1, 17 + i, 17 + i, z, z + 1, c, 1);
    }
  };
  blitz(-6, -2, 3, -1); blitz(-4, 1, 4, -1); blitz(-1, -1, 5, 1); blitz(2, 2, 4, 1); blitz(4, -2, 3, 1); blitz(-2, 3, 3, -1);
  return b.list();
}

/** Tesla-Ritter: Blechrüstung, Spulenschild vorne, leuchtender Federbusch. */
function teslaritterHd(): Vox[] {
  const chrome = '#c9ced8', stahl = '#8d93a3', dunkel = '#5a5f68';
  const b = new HdBau();
  // Beine und Eisenschuhe
  b.box2(1, 3, 0, 5, -2, 1, dunkel).box2(1, 3, 0, 1, -2, 3, '#4a4e58').box2(1, 3, 3, 4, 2, 2, stahl);
  // Rumpf
  b.box(-4, 3, 6, 15, -3, 2, stahl).box(-4, 3, 6, 7, -3, 2, '#5a4a3e');
  b.male((x, y, z, c) => (c === stahl ? stufe(stahl, (y - 6) / 9, 0.85, 1.08) : null));
  // Schulterpanzer
  b.rbox(4, 6, 13, 16, -2, 1, 1, stahl).rbox(-7, -5, 13, 16, -2, 1, 1, stahl);
  // Arme, nach vorne zum Schild
  b.box2(5, 6, 9, 12, -1, 1, stahl).box2(5, 6, 9, 10, 2, 8, stahl);
  // Helm
  b.rbox(-5, 4, 16, 26, -5, 5, 1.6, (x, y) => stufe(chrome, (y - 15) / 12, 0.84, 1.1));
  // Visier-Schlitz mit roten LED-Augen
  for (let x = 0; x <= 4; x++) for (const y of [20, 21]) b.vorn2(x, y, '#2a2e38');
  b.vorn2(1, 20, '#ff2a4a', 1).vorn2(2, 20, '#ff2a4a', 1).vorn2(1, 21, '#ff6a7a', 1);
  // grimmige Helm-Brauen
  for (let i = 0; i < 5; i++) {
    const y = 22 + Math.round((i * 2) / 4);
    b.vorn2(i, y, TINTE).vorn2(i, y + 1, TINTE);
  }
  // Luftlöcher
  for (const x of [-3, -1, 0, 2]) b.vorn(x, 17, '#5a5f68');
  // Federbusch aus Strom
  for (let z = -5; z <= 3; z++) {
    const h = 28 + Math.round(3 - Math.abs(z + 1) * 0.6);
    for (let y = 27; y <= h; y++) b.box(-1, 0, y, y, z, z, y === h ? '#a8f6ff' : '#3de8ff', 1);
  }
  b.box(-1, 0, 32, 32, -2, -1, '#e8fdff', 1);
  // Spulenschild (Wappenform) vor dem Körper
  for (let y = 3; y <= 19; y++) {
    const r = y >= 9 ? 8 : 8 - Math.ceil((9 - y) * 1.1);
    if (r < 1) continue;
    b.box(-r, r - 1, y, y, 9, 10, y === 3 || y === 19 ? dunkel : '#d8a04a');
    b.v(-r, y, 10, dunkel).v(r - 1, y, 10, dunkel);
  }
  b.box(-7, 6, 18, 18, 10, 10, '#e8b85a');
  // Spule: Kupferringe, leuchtende Mitte
  for (let x = -5; x <= 4; x++) for (let y = 8; y <= 17; y++) {
    const d = Math.hypot(x + 0.5, y - 12.5);
    if (d < 1.6) b.v(x, y, 11, '#e8fdff', 1);
    else if (d < 2.8) b.v(x, y, 10, '#3de8ff', 1);
    else if (d >= 3.4 && d < 4.6) b.v(x, y, 10, '#b06a2a');
  }
  b.v2(6, 17, 11, '#9aa3b5').v2(6, 6, 11, '#9aa3b5');
  return b.list();
}

/** Schrottgolem: Kühlschranktür als Brust, rostige Arme, kleiner Topf-Kopf. */
function schrottgolemHd(): Vox[] {
  const rost = '#7a5a3a', tuer = '#e8e2f0';
  const b = new HdBau();
  // Stampfbeine
  b.box2(3, 6, 0, 7, -2, 2, '#5a4a3e').box2(3, 6, 0, 1, -2, 4, '#4a3a2e').box2(3, 6, 4, 4, 3, 3, '#6a5a4e');
  // Rumpf aus Rost
  b.box(-9, 8, 8, 25, -3, 4, rost);
  b.male((x, y, z, c) => (c === rost ? (rausch(x, y, z) < 0.18 ? '#8a6a48' : rausch(z, x, y) < 0.12 ? '#6a4a2e' : stufe(rost, (y - 8) / 17, 0.85, 1.05)) : null));
  // Kühlschranktür mit Griff und Magneten
  b.box(-8, 7, 10, 23, 5, 5, tuer);
  b.male((x, y, z, c) => (c === tuer ? stufe(tuer, (y - 10) / 13, 0.88, 1.03) : null));
  b.box(-8, 7, 18, 18, 5, 5, '#b8b2c8');
  b.box(5, 5, 12, 16, 6, 6, '#9aa3b5').box(5, 5, 20, 22, 6, 6, '#9aa3b5');
  b.box(-7, -6, 15, 16, 6, 6, '#c42a28').box(1, 2, 20, 21, 6, 6, '#3d9bff').box(-4, -3, 11, 12, 6, 6, '#ffd23f');
  b.v(-1, 13, 6, '#7dff5a').v(0, 13, 6, '#7dff5a').v(0, 14, 6, '#7dff5a');
  // Arme: links rostig, rechts Rohr, große Fäuste
  b.box(-13, -11, 11, 23, -2, 1, '#8a6a48').box(-13, -11, 18, 18, -2, 1, '#6a4a2e');
  b.box(10, 12, 11, 23, -2, 1, '#6b707a').box(10, 12, 16, 16, -2, 1, '#4a4e58');
  b.box(-14, -10, 6, 10, -3, 2, '#5a5f68').box(9, 13, 6, 10, -3, 2, '#5a5f68');
  b.box(-14, -10, 10, 10, -3, 2, '#6b707a').box(9, 13, 10, 10, -3, 2, '#6b707a');
  // Schulterbolzen
  b.box(-12, -11, 22, 23, 2, 2, '#c9ced8').box(10, 11, 22, 23, 2, 2, '#c9ced8');
  // Topf-Kopf mit Deckel
  b.box(-6, 5, 26, 34, -4, 5, '#8d93a3');
  for (const x of [-6, 5]) for (const z of [-4, 5]) for (let y = 26; y <= 34; y++) b.del(x, y, z);
  b.male((x, y, z, c) => (c === '#8d93a3' ? stufe('#8d93a3', (y - 26) / 8, 0.85, 1.08) : null));
  gesicht(b, 29, { w: 3, h: 3, gap: 1, eye: '#ffd23f', eyeGlow: 1, glanz: '#fff6c0', brow: TINTE, mouth: '#2a2e38', mouthY: 27, mouthW: 4, tusks: '#fff6d8' });
  b.box(-7, 6, 35, 35, -5, 6, '#5a5f68').box(-2, 1, 36, 36, -1, 2, '#6b707a').box(-1, 0, 37, 37, 0, 1, '#9aa3b5');
  return b.list();
}

/** HD-Modelle nach Gegner-ID */
export const HD_GEGNER_A: Record<string, HdModell> = {
  grummelbold: { vox: grummelboldHd, size: 0.055 },
  bombenkroete: { vox: bombenkroeteHd, size: 0.05 },
  toastomat: { vox: toastomatHd, size: 0.05 },
  kampfhuhn: { vox: kampfhuhnHd, size: 0.045 },
  vogelscheuche: { vox: vogelscheucheHd, size: 0.045 },
  funkenkobold: { vox: funkenkoboldHd, size: 0.04 },
  teslaritter: { vox: teslaritterHd, size: 0.05 },
  schrottgolem: { vox: schrottgolemHd, size: 0.05 }
};
