import * as THREE from 'three';
import { hash2 } from '@overboom/core';
import { haloTexture } from './arenaView.ts';

/** Größe der Explosionsgrafik relativ zum Wirkungsradius */
const EXPLOSION_GRAFIK = 0.8;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
  gravity: number;
  drag: number;
  spin: number;
}

export interface PoolOptions {
  /** wächst schnell auf, schrumpft dann (Feuerbälle, Rauch) statt nur zu schrumpfen */
  puff?: boolean;
  /** prallt vom Boden ab */
  floor?: boolean;
}

/** Einstellungen (Barrierefreiheit/Qualität): Partikeldichte 0,25–1, Blitz-Intensität 0–1 */
export const FX = { dichte: 1, blitze: 1, farbenblind: false };

/** Partikel-Pool mit Instancing und Farbe pro Partikel – keine Allokationen pro Frame. */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private free: number[] = [];
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private live = 0;
  private dirty = false;

  constructor(readonly capacity: number, material: THREE.Material, private opt: PoolOptions = {}) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) {
      this.parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, gravity: 0, drag: 0, spin: 0 });
      this.free.push(i);
      this.mesh.setColorAt(i, this.color.set(0xffffff));
      this.hide(i);
    }
  }

  get freeCount(): number { return this.free.length; }

  private hide(i: number) {
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.setScalar(0.0001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private skip = 0;

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, gravity = -9, color: THREE.ColorRepresentation = 0xffffff, drag = 0): void {
    // weniger Partikel bei geringer Dichte (gleichmäßig ausgedünnt)
    if (FX.dichte < 1) { this.skip += 1 - FX.dichte; if (this.skip >= 1) { this.skip -= 1; return; } }
    const i = this.free.pop();
    if (i === undefined) return;
    const p = this.parts[i];
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.size = size; p.gravity = gravity; p.drag = drag;
    p.spin = (x * 13.7 + z * 7.3) % 6.28;
    this.mesh.setColorAt(i, this.color.set(color));
    this.live++;
    this.dirty = true;
  }

  update(dt: number): void {
    if (!this.live && !this.dirty) return;
    this.dirty = false;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.hide(i); this.free.push(i); this.live--; this.dirty = true; continue; }
      p.vy += p.gravity * dt;
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (this.opt.floor !== false && p.y < p.size / 2) { p.y = p.size / 2; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.life / p.max;
      let s: number;
      if (this.opt.puff) { const t = 1 - k; s = p.size * Math.min(1, t / 0.12 + 0.2) * (0.2 + 0.8 * k); }
      else s = p.size * (0.3 + 0.7 * k);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.spin + p.life * 3, p.spin * 2 + p.life * 4, p.z * 3);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const FIRE = [0xfff3c4, 0xffd23f, 0xffb02e, 0xff7a1a, 0xff4a14];
const ROCK = [0x2a2142, 0x3a2f5c, 0x4b3f6e, 0x241b38, 0x1c1530];
const SMOKE = [0x3a2f52, 0x2e2542, 0x4a3d66, 0x262036];
const CONFETTI = [0xff3df0, 0x3de8ff, 0xffd23f, 0x5dff7a, 0xff7a1a];
const ZAP_POINTS = 6;
const ZAP_SUB = 4;

/** Brandfleck-Textur in Pixeloptik */
function scorchTexture(): THREE.Texture {
  const S = 24, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5) / S * 2 - 1, dy = (y + 0.5) / S * 2 - 1;
    const d = Math.hypot(dx, dy) + (hash2(x, y, 77) - 0.5) * 0.35;
    const i = (y * S + x) * 4;
    const a = d < 0.45 ? 0.85 : d < 0.8 ? 0.55 : d < 1 ? 0.2 : 0;
    img.data[i] = 12; img.data[i + 1] = 8; img.data[i + 2] = 18; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/**
 * Alle Partikel- und Explosionseffekte. Entstehen ausschließlich aus Simulations-Ereignissen;
 * eigener Zufall (rnd), damit die Simulation unberührt bleibt.
 */
export class Effects {
  readonly group = new THREE.Group();
  readonly dust: ParticlePool;
  readonly sparks: ParticlePool;
  readonly debris: ParticlePool;
  readonly fire: ParticlePool;
  readonly smoke: ParticlePool;
  private rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; max: number; r: number }[] = [];
  private lights: { light: THREE.PointLight; t: number; max: number; power: number }[] = [];
  private decals: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private flashes: { sprite: THREE.Sprite; t: number; max: number; size: number }[] = [];
  private bolts: { pts: Float32Array; n: number; t: number }[] = [];
  private beams: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; w: number }[] = [];
  private arcs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; r: number }[] = [];
  private beamIdx = 0;
  private arcIdx = 0;
  private tmpColor = new THREE.Color();
  private boltGeo: THREE.BufferGeometry;
  private boltPos: Float32Array;
  private ringIdx = 0;
  private lightIdx = 0;
  private decalIdx = 0;
  private flashIdx = 0;
  private boltIdx = 0;
  /** wie viel gerade explodiert – bei Massen-Explosionen weniger Partikel pro Explosion */
  private load = 0;
  /** Partikeldichte (Barrierefreiheit / Qualitätsstufe) */
  density = 1;

  constructor(private rnd: () => number) {
    this.dust = new ParticlePool(220, new THREE.MeshLambertMaterial({ color: '#7a6aa8' }));
    this.sparks = new ParticlePool(500, new THREE.MeshBasicMaterial({ toneMapped: false }));
    this.debris = new ParticlePool(900, new THREE.MeshLambertMaterial());
    this.fire = new ParticlePool(700, new THREE.MeshBasicMaterial({ toneMapped: false }), { puff: true, floor: false });
    this.smoke = new ParticlePool(500, new THREE.MeshLambertMaterial(), { puff: true, floor: false });
    this.debris.mesh.castShadow = true;
    this.group.add(this.dust.mesh, this.sparks.mesh, this.debris.mesh, this.fire.mesh, this.smoke.mesh);

    const ringGeo = new THREE.RingGeometry(0.8, 1, 28, 1);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, t: 0, max: 1, r: 1 });
    }
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight('#ff9a3a', 0, 8, 1.6);
      this.group.add(light);
      this.lights.push({ light, t: 0, max: 1, power: 0 });
    }
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    decalGeo.rotateX(-Math.PI / 2);
    const tex = scorchTexture();
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(decalGeo, mat);
      mesh.visible = false;
      mesh.position.y = 0.012;
      mesh.renderOrder = -1;
      this.group.add(mesh);
      this.decals.push({ mesh, mat, t: 0 });
    }
    for (let i = 0; i < 8; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#ffd9a0', blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0, toneMapped: false }));
      sprite.visible = false;
      this.group.add(sprite);
      this.flashes.push({ sprite, t: 0, max: 1, size: 1 });
    }
    // Strahlen: gestreckte, leuchtende Quader
    const beamGeo = new THREE.BoxGeometry(1, 1, 1);
    beamGeo.translate(0, 0, 0.5);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ff3df0', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(beamGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.beams.push({ mesh, mat, t: 0, w: 0.12 });
    }
    // Rundumschläge: Halbkreis-Bogen
    const arcGeo = new THREE.RingGeometry(0.55, 1, 20, 1, -Math.PI / 2, Math.PI);
    arcGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(arcGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.arcs.push({ mesh, mat, t: 0, r: 1 });
    }
    for (let i = 0; i < 24; i++) this.bolts.push({ pts: new Float32Array(ZAP_POINTS * 3), n: 0, t: 0 });
    this.boltPos = new Float32Array(24 * (ZAP_POINTS - 1) * ZAP_SUB * 2 * 3);
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.boltGeo.setDrawRange(0, 0);
    const lines = new THREE.LineSegments(this.boltGeo, new THREE.LineBasicMaterial({ color: '#c8fbff', toneMapped: false }));
    lines.frustumCulled = false;
    this.group.add(lines);
  }

  chance(p: number): boolean {
    return this.rnd() < p;
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rnd() * list.length)];
  }

  /* ---------------- Bewegung (Phase 1) ---------------- */

  /** Staubwolke + Funkenspur beim Dash */
  dash(x: number, z: number, dx: number, dz: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, s = 1 + rnd() * 2.5;
      this.dust.spawn(x - dx * 0.3, 0.1, z - dz * 0.3, Math.cos(a) * s - dx * 2, 1 + rnd() * 2, Math.sin(a) * s - dz * 2, 0.45 + rnd() * 0.3, 0.12 + rnd() * 0.1);
    }
    for (let i = 0; i < 18; i++) {
      const t = rnd() * 2.2;
      this.sparks.spawn(x + dx * t + (rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.9, z + dz * t + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.6, 0.6 + rnd(), (rnd() - 0.5) * 0.6, 0.25 + rnd() * 0.3, 0.07, -1, 0xa8f6ff);
    }
  }

  step(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 2; i++) this.dust.spawn(x + (rnd() - 0.5) * 0.3, 0.05, z + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.8, 0.6 + rnd() * 0.6, (rnd() - 0.5) * 0.8, 0.35, 0.08 + rnd() * 0.05);
  }

  bump(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      this.dust.spawn(x, 0.4 + rnd() * 0.5, z, Math.cos(a) * 2.5, 1.5 + rnd() * 2, Math.sin(a) * 2.5, 0.5, 0.1 + rnd() * 0.08);
    }
  }

  /* ---------------- Kampf ---------------- */

  muzzle(x: number, y: number, z: number, dx: number, dz: number, color: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 4; i++) {
      const s = 2 + rnd() * 3;
      this.sparks.spawn(x + dx * 0.3, y, z + dz * 0.3, dx * s + (rnd() - 0.5) * 1.5, rnd() * 1.5, dz * s + (rnd() - 0.5) * 1.5, 0.08 + rnd() * 0.08, 0.07, 0, color);
    }
    this.fire.spawn(x + dx * 0.35, y, z + dz * 0.35, dx, 0, dz, 0.07, 0.22, 0, color);
  }

  hit(x: number, y: number, z: number, crit: boolean): void {
    const rnd = this.rnd, n = crit ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, s = 2 + rnd() * 3;
      this.sparks.spawn(x, y, z, Math.cos(a) * s, 1 + rnd() * 3, Math.sin(a) * s, 0.15 + rnd() * 0.15, crit ? 0.1 : 0.07, -10, crit ? 0xffd23f : 0xffffff);
    }
  }

  spark(x: number, y: number, z: number, hostile: boolean): void {
    const rnd = this.rnd;
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, s = 1 + rnd() * 2.5;
      this.sparks.spawn(x, y, z, Math.cos(a) * s, 1 + rnd() * 2, Math.sin(a) * s, 0.2 + rnd() * 0.15, 0.06, -12, hostile ? 0xff7a1a : 0xfff3c4);
    }
    if (hostile) for (let i = 0; i < 4; i++) this.debris.spawn(x, y, z, (rnd() - 0.5) * 3, 2 + rnd() * 2, (rnd() - 0.5) * 3, 0.8, 0.07, -14, rnd() < 0.5 ? 0xc98a3a : 0x8a5a2a);
  }

  /** Die große Nummer: Feuerball, Rauch, Voxel-Trümmer, Funken, Schockwelle, Lichtblitz, Brandfleck. */
  explosion(x: number, z: number, r: number, small = false): void {
    const rnd = this.rnd;
    // nur die Grafik 20 % kleiner (v0.10: man soll vor lauter Explosionen noch etwas sehen);
    // der Wirkungsradius im Spiel bleibt unverändert
    r *= EXPLOSION_GRAFIK;
    this.load += 1;
    const q = this.density / (1 + this.load * 0.25);
    const n = (base: number) => Math.max(1, Math.round(base * q));
    const y = 0.35;

    // Kern: kurzer heller Blitz
    for (let i = 0; i < n(3); i++) this.fire.spawn(x + (rnd() - 0.5) * 0.3, y + 0.2, z + (rnd() - 0.5) * 0.3, 0, 1, 0, 0.1, r * 0.45, 0, 0xfff3c4);
    // Feuerball
    for (let i = 0; i < n(10 + r * 7); i++) {
      const a = rnd() * Math.PI * 2, el = rnd() * 0.9, s = (1.5 + rnd() * 3.2) * r;
      this.fire.spawn(x, y + rnd() * 0.3, z, Math.cos(a) * Math.cos(el) * s, Math.sin(el) * s * 0.8 + 1.5, Math.sin(a) * Math.cos(el) * s, 0.28 + rnd() * 0.32, (0.22 + rnd() * 0.3) * Math.sqrt(r), 2, this.pick(FIRE), 5);
    }
    // Rauch
    for (let i = 0; i < n(5 + r * 3); i++) {
      const a = rnd() * Math.PI * 2, s = rnd() * 1.4 * r;
      this.smoke.spawn(x + Math.cos(a) * 0.3, y + 0.3, z + Math.sin(a) * 0.3, Math.cos(a) * s, 1.2 + rnd() * 1.6, Math.sin(a) * s, 0.7 + rnd() * 0.8, (0.3 + rnd() * 0.35) * Math.sqrt(r), 0.6, this.pick(SMOKE), 1.8);
    }
    if (!small) {
      // Voxel-Trümmer (Boden + Glut)
      for (let i = 0; i < n(10 + r * 7); i++) {
        const a = rnd() * Math.PI * 2, s = (1.5 + rnd() * 3.5) * Math.sqrt(r);
        const ember = rnd() < 0.3;
        this.debris.spawn(x + (rnd() - 0.5) * 0.4, y, z + (rnd() - 0.5) * 0.4, Math.cos(a) * s, 3.5 + rnd() * 5.5, Math.sin(a) * s, 1.1 + rnd() * 1.1, 0.07 + rnd() * 0.1, -18, ember ? this.pick(FIRE) : this.pick(ROCK));
      }
      // Funkenregen
      for (let i = 0; i < n(12 + r * 4); i++) {
        const a = rnd() * Math.PI * 2, s = (4 + rnd() * 6) * Math.sqrt(r);
        this.sparks.spawn(x, y + 0.2, z, Math.cos(a) * s, 2 + rnd() * 5, Math.sin(a) * s, 0.25 + rnd() * 0.35, 0.06, -12, this.pick(FIRE), 2);
      }
      this.decal(x, z, r * (0.9 + rnd() * 0.3));
    }
    this.ring(x, z, r * 1.25, small ? 0xffb02e : 0xffd23f, 0.28);
    this.light(x, z, small ? 10 : 18 + r * 8, 0.22 + r * 0.04);
    this.flash(x, z, r * 2.6, 0.12);
  }

  /** Gegner zerplatzt in seine Voxel + etwas Konfetti (kein Blut!) */
  burst(x: number, z: number, colors: readonly string[]): void {
    const rnd = this.rnd, q = this.density;
    for (let i = 0; i < Math.round(14 * q); i++) {
      const a = rnd() * Math.PI * 2, s = 1.5 + rnd() * 3;
      this.debris.spawn(x + (rnd() - 0.5) * 0.3, 0.3 + rnd() * 0.5, z + (rnd() - 0.5) * 0.3, Math.cos(a) * s, 3 + rnd() * 4, Math.sin(a) * s, 0.9 + rnd() * 0.9, 0.08 + rnd() * 0.06, -16, this.pick(colors));
    }
    for (let i = 0; i < Math.round(8 * q); i++) {
      const a = rnd() * Math.PI * 2, s = 1 + rnd() * 2.5;
      this.sparks.spawn(x, 0.6, z, Math.cos(a) * s, 3 + rnd() * 3, Math.sin(a) * s, 0.7 + rnd() * 0.5, 0.06, -6, this.pick(CONFETTI), 2.5);
    }
    this.smoke.spawn(x, 0.4, z, 0, 0.8, 0, 0.45, 0.55, 0, 0xc9bfe8, 2);
  }

  /** Kettenblitz: zackige Linie durch alle getroffenen Gegner */
  zap(pts: readonly number[]): void {
    const b = this.bolts[this.boltIdx++ % this.bolts.length];
    b.n = Math.min(ZAP_POINTS, pts.length / 3);
    for (let i = 0; i < b.n * 3; i++) b.pts[i] = pts[i];
    b.t = 0.2;
    const rnd = this.rnd;
    for (let i = 1; i < b.n; i++) {
      for (let k = 0; k < 4; k++) this.sparks.spawn(b.pts[i * 3], b.pts[i * 3 + 1], b.pts[i * 3 + 2], (rnd() - 0.5) * 4, rnd() * 3, (rnd() - 0.5) * 4, 0.2, 0.07, -8, 0x3de8ff);
    }
    if (b.n > 1) this.light(b.pts[3], b.pts[5], 8, 0.15, 0x3de8ff);
  }

  pickup(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 3; i++) this.sparks.spawn(x, 0.5, z, (rnd() - 0.5) * 2, 1.5 + rnd() * 1.5, (rnd() - 0.5) * 2, 0.25, 0.05, -4, 0xa8f6ff);
  }

  spawn(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.dust.spawn(x + Math.cos(a) * 0.3, 0.1, z + Math.sin(a) * 0.3, Math.cos(a) * 2, 0.8 + rnd(), Math.sin(a) * 2, 0.4, 0.1);
    }
  }

  /** Telegraf: Funken, bevor ein Gegner angreift */
  windup(x: number, z: number, color: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 5; i++) this.sparks.spawn(x + (rnd() - 0.5) * 0.5, 0.9 + rnd() * 0.4, z + (rnd() - 0.5) * 0.5, 0, 1.5, 0, 0.3, 0.06, 0, color);
  }

  trail(x: number, y: number, z: number): void {
    const rnd = this.rnd;
    this.smoke.spawn(x + (rnd() - 0.5) * 0.08, y, z + (rnd() - 0.5) * 0.08, 0, 0.3, 0, 0.35 + rnd() * 0.2, 0.12 + rnd() * 0.06, 0, 0x8a80a8, 1);
    if (rnd() < 0.6) this.fire.spawn(x, y, z, 0, 0, 0, 0.08, 0.1, 0, 0xffb02e);
  }

  /* ---------------- Statuseffekte & Progression ---------------- */

  burning(x: number, y: number, z: number): void {
    const rnd = this.rnd;
    this.fire.spawn(x + (rnd() - 0.5) * 0.4, y, z + (rnd() - 0.5) * 0.4, 0, 1.2 + rnd(), 0, 0.3, 0.12 + rnd() * 0.08, 0, this.pick(FIRE));
  }

  poisoned(x: number, y: number, z: number): void {
    const rnd = this.rnd;
    this.sparks.spawn(x + (rnd() - 0.5) * 0.4, y, z + (rnd() - 0.5) * 0.4, 0, 0.8, 0, 0.5, 0.09, 0, rnd() < 0.5 ? 0x7dff5a : 0x3dbb3a);
  }

  chilled(x: number, y: number, z: number): void {
    const rnd = this.rnd;
    this.sparks.spawn(x + (rnd() - 0.5) * 0.5, y, z + (rnd() - 0.5) * 0.5, 0, -0.3, 0, 0.5, 0.07, 0, 0xa8f6ff);
  }

  /** Cartoon-Sternchen über betäubten Gegnern */
  dizzy(x: number, y: number, z: number, time: number): void {
    const a = time * 8;
    this.sparks.spawn(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, -Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2, 0.25, 0.09, 0, 0xffd23f);
  }

  levelUp(x: number, z: number): void {
    this.ring(x, z, 1.6, 0xffd23f, 0.5);
    const rnd = this.rnd;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.sparks.spawn(x + Math.cos(a) * 0.5, 0.2, z + Math.sin(a) * 0.5, Math.cos(a) * 0.6, 3 + rnd() * 2, Math.sin(a) * 0.6, 0.7, 0.08, -2, rnd() < 0.5 ? 0xffd23f : 0xfff3c4);
    }
  }

  heal(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 4; i++) this.sparks.spawn(x + (rnd() - 0.5) * 0.6, 0.4 + rnd() * 0.6, z + (rnd() - 0.5) * 0.6, 0, 1.2, 0, 0.5, 0.08, 0, 0x5dff7a);
  }

  dodge(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 8; i++) this.dust.spawn(x, 0.5, z, (rnd() - 0.5) * 4, 1 + rnd(), (rnd() - 0.5) * 4, 0.35, 0.08);
  }

  /* ---------------- Phase 4: neue Antriebe & Fusion ---------------- */

  beam(x: number, z: number, x2: number, z2: number, color: string): void {
    const b = this.beams[this.beamIdx++ % this.beams.length];
    const len = Math.hypot(x2 - x, z2 - z) || 0.01;
    b.t = 0.12; b.w = 0.14;
    b.mat.color.set(color);
    b.mesh.position.set(x, 0.7, z);
    b.mesh.rotation.set(0, Math.atan2(x2 - x, z2 - z), 0);
    b.mesh.scale.set(b.w, b.w, len);
    b.mesh.visible = true;
    const rnd = this.rnd;
    for (let i = 0; i < 4; i++) this.sparks.spawn(x2, 0.7, z2, (rnd() - 0.5) * 3, rnd() * 2, (rnd() - 0.5) * 3, 0.2, 0.07, -6, color);
    this.light(x2, z2, 4, 0.1, this.tmpColor.set(color).getHex());
  }

  cone(x: number, z: number, dx: number, dz: number, range: number, color: string, fire: boolean): void {
    const rnd = this.rnd, n = Math.round(6 * this.density);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dx, dz) + (rnd() - 0.5) * 1.0, s = range * (2.2 + rnd() * 1.4);
      const vx = Math.sin(a) * s, vz = Math.cos(a) * s;
      if (fire) this.fire.spawn(x + dx * 0.3, 0.7, z + dz * 0.3, vx, 0.6 + rnd(), vz, 0.3 + rnd() * 0.12, 0.12 + rnd() * 0.12, 1, this.pick(FIRE), 2.5);
      else this.sparks.spawn(x + dx * 0.3, 0.7, z + dz * 0.3, vx, rnd(), vz, 0.3 + rnd() * 0.1, 0.08, -2, color, 2);
    }
  }

  swing(x: number, z: number, dx: number, dz: number, range: number, color: string): void {
    const a = this.arcs[this.arcIdx++ % this.arcs.length];
    a.t = 0.18; a.r = range;
    a.mat.color.set(color);
    a.mesh.position.set(x, 0.5, z);
    a.mesh.rotation.set(0, Math.atan2(dx, dz) - Math.PI / 2, 0);
    a.mesh.visible = true;
    const rnd = this.rnd, base = Math.atan2(dx, dz);
    for (let i = 0; i < 8; i++) {
      const ang = base + (i / 7 - 0.5) * Math.PI;
      this.sparks.spawn(x + Math.sin(ang) * range, 0.5, z + Math.cos(ang) * range, Math.sin(ang) * 2, 0.5 + rnd(), Math.cos(ang) * 2, 0.2, 0.07, -4, color);
    }
  }

  teleport(x: number, z: number, color: string): void {
    const rnd = this.rnd;
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      this.sparks.spawn(x + Math.cos(a) * 0.5, 0.2 + rnd(), z + Math.sin(a) * 0.5, -Math.cos(a) * 2, 1, -Math.sin(a) * 2, 0.3, 0.08, 0, i % 2 ? color : 0xff3df0);
    }
    this.ring(x, z, 0.9, 0xff3df0, 0.2);
  }

  puddle(x: number, z: number, r: number, lava: boolean): void {
    const rnd = this.rnd, a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.8;
    if (lava) this.fire.spawn(x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d, 0, 1.2, 0, 0.35, 0.12, 0, this.pick(FIRE));
    else this.sparks.spawn(x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d, 0, 0.9, 0, 0.5, 0.1, 0, rnd() < 0.5 ? 0x7dff5a : 0x3dbb3a);
  }

  /** Fanfare am Amboss: Konfetti-Fontäne, Ringe, Lichtblitz */
  fusion(x: number, z: number, recipe: boolean): void {
    const rnd = this.rnd;
    for (let i = 0; i < (recipe ? 80 : 40); i++) {
      const a = rnd() * Math.PI * 2, s = 1 + rnd() * 3;
      this.sparks.spawn(x, 0.8, z, Math.cos(a) * s, 4 + rnd() * 5, Math.sin(a) * s, 1 + rnd() * 0.8, 0.09, -7, this.pick(CONFETTI), 1.2);
    }
    this.ring(x, z, 2.2, 0xffd23f, 0.5);
    this.ring(x, z, 1.4, recipe ? 0xff3df0 : 0x3de8ff, 0.4);
    this.light(x, z, recipe ? 30 : 16, 0.5, 0xffd23f);
    this.flash(x, z, recipe ? 5 : 3, 0.3);
  }

  /* ---------------- Phase 5: Gegner & Inseln ---------------- */

  enemyHeal(x: number, z: number, r: number): void {
    this.ring(x, z, r, 0x5dff7a, 0.5);
    const rnd = this.rnd;
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * r;
      this.sparks.spawn(x + Math.cos(a) * d, 0.2, z + Math.sin(a) * d, 0, 1.6 + rnd(), 0, 0.6, 0.09, 0, 0x5dff7a);
    }
  }

  /** Elementar-Reaktion: Ring und Funkenregen in der Reaktionsfarbe */
  reaction(x: number, z: number, color: string): void {
    const c = this.tmpColor.set(color).getHex();
    this.ring(x, z, 1.8, c, 0.35);
    this.flash(x, z, 2.2, 0.15);
    const rnd = this.rnd;
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, s = 2 + rnd() * 3;
      this.sparks.spawn(x, 0.7, z, Math.cos(a) * s, 1.5 + rnd() * 3, Math.sin(a) * s, 0.45, 0.09, -6, c, 1.5);
    }
  }

  /** Mini-Nuke: riesiger Feuerball mit Pilz */
  nuke(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 30; i++) this.fire.spawn(x + (rnd() - 0.5) * 0.6, 0.6 + i * 0.12, z + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 1.5, 3 + rnd() * 2, (rnd() - 0.5) * 1.5, 0.9 + rnd() * 0.4, 0.5 + rnd() * 0.4, -1, this.pick(FIRE), 1.5);
    this.ring(x, z, 6, 0xfff3c4, 0.6);
    this.light(x, z, 60, 0.6, 0xffd23f);
    this.flash(x, z, 9, 0.35);
  }

  /** Gewitterblitz vom Himmel */
  storm(x: number, z: number): void {
    const b = this.bolts[this.boltIdx++ % this.bolts.length];
    b.n = 4;
    b.pts.set([x + 0.6, 9, z - 0.6, x - 0.4, 6, z + 0.3, x + 0.3, 3, z - 0.2, x, 0.2, z]);
    b.t = 0.25;
    this.light(x, z, 25, 0.25, 0xa8f6ff);
    this.ring(x, z, 1.4, 0x3de8ff, 0.25);
  }

  /** Schildtreffer: „Pling" mit Funken */
  block(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 6; i++) this.sparks.spawn(x, 0.8, z, (rnd() - 0.5) * 5, 1 + rnd() * 2, (rnd() - 0.5) * 5, 0.2, 0.07, -10, i % 2 ? 0x3de8ff : 0xffffff);
  }

  keks(x: number, z: number): void {
    const rnd = this.rnd;
    for (let i = 0; i < 6; i++) this.debris.spawn(x, 1.2, z, (rnd() - 0.5) * 2, 2 + rnd() * 2, (rnd() - 0.5) * 2, 0.9, 0.1, -14, rnd() < 0.5 ? 0xc98a3a : 0x5a3a1e);
    this.heal(x, z);
  }

  /** Tesla-Platten entladen sich: Blitze aus jeder Platte */
  shock(a: { size: number; tile(x: number, z: number): number }): void {
    const rnd = this.rnd;
    for (let z = 0; z < a.size; z++) for (let x = 0; x < a.size; x++) {
      if (a.tile(x, z) !== 8) continue;
      for (let i = 0; i < 2; i++) this.sparks.spawn(x + 0.5 + (rnd() - 0.5), 0.1, z + 0.5 + (rnd() - 0.5), (rnd() - 0.5) * 3, 3 + rnd() * 3, (rnd() - 0.5) * 3, 0.3, 0.08, -6, i % 2 ? 0x3de8ff : 0xe8fdff);
    }
  }

  hurt(x: number, z: number): void {
    this.ring(x, z, 1.2, 0xff3d6a, 0.25);
    const rnd = this.rnd;
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      this.sparks.spawn(x, 0.7, z, Math.cos(a) * 3, 1 + rnd() * 2, Math.sin(a) * 3, 0.3, 0.08, -8, 0xff3d6a);
    }
  }

  private ring(x: number, z: number, r: number, color: number, time: number): void {
    const g = this.rings[this.ringIdx++ % this.rings.length];
    g.t = time; g.max = time; g.r = r;
    g.mat.color.set(color);
    g.mesh.position.set(x, 0.06, z);
    g.mesh.visible = true;
  }

  private light(x: number, z: number, power: number, time: number, color = 0xff9a3a): void {
    // die stärkste laufende Lichtquelle nicht überschreiben
    let l = this.lights[this.lightIdx++ % this.lights.length];
    for (const o of this.lights) if (o.t <= 0) { l = o; break; }
    l.t = time; l.max = time; l.power = power;
    l.light.color.set(color);
    l.light.position.set(x, 1.2, z);
  }

  private flash(x: number, z: number, size: number, time: number): void {
    const f = this.flashes[this.flashIdx++ % this.flashes.length];
    f.t = time; f.max = time; f.size = size;
    f.sprite.position.set(x, 0.6, z);
    f.sprite.visible = true;
  }

  private decal(x: number, z: number, size: number): void {
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.t = 9;
    d.mesh.position.x = x; d.mesh.position.z = z;
    d.mesh.scale.set(size, 1, size);
    d.mesh.rotation.y = this.rnd() * Math.PI * 2;
    d.mesh.visible = true;
  }

  update(dt: number): void {
    this.load *= Math.pow(0.02, dt);
    this.dust.update(dt);
    this.sparks.update(dt);
    this.debris.update(dt);
    this.fire.update(dt);
    this.smoke.update(dt);

    for (const g of this.rings) {
      if (g.t <= 0) continue;
      g.t -= dt;
      if (g.t <= 0) { g.mesh.visible = false; continue; }
      const k = 1 - g.t / g.max;
      const s = g.r * (0.2 + 0.8 * Math.sqrt(k));
      g.mesh.scale.set(s, 1, s);
      g.mat.opacity = 1 - k;
    }
    for (const l of this.lights) {
      if (l.t <= 0) { l.light.intensity = 0; continue; }
      l.t -= dt;
      const k = Math.max(0, l.t / l.max);
      l.light.intensity = l.power * k * k * (0.35 + 0.65 * FX.blitze);
    }
    for (const f of this.flashes) {
      if (f.t <= 0) continue;
      f.t -= dt;
      if (f.t <= 0) { f.sprite.visible = false; continue; }
      const k = f.t / f.max;
      f.sprite.scale.set(f.size * (1.2 - 0.4 * k), f.size * (1.2 - 0.4 * k), 1);
      (f.sprite.material as THREE.SpriteMaterial).opacity = k * 0.55 * FX.blitze;
    }
    for (const b of this.beams) {
      if (b.t <= 0) continue;
      b.t -= dt;
      if (b.t <= 0) { b.mesh.visible = false; continue; }
      const k = b.t / 0.12;
      b.mesh.scale.x = b.mesh.scale.y = b.w * (0.4 + 0.6 * k);
      b.mat.opacity = k;
    }
    for (const a of this.arcs) {
      if (a.t <= 0) continue;
      a.t -= dt;
      if (a.t <= 0) { a.mesh.visible = false; continue; }
      const k = a.t / 0.18;
      const s = a.r * (1.1 - 0.2 * k);
      a.mesh.scale.set(s, 1, s);
      a.mat.opacity = k * 0.9;
    }
    for (const d of this.decals) {
      if (d.t <= 0) continue;
      d.t -= dt;
      if (d.t <= 0) { d.mesh.visible = false; continue; }
      d.mat.opacity = Math.min(1, d.t / 2) * 0.85;
    }

    // Blitze: jedes Frame neu gezackt → flackert
    const rnd = this.rnd, P = this.boltPos;
    let v = 0;
    for (const b of this.bolts) {
      if (b.t <= 0) continue;
      b.t -= dt;
      if (b.t <= 0) continue;
      for (let i = 0; i < b.n - 1; i++) {
        const ax = b.pts[i * 3], ay = b.pts[i * 3 + 1], az = b.pts[i * 3 + 2];
        const bx = b.pts[i * 3 + 3], by = b.pts[i * 3 + 4], bz = b.pts[i * 3 + 5];
        let lx = ax, ly = ay, lz = az;
        for (let k = 1; k <= ZAP_SUB; k++) {
          const t = k / ZAP_SUB, j = k < ZAP_SUB ? 0.35 : 0;
          const nx = ax + (bx - ax) * t + (rnd() - 0.5) * j, ny = ay + (by - ay) * t + (rnd() - 0.5) * j, nz = az + (bz - az) * t + (rnd() - 0.5) * j;
          P[v++] = lx; P[v++] = ly; P[v++] = lz;
          P[v++] = nx; P[v++] = ny; P[v++] = nz;
          lx = nx; ly = ny; lz = nz;
        }
      }
    }
    this.boltGeo.setDrawRange(0, v / 3);
    (this.boltGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
