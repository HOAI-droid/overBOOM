import * as THREE from 'three';

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
  gravity: number;
}

/** Partikel-Pool mit Instancing – keine Allokationen pro Frame. */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private free: number[] = [];
  private dummy = new THREE.Object3D();

  constructor(capacity: number, material: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) {
      this.parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, gravity: 0 });
      this.free.push(i);
      this.hide(i);
    }
  }

  private hide(i: number) {
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.setScalar(0.0001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, gravity = -9): void {
    const i = this.free.pop();
    if (i === undefined) return;
    Object.assign(this.parts[i], { x, y, z, vx, vy, vz, life, max: life, size, gravity });
  }

  update(dt: number): void {
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.hide(i); this.free.push(i); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.size / 2) { p.y = p.size / 2; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      const k = p.life / p.max;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.x * 3, p.life * 4, p.z * 3);
      this.dummy.scale.setScalar(p.size * (0.3 + 0.7 * k));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Effects {
  readonly group = new THREE.Group();
  readonly dust: ParticlePool;
  readonly sparks: ParticlePool;

  constructor() {
    this.dust = new ParticlePool(160, new THREE.MeshLambertMaterial({ color: '#7a6aa8' }));
    this.sparks = new ParticlePool(120, new THREE.MeshBasicMaterial({ color: '#a8f6ff', toneMapped: false }));
    this.group.add(this.dust.mesh, this.sparks.mesh);
  }

  /** Staubwolke + Funkenspur beim Dash */
  dash(x: number, z: number, dx: number, dz: number, rnd: () => number): void {
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, s = 1 + rnd() * 2.5;
      this.dust.spawn(x - dx * 0.3, 0.1, z - dz * 0.3, Math.cos(a) * s - dx * 2, 1 + rnd() * 2, Math.sin(a) * s - dz * 2, 0.45 + rnd() * 0.3, 0.12 + rnd() * 0.1);
    }
    for (let i = 0; i < 18; i++) {
      const t = rnd() * 2.2;
      this.sparks.spawn(x + dx * t + (rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.9, z + dz * t + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.6, 0.6 + rnd(), (rnd() - 0.5) * 0.6, 0.25 + rnd() * 0.3, 0.07, -1);
    }
  }

  step(x: number, z: number, rnd: () => number): void {
    for (let i = 0; i < 2; i++) this.dust.spawn(x + (rnd() - 0.5) * 0.3, 0.05, z + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.8, 0.6 + rnd() * 0.6, (rnd() - 0.5) * 0.8, 0.35, 0.08 + rnd() * 0.05);
  }

  bump(x: number, z: number, rnd: () => number): void {
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      this.dust.spawn(x, 0.4 + rnd() * 0.5, z, Math.cos(a) * 2.5, 1.5 + rnd() * 2, Math.sin(a) * 2.5, 0.5, 0.1 + rnd() * 0.08);
    }
  }

  update(dt: number): void {
    this.dust.update(dt);
    this.sparks.update(dt);
  }
}
