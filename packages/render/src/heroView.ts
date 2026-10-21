import * as THREE from 'three';
import { buildVoxels, solidMaterial, glowMaterial, type Vox } from './voxel.ts';
import { heroParts, HERO_VOXEL } from './models.ts';
import { DETAIL, heroPartsHd, HERO_VOXEL_HD } from './hd/index.ts';

/** Held-Material: schreibt Stencil 1 – die Silhouette erscheint dann nur, wo die Welt den Helden verdeckt, nicht auf ihm selbst */
const mitStencil = <T extends THREE.Material>(m: T): T => {
  m.stencilWrite = true; m.stencilRef = 1;
  m.stencilFunc = THREE.AlwaysStencilFunc; m.stencilZPass = THREE.ReplaceStencilOp;
  return m;
};
const heldMaterial = mitStencil(solidMaterial.clone());
const heldGlow = mitStencil(glowMaterial.clone());
/** Held nach der Welt zeichnen: Stencil 1 nur auf wirklich sichtbaren Held-Pixeln */
const HELD_REIHE = 5;

const silhouettes = new Map<string, THREE.MeshBasicMaterial>();
/** Durchscheinende Silhouette, wenn der Held hinter Mauern oder Säulen steht. */
function silhouetteMaterial(color: string): THREE.MeshBasicMaterial {
  let m = silhouettes.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6, depthFunc: THREE.GreaterDepth, depthWrite: false, toneMapped: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp
    });
    silhouettes.set(color, m);
  }
  return m;
}

function partMesh(vox: Vox[], pivot: [number, number, number], color: string, size: number): THREE.Group {
  const g = new THREE.Group();
  const { solid, glow } = buildVoxels(vox, size, { origin: pivot, jitter: size < HERO_VOXEL ? 0.03 : 0.05 });
  if (solid) {
    const m = new THREE.Mesh(solid, heldMaterial); m.castShadow = true; m.renderOrder = HELD_REIHE; g.add(m);
    const ghost = new THREE.Mesh(solid, silhouetteMaterial(color));
    ghost.renderOrder = 10;
    g.add(ghost);
  }
  if (glow) { const gm = new THREE.Mesh(glow, heldGlow); gm.renderOrder = HELD_REIHE; g.add(gm); }
  g.position.set(pivot[0] * size, pivot[1] * size, pivot[2] * size);
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
    // feines Modell ab Grafikstufe „Ultra“
    const hd = DETAIL.hd, size = hd ? HERO_VOXEL_HD : HERO_VOXEL;
    const p = hd ? heroPartsHd(body) : heroParts(body);
    this.body = partMesh(p.body, [0, 0, 0], color, size);
    this.legL = partMesh(p.legL, p.pivots.legL, color, size);
    this.legR = partMesh(p.legR, p.pivots.legR, color, size);
    this.armL = partMesh(p.armL, p.pivots.armL, color, size);
    this.armR = partMesh(p.armR, p.pivots.armR, color, size);
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
