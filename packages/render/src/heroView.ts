import * as THREE from 'three';
import { buildVoxels, solidMaterial, glowMaterial, type Vox } from './voxel.ts';
import { heroParts, HERO_VOXEL } from './models.ts';

const silhouettes = new Map<string, THREE.MeshBasicMaterial>();
/** Durchscheinende Silhouette, wenn der Held hinter Mauern oder Säulen steht. */
function silhouetteMaterial(color: string): THREE.MeshBasicMaterial {
  let m = silhouettes.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthFunc: THREE.GreaterDepth, depthWrite: false, toneMapped: false });
    silhouettes.set(color, m);
  }
  return m;
}

function partMesh(vox: Vox[], pivot: [number, number, number], color: string): THREE.Group {
  const g = new THREE.Group();
  const { solid, glow } = buildVoxels(vox, HERO_VOXEL, { origin: pivot, jitter: 0.05 });
  if (solid) {
    const m = new THREE.Mesh(solid, solidMaterial); m.castShadow = true; g.add(m);
    const ghost = new THREE.Mesh(solid, silhouetteMaterial(color));
    ghost.renderOrder = 10;
    g.add(ghost);
  }
  if (glow) g.add(new THREE.Mesh(glow, glowMaterial));
  g.position.set(pivot[0] * HERO_VOXEL, pivot[1] * HERO_VOXEL, pivot[2] * HERO_VOXEL);
  return g;
}

/** Darstellung eines Spielers inkl. Lauf-, Dash- und Idle-Animation. */
export class HeroView {
  readonly root = new THREE.Group();
  private model = new THREE.Group();
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private body: THREE.Group;
  readonly ring: THREE.Mesh;
  private lean = 0;
  private squash = 0;

  constructor(color: string) {
    const p = heroParts(color);
    this.body = partMesh(p.body, [0, 0, 0], color);
    this.legL = partMesh(p.legL, p.pivots.legL, color);
    this.legR = partMesh(p.legR, p.pivots.legR, color);
    this.armL = partMesh(p.armL, p.pivots.armL, color);
    this.armR = partMesh(p.armR, p.pivots.armR, color);
    this.model.add(this.body, this.legL, this.legR, this.armL, this.armR);
    this.root.add(this.model);

    // Spielerring am Boden (Koop-Erkennung)
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 20, 1),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.root.add(this.ring);
  }

  /** Kurzes Stauchen, z. B. beim Dash-Start oder Aufprall. */
  punch(amount: number): void {
    this.squash = Math.max(this.squash, amount);
  }

  update(x: number, z: number, facing: number, speed: number, stride: number, dashing: boolean, time: number, dt: number): void {
    this.root.position.set(x, 0, z);
    this.model.rotation.y = facing;
    const moving = Math.min(1, speed / 4);
    const phase = stride * 3.4;
    const swing = Math.sin(phase) * 0.8 * moving;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.5 - 0.25 * moving;

    const idle = (1 - moving) * Math.sin(time * 2.6) * 0.02;
    this.body.position.y = Math.abs(Math.sin(phase)) * 0.06 * moving + idle;
    this.armL.position.y = this.armR.position.y = 0.9 + this.body.position.y;

    const targetLean = dashing ? 0.55 : moving * 0.12;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 14);
    this.model.rotation.x = 0;
    this.body.rotation.x = this.lean * 0.6;
    this.squash *= Math.pow(0.0005, dt);
    const s = this.squash;
    this.model.scale.set(1 + s * 0.35, 1 - s * 0.35, 1 + s * 0.35);

    const m = this.ring.material as THREE.MeshBasicMaterial;
    m.opacity = 0.65 + Math.sin(time * 4) * 0.2;
  }
}
