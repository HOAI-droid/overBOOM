import * as THREE from 'three';

/**
 * Voxel-Explosionen: ein glühender Ball aus Voxeln (weiß → gelb → orange → rot), der sich aufbläht,
 * abkühlt, ab etwa einem Viertel der Zeit von außen nach innen zerfällt; einzelne Randstücke und
 * Glutwürfel fliegen weg, danach verzieht sich etwas Rauch (erst langsam, dann schneller).
 *
 * Alles läuft über zwei InstancedMeshes (leuchtend + Rauch), die jedes Bild neu gefüllt werden.
 * Die Bewegung ist eine feste Funktion der Zeit – keine Allokationen pro Bild.
 */

/** Kantenlänge eines Explosions-Voxels in Metern (bei allen Größen gleich) */
const V = 0.15;
/** Radius des Feuerballs bei Größe 1 */
const RBALL = 1.1;
/** Größenstufen der vorberechneten Formen */
const STUFEN = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.4];
/** Formvarianten (Beulen/Dellen) je Größenstufe */
const VARIANTEN = 4;
/** Obergrenze gleichzeitig sichtbarer Explosions-Voxel */
const MAX_VOXEL = 16000;
const MAX_RAUCH = 700;
const MAX_EXPLOSIONEN = 64;

/** Farbverlauf der Hitze: weiß → hellgelb → gelb → orange → rot → dunkelrot */
const HITZE: [number, number][] = [[1.0, 0xffffff], [0.82, 0xfff3b0], [0.66, 0xffd23f], [0.48, 0xff9a1a], [0.32, 0xff5a14], [0.18, 0xd42a10], [0.0, 0x5a1a1a]];
const RAUCH = [0x7a6a86, 0x5e5470, 0x8d7f96];
const RAUCH_RGB = new Float32Array(RAUCH.flatMap((h) => new THREE.Color(h).toArray()));

/** Hitze 0–1 → Farbe (in 64 Stufen vorberechnet, in Dreierschritten zwischen den Stützfarben) */
const LUT = new Float32Array(65 * 3);
{
  const a = new THREE.Color(), b = new THREE.Color(), c = new THREE.Color();
  for (let i = 0; i <= 64; i++) {
    const h = i / 64;
    c.setHex(HITZE[HITZE.length - 1][1]);
    for (let k = 0; k < HITZE.length - 1; k++) {
      const [h0, c0] = HITZE[k], [h1, c1] = HITZE[k + 1];
      if (h <= h0 && h >= h1) { const f = (h0 - h) / (h0 - h1); c.copy(a.setHex(c0)).lerp(b.setHex(c1), Math.round(f * 3) / 3); break; }
    }
    LUT[i * 3] = c.r; LUT[i * 3 + 1] = c.g; LUT[i * 3 + 2] = c.b;
  }
}

/** Felder je Zelle: x, y, z, d (0 Mitte – 1 Rand), n, m (Zufall), Richtung dx/dy/dz, Abflug t0, Tempo v, los (0/1) */
const F = 12;

/** vorberechnete Ballform: Zellen mit Beulen/Dellen */
interface Form { zellen: Float32Array; anzahl: number }

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baueForm(S: number, variante: number): Form {
  const rnd = mulberry(1000 + variante * 97 + Math.round(S * 100));
  const R = RBALL * S, WS = Math.sqrt(S);
  const beulen: number[][] = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, b = Math.acos(rnd() * 1.6 - 0.6);
    beulen.push([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a), i < 4 ? 0.3 + rnd() * 0.35 : -(0.15 + rnd() * 0.15)]);
  }
  const G = Math.ceil(R / V * 1.7);
  const tmp: number[] = [];
  for (let x = -G; x <= G; x++) for (let y = -G; y <= G; y++) for (let q = -G; q <= G; q++) {
    const l = Math.hypot(x, y, q) || 1;
    let f = 1;
    for (const b of beulen) f += b[3] * Math.max(0, (x * b[0] + y * b[1] + q * b[2]) / l) ** 4;
    const d = l * V / R / f;
    if (d > 1.05) continue;
    const n = rnd(), m = rnd();
    // einzelne Randstücke lösen sich schon früh
    const los = d > 0.7 && m > 1 - 0.018 / S ? 1 : 0;
    tmp.push(x * V, y * V, q * V, d, n, m, x / l, y / l, q / l, 0.05 + n * 0.1, (2.2 + n * 2.5) * WS, los);
  }
  return { zellen: new Float32Array(tmp), anzahl: tmp.length / F };
}

interface Glut { vx: number; vy: number; vz: number; l: number; g: number; sx: number; sy: number }
interface Wolke { x: number; z: number; y: number; t0: number; g: number; f: number }

interface Explosion {
  x: number; z: number;
  /** Größe (0,5–1,4) und Zeitfaktor */
  S: number; T: number;
  /** Alter in Sekunden */
  t: number;
  form: Form;
  /** Drehung der Form um die Hochachse */
  cos: number; sin: number;
  glut: Glut[]; nGlut: number;
  wolken: Wolke[]; nWolken: number;
  aktiv: boolean;
}

export class VoxelExplosions {
  readonly glow: THREE.InstancedMesh;
  readonly rauch: THREE.InstancedMesh;
  private formen = new Map<number, Form>();
  private liste: Explosion[] = [];
  /** grob geschätzte Voxel aller laufenden Explosionen (für die Begrenzung) */
  private last = 0;
  /** 0,25–1: weniger Glut und Rauch, kleinere Obergrenze */
  density = 1;

  constructor() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.glow = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_VOXEL);
    this.rauch = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), MAX_RAUCH);
    for (const m of [this.glow, this.rauch]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
    }
    for (let i = 0; i < MAX_EXPLOSIONEN; i++) {
      const glut: Glut[] = [], wolken: Wolke[] = [];
      for (let k = 0; k < 24; k++) glut.push({ vx: 0, vy: 0, vz: 0, l: 1, g: 0, sx: 0, sy: 0 });
      for (let k = 0; k < 36; k++) wolken.push({ x: 0, z: 0, y: 0, t0: 0, g: 0, f: 0 });
      this.liste.push({ x: 0, z: 0, S: 1, T: 1, t: 0, form: { zellen: new Float32Array(0), anzahl: 0 }, cos: 1, sin: 0, glut, nGlut: 0, wolken, nWolken: 0, aktiv: false });
    }
  }

  private form(stufe: number, variante: number): Form {
    const key = stufe * 16 + variante;
    let f = this.formen.get(key);
    if (!f) { f = baueForm(STUFEN[stufe], variante); this.formen.set(key, f); }
    return f;
  }

  private vorrat = 0;

  /** Formen nach und nach vorab berechnen (eine pro Bild), damit keine Explosion ruckelt */
  private vorbereiten(): void {
    if (this.vorrat >= STUFEN.length * VARIANTEN) return;
    this.form(Math.floor(this.vorrat / VARIANTEN), this.vorrat % VARIANTEN);
    this.vorrat++;
  }

  /**
   * Neue Explosion. `S` ist die Größe (0,6 klein, 0,8 mittel, 1,15 groß), `ohneRest` lässt
   * Glut und Rauch weg (z. B. schwache Druckwellen), `menge` dünnt Glut/Rauch aus (viele gleichzeitig).
   */
  spawn(x: number, z: number, S: number, rnd: () => number, menge = 1, ohneRest = false): void {
    let e: Explosion | undefined;
    for (const k of this.liste) if (!k.aktiv) { e = k; break; }
    if (!e) return;
    // Begrenzung: passt die Explosion nicht mehr, wird sie kleiner
    const budget = MAX_VOXEL * Math.max(0.4, this.density) * 0.7;
    let stufe = 0;
    while (stufe < STUFEN.length - 1 && STUFEN[stufe + 1] <= S + 0.001) stufe++;
    const variante = Math.floor(rnd() * VARIANTEN);
    while (stufe > 0 && this.last + this.form(stufe, variante).anzahl * 0.6 > budget) stufe--;
    const form = this.form(stufe, variante);
    S = STUFEN[stufe];
    e.aktiv = true; e.x = x; e.z = z; e.S = S; e.T = S; e.t = 0; e.form = form;
    const a = rnd() * Math.PI * 2;
    e.cos = Math.cos(a); e.sin = Math.sin(a);
    this.last += form.anzahl * 0.6;
    const WS = Math.sqrt(S), q = Math.max(0.25, this.density) * menge;
    // wegfliegende Glutwürfel: klein 4, mittel 8, groß 13
    e.nGlut = ohneRest ? 0 : Math.min(e.glut.length, Math.max(1, Math.round((4 + (S - 0.6) * 16.5) * q)));
    for (let i = 0; i < e.nGlut; i++) {
      const g = e.glut[i], w = rnd() * Math.PI * 2, up = 0.35 + rnd() * 0.9, sp = (3.2 + rnd() * 2.8) * WS;
      g.vx = Math.cos(w) * sp; g.vy = up * sp * 1.2; g.vz = Math.sin(w) * sp;
      g.l = 0.55 + rnd() * 0.4; g.g = 0.2 + rnd() * 0.1; g.sx = rnd() * 9; g.sy = rnd() * 9;
    }
    // Rauch: klein 6, mittel 12, groß 20
    e.nWolken = ohneRest ? 0 : Math.min(e.wolken.length, Math.max(1, Math.round((6 + (S - 0.6) * 25.5) * q)));
    for (let i = 0; i < e.nWolken; i++) {
      const c = e.wolken[i], w = rnd() * Math.PI * 2, r0 = (0.5 + rnd() * 0.7) * S;
      c.x = Math.cos(w) * r0; c.z = Math.sin(w) * r0; c.y = (1.1 + rnd() * 0.9) * S;
      c.t0 = 0.14 + rnd() * 0.1; c.g = (0.24 + rnd() * 0.2) * WS; c.f = i % RAUCH.length;
    }
  }

  /** Zahl der Brocken passend zur Größe: klein 2, mittel 4, groß 6 */
  static brocken(S: number): number {
    return Math.max(1, Math.round(2 + (S - 0.6) * 7.3));
  }

  update(dt: number): void {
    this.vorbereiten();
    const gm = this.glow.instanceMatrix.array as Float32Array, gc = this.glow.instanceColor!.array as Float32Array;
    const rm = this.rauch.instanceMatrix.array as Float32Array, rc = this.rauch.instanceColor!.array as Float32Array;
    let n = 0, nr = 0, last = 0;
    for (const e of this.liste) {
      if (!e.aktiv) continue;
      e.t += dt;
      const t = e.t / e.T, S = e.S;
      if (t > 1.05) { e.aktiv = false; continue; }
      const Y0 = 0.9 * S, cs = e.cos, sn = e.sin;
      // Feuerball
      const R = RBALL * S * (1 - Math.exp(-t * 16)), hub = t * t * 1.2 * S;
      const z = e.form.zellen, cnt = e.form.anzahl;
      if (t < 1) last += cnt * (t < 0.45 ? 0.6 : 0.1);
      for (let i = 0, o = 0; i < cnt && n < MAX_VOXEL; i++, o += F) {
        const d = z[o + 3];
        if (d * RBALL * S > R + 0.01) continue;
        const cn = z[o + 4], cm = z[o + 5], los = z[o + 11] > 0;
        // ab etwa einem Viertel zieht sich der Kern zurück: außen zuerst
        const tr = 0.22 + (1 - d) * 0.2;
        const fliegt = (los && t > z[o + 9]) || (t > tr && cm > 1 - 0.025 / S && d > 0.45);
        if (!los && t > tr && !fliegt) continue;
        // in der Form gedreht
        const lx = z[o], ly = z[o + 1], lz = z[o + 2];
        const fx = lx * cs - lz * sn, fz = lx * sn + lz * cs;
        let px: number, py: number, pz: number, g: number, h: number, rx = 0, ry = 0;
        if (fliegt) {
          const st = los ? z[o + 9] : tr, tt = t - st, a = tt / 0.55;
          if (a >= 1) continue;
          const sp = 0.75 + st * 0.6, v = z[o + 10];
          const dx = z[o + 6] * cs - z[o + 8] * sn, dz = z[o + 6] * sn + z[o + 8] * cs;
          px = fx * sp + dx * v * tt;
          py = Math.max(0.05, Y0 + ly * 0.85 + st * st * 1.2 * S + (z[o + 7] + 0.6) * v * tt - 7 * tt * tt);
          pz = fz * sp + dz * v * tt;
          g = V * (1.3 - a * 0.8);
          h = Math.min(0.6, 1.4 - st * 1.5 - d + (cn - 0.5) * 0.35) - a * 0.5;
          rx = tt * 11; ry = tt * 7;
        } else {
          if (d > 0.85 && cn > 0.6) continue;
          h = 1.4 - t * 1.5 - d + (cn - 0.5) * 0.35;
          if (h < 0.02) continue;
          g = V * (h > 0.3 ? 1 : 0.6 + h * 1.3);
          const sp = 0.75 + t * 0.6;
          px = fx * sp; py = Y0 + ly * 0.85 + hub * (1 - d * 0.5); pz = fz * sp;
        }
        schreibe(gm, n, e.x + px, py, e.z + pz, g, rx, ry);
        farbe(gc, n, h);
        n++;
      }
      // Glut
      for (let i = 0; i < e.nGlut && n < MAX_VOXEL; i++) {
        const f = e.glut[i], tt = t - 0.03, a = tt / f.l;
        if (tt <= 0 || a >= 1) continue;
        const y = Math.max(0.1, Y0 + f.vy * tt - 9 * tt * tt);
        schreibe(gm, n, e.x + f.vx * tt * 0.9, y, e.z + f.vz * tt * 0.9, f.g * (1 - a * 0.7), f.sx + tt * 12, f.sy + tt * 9);
        farbe(gc, n, 0.62 - a * 0.55);
        n++;
      }
      // Rauch: bis zum Ende verzogen, erst langsam, dann schneller
      for (let i = 0; i < e.nWolken && nr < MAX_RAUCH; i++) {
        const c = e.wolken[i], a = (t - c.t0) / (1 - c.t0);
        if (a <= 0 || a >= 1) continue;
        const w = 1 + a * a * 1.6;
        schreibe(rm, nr, e.x + c.x * w, c.y + (a * 0.35 + a * a * 1.6) * S, e.z + c.z * w, c.g * Math.min(1, a * 9) * (1 - a ** 2.5), a * 2, a);
        const k = c.f * 3;
        rc[nr * 3] = RAUCH_RGB[k]; rc[nr * 3 + 1] = RAUCH_RGB[k + 1]; rc[nr * 3 + 2] = RAUCH_RGB[k + 2];
        nr++;
      }
    }
    this.last = last;
    this.glow.count = n;
    this.rauch.count = nr;
    this.glow.instanceMatrix.needsUpdate = true;
    this.glow.instanceColor!.needsUpdate = true;
    this.rauch.instanceMatrix.needsUpdate = true;
    this.rauch.instanceColor!.needsUpdate = true;
  }

  clear(): void {
    for (const e of this.liste) e.aktiv = false;
    this.glow.count = this.rauch.count = 0;
    this.last = 0;
  }
}

/** Würfel mit Kantenlänge g, gedreht um x (rx) und y (ry), direkt in die Instanz-Matrix schreiben */
function schreibe(m: Float32Array, i: number, x: number, y: number, z: number, g: number, rx: number, ry: number): void {
  const o = i * 16;
  if (rx === 0 && ry === 0) {
    m[o] = g; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = g; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = g; m[o + 11] = 0;
  } else {
    // R = Rx · Ry (wie Euler-Reihenfolge XYZ ohne z)
    const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry);
    m[o] = c * g; m[o + 1] = b * d * g; m[o + 2] = -a * d * g; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = a * g; m[o + 6] = b * g; m[o + 7] = 0;
    m[o + 8] = d * g; m[o + 9] = -b * c * g; m[o + 10] = a * c * g; m[o + 11] = 0;
  }
  m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
}

function farbe(c: Float32Array, i: number, h: number): void {
  const k = Math.max(0, Math.min(64, Math.round(h * 64))) * 3;
  c[i * 3] = LUT[k]; c[i * 3 + 1] = LUT[k + 1]; c[i * 3 + 2] = LUT[k + 2];
}
