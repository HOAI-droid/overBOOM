import * as THREE from 'three';
import { buildVoxels, glowMaterial, type Vox, type VoxelBuildOptions } from './voxel.ts';

/** Material der Schatten-Stellvertreter (werden nie sichtbar gezeichnet) */
const schattenMaterial = new THREE.MeshBasicMaterial();

let flashMat: THREE.MeshLambertMaterial | null = null;

/** Lambert mit Vertex-Farben + Treffer-Blitz pro Instanz (Attribut aFlash: 0 = normal, 1 = weiß). */
export function flashMaterial(): THREE.MeshLambertMaterial {
  if (flashMat) return flashMat;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFlash;\nvarying float vFlash;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = aFlash;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFlash;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), vFlash);');
  };
  m.customProgramCacheKey = () => 'ob-flash';
  flashMat = m;
  return m;
}

/**
 * Viele Kopien eines Voxel-Modells in je einem Draw-Call (beleuchtet + leuchtend).
 * Pro Frame: begin() → push() für jede Instanz → end(). Keine Allokationen.
 */
export class VoxelInstances {
  readonly group = new THREE.Group();
  private solid: THREE.InstancedMesh | null = null;
  private glow: THREE.InstancedMesh | null = null;
  private flash: THREE.InstancedBufferAttribute | null = null;
  /** nur für die Schattenkarte sichtbares, gröberes Modell (Ebene 1) */
  private schatten: THREE.InstancedMesh | null = null;
  private n = 0;

  /**
   * `schatten`: gröberes Modell, das statt des eigentlichen den Schatten wirft
   * (spart bei feinen Modellen die Hälfte der Dreiecke im Schattendurchgang).
   */
  constructor(vox: Vox[], voxelSize: number, readonly capacity: number,
    opt: VoxelBuildOptions & { shadows?: boolean; schatten?: { vox: Vox[]; size: number } } = {}) {
    const { solid, glow } = buildVoxels(vox, voxelSize, opt);
    if (solid) {
      this.flash = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      this.flash.setUsage(THREE.DynamicDrawUsage);
      solid.setAttribute('aFlash', this.flash);
      this.solid = new THREE.InstancedMesh(solid, flashMaterial(), capacity);
      this.solid.castShadow = (opt.shadows ?? true) && !opt.schatten;
      this.solid.receiveShadow = true;
      this.setup(this.solid);
    }
    if (opt.schatten && (opt.shadows ?? true)) {
      // leuchtende Teile zählen hier mit, damit der Schatten keine Löcher hat
      const ganz = opt.schatten.vox.map((v): Vox => [v[0], v[1], v[2], v[3]]);
      const geo = buildVoxels(ganz, opt.schatten.size, { origin: opt.origin, jitter: 0 }).solid;
      if (geo) {
        this.schatten = new THREE.InstancedMesh(geo, schattenMaterial, capacity);
        this.schatten.castShadow = true;
        this.schatten.layers.set(1);
        this.setup(this.schatten);
      }
    }
    if (glow) {
      this.glow = new THREE.InstancedMesh(glow, glowMaterial, capacity);
      this.setup(this.glow);
    }
  }

  private setup(m: THREE.InstancedMesh) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    this.group.add(m);
  }

  begin(): void {
    this.n = 0;
  }

  push(matrix: THREE.Matrix4, flash = 0): void {
    if (this.n >= this.capacity) return;
    this.solid?.setMatrixAt(this.n, matrix);
    this.glow?.setMatrixAt(this.n, matrix);
    this.schatten?.setMatrixAt(this.n, matrix);
    if (this.flash) this.flash.array[this.n] = flash;
    this.n++;
  }

  end(): void {
    for (const m of [this.solid, this.glow, this.schatten]) {
      if (!m) continue;
      m.count = this.n;
      m.instanceMatrix.needsUpdate = true;
    }
    if (this.flash) this.flash.needsUpdate = true;
  }
}
