/**
 * Feine Modelle (HD) für Minenbot, Pilzling, Schleimi/Schleimchen, Lavaklops, Kultist, Schneemann,
 * Bombenpinguin und die alten Bosse (König Gockel, Toastomat 3000, Morchella, Baron von Bumm).
 *
 * Gleiche Figuren wie in `models.ts`, halbe Voxelgröße: ein kleiner Voxel (x, y, z) entspricht hier
 * etwa dem Block 2x..2x+1 – Höhe in Metern (und damit `top`) bleibt gleich. Blickrichtung +z.
 */
import type { Vox } from '../voxel.ts';
import type { HdModell } from './index.ts';

const INK = '#141018';

/** Farbe abdunkeln/aufhellen (sRGB-Hex) – wie `shade` in models.ts, hier lokal, damit die Datei ohne Three.js prüfbar bleibt. */
function ton(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** kleiner Pseudo-Zufall aus Koordinaten (0..1), für Muster */
function rausch(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

type Farbe = string | [string, number] | null;
type FarbFn = (x: number, y: number, z: number) => Farbe;

/** Baukasten für feine Modelle: kennt belegte Zellen, malt auf runde Vorderseiten, entfernt Innenvoxel. */
class Fein {
  private m = new Map<string, Vox>();
  private static k(x: number, y: number, z: number): string { return x + ',' + y + ',' + z; }
  v(x: number, y: number, z: number, c: string, glow = 0): this {
    this.m.set(Fein.k(x, y, z), [x, y, z, c, glow]);
    return this;
  }
  /** Farbe oder [Farbe, Leuchten] setzen; null = nichts */
  f(x: number, y: number, z: number, c: Farbe): this {
    if (c === null) return this;
    return typeof c === 'string' ? this.v(x, y, z, c) : this.v(x, y, z, c[0], c[1]);
  }
  hat(x: number, y: number, z: number): boolean { return this.m.has(Fein.k(x, y, z)); }
  del(x: number, y: number, z: number): this { this.m.delete(Fein.k(x, y, z)); return this; }
  /** Quader; Farbe fest oder je Zelle */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string | FarbFn, glow = 0): this {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (typeof c === 'string') this.v(x, y, z, c, glow);
      else this.f(x, y, z, c(x, y, z));
    }
    return this;
  }
  /** Ellipsoid */
  kugel(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: string | FarbFn): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          if (dx * dx + dy * dy + dz * dz > 1) continue;
          this.f(x, y, z, typeof c === 'string' ? c : c(x, y, z));
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
  /** Linie aus Voxeln (Bresenham-artig in 3D) */
  linie(a: [number, number, number], b: [number, number, number], c: string, glow = 0): this {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.v(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), c, glow);
    }
    return this;
  }
  liste(): Vox[] {
    // Innenvoxel bleiben drin: buildVoxels braucht sie, um verdeckte Flächen zu erkennen
    return [...this.m.values()];
  }
}

/**
 * Auge auf der Vorderseite: Rechteck x0..x1 × y0..y1, Pupille unten zur Innenseite (`innen` = +1: rechts).
 * Pupillengröße p (2 oder 3); bei 3 sitzt ein Glanzpunkt in der Pupille.
 */
function auge(b: Fein, x0: number, x1: number, y0: number, y1: number, innen: 1 | -1, o: { weiss?: string; pupille?: string; p?: number; glow?: number; dz?: number } = {}): void {
  const w = o.weiss ?? '#ffffff', pu = o.pupille ?? INK, p = o.p ?? 2, g = o.glow ?? 0, dz = o.dz ?? 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) b.vorn(x, y, w, g, dz);
  const px0 = innen > 0 ? x1 - p + 1 : x0;
  for (let x = px0; x < px0 + p; x++) for (let y = y0; y < y0 + p; y++) {
    const z = b.vorne(x, y);
    b.v(x, y, z, pu);
  }
  if (p >= 3) {
    // Glanzpunkt oben zur Außenseite in der Pupille
    const gx = innen > 0 ? px0 : px0 + p - 1;
    b.v(gx, y0 + p - 1, b.vorne(gx, y0 + p - 1), '#ffffff', 1);
  }
}

/** Dicke Braue: Spalten [x, y-unten], je `dicke` hoch, einen Voxel vor der Oberfläche */
function braue(b: Fein, spalten: [number, number][], c: string, dicke = 2, glow = 0, dz = 1): void {
  for (const [x, y] of spalten) {
    // vorne der Spalte vor dem Malen merken, damit beide Reihen gleich weit vorstehen
    let z = -99;
    for (let i = 0; i < dicke; i++) { const f = b.vorne(x, y + i); if (!Number.isNaN(f)) z = Math.max(z, f); }
    if (z === -99) continue;
    for (let i = 0; i < dicke; i++) b.v(x, y + i, z + dz, c, glow);
  }
}

/** spiegelt Brauen-Spalten an x = 0 */
function spiegel(sp: [number, number][]): [number, number][] {
  return sp.map(([x, y]) => [-x, y]);
}

/* ------------------------------------------------------------------ */
/* Minenbot (Blechbrut)                                                 */
/* ------------------------------------------------------------------ */

function minenbotHd(): Vox[] {
  const b = new Fein();
  const kette = '#2a2e38', ketteH = '#3a3e46', olive = '#5b6b3a', oliveD = '#4a5a2e', rot = '#ff2a4a';
  // Raupenketten links und rechts, mit Rillen und Radnaben
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -7 : 4, xb = s < 0 ? -4 : 7;
    for (let x = xa; x <= xb; x++) for (let y = 0; y <= 3; y++) for (let z = -6; z <= 6; z++) {
      if ((z === -6 || z === 6) && (y === 0 || y === 3)) continue;
      b.v(x, y, z, (z + 20) % 2 === 0 ? ketteH : kette);
    }
    const xo = s < 0 ? xa : xb;
    for (const zc of [-4, 0, 3]) b.box(xo, xo, 1, 2, zc, zc + 1, '#7d8597').v(xo, 2, zc, '#c9ced8');
  }
  b.box(-3, 3, 1, 3, -5, 5, '#1d2026');
  // Rumpf mit abgeschrägten Kanten, Warnstreifen unten
  for (let x = -6; x <= 6; x++) for (let y = 4; y <= 13; y++) for (let z = -5; z <= 5; z++) {
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax === 6 && az === 5) continue;
    if (y === 13 && (ax === 6 || az === 5)) continue;
    let c = ton(olive, 0.88 + (y - 4) * 0.025);
    if (y === 4) c = ((x + z + 40) % 4) < 2 ? '#ffd23f' : '#24202e';
    else if (ax === 6 || az === 5) c = ton(c, 0.92);
    b.v(x, y, z, c);
  }
  // Nieten
  for (const x of [-5, 5]) b.v(x, 12, 5, '#8a9a5a').v(x, 6, 5, '#8a9a5a');
  // Visier mit roten LED-Augen und LED-Brauen
  b.box(-5, 5, 7, 11, 6, 6, '#262b22');
  for (const s of [-1, 1]) {
    for (let i = 2; i <= 4; i++) for (const y of [8, 9]) b.v(s * i, y, 6, rot, 1);
    b.v(s * 4, 9, 6, '#ffc0c8', 1);
    b.v(s * 5, 11, 6, rot, 1).v(s * 4, 11, 6, rot, 1).v(s * 3, 10, 6, rot, 1).v(s * 2, 10, 6, rot, 1);
  }
  // Zahngitter-Mund
  b.box(-3, 3, 5, 6, 5, 5, INK);
  for (let x = -3; x <= 3; x += 2) b.v(x, 6, 5, '#c9ced8');
  b.v(-2, 5, 5, '#c9ced8').v(2, 5, 5, '#c9ced8');
  // Deckel, Antenne mit Blinklicht
  b.box(-5, 5, 14, 14, -4, 4, oliveD).box(-3, 3, 15, 15, -3, 3, ton(oliveD, 1.1));
  b.box(-1, 1, 15, 15, -1, 1, '#3a3e46').box(0, 0, 16, 17, 0, 0, '#9aa3b5');
  b.box(-1, 1, 18, 19, -1, 1, '#ff3d3d', 1).v(0, 19, 1, '#ffd0d0', 1);
  // Minenklappe hinten, eine Mine kommt gerade heraus
  b.box(-3, 3, 5, 10, -6, -6, '#141018').box(-3, 3, 11, 11, -6, -6, '#8a9a5a').v(0, 9, -7, '#ff3d3d', 1);
  for (let x = -2; x <= 2; x++) for (let z = -9; z <= -7; z++) if (x * x + (z + 8) * (z + 8) <= 5) b.v(x, 1, z, '#24202e');
  b.box(-1, 1, 2, 2, -9, -7, '#3a3e46').v(0, 2, -8, '#ff3d3d', 1).v(-2, 1, -8, '#ffd23f').v(2, 1, -8, '#ffd23f');
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Pilzling (Sumpfbande)                                                */
/* ------------------------------------------------------------------ */

function pilzlingHd(): Vox[] {
  const b = new Fein();
  const haut = '#f8dcc0', fuss = '#e0c49e', kappe = '#d42e2a';
  // Füßchen
  for (const s of [-1, 1]) b.box(s < 0 ? -4 : 2, s < 0 ? -2 : 4, 0, 1, -1, 3, (x, y, z) => (y === 1 && z === 3 ? null : fuss));
  // knubbeliger Körper (Stiel)
  b.kugel(0, 6.5, 0.5, 5.2, 6, 5.6, (x, y) => (y < 1 ? null : ton(haut, 0.9 + y * 0.01)));
  // Ärmchen
  for (const s of [-1, 1]) b.box(s * 6, s * 6, 3, 5, 0, 1, ton(haut, 0.9));
  // Kappe: Kuppel, leicht nach hinten versetzt, mit weißen Punkten
  const cx = 0, cy = 12, cz = -1.2, rx = 8.8, ry = 7.2, rz = 8;
  const punkte: [number, number, number][] = [];
  for (const [az, el] of [[0.35, 0.55], [-0.6, 0.45], [1.5, 0.35], [-1.6, 0.4], [2.5, 0.4], [-2.6, 0.35], [0, 1.25], [1.9, 1.0], [-1.2, 1.0], [3.1, 0.9]]) {
    punkte.push([cx + rx * Math.cos(el) * Math.sin(az), cy + ry * Math.sin(el), cz + rz * Math.cos(el) * Math.cos(az)]);
  }
  b.kugel(cx, cy, cz, rx, ry, rz, (x, y, z) => {
    if (y < cy) return null;
    for (const [px, py, pz] of punkte) if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 < 3.4) return '#fff6ec';
    if (y === cy) return '#c02420';
    return ton(kappe, 0.88 + (y - cy) * 0.03);
  });
  // Gesicht: große Augen, dicke Brauen, Bäckchen, Schmollmund mit vorgeschobener Unterlippe
  auge(b, -4, -2, 6, 8, 1);
  auge(b, 2, 4, 6, 8, -1);
  const br: [number, number][] = [[-5, 10], [-4, 10], [-3, 9], [-2, 9]];
  braue(b, br, '#5a2a1a', 2);
  braue(b, spiegel(br), '#5a2a1a', 2);
  for (const s of [-1, 1]) b.vorn(s * 5, 5, '#f09090').vorn(s * 4, 5, '#f4a8a0');
  for (let x = -1; x <= 1; x++) b.vorn(x, 4, '#6a2a3a');
  b.vorn(-2, 3, '#6a2a3a').vorn(2, 3, '#6a2a3a');
  for (let x = -1; x <= 1; x++) b.vorn(x, 3, '#d06878', 0, 1);
  // Stinkewölkchen hinten
  b.v(-3, 3, -6, '#9ae05a', 1).v(-4, 4, -6, '#7dc84a', 1);
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Schleimi / Schleimchen (Sumpfbande)                                  */
/* ------------------------------------------------------------------ */

function schleimHd(klein: boolean): Vox[] {
  const b = new Fein();
  const gruen = klein ? '#6ccc44' : '#5dbb3a', dunkel = klein ? '#45942e' : '#3d8a2a', braue_ = '#1e4a10';
  const radius = [7.8, 7.4, 7.4, 7.3, 7.3, 7.2, 7.1, 7.0, 6.8, 6.5, 6.0, 5.4, 4.5, 3.0];
  for (let y = 0; y < radius.length; y++) {
    const r = radius[y];
    for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) {
      const q = (Math.abs(x) / r) ** 4 + (Math.abs(z - 0.3) / (r * 0.95)) ** 4;
      if (q > 1) continue;
      let c = ton(gruen, 0.86 + y * 0.022);
      if (y === 0) c = dunkel;
      // glänzender Lichtfleck oben links
      if ((x + 3) ** 2 + (y - 11) ** 2 * 0.8 + (z - 3) ** 2 < 4.5) c = '#d8ffc8';
      b.v(x, y, z, c);
    }
  }
  // leuchtende Bläschen
  for (const [x, y] of [[-6, 3], [5, 10], [6, 2]]) b.vorn(x, y, '#7dff5a', 1);
  b.v(-7, 6, -3, '#7dff5a', 1).v(4, 12, -2, '#7dff5a', 1);
  // Gesicht
  auge(b, -5, -2, 6, 8, 1);
  auge(b, 2, 5, 6, 8, -1);
  const br: [number, number][] = klein ? [[-6, 11], [-5, 10], [-4, 10], [-3, 9], [-2, 9]] : [[-6, 10], [-5, 10], [-4, 10], [-3, 9], [-2, 9]];
  braue(b, br, braue_, 2);
  braue(b, spiegel(br), braue_, 2);
  // grimmiger Mund mit Hauern (Schleimchen brüllt mit offenem Maul)
  const maul = '#14300c';
  if (klein) {
    for (let x = -3; x <= 3; x++) for (const y of [2, 3, 4]) b.vorn(x, y, maul);
    b.vorn(-1, 2, '#c84a5a').vorn(0, 2, '#c84a5a').vorn(1, 2, '#c84a5a');
    b.vorn(-3, 4, '#fff6d8').vorn(3, 4, '#fff6d8').vorn(-2, 4, '#fff6d8').vorn(2, 4, '#fff6d8');
  } else {
    for (let x = -2; x <= 2; x++) b.vorn(x, 4, maul);
    for (let x = -3; x <= 3; x++) b.vorn(x, 3, maul);
    b.vorn(-4, 2, maul).vorn(4, 2, maul);
    b.vorn(-2, 4, '#fff6d8').vorn(2, 4, '#fff6d8').vorn(-2, 5, '#fff6d8').vorn(2, 5, '#fff6d8');
  }
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Lavaklops (Glutgesindel)                                             */
/* ------------------------------------------------------------------ */

function lavaklopsHd(): Vox[] {
  const b = new Fein();
  for (let x = -8; x <= 8; x++) for (let y = 0; y <= 14; y++) for (let z = -8; z <= 8; z++) {
    const dy = y - 6.5, d = Math.sqrt(x * x + dy * dy + z * z);
    const az = Math.atan2(x, z), el = Math.atan2(dy, Math.hypot(x, z));
    const r = 7 + 0.45 * Math.sin(az * 3 + 0.5) * Math.cos(el * 2);
    if (d > r) continue;
    // Gesichtsfeld frei von Rissen, damit Augen und Maul lesbar bleiben
    const gesicht = z > 2 && Math.abs(x) <= 6 && y >= 2 && y <= 12;
    // Risse: schmale Bänder schräger Ebenen
    const u = (x * 0.7 + z * 0.45 + y * 0.9 + 40) % 7, w = (-x * 0.6 + z * 0.8 + y * 0.35 + 40) % 8.5;
    const riss = !gesicht && (u < 0.7 || w < 0.6);
    if (y <= 1) b.v(x, y, z, y === 0 ? '#ff5a0a' : '#ff7a1a', 1);
    else if (riss) b.v(x, y, z, rausch(x, y, z) < 0.3 ? '#ffb02e' : '#ff7a1a', 1);
    else b.v(x, y, z, y > 10 ? '#3a2a2a' : ton('#5a2a1a', 0.92 + rausch(x, y, z) * 0.12));
  }
  // brodelnde Flamme oben
  b.box(-1, 1, 14, 14, -1, 1, '#ff7a1a', 1).box(0, 0, 15, 16, 0, 0, '#ffd23f', 1).v(1, 15, -1, '#ff5a0a', 1).v(-2, 14, 1, '#ffb02e', 1).v(0, 17, 0, '#fff3c4', 1);
  // Gesicht: glühende Augen mit Pupillen, Felsbrauen, glühendes Grummelmaul
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -5 : 2;
    for (let x = x0; x <= x0 + 3; x++) for (let y = 6; y <= 8; y++) b.vorn(x, y, '#ffd23f', 1);
    const pin = s < 0 ? -2 : 2;
    for (const y of [6, 7]) b.vorn(pin, y, '#2a1408').vorn(pin - s, y, '#2a1408');
    b.vorn(s < 0 ? -5 : 5, 8, '#fff3c4', 1);
  }
  const br: [number, number][] = [[-6, 10], [-5, 10], [-4, 9], [-3, 9], [-2, 9]];
  braue(b, br, INK, 2);
  braue(b, spiegel(br), INK, 2);
  for (let x = -2; x <= 2; x++) b.vorn(x, 4, '#ffb02e', 1);
  for (let x = -3; x <= 3; x++) b.vorn(x, 3, '#ff5a0a', 1);
  b.vorn(-4, 2, '#ff5a0a', 1).vorn(4, 2, '#ff5a0a', 1);
  b.vorn(-2, 4, '#e8d8c0').vorn(2, 4, '#e8d8c0');
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Kawumm-Kultist (Glutgesindel)                                        */
/* ------------------------------------------------------------------ */

function kultistHd(): Vox[] {
  const b = new Fein();
  const kutte = '#4a1a3a', kapuze = '#5a2248', magenta = '#ff3df0';
  // Kutte: unten weit, oben schmaler, senkrechte Falten, Flammensaum
  for (let y = 0; y <= 16; y++) {
    const rx = 7.2 - y * 0.11, rz = 4.3 - y * 0.05;
    for (let x = -8; x <= 8; x++) for (let z = -6; z <= 6; z++) {
      if ((x / rx) ** 2 + (z / rz) ** 2 > 1) continue;
      let c = ton(kutte, 0.9 + y * 0.01);
      if ((x + 40) % 4 === 0) c = ton(c, 0.82);
      if (y === 1 || (y === 2 && (x + z + 40) % 3 === 0)) c = '#ff7a1a';
      if (y === 0) c = ton(kutte, 0.7);
      b.v(x, y, z, c);
    }
  }
  // Gürtelkordel mit Knoten
  for (let x = -6; x <= 6; x++) b.vorn(x, 7, '#c98a3a');
  b.vorn(2, 6, '#c98a3a', 0, 1).vorn(2, 5, '#e0a050', 0, 1);
  // Kapuze mit Zipfel
  b.kugel(0, 21.5, -0.5, 5.8, 6.2, 5.4, (x, y) => (y < 15 ? null : ton(kapuze, 0.9 + (y - 15) * 0.015)));
  b.box(-1, 1, 27, 28, -4, -1, kapuze).box(0, 0, 29, 29, -5, -3, kapuze).v(0, 28, -5, kapuze);
  // Gesichtsöffnung: aushöhlen, dunkle Rückwand, heller Rand
  for (let x = -5; x <= 5; x++) for (let y = 16; y <= 26; y++) {
    if ((x / 4.4) ** 2 + ((y - 20.5) / 4.2) ** 2 > 1) continue;
    for (let z = 2; z <= 8; z++) b.del(x, y, z);
    b.v(x, y, 1, '#1a0814');
  }
  for (let x = -6; x <= 6; x++) for (let y = 15; y <= 27; y++) {
    const q = (x / 4.4) ** 2 + ((y - 20.5) / 4.2) ** 2;
    if (q > 1 && q < 1.7) { const z = b.vorne(x, y); if (z >= 3) b.v(x, y, z, '#7a3060'); }
  }
  // glühende Augen und Brauen im Schatten
  for (const s of [-1, 1]) {
    b.box(s < 0 ? -4 : 2, s < 0 ? -2 : 4, 20, 21, 1, 1, magenta, 1);
    b.v(s < 0 ? -2 : 2, 20, 1, '#5a1a4a');
    b.v(s * 4, 23, 1, magenta, 1).v(s * 3, 23, 1, magenta, 1).v(s * 2, 22, 1, magenta, 1).v(s * 1, 22, 1, magenta, 1);
  }
  b.box(-1, 1, 18, 18, 1, 1, '#5a1a4a');
  // Bomben-Amulett an goldener Kette
  for (let i = 0; i <= 3; i++) { b.vorn(-4 + i, 16 - i, '#ffd23f'); b.vorn(4 - i, 16 - i, '#ffd23f'); }
  const fz = b.vorne(0, 11) + 1;
  b.kugel(0, 10.5, fz + 0.5, 2.2, 2.2, 1.6, (x, y, z) => ((x === -1 && y === 11 && z >= fz + 1) ? '#6a6478' : '#24202e'));
  b.v(0, 13, fz, '#6b4b2e').v(0, 14, fz + 1, '#ff7a1a', 1).v(0, 15, fz + 1, '#ffd23f', 1).v(1, 14, fz + 1, '#ff5a0a', 1);
  // Glockenärmel, Hände mit magentafarbener Portalmagie
  for (const s of [-1, 1]) {
    b.box(s * 6, s * 7, 12, 14, -1, 1, ton(kutte, 0.95));
    b.box(s * 8, s * 9, 12, 16, -2, 1, ton(kutte, 1.05)).box(s * 10, s * 10, 12, 16, -2, 1, '#ff7a1a');
    b.kugel(s * 11, 17.5, -0.5, 1.4, 1.4, 1.4, () => [magenta, 1]);
  }
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Schneemann Fritz (Frostfrieder)                                      */
/* ------------------------------------------------------------------ */

function schneemannHd(): Vox[] {
  const b = new Fein();
  const schnee = (cy: number, r: number): FarbFn => (x, y) => {
    const t = (y - cy) / r;
    return t < -0.5 ? '#dce8f8' : t < 0 ? '#eef4fe' : '#ffffff';
  };
  b.kugel(0, 5.8, 0, 5.9, 5.9, 5.6, (x, y, z) => (y < 0 ? null : schnee(5.8, 5.9)(x, y, z)));
  b.kugel(0, 14.6, 0, 4.3, 4.3, 4.1, schnee(14.6, 4.3));
  b.kugel(0, 23.8, 0.3, 5.6, 5.6, 5.3, schnee(23.8, 5.6));
  // Kohleknöpfe
  for (const y of [15, 12, 7, 3]) b.vorn(0, y, INK).vorn(0, y + 1, '#3a3a4a');
  // Schal mit Streifen und Zipfel
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
    const d = x * x + z * z;
    if (d > 22 || d < 6) continue;
    for (const y of [18, 19]) b.v(x, y, z, (Math.round(Math.atan2(x, z) * 3) + 40) % 3 === 0 ? '#ffd23f' : '#c42a28');
  }
  for (let y = 12; y <= 17; y++) { b.vorn(3, y, y === 12 ? '#ffd23f' : '#c42a28', 0, 1); b.vorn(4, y, y === 12 ? '#ffd23f' : '#a82220', 0, 1); }
  // Gesicht: zusammengekniffene Kohleaugen, dicke Brauen, gerümpfte Möhrennase, Kohle-Mund
  for (const s of [-1, 1]) {
    for (const x of [2, 3, 4]) b.vorn(s * x, 24, INK);
    for (const x of [2, 3]) b.vorn(s * x, 25, INK);
    b.vorn(s * 3, 25, '#4a4a5a');
  }
  const br: [number, number][] = [[-5, 28], [-4, 28], [-3, 27], [-2, 27], [-1, 27]];
  braue(b, br, '#3a3040', 1);
  braue(b, spiegel(br), '#3a3040', 1);
  for (const [x, y] of [[-3, 20], [-2, 21], [-1, 21], [0, 21], [1, 21], [2, 21], [3, 20]]) b.vorn(x, y, INK);
  const nz = b.vorne(0, 22);
  b.box(-1, 1, 22, 23, nz + 1, nz + 1, '#ff7a1a').box(0, 0, 22, 23, nz + 2, nz + 3, '#ff7a1a').v(-1, 23, nz + 1, '#d85a10').v(0, 23, nz + 3, '#ff9a3a').v(0, 22, nz + 4, '#ffb05a');
  // Zylinder, schief und etwas nach hinten aufgesetzt (Gesicht bleibt frei)
  for (let x = -4; x <= 6; x++) for (let z = -6; z <= 3; z++) if ((x - 0.8) ** 2 + (z + 1.5) ** 2 <= 19) b.v(x, 29, z, '#24202e');
  for (let y = 30; y <= 35; y++) {
    const cx = y < 32 ? 1 : 2;
    for (let x = cx - 4; x <= cx + 4; x++) for (let z = -5; z <= 2; z++) {
      if ((x - cx) ** 2 + (z + 1.5) ** 2 > 10) continue;
      b.v(x, y, z, y <= 31 ? '#c42a28' : y === 35 ? '#3a3448' : x === cx - 3 ? '#3a3448' : '#24202e');
    }
  }
  // Stockarme: links waagerecht, rechts erhoben mit Schneeball
  b.linie([-4, 15, 0], [-12, 16, 0], '#6b4b2e').linie([-4, 16, 0], [-10, 17, 0], '#7a5838');
  b.linie([-10, 16, 0], [-12, 18, 0], '#6b4b2e').linie([-11, 16, 0], [-13, 15, 1], '#6b4b2e');
  b.linie([4, 15, 0], [11, 20, 0], '#6b4b2e').linie([4, 16, 0], [10, 20, 0], '#7a5838');
  b.linie([9, 19, 0], [9, 22, 0], '#6b4b2e');
  b.kugel(11.5, 22.5, 0.5, 1.8, 1.8, 1.8, (x, y) => (y > 22 ? '#ffffff' : '#e6f0fc'));
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Bombenpinguin (Frostfrieder)                                         */
/* ------------------------------------------------------------------ */

function bombenpinguinHd(): Vox[] {
  const b = new Fein();
  const schwarz = '#2a2638', orange = '#ff9a1a';
  const koerper: FarbFn = (x, y, z) => {
    if (z > 1.2 && (x / 4.4) ** 2 + ((y - 8) / 7) ** 2 <= 1) return y < 4 ? '#e2e8f4' : '#ffffff';
    return ton(schwarz, 0.92 + y * 0.014);
  };
  b.kugel(0, 9, 0, 6, 8.4, 5.2, (x, y, z) => (y < 1 ? null : koerper(x, y, z)));
  b.kugel(0, 16.6, 0.5, 5, 4.8, 4.6, koerper);
  // Füße
  for (const s of [-1, 1]) b.box(s < 0 ? -4 : 1, s < 0 ? -1 : 4, 0, 0, 0, 6, orange).box(s < 0 ? -4 : 1, s < 0 ? -1 : 4, 1, 1, 1, 3, ton(orange, 0.85));
  // Flossen
  for (const s of [-1, 1]) b.box(s * 6, s * 6, 10, 12, -1, 1, schwarz).box(s * 7, s * 7, 5, 10, -1, 1, ton(schwarz, 1.15));
  // Gurt mit Schnalle
  for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
    const y = 9;
    if (!b.hat(x, y, z)) continue;
    if (b.hat(x + 1, y, z) && b.hat(x - 1, y, z) && b.hat(x, y, z + 1) && b.hat(x, y, z - 1)) continue;
    b.v(x, y, z, '#7a5a3a');
  }
  b.vorn(-1, 9, '#ffd23f').vorn(0, 9, '#ffd23f').vorn(1, 9, '#ffd23f');
  // Schnabel
  const sz = b.vorne(0, 14);
  b.box(-1, 1, 14, 15, sz + 1, sz + 2, orange).box(0, 0, 14, 14, sz + 3, sz + 3, orange).box(-1, 1, 13, 13, sz + 1, sz + 1, '#d87a10');
  // Fliegerbrille: Riemen, Messingrahmen, leuchtende Gläser mit grimmigen Pupillen
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 2; z++) for (const y of [17, 18]) {
    if (!b.hat(x, y, z)) continue;
    if (b.hat(x + 1, y, z) && b.hat(x - 1, y, z) && b.hat(x, y, z + 1) && b.hat(x, y, z - 1)) continue;
    b.v(x, y, z, '#7a5a3a');
  }
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -5 : 2;
    let z = -99;
    for (let x = x0; x <= x0 + 3; x++) for (let y = 16; y <= 19; y++) { const f = b.vorne(x, y); if (!Number.isNaN(f)) z = Math.max(z, f); }
    for (let x = x0; x <= x0 + 3; x++) for (let y = 16; y <= 19; y++) {
      const rand = x === x0 || x === x0 + 3 || y === 16 || y === 19;
      b.v(x, y, z + 1, rand ? '#c9a050' : '#a8f6ff', rand ? 0 : 1);
    }
    b.v(s < 0 ? x0 + 2 : x0 + 1, 17, z + 1, INK).v(s < 0 ? x0 + 2 : x0 + 1, 18, z + 1, INK);
  }
  // gelbe Wut-Federbrauen (wie ein Felsenpinguin)
  const br: [number, number][] = [[-6, 21], [-5, 20], [-4, 20], [-3, 20], [-2, 19]];
  for (const [x, y] of [...br, ...spiegel(br)]) {
    let z = -99;
    for (const yy of [y - 1, y, y + 1]) { const f = b.vorne(x, yy); if (!Number.isNaN(f)) z = Math.max(z, f); }
    if (z > -99) b.v(x, y, z + 1, '#ffd23f').v(x, y + 1, z + 1, '#ffd23f');
  }
  // Bombe auf dem Rücken mit Lunte
  b.kugel(0, 10, -6.5, 3.3, 3.3, 3.1, (x, y, z) => ((x + 1.5) ** 2 + (y - 12) ** 2 < 2.5 && z <= -7 ? '#5a5468' : '#2e2a38'));
  b.box(0, 0, 13, 14, -7, -7, '#6b4b2e').v(0, 15, -8, '#6b4b2e').v(0, 16, -8, '#ff7a1a', 1).v(0, 17, -8, '#ffd23f', 1).v(1, 16, -9, '#fff3c4', 1).v(-1, 16, -8, '#ff5a0a', 1);
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* König Gockel der Laute (Boss, Hühner-Kult)                           */
/* ------------------------------------------------------------------ */

function koenigGockelHd(): Vox[] {
  const b = new Fein();
  const feder = '#f4ecff', federD = '#e2d8f0', orange = '#ff9a1a', umhang = '#8a1a3a', gold = '#ffd23f', rot = '#e8343a';
  // Beine mit Schuppen und Krallenfüße
  for (const s of [-1, 1]) {
    const xc = s * 4;
    b.box(xc - 1, xc + 1, 2, 9, 0, 2, (x, y) => (y % 2 === 0 ? ton(orange, 0.85) : orange));
    b.box(xc - 1, xc + 1, 0, 1, 0, 2, orange);
    for (const dx of [-2, 0, 2]) { b.box(xc + dx, xc + dx, 0, 0, 3, dx === 0 ? 6 : 5, orange); b.v(xc + dx, 0, dx === 0 ? 7 : 6, '#3b2a1e'); }
    b.box(xc, xc, 0, 0, -2, -1, orange);
  }
  // Federbauch mit angedeuteten Federreihen
  const bauch: FarbFn = (x, y, z) => ((y % 4 === 0) && ((x + Math.floor(y / 3) + 40) % 2 === 0) ? federD : ton(feder, 0.94 + (y - 8) * 0.004));
  b.kugel(0, 17, 0, 10.5, 9, 9.5, bauch);
  // Umhang hinten und an den Seiten, Goldborte
  for (let x = -13; x <= 13; x++) for (let y = 8; y <= 28; y++) for (let z = -13; z <= 3; z++) {
    const a = (x / 12) ** 2 + ((y - 18) / 11) ** 2 + ((z + 0.5) / 11.5) ** 2;
    if (a > 1) continue;
    const i = (x / 10.5) ** 2 + ((y - 17) / 9) ** 2 + (z / 9.5) ** 2;
    if (i <= 1 && y < 26) continue;
    const borte = z >= 2 || y <= 9;
    b.v(x, y, z, borte ? gold : ton(umhang, 0.85 + (y - 8) * 0.01 + ((x + 40) % 5 === 0 ? -0.08 : 0)));
  }
  // Hermelinkragen (nur hinten und seitlich, über dem Umhang)
  for (let x = -9; x <= 9; x++) for (let z = -8; z <= 3; z++) for (let y = 26; y <= 27; y++) {
    const d = x * x + (z - 1) * (z - 1);
    if (d > 72 || d < 36) continue;
    b.v(x, y, z, (x + z * 3 + y + 60) % 5 === 0 ? INK : '#ffffff');
  }
  // Flügel vorn an den Seiten
  for (const s of [-1, 1]) b.kugel(s * 11, 17, 2, 1.6, 4.5, 3.6, (x, y) => (y < 15 ? federD : feder));
  // Kopf
  b.kugel(0, 33.5, 4, 8, 8.2, 7.5, (x, y) => ton(feder, 0.96 + (y - 26) * 0.003));
  // große Wut-Augen: Pupille mit Glanz, weißer Augapfel mit zartem Rand, rote Bäckchen
  for (const s of [-1, 1]) for (let x = 2; x <= 8; x++) for (let y = 33; y <= 39; y++) {
    const ex = (x - 5) / 3.3, ey = (y - 36) / 3.3;
    if (ex * ex + ey * ey <= 1) b.vorn(s * x, y, '#c8b8dc');
  }
  auge(b, -7, -3, 34, 37, 1, { p: 3 });
  auge(b, 3, 7, 34, 37, -1, { p: 3 });
  for (const s of [-1, 1]) for (const x of [6, 7]) b.vorn(s * x, 32, rot);
  const br: [number, number][] = [[-8, 39], [-7, 39], [-6, 39], [-5, 38], [-4, 38], [-3, 37], [-2, 37]];
  braue(b, br, '#3b1a1a', 2);
  braue(b, spiegel(br), '#3b1a1a', 2);
  // lauter, offener Schnabel: oben gelb, unten orange, dazwischen Rachen mit Zunge
  b.box(-2, 2, 32, 34, 11, 13, '#ffc030').box(-1, 1, 32, 33, 14, 14, '#ffc030').v(0, 32, 15, '#ffc030').box(-2, 2, 34, 34, 11, 13, '#ffd860');
  b.box(-2, 2, 30, 31, 11, 11, '#5a1a2a').box(-1, 1, 30, 31, 12, 12, '#5a1a2a').v(0, 30, 12, '#ff5a7a');
  b.box(-2, 2, 28, 29, 11, 12, orange).box(-1, 1, 29, 29, 13, 13, orange);
  // Kehllappen
  b.box(-1, 1, 24, 27, 10, 10, '#ff3d3d').box(-1, 1, 25, 27, 11, 11, '#ff3d3d').v(0, 23, 10, '#e02a2a');
  // Kamm hinter der Krone
  for (let z = -3; z <= 2; z++) {
    const top = z >= 1 ? 46 : z >= -1 ? 48 : 47;
    b.box(-1, 1, 40, top, z, z, (x, y) => (x === 0 || y < top ? '#ff3d3d' : '#e02a2a'));
  }
  // kleine Goldkrone mit Zacken und Edelsteinen, oben auf dem Kopf
  for (let x = -5; x <= 5; x++) for (let z = -1; z <= 10; z++) {
    const d = x * x + (z - 4.5) ** 2;
    if (d > 26 || d < 13) continue;
    for (let y = 41; y <= 42; y++) b.v(x, y, z, y === 41 ? ton(gold, 0.85) : gold);
  }
  const zacken: [number, number, string][] = [[0, 9, '#ff3df0'], [-4, 7, '#3de8ff'], [4, 7, '#3de8ff'], [-4, 1, '#5dff7a'], [4, 1, '#5dff7a']];
  for (const [x, z, edel] of zacken) {
    b.box(x, x, 43, 44, z, z, gold).v(x, 45, z, '#fff3c4');
    b.v(x, 41, z + (z > 4 ? 1 : -1), edel, 1);
  }
  // Schwanzfedern-Fächer: nach hinten gebogen, bleibt unter Kopfhöhe
  const fc = ['#ff7a1a', '#3d9bff', '#5dff7a', '#ff3df0', '#ffd23f'];
  [-7, -3.5, 0, 3.5, 7].forEach((xf, i) => {
    const hoch = 36 - Math.abs(xf) * 0.6;
    for (let y = 16; y <= hoch; y++) {
      const t = (y - 16) / (hoch - 16);
      const z = -10 - Math.round(t * t * 7);
      const xo = Math.round(xf * (1 + t * 0.7));
      b.box(xo - 1, xo + 1, y, y, z, z, t > 0.85 ? ton(fc[i], 1.25) : (y % 4 === 0 ? ton(fc[i], 0.82) : fc[i]));
    }
  });
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Toastomat 3000 (Boss, Blechbrut)                                     */
/* ------------------------------------------------------------------ */

function megatoasterHd(): Vox[] {
  const b = new Fein();
  const chrom = '#c9ced8', dunkel = '#8d93a3', led = '#ff2a4a', kette = '#2a2e38';
  // Raupenketten mit Rädern
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -13 : 7, xb = s < 0 ? -7 : 13;
    for (let x = xa; x <= xb; x++) for (let y = 0; y <= 5; y++) for (let z = -9; z <= 9; z++) {
      if ((y === 0 || y === 5) && Math.abs(z) === 9) continue;
      if ((y === 0 && Math.abs(z) === 8) || (y === 5 && Math.abs(z) === 8 && false)) continue;
      b.v(x, y, z, (y === 5 || y === 0) && (z + 40) % 2 === 0 ? '#3a3e46' : kette);
    }
    const xo = s < 0 ? xa : xb;
    for (const zc of [-6, 0, 6]) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      if (dy * dy + dz * dz > 5) continue;
      b.v(xo, 2.5 + dy > 5 ? 5 : Math.round(2.5 + dy), zc + dz, dy * dy + dz * dz <= 1 ? '#c9ced8' : '#5a5f68');
    }
  }
  b.box(-6, 6, 2, 5, -8, 8, '#1d2026');
  // Chromgehäuse mit runden Kanten und Glanzstreifen
  for (let x = -13; x <= 13; x++) for (let y = 6; y <= 31; y++) for (let z = -9; z <= 9; z++) {
    const ax = Math.abs(x), az = Math.abs(z);
    if ((ax === 13 && az >= 8) || (ax === 12 && az === 9)) continue;
    if (y === 31 && (ax === 13 || az === 9)) continue;
    let c = y >= 24 && y <= 26 ? '#e8ecf4' : ton(chrom, 0.86 + (y - 6) * 0.006);
    if (ax === 13) c = ton(dunkel, 0.95 + (y - 6) * 0.006);
    if (z === 9 && (x === -9 || x === -8) && y > 8) c = '#f4f6fa';
    if (y === 6) c = '#6b707a';
    b.v(x, y, z, c);
  }
  // Schlitze oben
  for (const z0 of [-7, -3, 1, 5]) b.box(-10, 10, 31, 31, z0, z0 + 1, kette);
  // Toastscheiben (eine glüht)
  const toast = (z0: number, h: number, heiss: boolean) => {
    for (let x = -9; x <= 9; x++) for (let y = 32; y <= 31 + h; y++) {
      const top = y === 31 + h, ecke = Math.abs(x) === 9 || (top && Math.abs(x) >= 8);
      if (top && Math.abs(x) === 9) continue;
      for (let z = z0; z <= z0 + 1; z++) {
        if (heiss) b.v(x, y, z, ecke || top ? '#ff7a1a' : '#ffb02e', 1);
        else b.v(x, y, z, ecke || top ? '#8a5226' : (x + y) % 5 === 0 ? '#b87830' : '#d89a48');
      }
    }
    if (!heiss) for (let x = -7; x <= 7; x++) { b.v(x, 32 + h, z0, '#8a5226').v(x, 32 + h, z0 + 1, '#8a5226'); }
  };
  toast(-7, 6, false); toast(-3, 2, true); toast(1, 4, false); toast(5, 8, false);
  // Gesichtsfeld: weiß leuchtende Augen mit Pupillen, rote LED-Brauen
  b.box(-11, 11, 16, 29, 10, 10, (x, y) => ((Math.abs(x) === 11 && (y === 16 || y === 29)) ? null : '#1a1d24'));
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -9 : 4;
    for (let x = x0; x <= x0 + 5; x++) for (let y = 19; y <= 23; y++) {
      const innen = s < 0 ? x - x0 : x0 + 5 - x;
      if (y === 23 && innen >= 4) continue;
      b.v(x, y, 11, '#ffffff', 1);
    }
    const px = s < 0 ? -5 : 4;
    b.box(px, px + 1, 19, 21, 11, 11, kette).v(s < 0 ? px : px + 1, 21, 11, '#ffffff', 1);
    for (let i = 0; i <= 7; i++) {
      const x = s < 0 ? -11 + i + 1 : 10 - i, y = 27 - Math.floor(i / 2);
      b.box(x, x, y - 1, y, 11, 11, led, 1);
    }
  }
  // Grill-Maul mit Zähnen
  b.box(-9, 9, 9, 13, 10, 10, kette);
  for (let x = -8; x <= 8; x += 2) b.v(x, 13, 10, '#fff6d8');
  b.box(-7, -6, 10, 11, 10, 10, '#fff6d8').box(6, 7, 10, 11, 10, 10, '#fff6d8');
  // Typenschild „3000“
  b.box(-4, 4, 7, 7, 10, 10, '#ffd23f').v(-3, 7, 10, '#a07a18').v(-1, 7, 10, '#a07a18').v(1, 7, 10, '#a07a18').v(3, 7, 10, '#a07a18');
  // Drehknöpfe
  for (const x of [-11, 11]) b.box(x, x, 10, 11, 10, 10, '#5a5f68').v(x, 11, 11, '#ff3d3d');
  // Hebel rechts
  b.box(13, 13, 14, 26, -1, 0, kette).box(14, 17, 19, 20, -1, 0, '#5a5f68').box(18, 19, 18, 23, -2, 1, '#ff3d3d').box(18, 19, 23, 23, -2, 1, '#ff7a7a');
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Pilzkönigin Morchella (Boss, Sumpfbande)                             */
/* ------------------------------------------------------------------ */

function morchellaHd(): Vox[] {
  const b = new Fein();
  const haut = '#f8e0c4', lila = '#9a3ab0', gold = '#ffd23f', spore = '#7dff5a';
  // Stiel-Körper
  for (let y = 0; y <= 20; y++) {
    const r = y < 3 ? 7.6 - y * 0.3 : 6.8 - (y > 16 ? (y - 16) * 0.25 : 0);
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
      if ((x / r) ** 2 + (z / (r * 0.95)) ** 2 > 1) continue;
      b.v(x, y, z, ton(haut, 0.88 + y * 0.006 + ((x + 40) % 3 === 0 ? -0.03 : 0)));
    }
  }
  // Spitzenkragen: gerüscht, nach außen ansteigend
  for (let x = -13; x <= 13; x++) for (let z = -13; z <= 13; z++) {
    const d = Math.hypot(x, z), az = Math.atan2(x, z);
    const ra = 11.8 + Math.sin(az * 9) * 0.9;
    for (let y = 17; y <= 20; y++) {
      const ri = 5.5 + (y - 17) * 2.2, ro = Math.min(ra, 7.5 + (y - 17) * 1.8);
      if (d < ri || d > ro) continue;
      b.v(x, y, z, (Math.round(az * 6) + y + 60) % 2 === 0 ? '#ffffff' : '#e8dcf0');
    }
  }
  // Kappe, nach hinten versetzt, mit Punkten
  const cx = 0, cy = 21, cz = -4, rx = 15, ry = 12, rz = 14;
  const punkte: [number, number, number][] = [];
  for (const [az, el] of [[0.3, 0.4], [-0.5, 0.35], [1.2, 0.3], [-1.3, 0.3], [2.0, 0.35], [-2.1, 0.35], [2.8, 0.3], [-2.8, 0.3], [0.6, 0.95], [-0.7, 0.9], [2.2, 0.95], [-2.0, 1.0], [Math.PI, 1.0], [0, 1.5]]) {
    punkte.push([cx + rx * Math.cos(el) * Math.sin(az), cy + ry * Math.sin(el), cz + rz * Math.cos(el) * Math.cos(az)]);
  }
  b.kugel(cx, cy, cz, rx, ry, rz, (x, y, z) => {
    if (y < cy) return null;
    for (const [px, py, pz] of punkte) if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 < 5.5) return '#ffffff';
    if (y === cy) return '#7a2a90';
    return ton(lila, 0.85 + (y - cy) * 0.035);
  });
  // Krone
  for (let x = -4; x <= 4; x++) for (let z = -8; z <= 0; z++) {
    const d = x * x + (z + 4) ** 2;
    if (d > 17 || d < 8) continue;
    b.v(x, 33, z, gold).v(x, 34, z, ton(gold, 0.85));
  }
  for (const [x, z] of [[0, 0], [-3, -1], [3, -1], [-4, -5], [4, -5], [0, -8]]) b.box(x, x, 35, 36, z, z, gold);
  b.v(0, 35, 1, spore, 1).v(0, 34, 1, spore, 1);
  // Gesicht: Wimpernaugen, Brauen, Bäckchen, Schmollmund
  auge(b, -6, -2, 9, 13, 1, { p: 3 });
  auge(b, 2, 6, 9, 13, -1, { p: 3 });
  for (const s of [-1, 1]) { b.vorn(s * 7, 12, INK, 0, 1).vorn(s * 7, 13, INK, 0, 1).vorn(s * 8, 14, INK, 0, 1); }
  const br: [number, number][] = [[-7, 16], [-6, 16], [-5, 15], [-4, 15], [-3, 14], [-2, 14]];
  braue(b, br, '#5a1a6a', 2);
  braue(b, spiegel(br), '#5a1a6a', 2);
  for (const s of [-1, 1]) for (const x of [5, 6]) b.vorn(s * x, 7, '#f08aa0').vorn(s * x, 8, '#f4a0b0');
  for (let x = -2; x <= 2; x++) b.vorn(x, 5, '#8a3048');
  b.vorn(-3, 4, '#8a3048').vorn(3, 4, '#8a3048');
  for (let x = -2; x <= 2; x++) b.vorn(x, 4, '#e0607a', 0, 1);
  for (let x = -1; x <= 1; x++) b.vorn(x, 3, '#e0607a', 0, 1);
  // Ärmchen mit Pilzzepter
  b.box(-9, -8, 7, 10, -1, 1, ton(haut, 0.9)).box(8, 9, 7, 10, -1, 1, ton(haut, 0.9));
  b.box(10, 10, 3, 17, 1, 1, '#6b4b2e').kugel(10, 18.5, 1, 2, 1.6, 2, (x, y) => (y >= 19 ? spore : '#4ac83a'));
  b.v(10, 20, 1, '#c8ffb0', 1);
  // schwebende Giftsporen
  for (const [x, y, z] of [[-15, 18, 2], [15, 15, -2], [-12, 8, -6], [13, 7, 5], [-6, 36, -9]]) b.v(x, y, z, spore, 1);
  return b.liste();
}

/* ------------------------------------------------------------------ */
/* Baron von Bumm (Boss)                                                */
/* ------------------------------------------------------------------ */

function baronHd(): Vox[] {
  const b = new Fein();
  const rock = '#6a1f3a', rockD = '#4a1428', haut = '#ffdcb8', hut = '#2a2140', gold = '#ffd23f', bart = '#5a3a22';
  // Stiefel
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -7 : 3;
    b.box(x0, x0 + 4, 0, 2, -2, 5, (x, y, z) => (y === 2 && z === 5 ? null : (y === 2 && z === 4 ? '#4a4060' : '#1c1530')));
  }
  // runder Bauch: Frack, goldene Weste, Revers
  b.kugel(0, 11, 0, 12, 9.6, 11.5, (x, y, z) => {
    if (y < 2) return null;
    if (Math.abs(x) <= 3 && z > 0) return (y + 40) % 3 === 0 ? '#e8b830' : gold;
    if (Math.abs(x) <= 5 && z > 0 && y >= 12) return rockD;
    return ton(rock, 0.85 + (y - 2) * 0.014 + ((x + 40) % 6 === 0 ? -0.06 : 0));
  });
  for (const y of [6, 10, 14]) { b.vorn(0, y, '#8a1a3a').vorn(0, y + 1, '#8a1a3a').vorn(-1, y, '#8a1a3a').vorn(-1, y + 1, '#8a1a3a'); }
  // Ärmchen mit weißen Handschuhen
  for (const s of [-1, 1]) {
    b.box(s < 0 ? -15 : 11, s < 0 ? -11 : 15, 10, 14, -2, 2, (x, y) => ton(rock, 0.9 + (y - 10) * 0.03));
    b.box(s * 16, s * 16, 10, 13, -2, 2, '#ffffff');
    b.box(s < 0 ? -18 : 16, s < 0 ? -16 : 18, 7, 10, -1, 1, '#f4f4ff').v(s * 18, 10, 0, '#e0e0f0');
  }
  // Kopf: abgerundeter Block, helle Haut
  for (let x = -8; x <= 8; x++) for (let y = 20; y <= 31; y++) for (let z = -7; z <= 8; z++) {
    const kx = Math.abs(x) === 8, ky = y === 20 || y === 31, kz = z === -7 || z === 8;
    if ((kx ? 1 : 0) + (ky ? 1 : 0) + (kz ? 1 : 0) >= 2) continue;
    b.v(x, y, z, ton(haut, 0.92 + (y - 20) * 0.008));
  }
  for (const s of [-1, 1]) b.box(s * 9, s * 9, 24, 27, -1, 1, ton(haut, 0.9));
  // Grinsen mit Zähnen
  for (let x = -3; x <= 3; x++) b.v(x, 20, 9, '#5a1a2a').v(x, 21, 9, '#fff6d8');
  b.v(-4, 21, 9, '#5a1a2a').v(4, 21, 9, '#5a1a2a').v(-5, 22, 9, '#5a1a2a').v(5, 22, 9, '#5a1a2a');
  // gezwirbelter Schnurrbart
  for (let x = -7; x <= 7; x++) {
    const ax = Math.abs(x), y = ax <= 4 ? 22 : 23;
    b.v(x, y, 9, ax % 3 === 0 ? '#7a5232' : bart).v(x, y + 1, 9, bart);
    if (ax <= 2) b.v(x, 23, 10, bart);
  }
  for (const s of [-1, 1]) b.v(s * 8, 24, 9, bart).v(s * 9, 25, 9, bart).v(s * 9, 26, 9, '#7a5232');
  // Knollnase und rosige Bäckchen
  b.box(-1, 1, 25, 26, 9, 9, '#f0a880').box(-1, 0, 25, 26, 10, 10, '#f0a880').v(-1, 26, 10, '#ffe0c8');
  for (const s of [-1, 1]) b.v(s * 6, 24, 8, '#ff9a8a').v(s * 7, 24, 8, '#ff9a8a').v(s * 6, 25, 8, '#ffb0a0');
  // Augen; rechts mit goldenem Monokel und Kettchen
  auge(b, -6, -3, 26, 28, 1, { p: 2 });
  auge(b, 3, 6, 26, 28, -1, { p: 2 });
  for (let x = 2; x <= 7; x++) for (let y = 25; y <= 29; y++) {
    const rand = x === 2 || x === 7 || y === 25 || y === 29;
    if (rand && !((x === 2 || x === 7) && (y === 25 || y === 29))) b.v(x, y, 9, gold);
  }
  b.v(6, 28, 9, '#a8f6ff', 1);
  for (const [x, y, z] of [[7, 24, 9], [8, 23, 8], [8, 22, 8], [9, 21, 7], [9, 20, 7]]) b.v(x, y, z, (y % 2 === 0) ? gold : '#c8a020');
  // buschige Wut-Brauen
  const br: [number, number][] = [[-8, 30], [-7, 30], [-6, 30], [-5, 29], [-4, 29], [-3, 29], [-2, 28]];
  braue(b, br, '#4a3222', 2);
  braue(b, spiegel(br).map(([x, y]) => [x, y + 1] as [number, number]).filter(([, y]) => y <= 31), '#4a3222', 2, 0, 2);
  // Zylinder (Krempe vorn knapp, damit das Gesicht im Licht bleibt)
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 9; z++) {
    if ((x / 12.5) ** 2 + ((z + 1.5) / 10.6) ** 2 > 1) continue;
    b.v(x, 32, z, ton(hut, 0.9)).v(x, 33, z, hut);
  }
  for (let y = 34; y <= 45; y++) for (let x = -8; x <= 8; x++) for (let z = -9; z <= 7; z++) {
    if (x * x + (z + 1) ** 2 > 66) continue;
    let c = y <= 36 ? (y === 35 ? '#e03a38' : '#c42a28') : x <= -6 ? '#3d3358' : hut;
    if (y === 45) c = '#3a2f55';
    b.v(x, y, z, c);
  }
  // Bombe auf dem Hut mit brennender Lunte
  b.kugel(0, 50, -1, 4.6, 4.6, 4.6, (x, y, z) => ((x + 2) ** 2 + (y - 52) ** 2 + (z - 1) ** 2 < 4 ? '#5a5468' : '#24202e'));
  b.box(-1, 1, 55, 55, -2, 0, '#7d8597');
  b.v(0, 56, -1, '#6b4b2e').v(1, 57, -1, '#6b4b2e').v(1, 58, -1, '#ff7a1a', 1).v(1, 59, -1, '#ffd23f', 1).v(2, 58, -1, '#ff3d3d', 1).v(0, 58, 0, '#fff3c4', 1);
  return b.liste();
}

/** HD-Modelle Teil B (Größe = halbe Voxelgröße des kleinen Modells) */
export const HD_GEGNER_B: Record<string, HdModell> = {
  minenbot: { vox: minenbotHd, size: 0.05 },
  pilzling: { vox: pilzlingHd, size: 0.05 },
  schleimi: { vox: () => schleimHd(false), size: 0.055 },
  schleimchen: { vox: () => schleimHd(true), size: 0.0325 },
  lavaklops: { vox: lavaklopsHd, size: 0.055 },
  kultist: { vox: kultistHd, size: 0.05 },
  schneemann: { vox: schneemannHd, size: 0.05 },
  bombenpinguin: { vox: bombenpinguinHd, size: 0.05 },
  koenig_gockel: { vox: koenigGockelHd, size: 0.05 },
  megatoaster: { vox: megatoasterHd, size: 0.055 },
  morchella: { vox: morchellaHd, size: 0.05 },
  baron: { vox: baronHd, size: 0.05 }
};
