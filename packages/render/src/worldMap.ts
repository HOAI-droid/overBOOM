import * as THREE from 'three';
import { hash2 } from '@overboom/core';
import { INSELN, type Insel } from '@overboom/data';
import { buildVoxels, solidMaterial, glowMaterial, VoxBuilder, type Vox } from './voxel.ts';

/** Zustand der Weltkarte, den die UI vorgibt */
export interface MapState {
  inseln: { id: string; frei: boolean; befreit: boolean; erobert: boolean }[];
  auswahl: string;
}

const V = 0.32; // Weltgröße eines Voxels auf der Karte

/** Lage der Inseln auf der Karte (Weltkoordinaten) – Bummburg in der Mitte */
const LAGE: Record<string, { x: number; z: number; r: number }> = {
  gackerfeld: { x: -11, z: 7, r: 11 },
  funkenschlund: { x: -12, z: -4, r: 10 },
  rostgrat: { x: -3, z: -11, r: 10 },
  pilzmoor: { x: 9, z: -9, r: 10 },
  lavakessel: { x: 12, z: 2, r: 10 },
  frostfass: { x: 4, z: 11, r: 10 },
  bummburg: { x: 0, z: 0, r: 13 }
};

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** gesperrte Inseln: entsättigt und dunkler */
function grau(hex: string): string {
  const p = parseInt(hex.slice(1), 16);
  const l = Math.round((((p >> 16) & 255) * 0.3 + ((p >> 8) & 255) * 0.59 + (p & 255) * 0.11) * 0.6 + 30);
  return mix(hex, '#' + ((l << 16) | (l << 8) | l).toString(16).padStart(6, '0'), 0.8);
}

const pick = (list: string[], a: number, b: number, s: number) => list[Math.floor(hash2(a, b, s) * list.length) % list.length];

/** Eine schwebende Insel aus Voxeln: Oberfläche, Erdschicht, Felszapfen nach unten, Deko nach Gefahr */
function inselVoxel(insel: Insel, r: number, gesperrt: boolean): Vox[] {
  const f = insel.farben;
  const c = (hex: string) => (gesperrt ? grau(hex) : hex);
  const b = new VoxBuilder();
  const seed = insel.id.length * 17 + insel.id.charCodeAt(0);
  const R = r + 1;
  for (let x = -R; x <= R; x++) {
    for (let z = -R; z <= R; z++) {
      const ang = Math.atan2(z, x);
      const rr = r * (0.82 + 0.18 * Math.sin(ang * 3 + seed) * 0.6 + hash2(Math.round(ang * 4), seed, 2) * 0.12);
      const d = Math.hypot(x, z);
      if (d > rr) continue;
      const k = 1 - d / rr;
      const depth = Math.round(1 + Math.pow(k, 0.8) * r * 0.9 + hash2(x, z, seed) * 2.5);
      const top = hash2(x >> 1, z >> 1, seed + 1) > 0.78 ? pick(f.fleck, x, z, seed) : pick(f.boden, x, z, seed);
      b.v(x, 0, z, c(top));
      for (let y = 1; y <= depth; y++) {
        const col = y <= 2 ? pick(f.wand, x, y + z, seed) : pick(f.klippe, x + y, z, seed);
        b.v(x, -y, z, c(col));
      }
    }
  }
  deko(b, insel, r, c, gesperrt);
  return b.list();
}

function deko(b: VoxBuilder, insel: Insel, r: number, c: (h: string) => string, gesperrt: boolean): void {
  const g = gesperrt ? 0 : 1;
  const sp = insel.farben.spezial;
  switch (insel.gefahr) {
    case 'heu': {
      // Scheune mit Dach + Heuballen
      b.box(-3, 1, 1, 4, -5, -2, c('#b0302a')).box(-3, 1, 5, 5, -5, -2, c('#6b2a1e')).box(-2, 0, 6, 6, -5, -2, c('#6b2a1e'));
      b.box(-2, -1, 1, 2, -1, -1, c('#3a1a12'));
      for (const [x, z] of [[4, 2], [5, -2], [-6, 3], [2, 5]]) b.box(x, x + 1, 1, 2, z, z + 1, c(sp[0]));
      // Hühner
      for (const [x, z] of [[0, 3], [-4, 6], [6, 4]]) { b.v(x, 1, z, c('#f4ecff')).v(x, 2, z, c('#f4ecff')).v(x, 3, z, c('#ff3d3d')); }
      break;
    }
    case 'strom': {
      for (const [x, z] of [[-4, -2], [4, 3], [0, -6]]) {
        b.box(x, x, 1, 6, z, z, c('#5a6078'));
        b.box(x - 1, x + 1, 7, 7, z - 1, z + 1, c('#8890a8'));
        b.v(x, 8, z, c(sp[0]), g);
      }
      for (let i = -5; i <= 5; i++) b.v(i, 0, Math.round(Math.sin(i) * 2), c(sp[1] ?? sp[0]), g);
      break;
    }
    case 'schrott': {
      // Fabrik mit Schornstein, Schrotthaufen
      b.box(-5, -1, 1, 4, -4, 0, c('#6a5a50')).box(-4, -4, 5, 9, -3, -3, c('#4a3a32'));
      b.v(-4, 10, -3, c('#ff7a1a'), g);
      for (let i = 0; i < 14; i++) {
        const x = 1 + Math.floor(hash2(i, 1, 4) * 6), z = -2 + Math.floor(hash2(i, 2, 4) * 7);
        const h = 1 + Math.floor(hash2(i, 3, 4) * 3);
        b.box(x, x, 1, h, z, z, c(pick(['#8a6a4a', '#9a9aa8', '#6a5a50', '#b05a2a'], i, 0, 5)));
      }
      break;
    }
    case 'gift': {
      for (const [x, z, h, col] of [[-3, -2, 5, '#b03ad8'], [3, 2, 4, '#d84a3a'], [1, -5, 3, '#b03ad8']] as [number, number, number, string][]) {
        b.box(x, x, 1, h, z, z, c('#f0e8d8'));
        b.box(x - 2, x + 2, h + 1, h + 1, z - 2, z + 2, c(col)).box(x - 1, x + 1, h + 2, h + 2, z - 1, z + 1, c(col));
        b.v(x - 1, h + 2, z, c('#f4ecff')).v(x + 1, h + 1, z + 2, c('#f4ecff'));
      }
      for (const [x, z] of [[-5, 4], [5, -3], [0, 5]]) b.box(x, x + 1, 0, 0, z, z + 1, c('#7dff5a'), g);
      break;
    }
    case 'lava': {
      // Vulkan
      for (let y = 1; y <= 7; y++) {
        const rad = 6 - y * 0.7;
        for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
          const d = Math.hypot(x, z + 1);
          if (d <= rad && (d > rad - 1.6 || y === 1)) b.v(x, y, z - 1, c(pick(insel.farben.klippe, x, y + z, 3)));
          else if (y === 7 && d <= rad) b.v(x, y, z - 1, c('#ff7a1a'), g);
        }
      }
      for (let i = 0; i < 8; i++) b.v(3 + i % 3, 0, 2 + i, c(i % 2 ? '#ff5a0a' : '#ffb02e'), g);
      break;
    }
    case 'eis': {
      for (const [x, z, h] of [[-4, -1, 6], [3, -4, 4], [4, 3, 5], [-1, 5, 3]]) {
        for (let y = 1; y <= h; y++) b.v(x, y, z, c(y > h - 2 ? '#e8fcff' : '#a8f6ff'), g && y > h - 2 ? 1 : 0);
        b.v(x + 1, 1, z, c('#c8f4ff')).v(x, 1, z + 1, c('#c8f4ff'));
      }
      // Schneemann
      b.box(0, 1, 1, 2, -1, 0, c('#f4ecff')).v(0, 3, -1, c('#f4ecff')).v(1, 3, -1, c('#ff7a1a'));
      break;
    }
    case 'festung': {
      // Burgmauern mit Ecktürmen und Bergfried
      const w = Math.min(7, r - 3);
      for (let i = -w; i <= w; i++) for (let y = 1; y <= 3; y++) {
        b.v(i, y, -w, c(pick(insel.farben.wand, i, y, 7))).v(i, y, w, c(pick(insel.farben.wand, i, y, 8)));
        b.v(-w, y, i, c(pick(insel.farben.wand, i, y, 9))).v(w, y, i, c(pick(insel.farben.wand, i, y, 10)));
      }
      for (const [x, z] of [[-w, -w], [w, -w], [-w, w], [w, w]]) b.box(x - 1, x + 1, 1, 5, z - 1, z + 1, c(insel.farben.wand[0]));
      b.box(-2, 2, 1, 8, -2, 2, c(insel.farben.wand[1] ?? insel.farben.wand[0])).box(-1, 1, 9, 9, -1, 1, c('#2a1a30'));
      b.box(0, 0, 10, 13, 0, 0, c('#3a2a20')).box(1, 3, 12, 13, 0, 0, c('#ff7a1a'));
      b.v(0, 5, -3, c('#ffd23f'), g).v(-1, 6, -3, c('#ffd23f'), g).v(1, 6, -3, c('#ffd23f'), g);
      break;
    }
  }
}

function flagge(): Vox[] {
  const b = new VoxBuilder();
  b.box(0, 0, 0, 7, 0, 0, '#5a4030').box(1, 4, 5, 7, 0, 0, '#ff7a1a').v(2, 6, 0, '#ffd23f').v(3, 6, 0, '#ffd23f');
  return b.list();
}

function krone(): Vox[] {
  const b = new VoxBuilder();
  b.box(0, 4, 0, 1, 0, 4, '#ffd23f', 1).del(1, 1, 1).del(2, 1, 2).del(3, 1, 3);
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4], [2, 0], [2, 4], [0, 2], [4, 2]]) b.v(x, 2, z, '#ffd23f', 1);
  b.v(2, 1, 0, '#ff3df0', 1).v(2, 1, 4, '#3de8ff', 1);
  return b.list();
}

function schloss(): Vox[] {
  const b = new VoxBuilder();
  b.box(0, 4, 0, 3, 0, 1, '#8a80a8').box(1, 1, 4, 6, 0, 1, '#b0a8c8').box(3, 3, 4, 6, 0, 1, '#b0a8c8').box(2, 2, 7, 7, 0, 1, '#b0a8c8');
  b.v(2, 2, 0, '#2a1f45').v(2, 1, 0, '#2a1f45');
  return b.list();
}

function wolke(seed: number): Vox[] {
  const b = new VoxBuilder();
  const n = 3 + Math.floor(hash2(seed, 1, 3) * 3);
  for (let i = 0; i < n; i++) {
    const cx = i * 3 - n, cz = Math.round((hash2(seed, i, 4) - 0.5) * 4), rr = 2 + Math.floor(hash2(seed, i, 5) * 2);
    for (let x = -rr; x <= rr; x++) for (let z = -rr; z <= rr; z++) for (let y = 0; y <= 1; y++) {
      if (Math.hypot(x, z) <= rr - y * 0.8) b.v(cx + x, y, cz + z, y ? '#f4ecff' : '#c9bfe8');
    }
  }
  return b.list();
}

function mesh(vox: Vox[], size: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const { solid, glow } = buildVoxels(vox, size, { jitter: 0.06, seed });
  if (solid) g.add(new THREE.Mesh(solid, solidMaterial));
  if (glow) g.add(new THREE.Mesh(glow, glowMaterial));
  return g;
}

function dispose(o: THREE.Object3D): void {
  o.traverse((m) => { if (m instanceof THREE.Mesh && m.geometry) m.geometry.dispose(); });
}

interface InselObj { root: THREE.Group; key: string; flag: THREE.Group; crown: THREE.Group; lock: THREE.Group; ring: THREE.Mesh; seed: number }

const ELEV = THREE.MathUtils.degToRad(38), AZ = Math.PI / 4;
/** Bildschirm-Rechts und -Oben der isometrischen Kamera in Weltkoordinaten */
const RIGHT = new THREE.Vector3(Math.cos(AZ), 0, -Math.sin(AZ));
const UP = new THREE.Vector3(-Math.sin(AZ) * Math.sin(ELEV), Math.cos(ELEV), -Math.cos(AZ) * Math.sin(ELEV));

/** Weltkarte Krawummia: schwebende Voxel-Inseln über einem Wolkenmeer. */
export class WorldMapView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera();
  private inseln = new Map<string, InselObj>();
  private wege: THREE.Group[] = [];
  private wegKey = '';
  private wolken: { g: THREE.Group; speed: number }[] = [];
  private target = new THREE.Vector3();
  private dir = new THREE.Vector3(Math.sin(AZ) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(AZ) * Math.cos(ELEV));
  private tmp = new THREE.Vector3();
  readonly viewShort = 32;
  /** Verschiebung, damit die Karte neben dem Infofeld liegt (Weltkoordinaten, Bildschirmachsen) */
  private shiftR = 0;
  private shiftU = 0;
  /** wie stark die Kamera der gewählten Insel folgt */
  private follow = 0.3;

  constructor() {
    this.scene.add(new THREE.HemisphereLight('#c8bcff', '#3a2050', 2.4));
    const sun = new THREE.DirectionalLight('#ffe6c8', 2.6);
    sun.position.set(-8, 14, -4);
    this.scene.add(sun);
    for (let i = 0; i < 12; i++) {
      const g = mesh(wolke(i * 7 + 3), 0.4, i);
      g.position.set((hash2(i, 0, 11) - 0.5) * 50, -7 - hash2(i, 1, 11) * 5, (hash2(i, 2, 11) - 0.5) * 50);
      this.scene.add(g);
      this.wolken.push({ g, speed: 0.3 + hash2(i, 3, 11) * 0.4 });
    }
  }

  /** Inseln bei geänderter Freischaltung neu bauen */
  private sync(state: MapState): void {
    for (const s of state.inseln) {
      const insel = INSELN.find((i) => i.id === s.id);
      const lage = LAGE[s.id];
      if (!insel || !lage) continue;
      const key = s.frei ? 'frei' : 'zu';
      let o = this.inseln.get(s.id);
      if (!o || o.key !== key) {
        if (o) { this.scene.remove(o.root); dispose(o.root); }
        const root = new THREE.Group();
        root.add(mesh(inselVoxel(insel, lage.r, !s.frei), V, lage.r));
        const flag = mesh(flagge(), V, 1); flag.position.set(lage.r * V * 0.5, V, -lage.r * V * 0.3); root.add(flag);
        const crown = mesh(krone(), V * 0.8, 2); crown.position.set(-0.5, lage.r * V * 0.9 + 2.2, -0.5); root.add(crown);
        const lock = mesh(schloss(), V * 1.2, 3); lock.position.set(-0.6, 2.4, 0); root.add(lock);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(lage.r * V * 1.05, lage.r * V * 1.2, 32, 1),
          new THREE.MeshBasicMaterial({ color: insel.farben.spezial[0], transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
        root.add(ring);
        root.position.set(lage.x, 0, lage.z);
        this.scene.add(root);
        o = { root, key, flag, crown, lock, ring, seed: lage.r + insel.id.length };
        this.inseln.set(s.id, o);
      }
      o.flag.visible = s.befreit;
      o.crown.visible = s.erobert;
      o.lock.visible = !s.frei;
    }
    // Wege zwischen aufeinanderfolgenden Inseln (leuchten, wenn freigeschaltet)
    const wk = state.inseln.map((s) => (s.frei ? 1 : 0)).join('');
    if (wk !== this.wegKey) {
      this.wegKey = wk;
      for (const w of this.wege) { this.scene.remove(w); dispose(w); }
      this.wege = [];
      for (let i = 0; i + 1 < INSELN.length; i++) {
        const a = LAGE[INSELN[i].id], b = LAGE[INSELN[i + 1].id];
        const frei = state.inseln.find((s) => s.id === INSELN[i + 1].id)?.frei ?? false;
        const vb = new VoxBuilder();
        const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.floor(len / 0.9);
        for (let k = 2; k < n - 2; k++) {
          const t = k / n;
          const x = Math.round(((a.x + (b.x - a.x) * t) / 0.3)), z = Math.round(((a.z + (b.z - a.z) * t) / 0.3));
          vb.v(x, Math.round(Math.sin(t * Math.PI) * 4), z, frei ? '#ffd23f' : '#4a3a6a', frei ? 1 : 0);
        }
        const g = mesh(vb.list(), 0.3, i);
        g.position.y = 0.4;
        this.scene.add(g);
        this.wege.push(g);
      }
    }
  }

  /** Kamera-Frustum an die interne Auflösung anpassen */
  resize(iw: number, ih: number): void {
    // Hochformat: Karte muss in die Breite passen
    const wpp = (iw >= ih ? this.viewShort : this.viewShort * 0.95) / Math.min(iw, ih);
    const hw = (iw / 2) * wpp, hh = (ih / 2) * wpp;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh, near: 0.1, far: 300 });
    // Querformat: Infofeld rechts → Karte nach links; Hochformat: Infofeld unten → Karte nach oben
    if (iw >= ih) { this.shiftR = hw * 0.26; this.shiftU = 0; this.follow = 0.3; } else { this.shiftR = 0; this.shiftU = -hh * 0.2; this.follow = 0.8; }
    this.camera.updateProjectionMatrix();
  }

  update(state: MapState, dt: number, time: number): void {
    this.sync(state);
    for (const [id, o] of this.inseln) {
      const sel = id === state.auswahl;
      const lage = LAGE[id];
      o.root.position.y = Math.sin(time * 0.8 + o.seed) * 0.25 + (sel ? 0.6 : 0);
      o.ring.visible = sel;
      (o.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 5) * 0.3;
      o.crown.rotation.y = time * 1.2;
      o.lock.rotation.y = Math.sin(time * 1.5) * 0.4;
      o.flag.rotation.y = Math.sin(time * 2 + o.seed) * 0.15;
      if (sel) this.tmp.set(lage.x * this.follow, 0, lage.z * this.follow);
    }
    if (!this.inseln.has(state.auswahl)) this.tmp.set(0, 0, 0);
    const k = 1 - Math.pow(0.03, dt);
    this.target.lerp(this.tmp, k);
    for (const w of this.wolken) {
      w.g.position.x += w.speed * dt;
      if (w.g.position.x > 28) w.g.position.x -= 56;
    }
    this.tmp.copy(this.target).addScaledVector(RIGHT, this.shiftR).addScaledVector(UP, this.shiftU);
    this.camera.position.copy(this.tmp).addScaledVector(this.dir, 60);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.tmp);
    this.camera.updateMatrixWorld();
  }

  /** Bildschirm-Anker einer Insel (normierte Gerätekoordinaten -1…1) */
  anchor(id: string, out: { x: number; y: number }): boolean {
    const o = this.inseln.get(id), lage = LAGE[id];
    if (!o || !lage) return false;
    this.tmp.set(o.root.position.x, o.root.position.y - lage.r * V * 0.95, o.root.position.z).project(this.camera);
    out.x = this.tmp.x; out.y = this.tmp.y;
    return true;
  }
}
