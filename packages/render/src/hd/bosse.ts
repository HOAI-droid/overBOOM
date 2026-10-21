/**
 * Feine Modelle (HD) der Inselbarone, -baroninnen und des Großen Kawumms.
 * Gleiche Figuren wie in models.ts, aber mit halber Voxelgröße: ein kleiner Voxel x
 * entspricht hier den Zellen 2x und 2x+1. Spiegelachse ist daher x = 0,5 (x ↔ 1 − x).
 * Blickrichtung +z. Gesichter hell und kontrastreich, da die Vorderseite aus der
 * Spielkamera eher im Schatten liegt; Augenweiß leuchtet.
 */
import type { Vox } from '../voxel.ts';
import type { HdModell } from './index.ts';

const INK = '#141018';

/** Farbe abdunkeln/aufhellen (sRGB-Hex) */
function ton(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** kleiner Pseudo-Zufall aus Koordinaten (0..1) */
function rausch(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/** Spiegelbild einer x-Zelle an der Mittelachse */
const sp = (x: number): number => 1 - x;

type Farbe = string | [string, number] | null;

/** Baukasten mit Belegungs-Abfrage (für Gesichter auf runden Formen) */
class Fein {
  private m = new Map<string, Vox>();
  v(x: number, y: number, z: number, c: string, glow = 0): this {
    this.m.set(x + ',' + y + ',' + z, [x, y, z, c, glow]);
    return this;
  }
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string, glow = 0): this {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.v(x, y, z, c, glow);
    return this;
  }
  /** Quader beidseitig (rechte Seite angeben, linke wird gespiegelt) */
  sbox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string, glow = 0): this {
    return this.box(x0, x1, y0, y1, z0, z1, c, glow).box(sp(x1), sp(x0), y0, y1, z0, z1, c, glow);
  }
  /** Voxel beidseitig */
  sv(x: number, y: number, z: number, c: string, glow = 0): this {
    return this.v(x, y, z, c, glow).v(sp(x), y, z, c, glow);
  }
  del(x: number, y: number, z: number): this {
    this.m.delete(x + ',' + y + ',' + z);
    return this;
  }
  hat(x: number, y: number, z: number): boolean {
    return this.m.has(x + ',' + y + ',' + z);
  }
  /** Vorderste belegte z-Zelle der Spalte (x, y), sonst NaN */
  vorne(x: number, y: number): number {
    for (let z = 80; z >= -80; z--) if (this.m.has(x + ',' + y + ',' + z)) return z;
    return NaN;
  }
  /** Vordersten Voxel der Spalte umfärben (dz = 0) oder davor setzen (dz ≥ 1) */
  vorn(x: number, y: number, c: string, glow = 0, dz = 0): this {
    const z = this.vorne(x, y);
    if (Number.isNaN(z)) return this;
    for (let k = Math.min(dz, 1); k <= dz; k++) this.v(x, y, z + k, c, glow);
    return this;
  }
  /** wie vorn, beidseitig */
  svorn(x: number, y: number, c: string, glow = 0, dz = 0): this {
    return this.vorn(x, y, c, glow, dz).vorn(sp(x), y, c, glow, dz);
  }
  /** Ellipsoid; `farbe` bekommt Zelle und Normale (nx, ny, nz) */
  kugel(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number,
    farbe: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => Farbe): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d > 1) continue;
          const l = Math.sqrt(d) || 1;
          const f = farbe(x, y, z, dx / l, dy / l, dz / l);
          if (f === null) continue;
          if (typeof f === 'string') this.v(x, y, z, f);
          else this.v(x, y, z, f[0], f[1]);
        }
    return this;
  }
  list(): Vox[] {
    return [...this.m.values()];
  }
}

/** grobe Abstufung nach Normale: oben heller, unten dunkler (wenige breite Bänder, kein Rauschen) */
function licht(c: string, ny: number, nz = 0, staerke = 1): string {
  const f = ny > 0.55 ? 1.07 : ny < -0.45 ? 0.84 : ny < -0.1 ? 0.93 : 1;
  return ton(c, 1 + (f - 1) * staerke + (nz < -0.5 ? -0.05 : 0));
}

interface GesichtOpt {
  /** Augenmitte (Zeile) */
  y: number;
  /** Abstand der Augen-Innenkante von der Mitte */
  gap?: number;
  aw?: number;
  ah?: number;
  eye?: string;
  eyeGlow?: number;
  pupil?: string;
  /** Pupillen-Breite (Spalten von innen) */
  pw?: number;
  /** dunkle Augen ohne Weiß (nur Glanzpunkt) */
  dunkel?: boolean;
  /** Irisfarbe neben der Pupille (leuchtet) */
  iris?: string;
  /** Umrandung der Augen (hebt helle Augen von heller Haut ab) */
  rand?: string;
  glanz?: string;
  brow?: string;
  browDick?: number;
  browHub?: number;
  /** Lid-Farbe (grimmiger Schlafzimmerblick innen oben) */
  lid?: string;
  dame?: { wimpern?: string; lippen?: string; rouge?: string };
  mund?: { farbe?: string; breite?: number; zaehne?: boolean; hauer?: boolean; zunge?: string; tief?: number } | null;
}

/**
 * Grimmiges, aber knuffiges Gesicht auf der Vorderseite: große Augen mit Pupille nach innen
 * und Glanzpunkt, dicke schräge Brauen (stehen einen Voxel vor), Mund mit Zähnen und Hauern
 * oder bei Damen Wimpern, Rouge und Schmollmund.
 */
function gesicht(b: Fein, o: GesichtOpt): void {
  const g = o.gap ?? 1, aw = o.aw ?? 5, ah = o.ah ?? 6, y = o.y;
  const eye = o.eye ?? '#ffffff', eg = o.eyeGlow ?? 1, pup = o.pupil ?? INK, pw = o.pw ?? (aw >= 5 ? 3 : 2);
  const brow = o.brow ?? '#2b1d14', dick = o.browDick ?? 2, hub = o.browHub ?? 3;
  const yB = y - Math.floor(ah / 2), yT = yB + ah - 1;
  const x0 = 1 + g; // innerste Spalte des rechten Auges
  // Augen
  for (let i = 0; i < aw; i++) for (let j = 0; j < ah; j++) {
    const ecke = (i === 0 || i === aw - 1) && (j === 0 || j === ah - 1);
    if (ecke) continue;
    let c = eye, gl = eg;
    if (o.dunkel) { c = eye; gl = 0; }
    else if (i <= pw && j <= Math.min(ah > 5 ? 3 : 2, ah - 2) && j >= (ah > 4 ? 1 : 0)) {
      if (i < pw) { c = pup; gl = 0; } else if (o.iris) { c = o.iris; gl = 1; }
    }
    b.svorn(x0 + i, yB + j, c, gl);
  }
  // Umrandung: außen, innen und unten, Ecken gerundet
  if (o.rand) {
    for (let j = 1; j < ah - 1; j++) b.svorn(x0 - 1, yB + j, o.rand).svorn(x0 + aw, yB + j, o.rand);
    for (let i = 1; i < aw - 1; i++) b.svorn(x0 + i, yB - 1, o.rand);
    b.svorn(x0, yB, o.rand).svorn(x0 + aw - 1, yB, o.rand);
  }
  // Glanzpunkt oben außen an der Pupille
  const gy = o.dunkel ? yT - 1 : Math.min(ah > 5 ? 3 : 2, ah - 2);
  b.svorn(o.dunkel ? x0 + aw - 2 : x0 + pw - 1, o.dunkel ? gy : yB + gy, o.glanz ?? '#ffffff', 1);
  if (o.dunkel) b.svorn(x0 + 1, yB + 1, o.glanz ?? '#ffffff', 1);
  // grimmiges Lid innen oben
  if (!o.dame && !o.dunkel) {
    const lid = o.lid ?? ton(brow, 1.2);
    b.svorn(x0, yT, lid).svorn(x0 + 1, yT, lid).svorn(x0 + 2, yT, lid).svorn(x0, yT - 1, lid);
  }
  if (o.dame) {
    const w = o.dame.wimpern ?? INK;
    for (let i = 0; i < aw; i++) b.svorn(x0 + i, yT + 1, w); // Lidstrich
    b.svorn(x0 + aw, yT + 1, w).svorn(x0 + aw, yT, w).svorn(x0 + aw + 1, yT + 2, w, 0, 1).svorn(x0 + aw + 1, yT + 1, w, 0, 1);
    b.svorn(x0 + aw, yB + 1, w);
    if (o.dame.rouge) for (let i = aw - 2; i <= aw; i++) for (const dy of [2, 3]) b.svorn(x0 + i, yB - dy, i === aw - 2 && dy === 3 ? ton(o.dame.rouge, 0.92) : o.dame.rouge);
    if (o.dame.lippen) {
      const lp = o.dame.lippen, lpD = ton(lp, 0.7), lpH = ton(lp, 1.25);
      const ym = yB - 6;
      // Oberlippe mit Amorbogen, dunkle Mittellinie, volle Unterlippe mit Glanz
      b.svorn(2, ym + 1, lp, 0, 1).svorn(3, ym + 1, lp, 0, 1);
      b.svorn(1, ym + 1, ton(lp, 0.9), 0, 1);
      for (let x = 1; x <= 3; x++) b.svorn(x, ym, lpD, 0, 1);
      b.svorn(4, ym, lp, 0, 1);
      b.svorn(1, ym - 1, lp, 0, 1).svorn(2, ym - 1, lp, 0, 1).svorn(1, ym - 2, lpD, 0, 1);
      b.vorn(1, ym - 1, lpH, 0, 0);
    }
  }
  // Brauen: dick, schräg nach innen abfallend, stehen vor
  for (let k = -1; k <= aw; k++) {
    const t = (k + 1) / (aw + 1);
    const by = yT + (o.dame ? 3 : 1) + Math.round(t * hub);
    const d = o.dame ? Math.max(1, dick - 1) : dick;
    for (let j = 0; j < d; j++) b.svorn(x0 + k, by + j, j === d - 1 ? ton(brow, 1.35) : brow, 0, 1);
  }
  // Mund
  if (!o.dame && o.mund !== null && o.mund !== undefined) {
    const mf = o.mund.farbe ?? '#5a1a2a', mw = o.mund.breite ?? 4, tief = o.mund.tief ?? 2;
    const ym = yB - 5;
    for (let x = 1; x <= mw; x++) {
      const ab = x >= mw - 1 ? 1 : 0; // Mundwinkel nach unten
      for (let j = 0; j < tief; j++) b.svorn(x, ym - j - ab, j === tief - 1 && o.mund.zunge && x <= 2 ? o.mund.zunge : mf);
      if (o.mund.zaehne && x < mw - 1) b.svorn(x, ym + 1 - ab, x % 2 ? '#fff6d8' : '#e8dcc0');
    }
    b.svorn(mw + 1, ym - 2, mf);
    if (o.mund.hauer) b.svorn(mw - 1, ym - tief, '#fff6d8', 0, 1).svorn(mw - 1, ym - tief + 1, '#fff6d8', 0, 1);
  }
}

/* ------------------------------------------------------------------ */

/** Baronin Gackerella von Federstein: hochnäsige Riesenhenne im Rüschenkleid, Federhut, Lorgnette. */
function gackerella(): Vox[] {
  const fed = '#f8f2ff', fedM = '#e6dcf4', fedD = '#c8bcdc', kleid = '#d03486', kleidD = '#9a2266', kleidH = '#f070b0';
  const gold = '#ffd23f', goldD = '#c8902a', hut = '#4a2370', hutD = '#2e1450', bein = '#ff9a1a', beinD = '#d0700e';
  const b = new Fein();
  // Hühnerfüße mit Krallen lugen unter dem Rock hervor
  b.sbox(3, 7, 0, 2, 9, 11, beinD);
  for (const [x, z1] of [[2, 14], [5, 15], [8, 13]] as [number, number][]) {
    b.sbox(x, x + 1, 0, 1, 10, z1, bein).sbox(x, x + 1, 1, 1, 10, z1 - 1, '#ffb84a').sbox(x, x + 1, 0, 0, z1 + 1, z1 + 1, '#5a3a1a');
  }
  // Rüschenrock (Glocke): Falten mit Verlauf, zwei Rüschen-Stufen, goldener Saum
  const rockR = (y: number) => 15 * Math.sqrt(Math.max(0, 1 - ((y - 7) / 12) ** 2));
  b.kugel(0.5, 7, 0.5, 15, 12, 15, (x, y, z, nx, ny, nz) => {
    if (y < 3 || y > 17) return null;
    if (y <= 4) return y === 3 ? goldD : gold;
    // Rüschenband über dem Saum, darüber breite Falten
    if (y <= 6) return (Math.round(Math.atan2(x - 0.5, z - 0.5) * 7) & 1) ? kleidH : '#ff9ad0';
    const a = Math.atan2(x - 0.5, z - 0.5) * 5 / Math.PI;
    const t = a - Math.floor(a);
    const c = t < 0.5 ? kleid : kleidD;
    return licht(c, ny, nz);
  });
  // Rüschen-Kante: welliger Rand eine Zelle vor dem Rock
  for (let x = -16; x <= 17; x++) for (let z = -16; z <= 17; z++) {
    const d = Math.hypot(x - 0.5, z - 0.5);
    const r = rockR(12) + 1;
    if (d > r || d <= r - 1.2) continue;
    if (Math.sin(Math.atan2(x - 0.5, z - 0.5) * 12) > 0.2) b.v(x, 12, z, kleidH);
  }
  // Federschürze vorne
  for (let x = -2; x <= 3; x++) for (let y = 6; y <= 17; y++) {
    if (y < 8 && (x === -2 || x === 3)) continue;
    b.vorn(x, y, y % 4 === 0 ? fedM : fed, 0, 1);
  }
  // gefiederter Oberkörper mit Schuppenmuster
  const federn = (x: number, y: number, z: number, ny: number, nz: number): string => {
    // Brust glatt (hell), Seiten mit großen Schuppenfedern
    const off = (Math.floor(y / 4) & 1) * 3;
    const fx = ((x + off) % 6 + 6) % 6, fy = ((y % 4) + 4) % 4;
    const kante = fy === 0 && fx !== 2 && fx !== 3 && Math.abs(x - 0.5) > 4;
    return licht(kante ? fedM : z < -4 ? fedM : fed, ny, nz);
  };
  b.kugel(0.5, 25, 1.5, 11, 9, 11, (x, y, z, nx, ny, nz) => federn(x, y, z, ny, nz));
  // Perlenkette mit leuchtendem Anhänger
  for (let x = -6; x <= 7; x++) {
    const ax = Math.abs(x - 0.5);
    const y = 30 - Math.round((6.5 - ax) * 0.45);
    b.vorn(x, y, x % 2 ? '#fff6f0' : '#ffd8ec', 0, 1);
  }
  b.vorn(0, 26, gold, 0, 1).vorn(1, 26, gold, 0, 1).vorn(0, 25, '#ff3df0', 1, 1).vorn(1, 25, '#ff3df0', 1, 1).vorn(0, 24, gold, 0, 1).vorn(1, 24, gold, 0, 1);
  // Schwanzfedern als Fächer hinten
  for (let x = -5; x <= 6; x++) {
    const h = 12 - Math.round(Math.abs(x - 0.5) * 1.2);
    const fi = Math.floor((x + 7) / 2) & 1;
    for (let k = 0; k <= h; k++) {
      const z = -10 - (k >> 1);
      const c = k >= h - 1 ? (fi ? '#ff3df0' : gold) : fi ? (x & 1 ? kleid : kleidD) : (x & 1 ? fed : fedM);
      b.v(x, 21 + k, z, c);
    }
  }
  // Flügel links angelegt, mit gestuften Schwungfedern
  for (let y = 15; y <= 27; y++) for (let z = -4; z <= 5; z++) {
    const unten = 18 - ((z + 4) >> 1) % 3;
    if (y < unten) continue;
    const c = y <= unten + 1 ? fedD : (z & 1) ? fedM : fed;
    b.box(-12, -10, y, y, z, z, licht(c, (y - 22) / 8));
  }
  // rechter Flügel erhoben, hält die Lorgnette
  b.box(11, 14, 21, 28, -2, 3, fedM).box(11, 14, 21, 21, -2, 3, fedD).box(13, 16, 29, 34, 0, 5, fedM).box(16, 16, 29, 34, 0, 5, fedD);
  b.box(14, 17, 35, 36, 2, 6, fed);
  // Kopf
  b.kugel(0.5, 41, 3, 10, 10, 9.5, (x, y, z, nx, ny, nz) => licht(z < -2 && ((x + y) % 4 === 0) ? fedM : fed, ny, nz, 0.6));
  // Federbüschel an den Wangen
  b.sbox(10, 11, 38, 41, 1, 4, fedM).sv(12, 39, 2, fedD).sv(12, 40, 3, fedD);
  gesicht(b, { y: 43, gap: 2, pw: 2, iris: '#ff8ad8', brow: '#4a1a3a', browDick: 2, browHub: 2, rand: '#9a7ab8', dame: { rouge: '#ff9ac8', wimpern: INK } });
  // Schnabel, hochnäsig nach oben gereckt
  const sz = b.vorne(0, 37);
  for (let x = -1; x <= 2; x++) for (let y = 35; y <= 39; y++) {
    const ax = Math.abs(x - 0.5);
    if (y === 39 && ax > 1) continue;
    b.v(x, y, sz + 1, y >= 37 ? '#ffc040' : '#ffa82a');
    if (ax < 1 && y >= 36) b.v(x, y, sz + 2, y >= 38 ? '#ffd860' : '#ffc040');
    if (ax < 1 && y >= 38) b.v(x, y + 1, sz + 3, '#ffe080');
  }
  b.v(-1, 38, sz + 2, '#b0600e').v(2, 38, sz + 2, '#b0600e'); // Nasenlöcher
  b.box(-1, 2, 36, 36, sz + 1, sz + 1, '#e07a10'); // Schnabelspalt
  // Kehllappen
  for (let x = -1; x <= 2; x++) for (let y = 31; y <= 34; y++) {
    if ((y === 31) && (x === -1 || x === 2)) continue;
    b.vorn(x, y, y <= 32 ? '#d82a3a' : '#ff3d3d', 0, 1);
  }
  // Lorgnette neben dem Gesicht: zwei Gläser, Goldrahmen, Stiel zur Flügelhand
  const lz = b.vorne(10, 42) + 2;
  for (const cx0 of [12.5, 18.5]) for (let x = Math.floor(cx0 - 3); x <= Math.ceil(cx0 + 3); x++) for (let y = 39; y <= 46; y++) {
    const d = Math.hypot(x - cx0, y - 42.5);
    if (d > 3.3) continue;
    if (d > 2.3) b.v(x, y, lz, (y > 43) ? gold : goldD);
    else b.v(x, y, lz, d < 1 && y > 42 ? '#ffffff' : '#a8f6ff', 1);
  }
  b.box(15, 16, 43, 43, lz, lz, gold);
  b.box(16, 16, 35, 39, lz - 1, lz - 1, goldD).box(17, 17, 33, 38, lz - 2, lz - 2, gold);
  // Federhut: Krempe vorne hochgeklappt, Goldband, Krone
  for (let x = -13; x <= 14; x++) for (let z = -15; z <= 12; z++) {
    const d = Math.hypot(x - 0.5, z + 1.5);
    if (d > 11.3) continue;
    const y = 50 + (z > 3 ? 1 : 0) + (z > 6 ? 1 : 0) + (z > 8 ? 1 : 0);
    b.v(x, y, z, d > 10.1 ? hutD : d > 8 ? ton(hut, 0.9) : hut);
  }
  b.kugel(0.5, 55, -2.5, 7.5, 5.5, 7.5, (x, y, z, nx, ny, nz) => {
    if (y < 51) return null;
    if (y <= 53) return y === 51 ? goldD : gold;
    return licht(hut, ny, nz, 1.5);
  });
  // Riesenfedern: Magenta, Cyan, Gelb – mit hellem Kiel
  const feder = (x0: number, z0: number, c: string, h: number, dx: number) => {
    for (let k = 0; k <= h * 2; k++) {
      const t = k / 2;
      const x = x0 + Math.round(dx * (t / h) ** 2 * 8), y = 56 + Math.round(2 * t * (1 - t / (h * 2.2))) + (k & 1);
      const z = z0 - Math.round((t / h) ** 2 * h * 1.8);
      const w = Math.round(0.4 + 1.2 * Math.sin(Math.PI * Math.min(1, (k + 2) / (h * 2 + 2))));
      for (let i = -w; i <= w + 1; i++) {
        const kiel = (i === 0 || i === 1) && w > 0;
        const fc = kiel ? ton(c, 1.3) : k >= h * 2 - 2 ? ton(c, 1.15) : (i === -w || i === w + 1) ? ton(c, 0.8) : c;
        b.v(x + i, y, z, fc).v(x + i, y, z + 1, fc);
      }
    }
  };
  feder(-6, -4, '#ff3df0', 9, -1);
  feder(3, -6, '#3de8ff', 7, 1);
  feder(-1, -8, gold, 6, 0);
  return b.list();
}

/** Baron Blitzbirne: eitler Edelmann im Frack voller Kabel, riesige leuchtende Glühbirne als Kopf. */
function blitzbirne(): Vox[] {
  const frack = '#3b2b66', frackD = '#2a1f45', frackH = '#54408a', hemd = '#f4ecff', messing = '#ecb45a', messingD = '#b88a38', messingH = '#ffd890';
  const b = new Fein();
  // Lackschuhe mit Glanz, Röhrenhosen mit Galonstreifen
  b.sbox(2, 7, 0, 1, -2, 5, '#141018').sbox(3, 6, 1, 1, 4, 5, '#2a2638').sv(4, 1, 5, '#8a84a0').sv(5, 1, 4, '#5a5468');
  b.sbox(2, 6, 2, 11, -1, 2, frackD).sbox(6, 6, 2, 11, 0, 1, '#5a4a8a');
  // Frack-Rumpf, Hemdbrust mit Weste
  b.kugel(0.5, 20.5, 0.5, 10, 10, 7, (x, y, z, nx, ny, nz) => {
    if (y < 12) return null;
    const ax = Math.abs(x - 0.5);
    if (z > 3 && ax <= 2.5) return licht(hemd, ny, nz, 0.5);
    if (z > 3 && ax <= 4.5 && y < 26) return licht('#ff3df0', ny, nz);
    return licht(nx < -0.5 || nx > 0.5 ? frack : frackH, ny, nz);
  });
  // Hemdknöpfe (gold), Westenknöpfe
  for (const y of [15, 18, 21, 24]) b.vorn(0, y, '#ffd23f').vorn(1, y, '#ffd23f');
  b.svorn(4, 17, '#ffd23f').svorn(4, 21, '#ffd23f');
  // Rüschen-Jabot
  for (let y = 22; y <= 27; y++) b.vorn(y % 2 ? 0 : 1, y, '#ffffff', 0, 1);
  // Revers: glänzende Satinstreifen schräg vom Kragen
  for (let y = 18; y <= 29; y++) {
    const x = 3 + Math.floor((29 - y) / 4);
    b.svorn(x, y, '#1f1636', 0, 1).svorn(x + 1, y, '#4a3a7a', 0, 1);
  }
  // Fliege (Magenta) mit Knoten
  for (let i = 1; i <= 5; i++) for (let j = -Math.ceil(i / 2); j <= Math.ceil(i / 2); j++) b.svorn(i, 29 + j, i === 1 ? '#c42a9a' : j === 0 ? '#ff6af4' : '#ff3df0', 0, 1);
  // Schwalbenschwänze hinten
  for (let y = 4; y <= 17; y++) {
    const w = y < 8 ? 3 - ((8 - y) >> 1) : 7;
    b.sbox(Math.max(1, 8 - w), 8, y, y, -9, -7, y < 7 ? frackD : frack);
  }
  // Kabel winden sich um den Frack (gelb und cyan, mit Funken)
  for (let a = 0; a < 90; a++) {
    const w = a / 90 * Math.PI * 2.4;
    const x1 = Math.round(0.5 + Math.sin(w) * 10.4), z1 = Math.round(0.5 + Math.cos(w) * 7.4);
    b.v(x1, 14 + Math.round(a / 9), z1, a % 23 === 0 ? '#fff3c4' : '#ffd23f', a % 23 === 0 ? 1 : 0);
    const x2 = Math.round(0.5 + Math.sin(w + 2) * 10.2), z2 = Math.round(0.5 + Math.cos(w + 2) * 7.3);
    b.v(x2, 24 - Math.round(a / 10), z2, a % 19 === 0 ? '#a8f6ff' : '#3de8ff', a % 19 === 0 ? 1 : 0);
  }
  // Ärmchen mit weißen Handschuhen
  b.box(-14, -11, 17, 27, -2, 3, frack).box(-14, -14, 17, 27, -2, 3, frackD).box(-14, -11, 18, 19, -2, 3, '#ff3df0');
  b.box(-14, -11, 13, 17, -1, 4, hemd).box(-14, -14, 13, 13, 0, 4, '#d8d0e8');
  b.box(12, 15, 17, 27, -2, 3, frack).box(15, 15, 17, 27, -2, 3, frackD).box(12, 15, 18, 19, -2, 3, '#ff3df0');
  b.box(12, 15, 13, 17, -1, 4, hemd).box(15, 15, 13, 13, 0, 4, '#d8d0e8');
  // Kabel als Peitsche mit Funkenspitze
  const peitsche: [number, number, number][] = [[15, 12, 3], [16, 11, 4], [17, 10, 4], [18, 9, 5], [19, 8, 6], [19, 7, 7], [20, 6, 8], [20, 5, 8]];
  for (const [x, y, z] of peitsche) b.box(x, x, y, y, z, z + 1, '#ffd23f');
  b.box(20, 21, 3, 4, 8, 9, '#ffffff', 1).v(22, 5, 9, '#3de8ff', 1).v(19, 3, 10, '#3de8ff', 1).v(21, 2, 8, '#a8f6ff', 1).v(22, 3, 7, '#ff3df0', 1);
  // Kabel vom Rücken in die Fassung
  b.box(-6, -5, 26, 33, -8, -7, '#3de8ff').box(6, 7, 24, 33, -8, -7, '#ffd23f');
  // Stehkragen
  for (let x = -5; x <= 6; x++) for (let z = -5; z <= 6; z++) {
    const d = Math.hypot(x - 0.5, z - 0.5);
    if (d <= 6.2 && d > 4.2) b.v(x, 30, z, hemd).v(x, 31, z, z > 3 ? '#e8e0f4' : hemd);
  }
  // Schraubfassung aus Messing mit Gewinderillen
  for (let y = 31; y <= 38; y++) for (let x = -6; x <= 7; x++) for (let z = -6; z <= 7; z++) {
    const d = Math.hypot(x - 0.5, z - 0.5);
    const r = y % 2 ? 6.4 : 5.8;
    if (d > r) continue;
    b.v(x, y, z, y % 2 ? (x < -1 && z > 0 ? messingH : messing) : messingD);
  }
  // riesige Glühbirne (leuchtet): Farbverlauf, Randschatten, Glanzlicht oben links
  b.kugel(0.5, 51, 1.5, 13, 14, 13, (x, y, z, nx, ny, nz) => {
    if (y < 38) return null;
    if (y <= 41 && Math.hypot(x - 0.5, z - 1.5) > 6.5) return null;
    if (nx < -0.3 && ny > 0.35 && nz > 0.25 && nx > -0.75) return ['#ffffff', 1];
    const rand = nx * nx + nz * nz > 0.88 && Math.abs(ny) < 0.45;
    const c = rand ? '#ffd24a' : ny > 0.55 ? '#fff3c4' : ny > 0.1 ? '#ffec9a' : ny > -0.4 ? '#ffe070' : '#ffcf50';
    return [c, 1];
  });
  // Glühfaden schimmert durch den Scheitel
  for (const [x, y] of [[-2, 65], [-1, 64], [0, 65], [1, 64], [2, 65], [3, 64]]) b.v(x, y, 1, '#ff7a1a', 1).v(x, y, 2, '#ff9a1a', 1);
  // Gesicht auf dem Glas: dunkle Augen mit Glanz, dicke Brauen, gezwirbelter Draht-Schnurrbart, grimmiges Grinsen
  const d = '#2a1f45';
  gesicht(b, { y: 53, gap: 2, aw: 4, ah: 5, eye: d, dunkel: true, brow: d, browDick: 2, browHub: 3 });
  // Schnurrbart: dicke Mitte, Enden hochgezwirbelt
  const bart: [number, number][] = [[1, 46], [2, 46], [3, 46], [4, 46], [5, 46], [6, 46], [7, 46], [8, 47], [9, 48], [9, 49], [1, 45], [2, 45], [3, 45], [4, 45], [5, 45], [6, 45], [7, 45], [8, 46], [10, 48], [10, 49]];
  for (const [x, y] of bart) b.svorn(x, y, y === 46 && x < 7 ? '#3a2a5a' : d, 0, 1);
  // Mund mit Zahnreihe, grimmig nach unten
  for (let x = 1; x <= 4; x++) b.svorn(x, 41 - (x > 3 ? 1 : 0), '#7a2a3a').svorn(x, 42 - (x > 3 ? 1 : 0), x < 4 ? '#fff6d8' : '#7a2a3a');
  // eitles Zylinderchen schräg auf dem Glas
  b.box(-4, 7, 65, 65, -4, 7, '#141018').box(-4, 7, 65, 65, 7, 7, '#2a2638');
  b.box(-2, 5, 66, 73, -2, 5, '#141018').box(-2, 5, 66, 67, -2, 5, '#ff3df0').box(-2, 5, 73, 73, -2, 5, '#2a2638');
  b.box(-2, -2, 68, 72, -2, 5, '#24202e');
  // Monokelkette als Funke am Hutband
  b.v(5, 67, 6, '#ffd23f', 1);
  return b.list();
}

/** Baronin Schraubella: elegante Blechdame im Glockenrock, Zahnrad-Krone, Schrauben-Monokel, Aufziehschlüssel. */
function schraubella(): Vox[] {
  const chrom = '#c9ced8', chromD = '#8d93a3', chromH = '#eef1f6', stahl = '#6b707a', goldH = '#ffd23f', goldD = '#d8a04a';
  const b = new Fein();
  // Glockenrock aus Blechbahnen: jede Bahn mit Glanzkante, Nietenreihen, Goldbänder
  for (let y = 0; y <= 21; y++) {
    const r = 15 - y * 0.33;
    for (let x = -16; x <= 17; x++) for (let z = -16; z <= 17; z++) {
      const dd = Math.hypot(x - 0.5, z - 0.5);
      if (dd > r) continue;
      const a = Math.atan2(x - 0.5, z - 0.5) * 7 / Math.PI;
      const t = a - Math.floor(a);
      const bahn = Math.floor(a + 20) % 2;
      let c = t < 0.2 ? chromH : bahn ? chrom : '#b4bac6';
      if (y <= 1 || y === 12 || y === 13) c = y === 0 || y === 12 ? goldD : goldH;
      else if (dd > r - 1.2 && (y === 7 || y === 17) && t > 0.45 && t < 0.62) c = goldH;
      b.v(x, y, z, c);
    }
  }
  // Mieder mit Goldschnürung
  b.kugel(0.5, 25, 0.5, 6.4, 4, 6, (x, y, z, nx, ny, nz) => licht(stahl, ny, nz));
  for (let y = 22; y <= 28; y++) b.vorn(y % 2 ? 0 : 1, y, goldH);
  // Oberkörper
  b.kugel(0.5, 31, 0.5, 8, 5, 6.4, (x, y, z, nx, ny, nz) => licht(nx < -0.4 ? chromD : nx > 0.5 ? chromH : chrom, ny, nz));
  b.vorn(0, 31, '#ff3df0', 1, 1).vorn(1, 31, '#ff3df0', 1, 1).vorn(0, 32, '#ffb0f8', 1, 1).vorn(1, 32, '#ff3df0', 1, 1);
  b.svorn(2, 31, goldH, 0, 1).svorn(2, 32, goldH, 0, 1);
  // Schulterkugeln, Röhrenärmchen mit Goldgelenken, Hände in die Hüfte gestemmt
  b.sbox(8, 11, 31, 34, -1, 2, chromH).sbox(9, 11, 26, 30, -2, 1, chromD).sbox(9, 11, 25, 25, -1, 2, goldH);
  b.sbox(9, 11, 20, 24, 0, 3, stahl).sbox(7, 8, 20, 21, 0, 3, stahl).sbox(9, 11, 24, 24, 0, 3, goldD);
  // Aufziehschlüssel im Rücken
  b.box(0, 1, 32, 33, -10, -6, stahl).box(-6, 7, 30, 35, -12, -11, goldD).box(-4, -1, 32, 33, -12, -11, '#2a2e38').box(2, 5, 32, 33, -12, -11, '#2a2e38');
  b.box(-6, 7, 35, 35, -12, -11, goldH);
  // Hals mit Ring
  b.box(-1, 2, 36, 37, -2, 3, stahl).box(-2, 3, 36, 36, -2, 3, goldD);
  // großer runder Blechkopf mit Nahtlinien
  b.kugel(0.5, 47, 1.5, 11, 10, 10, (x, y, z, nx, ny, nz) => {
    if (z < 0 && (x === -6 || x === 7)) return chromD;
    return licht('#e8ecf2', ny, nz, 0.6);
  });
  gesicht(b, { y: 48, gap: 2, pw: 2, iris: '#3de8ff', brow: INK, browDick: 2, browHub: 3, rand: '#8d93a3', dame: { lippen: '#ff3df0', rouge: '#ff9ac8', wimpern: INK } });
  // Nieten auf den Wangen
  b.svorn(9, 46, stahl).svorn(9, 43, stahl);
  // Mutter-Ohrringe mit leuchtenden Tropfen
  b.sbox(11, 12, 39, 42, 0, 1, goldH).sv(12, 40, 1, goldD).sbox(11, 12, 36, 37, 0, 1, '#3de8ff', 1).sv(11, 35, 1, '#a8f6ff', 1);
  // Schrauben-Monokel: Goldring um das rechte Auge (Auge bleibt sichtbar), Schraube und Kettchen
  const mz = b.vorne(5, 48) + 2;
  for (let x = 0; x <= 11; x++) for (let y = 42; y <= 54; y++) {
    const dd = Math.hypot(x - 5, y - 48);
    if (dd > 4.8 || dd < 3.7) continue;
    b.v(x, y, mz, y > 48 ? goldH : goldD);
  }
  b.box(10, 11, 49, 50, mz, mz, '#f6f8fc').v(11, 50, mz, INK); // Schraubenkopf
  for (let k = 0; k < 8; k++) b.v(8 + (k >> 2), 43 - k, mz - (k >> 1), k % 2 ? goldH : goldD);
  // Seidenschärpe (Magenta) um die Taille, Schleife hinten
  for (let x = -7; x <= 8; x++) for (let z = -7; z <= 8; z++) {
    if (!b.hat(x, 23, z)) continue;
    if (b.hat(x + 1, 23, z) && b.hat(x - 1, 23, z) && b.hat(x, 23, z + 1) && b.hat(x, 23, z - 1)) continue;
    b.v(x, 23, z, '#ff3df0').v(x, 24, z, '#e02ad0');
  }
  b.box(-6, -1, 21, 26, -8, -8, '#ff3df0').box(2, 7, 21, 26, -8, -8, '#ff3df0').box(0, 1, 22, 25, -8, -8, '#c42a9a');
  b.box(-2, 3, 14, 20, -8, -8, '#c42a9a').box(-3, -2, 14, 15, -8, -8, '#9a1a7a').box(3, 4, 14, 15, -8, -8, '#9a1a7a');
  // Zahnrad-Krone: Goldreif mit Zacken
  for (let x = -9; x <= 10; x++) for (let z = -9; z <= 10; z++) {
    const dd = Math.hypot(x - 0.5, z - 0.5);
    if (dd > 8.8 || dd <= 6.4) continue;
    const zahn = (Math.round(Math.atan2(x - 0.5, z - 0.5) * 5) & 1) === 1;
    b.v(x, 56, z, zahn ? goldH : goldD);
    if (zahn && dd > 7.5) b.v(x, 57, z, goldH);
  }
  // stehendes Zahnrad mit Speichen und leuchtender Nabe
  for (let x = -12; x <= 13; x++) for (let y = -12; y <= 12; y++) {
    const dx = x - 0.5, dd = Math.hypot(dx, y), a = Math.atan2(y, dx);
    const zahn = Math.cos(a * 10) > 0.25;
    const speiche = dd < 7.4 && [Math.PI / 2, Math.PI * 7 / 6, -Math.PI / 6].some((w) => Math.abs(dx * Math.sin(w) - y * Math.cos(w)) < 1.1 && dx * Math.cos(w) + y * Math.sin(w) > 0);
    const nabe = dd < 2.3;
    if (!(speiche || nabe || (dd >= 6.6 && dd <= (zahn ? 11.6 : 9.2)))) continue;
    if (y < -5) continue;
    const c = dd > 9.4 ? (y > 0 ? goldH : goldD) : (y + dx > 0 ? goldH : '#e8b83a');
    b.v(x, 64 + y, -4, c).v(x, 64 + y, -5, goldD).v(x, 64 + y, -6, goldD);
    if (nabe) b.v(x, 64 + y, -3, dd < 1.2 ? '#ffb0f8' : '#ff3df0', 1);
  }
  return b.list();
}

/** Baronin Sporella: Pilzbaronin, Hut so groß wie ein Gartenteich, Moos-Schleier, Sporen-Kette. */
function sporella(): Vox[] {
  const stiel = '#fff2e0', stielD = '#e8d4b4', kleid = '#a04ac0', kleidH = '#c070e0', kleidD = '#7a3098', hut = '#1f8a80', hutD = '#155a56', hutH = '#2aa898';
  const punkt = '#ffd23f', moos = ['#5dbb3a', '#3d8a2a', '#7dcc4a'];
  const b = new Fein();
  // Rock wie ein Pilzstiel: Falten mit Verlauf, Moos-Saum mit Fransen
  b.kugel(0.5, 4.5, 0.5, 13, 16, 13, (x, y, z, nx, ny, nz) => {
    if (y < 0 || y > 19) return null;
    if (y <= 3 || (y === 4 && rausch(x, 4, z) < 0.5)) return moos[Math.floor(rausch(x, y, z) * 3)];
    const a = Math.atan2(x - 0.5, z - 0.5) * 5 / Math.PI;
    const t = a - Math.floor(a);
    return licht(t < 0.5 ? kleidH : kleid, ny, nz);
  });
  // Rüschenkragen
  for (let x = -7; x <= 8; x++) for (let z = -7; z <= 8; z++) {
    const dd = Math.hypot(x - 0.5, z - 0.5);
    if (dd > 7.5 || dd < 4.5) continue;
    b.v(x, 19, z, (Math.round(Math.atan2(x - 0.5, z - 0.5) * 4) & 1) ? '#e8b0ff' : kleidH);
  }
  // Ärmchen mit Moos-Handschuhen
  b.sbox(8, 11, 16, 23, -2, 3, kleid).sbox(11, 11, 16, 23, -2, 3, kleidD).sbox(8, 11, 12, 15, -2, 3, moos[1]).sbox(8, 11, 15, 15, -2, 3, moos[2]);
  // Kopf
  b.kugel(0.5, 28.5, 1.5, 9, 9, 9, (x, y, z, nx, ny, nz) => licht(stiel, ny, nz, 0.5));
  gesicht(b, { y: 30, gap: 2, aw: 4, pw: 2, iris: '#b05dff', brow: '#2b1440', browDick: 2, browHub: 3, rand: '#d8bfa0', dame: { lippen: '#ff3df0', rouge: '#ff9ac8', wimpern: '#2b1440' } });
  // Sommersprossen-Sporen
  b.svorn(7, 27, '#e8c8a0').svorn(8, 26, '#e8c8a0');
  // Kette aus leuchtenden Sporen
  for (let x = -6; x <= 7; x++) {
    const ax = Math.abs(x - 0.5);
    b.vorn(x, 20 - (ax < 4 ? 1 : 0), '#2a5a2a', 0, 1);
  }
  for (const [x, c] of [[1, '#ff3df0'], [4, '#3de8ff'], [7, '#ff3df0']] as [number, string][]) {
    const y = 19 - (x < 5 ? 1 : 0);
    b.svorn(x, y, c, 1, 1).svorn(x, y - 1, ton(c, 1.2), 1, 1);
  }
  // Riesenhut, nach hinten gekippt (vorne höher): Lamellen unten, goldene Tupfen, Moos-Schleier
  const R = 20;
  const tupfen: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, r = 3 + Math.sqrt(i / 16) * 15;
    tupfen.push([Math.sin(a) * r + 0.5, Math.cos(a) * r + 0.5, 1.6 + (i % 3) * 0.6]);
  }
  for (let x = -21; x <= 22; x++) for (let z = -21; z <= 22; z++) {
    const dx = x - 0.5, dzz = z - 0.5, dd = Math.hypot(dx, dzz);
    if (dd > R) continue;
    const h = Math.round(Math.sqrt(1 - (dd / R) ** 2) * 12);
    const y0 = 41 + Math.round(dzz * 0.16);
    const lam = (Math.round(Math.atan2(dx, dzz) * 12) & 1) ? '#e8d0b8' : '#cfb090';
    b.v(x, y0, z, dd > R - 1.5 ? hutD : lam);
    let tupf = -1;
    for (const [tx, tz, tr] of tupfen) { const t = Math.hypot(x - tx, z - tz); if (t < tr) tupf = t / tr; }
    for (let y = 1; y <= h; y++) {
      const oben = y === h;
      let c = dd > R - 2 ? hutD : dd > R - 6 ? hut : hutH;
      if (!oben && y < h - 1) c = hutD;
      if (tupf >= 0) c = tupf < 0.45 ? '#fff0a0' : punkt;
      b.v(x, y0 + y, z, c);
    }
    // Moos-Schleier: geschlossener Vorhang mit Fransen-Saum, vorne frei fürs Gesicht
    if (dd > R - 2.2 && dd <= R - 1.2 && Math.abs(Math.atan2(dx, dzz)) > 1.0) {
      const w = Math.atan2(dx, dzz);
      const len = 6 + Math.round(Math.sin(w * 7) * 2 + Math.sin(w * 17) * 1.5) + (rausch(x, 0, z) < 0.35 ? 3 : 0);
      for (let k = 1; k <= len; k++) b.v(x, y0 - k, z, k >= len - 1 ? moos[2] : (Math.round(w * 9) & 1) ? moos[0] : moos[1]);
    }
  }
  // feiner Schleier-Fransen vor der Stirn
  for (let x = -8; x <= 9; x += 3) for (let k = 0; k < 2; k++) b.vorn(x, 38 - k + (x & 1), moos[k ? 2 : 0], 0, 1);
  // Stiel-Hals verbindet Kopf und Hut
  b.box(-3, 4, 36, 40, -4, 3, stielD);
  // Sporenwölkchen über dem Hut
  for (const [x, y, z] of [[-8, 56, 4], [6, 59, -4], [12, 55, 6], [-14, 53, -6], [1, 61, 1], [-3, 58, -8]]) b.v(x, y, z, '#c9a0ff', 1).v(x + 1, y + 1, z, '#ff8af0', 1);
  return b.list();
}

/** Baron Glutbauch: kugelrunder Magma-Fürst, glühender Bauch, Rauch-Schnauzbart, Obsidian-Krönchen. */
function glutbauch(): Vox[] {
  const kruste = '#3e2c2c', krusteD = '#2a1f25', krusteH = '#5a403a', glut = '#ff7a1a', hell = '#ffd23f', rauch = '#9a90a8', rauchH = '#d0c8d8';
  const b = new Fein();
  // Stummelfüße mit glühenden Zehen
  b.sbox(3, 10, 0, 3, -2, 7, krusteD).sbox(3, 10, 3, 3, -2, 7, kruste).sv(4, 1, 8, glut, 1).sv(6, 1, 8, glut, 1).sv(8, 1, 8, glut, 1);
  // Kugelkörper aus Kruste mit glühenden Rissen, vorne Gesichtsfeld und glühender Bauch
  b.kugel(0.5, 21, 0.5, 19, 19, 18, (x, y, z, nx, ny, nz) => {
    const bx = (x - 0.5) / 12, by = (y - 15) / 9.5;
    const k = bx * bx + by * by;
    if (nz > 0.45 && k < 1) return [k < 0.25 ? '#fff6d8' : k < 0.5 ? '#ffe680' : k < 0.78 ? hell : glut, 1];
    if (nz > 0.4 && k < 1.3) return '#5a2a1a';
    if (nz > 0.45 && y >= 25 && y <= 39 && Math.abs(x - 0.5) <= 14) return y > 36 ? '#a85030' : '#c46a3a';
    const riss = Math.abs(Math.sin(x * 0.45 + y * 0.3) + Math.cos(z * 0.4 - y * 0.25)) < 0.09;
    if (riss) return [rausch(x, y, z) < 0.5 ? glut : '#ff9a1a', 1];
    const n = rausch(x, y, z);
    return licht(n < 0.25 ? krusteD : n > 0.85 ? krusteH : kruste, ny, nz, 1.2);
  });
  // Ärmchen mit glühenden Knöcheln
  b.sbox(18, 22, 18, 23, -2, 3, kruste).sbox(18, 22, 23, 23, -2, 3, krusteH);
  b.sbox(21, 24, 13, 17, -2, 4, krusteD).sv(22, 15, 5, glut, 1).sv(23, 16, 5, '#ffd23f', 1).sv(21, 14, 5, glut, 1);
  // Gesicht: glühende Augen, Wutbrauen aus Obsidian
  gesicht(b, { y: 32, gap: 1, aw: 5, ah: 5, eye: hell, eyeGlow: 1, pupil: INK, brow: '#141018', browDick: 3, browHub: 4, lid: '#7a3a20', mund: null });
  // Rauch-Schnauzbart: zwei dicke Wölkchen-Hälften, Enden hochgezwirbelt (aus dem kleinen Modell verfeinert)
  const bart: [number, number][] = [];
  for (let x = 1; x <= 15; x++) {
    if (x <= 11) bart.push([x, 26], [x, 25], [x, 24]);
    if (x >= 3 && x <= 9) bart.push([x, 23], [x, 22]);
    if (x >= 10) bart.push([x, 27], [x, 28]);
    if (x >= 12) bart.push([x, 29], [x, 30]);
    if (x >= 13) bart.push([x, 31], [x, 32]);
  }
  for (const [x, y] of bart) {
    const oben = !bart.some(([a, c]) => a === x && c === y + 1);
    b.svorn(x, y, oben ? rauchH : (x + y) % 3 === 0 ? '#b0a8c0' : rauch, 0, 1);
  }
  // Hauer unterm Bart
  b.svorn(4, 21, '#fff6d8', 0, 1).svorn(4, 20, '#fff6d8', 0, 1).svorn(5, 21, '#e8dcc0', 0, 1);
  // Obsidian-Krönchen mit Lavasteinen
  for (let x = -7; x <= 8; x++) for (let z = -7; z <= 8; z++) {
    const dd = Math.hypot(x - 0.5, z - 0.5);
    if (dd > 7.2) continue;
    b.v(x, 40, z, '#2a2140').v(x, 41, z, dd > 5.8 ? '#3e3260' : '#2a2140');
  }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const x = Math.round(0.5 + Math.sin(a) * 6), z = Math.round(0.5 + Math.cos(a) * 6);
    b.box(x - 1, x, 42, 44, z - 1, z, '#2a2140').box(x - 1, x, 44, 44, z - 1, z, '#3e3260');
    b.box(x - 1, x, 45, 46, z - 1, z, i % 2 ? '#ff5a14' : hell, 1);
  }
  const fz = b.vorne(0, 42);
  b.box(0, 1, 42, 43, fz + 1, fz + 1, '#ff3df0', 1);
  // Rauchwölkchen
  for (const [x, y, z] of [[-12, 43, -6], [11, 46, -8], [-4, 49, -10], [14, 41, -4]]) {
    b.box(x, x + 2, y, y + 1, z, z + 2, rauch).box(x + 1, x + 2, y + 2, y + 2, z, z + 1, rauchH);
  }
  return b.list();
}

/** Baronin Frostine von Bibberstein: Eiskristall-Kleid, Pelzkragen, Schneeflocken-Diadem, Eiszepter. */
function frostine(): Vox[] {
  const eis = '#7ad8f8', eisD = '#3d9bd8', eisH = '#c8f4ff', pelz = '#ffffff', pelzD = '#dfe6f2', haut = '#f6ecf6';
  const b = new Fein();
  // facettiertes Eiskleid (Achteck, nach oben schmaler) mit Frostmuster
  for (let y = 0; y <= 23; y++) {
    const r = 14 - y * 0.33;
    for (let x = -15; x <= 16; x++) for (let z = -15; z <= 16; z++) {
      const ax = Math.abs(x - 0.5), az = Math.abs(z - 0.5);
      const m = Math.max(ax, az, (ax + az) * 0.72);
      if (m > r) continue;
      const facette = (x > 0 ? 1 : 0) + (z > 0 ? 2 : 0);
      const kante = m > r - 1 && (Math.abs(ax - az) < 1 || Math.abs(ax - (ax + az) * 0.72) < 0.6);
      const funkel = rausch(x, y, z) < 0.025;
      let c = facette === 3 ? eis : facette === 2 ? eisH : facette === 1 ? eisD : eis;
      if (y < 5) c = ton(c, 0.85 + y * 0.03);
      if (kante) c = '#e8fdff';
      b.v(x, y, z, funkel ? '#ffffff' : c, funkel ? 1 : 0);
    }
  }
  // Eiszacken am Saum
  for (const [x, z] of [[-11, 6], [12, 6], [0, 14], [-10, -8], [11, -8], [1, -14], [-6, 12], [7, 12]]) {
    const sx = Math.sign(x - 0.5), sz = Math.sign(z);
    for (let k = 0; k < 6; k++) b.v(x + sx * (k >> 1), 1 + k, z + sz * (k >> 1), k > 3 ? eisH : '#3de8ff', 1);
  }
  // Mieder mit Gürtel und Juwel
  b.kugel(0.5, 26.5, 0.5, 7, 4, 6, (x, y, z, nx, ny, nz) => (y <= 24 ? '#2a3a8a' : licht(eisD, ny, nz)));
  b.vorn(0, 24, '#3de8ff', 1, 1).vorn(1, 24, '#a8f6ff', 1, 1).vorn(0, 23, '#3de8ff', 1, 1).vorn(1, 23, '#3de8ff', 1, 1);
  // Pelzkragen, flauschig
  b.kugel(0.5, 32.5, 0.5, 12, 4, 10, (x, y, z, nx, ny, nz) => {
    const zotte = (Math.round(Math.atan2(x - 0.5, z - 0.5) * 6) + (y >> 1)) & 1;
    return licht(zotte ? pelzD : pelz, ny, nz, 0.7);
  });
  // Ärmel mit Pelzstulpen, Hände
  b.sbox(10, 13, 20, 31, -2, 3, eis).sbox(13, 13, 20, 31, -2, 3, eisD).sbox(10, 13, 17, 20, -2, 3, pelz).sbox(10, 13, 17, 17, -2, 3, pelzD).sbox(10, 13, 15, 16, 0, 3, haut);
  // Eiszepter mit Schneeflocke (rechte Hand)
  b.box(14, 15, 8, 33, 4, 5, eisD).box(14, 15, 8, 9, 4, 5, '#3de8ff', 1).box(14, 15, 18, 19, 4, 5, eisH);
  const flocke = (cx: number, cy: number, z: number, r: number, c: string, c2: string) => {
    b.v(cx, cy, z, '#ffffff', 1);
    for (let k = 1; k <= r; k++) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const kk = dx && dy ? Math.round(k * 0.75) : k;
        b.v(cx + dx * kk, cy + dy * kk, z, k === r ? c2 : c, 1);
      }
      if (k === r - 1 && r >= 4) for (const [dx, dy, ex, ey] of [[0, 1, 1, 1], [0, 1, -1, 1], [0, -1, 1, -1], [0, -1, -1, -1], [1, 0, 1, 1], [1, 0, 1, -1], [-1, 0, -1, 1], [-1, 0, -1, -1]]) b.v(cx + dx * k + ex * (dx ? 0 : 1), cy + dy * k + ey * (dy ? 0 : 1), z, c2, 1);
    }
  };
  flocke(15, 37, 5, 4, '#3de8ff', '#c8f4ff');
  flocke(14, 37, 4, 3, '#3de8ff', '#a8f6ff');
  // Kopf
  b.kugel(0.5, 42.5, 1.5, 10, 9.6, 9.6, (x, y, z, nx, ny, nz) => licht(haut, ny, nz, 0.5));
  gesicht(b, { y: 44, gap: 2, aw: 4, pw: 2, iris: '#3de8ff', brow: '#1a2a5a', pupil: '#1a2a5a', browDick: 2, browHub: 3, rand: '#c8b0d8', dame: { lippen: '#c04ad8', rouge: '#f0b8d8', wimpern: '#1a2a5a' } });
  // Hochsteckfrisur (silberweiß-blau) mit Wellen
  const haar = (x: number, y: number, z: number, ny: number, nz: number) => licht(((x + y + (z >> 1)) % 4 + 4) % 4 === 0 ? '#5a8ad0' : '#8ab4ee', ny, nz);
  b.kugel(0.5, 50.5, -1.5, 9.8, 5, 9.2, (x, y, z, nx, ny, nz) => (z > 5 && y < 50 ? null : haar(x, y, z, ny, nz)));
  b.kugel(0.5, 57.5, -3.5, 5, 4, 5, (x, y, z, nx, ny, nz) => haar(x, y, z, ny, nz));
  // Locken an den Seiten
  b.sbox(9, 10, 40, 47, -2, 2, '#8ab4ee').sbox(9, 10, 40, 40, -2, 2, '#5a8ad0').sv(10, 39, 1, '#5a8ad0');
  // Schneeflocken-Diadem (leuchtend, steht vor der Frisur)
  const dz = b.vorne(0, 52) + 1;
  for (let x = -6; x <= 7; x++) {
    const y = 52 - Math.round(Math.abs(x - 0.5) * 0.35);
    b.v(x, y, dz, x % 2 ? '#e8fdff' : '#a8f6ff', 1);
  }
  flocke(0, 58, dz, 5, '#3de8ff', '#e8fdff');
  flocke(1, 58, dz, 5, '#3de8ff', '#e8fdff');
  // Ohrstecker aus Eis
  b.sbox(10, 11, 37, 38, 1, 2, '#3de8ff', 1).sv(10, 36, 1, '#a8f6ff', 1);
  return b.list();
}

/**
 * Das Große Kawumm (Finale): brodelnder Feuerball mit Wutbrauen, riesigem Maul
 * und einer Lunte als Haarschopf; Flammenzungen und schwebende Glutbrocken.
 */
function kawumm(): Vox[] {
  const b = new Fein();
  const R = 22.5, cy = 26.5;
  // Feuerball: Hülle beleuchtet (gibt Form), glühende Adern und oben lodernde Glut
  b.kugel(0.5, cy, 0.5, R, R, R, (x, y, z, nx, ny, nz) => {
    const h = ny;
    const n = rausch(x, y, z);
    const s = Math.sin(Math.atan2(x - 0.5, z - 0.5) * 3 + y * 0.22) + Math.sin(y * 0.15 - x * 0.1) * 0.6;
    if (nz > 0.55 && Math.abs(nx) < 0.75 && h > -0.85 && h < 0.75) {
      // Gesichtsfeld glatt
      return [h > 0.25 ? '#ffd23f' : h > -0.2 ? '#ffb02e' : '#ff9a1a', 1];
    }
    if (s > 1.25) return h < -0.1 ? '#a83a14' : '#c8501a';
    if (s > 1.1) return h < -0.1 ? '#c8501a' : '#e0661a';
    if (Math.abs(s) < 0.07) return [h > 0.3 ? '#fff3c4' : '#ffd23f', 1];
    if (h > 0.55) return [n < 0.3 ? '#ff9a1a' : '#ffd23f', 1];
    if (h > 0.25) return n < 0.3 ? ['#ffd23f', 1] : '#ffc02e';
    if (h > -0.15) return n < 0.25 ? '#ffd23f' : '#ff9a1a';
    if (h > -0.55) return n < 0.3 ? '#ff9a1a' : '#ff7a1a';
    return n < 0.4 ? '#ff5a14' : '#d8401a';
  });
  // große Augen (7×7) mit Pupillen nach innen, Glanzpunkt und dunklem Rand
  for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
    const rand = i === -1 || i === 7 || j === -1 || j === 7;
    const ecke = (i <= 0 || i >= 6) && (j <= 0 || j >= 6);
    if (rand) { if (!ecke || (i >= 0 && i <= 6) || (j >= 0 && j <= 6)) b.svorn(4 + i, 29 + j, '#a83a14'); continue; }
    if (ecke) { b.svorn(4 + i, 29 + j, '#a83a14'); continue; }
    const pup = i <= 2 && j >= 1 && j <= 4;
    b.svorn(4 + i, 29 + j, pup ? INK : '#ffffff', pup ? 0 : 1);
  }
  b.svorn(6, 34, '#ffffff', 1).svorn(5, 33, '#3a1a2a');
  // dicke Wutbrauen: innen tief über dem Auge, außen hoch (stehen einen Voxel vor)
  const braue = '#2b1440';
  for (let i = -1; i <= 9; i++) {
    const y = 34 + Math.round((i + 1) * 0.45);
    const dick = i < 6 ? 4 : 3;
    for (let k = 0; k < dick; k++) b.svorn(3 + i, y + k, k === dick - 1 ? '#4a2470' : braue, 0, 1);
  }
  // riesiges, grimmig gebogenes Maul mit Zähnen, Zunge und zwei knuffigen Hauern
  for (let x = 1; x <= 13; x++) {
    const top = 25 - (x > 11 ? 2 : x > 9 ? 1 : 0);
    const bot = 13 + (x > 6 ? 1 : 0) + (x > 9 ? 1 : 0) + (x > 11 ? 2 : 0);
    for (let y = bot; y <= top; y++) {
      const zunge = y <= bot + 3 && x <= 4;
      b.svorn(x, y, zunge ? (y === bot + 3 ? '#ff6a8a' : '#ff3d6a') : y > top - 3 ? '#2a0814' : '#3a0a1a', zunge ? 1 : 0);
    }
    b.svorn(x, top + 1, '#8a2a1a');
  }
  // Zahnreihe oben (Zähne mit Lücken)
  for (const x of [1, 2, 4, 5, 7, 8, 10]) b.svorn(x, 25 - (x > 9 ? 1 : 0), '#fff6d8').svorn(x, 24 - (x > 9 ? 1 : 0), x % 3 === 1 ? '#e8dcc0' : '#fff6d8');
  // Hauer unten außen
  for (let k = 0; k < 4; k++) b.svorn(11, 17 + k, k === 3 ? '#ffffff' : '#fff6d8', 0, 1).svorn(12, 17 + k, '#e8dcc0', 0, 1);
  // Bäckchen
  for (let i = 0; i < 3; i++) b.svorn(13 + i, 27, '#ff5a6a', 1).svorn(13 + i, 28, '#ff7a8a', 1);
  // Flammenzungen am oberen Rand, nach außen lodernd (vorne frei fürs Gesicht)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.2;
    if (Math.cos(a) > 0.7) continue;
    const rr = R * (0.68 + (i % 3) * 0.07);
    const h = 8 + ((i * 5) % 4) * 2;
    const base = Math.round(cy + Math.sqrt(Math.max(0, R * R - rr * rr))) - 2;
    for (let k = 0; k < h; k++) {
      const r2 = rr + k * 0.5;
      const fx = Math.round(0.5 + Math.sin(a) * r2), fz = Math.round(0.5 + Math.cos(a) * r2);
      const c = k >= h - 2 ? '#fff3c4' : k >= h - 4 ? '#ffd23f' : k >= h - 6 ? '#ff9a1a' : '#ff5a14';
      const w = k < h * 0.4 ? 1 : k < h * 0.75 ? 0.5 : 0;
      if (w >= 1) b.box(fx - 1, fx + 1, base + k, base + k, fz - 1, fz + 1, c, 1);
      else if (w > 0) b.box(fx, fx + 1, base + k, base + k, fz, fz + 1, c, 1);
      else b.v(fx, base + k, fz, c, 1);
    }
  }
  // Lunte als Haarschopf: Metallkappe, gedrehte Schnur, kringelt sich nach vorne, sprühender Funke
  for (let x = -3; x <= 4; x++) for (let z = -5; z <= 2; z++) {
    const dd = Math.hypot(x - 0.5, z + 1.5);
    if (dd > 4) continue;
    b.v(x, 49, z, dd > 2.8 ? '#5a5468' : '#7d8597').v(x, 50, z, dd > 2.8 ? '#3a3448' : '#24202e');
  }
  const pfad: [number, number][] = [];
  for (let y = 51; y <= 67; y++) pfad.push([y, -3]);
  pfad.push([68, -2], [69, -2], [70, -1], [71, 0], [72, 1], [73, 2], [73, 3], [74, 4]);
  pfad.forEach(([y, z], i) => {
    const c = (i % 4) < 2 ? '#a87848' : '#6b4b2e';
    b.box(-1, 2, y, y, z, z + 1, c).box(0, 1, y, y, z - 1, z + 2, c);
  });
  const fy = 76, fz = 5;
  b.box(-1, 2, fy - 1, fy + 2, fz - 1, fz + 2, '#fff3c4', 1).box(0, 1, fy - 2, fy + 3, fz, fz + 1, '#ffffff', 1).box(-2, 3, fy, fy + 1, fz, fz + 1, '#ffffff', 1);
  for (const [dx, dy, dz, c] of [[-5, 2, 0, '#ffd23f'], [5, 2, 0, '#ffd23f'], [0, 6, 0, '#ffd23f'], [-2, 8, 1, '#ff7a1a'], [-6, 6, 2, '#ff7a1a'], [4, 6, -2, '#ff3df0'], [6, -2, 2, '#ffd23f'], [-7, -2, 0, '#ff3df0'], [0, -4, 4, '#ffd23f'], [2, 4, 4, '#ff7a1a'], [-8, 5, 0, '#ffd23f'], [7, 8, 0, '#ff3df0']] as [number, number, number, string][]) {
    b.box(dx, dx + 1, fy + dy, fy + dy + 1, fz + dz, fz + dz, c, 1);
  }
  // schwebende Glutbrocken
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const x = Math.round(Math.sin(a) * 32), z = Math.round(Math.cos(a) * 30), y = 12 + ((i * 7) % 4) * 6;
    b.box(x, x + 2, y, y + 2, z, z + 2, '#3a2a2a').box(x, x + 2, y + 2, y + 2, z, z + 2, '#5a403a');
    b.box(x, x + 1, y + 2, y + 2, z + 1, z + 2, '#ff7a1a', 1).v(x + 2, y + 1, z + 2, '#ffd23f', 1).v(x + 2, y, z + 2, '#ff5a14', 1);
  }
  return b.list();
}

/** HD-Modelle der Bosse: halbe Voxelgröße, doppelte Auflösung */
export const HD_BOSSE: Record<string, HdModell> = {
  baronin_gackerella: { vox: gackerella, size: 0.05 },
  baron_blitzbirne: { vox: blitzbirne, size: 0.05 },
  baronin_schraubella: { vox: schraubella, size: 0.05 },
  baronin_sporella: { vox: sporella, size: 0.05 },
  baron_glutbauch: { vox: glutbauch, size: 0.05 },
  baronin_frostine: { vox: frostine, size: 0.05 },
  kawumm: { vox: kawumm, size: 0.055 }
};
