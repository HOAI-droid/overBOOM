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

  /** color = Spielerfarbe (Ring, Silhouette), body = Heldenfarbe (Helm, Anzug) */
  constructor(color: string, body = color) {
    const p = heroParts(body);
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

  /** Koop: niedergeschlagen (liegt, Ring zeigt den Wiederbelebungs-Radius) */
  downed = false;
  /** 0–1 Fortschritt des Wiederbelebens */
  revive = 0;

  update(x: number, z: number, facing: number, speed: number, stride: number, dashing: boolean, time: number, dt: number): void {
    this.root.position.set(x, 0, z);
    if (this.downed) {
      // liegt auf dem Rücken und zappelt ein wenig
      this.model.rotation.set(-Math.PI / 2 + Math.sin(time * 6) * 0.05, facing, 0, 'YXZ');
      this.model.position.y = 0.15;
      this.legL.rotation.x = Math.sin(time * 8) * 0.3;
      this.legR.rotation.x = -Math.sin(time * 8) * 0.3;
      const rm = this.ring.material as THREE.MeshBasicMaterial;
      const pulse = 1 + Math.sin(time * 5) * 0.06;
      this.ring.scale.setScalar(3 * pulse);
      rm.opacity = 0.35 + this.revive * 0.6;
      return;
    }
    this.model.position.y = 0;
    this.ring.scale.setScalar(1);
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
    this.model.rotation.set(0, facing, 0, 'XYZ');
    this.body.rotation.x = this.lean * 0.6;
    this.squash *= Math.pow(0.0005, dt);
    const s = this.squash;
    this.model.scale.set(1 + s * 0.35, 1 - s * 0.35, 1 + s * 0.35);

    const m = this.ring.material as THREE.MeshBasicMaterial;
    m.opacity = 0.65 + Math.sin(time * 4) * 0.2;
  }
}
