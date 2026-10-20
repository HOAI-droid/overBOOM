import * as THREE from 'three';
import { hash2 } from '@overboom/core';

/** Ein Voxel: x, y (oben), z (vorne), Farbe, leuchtend? */
export type Vox = [number, number, number, string, number?];

const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  { n: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { n: [1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { n: [0, -1, 0], c: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }
];

export interface VoxelBuildOptions {
  /** Drehpunkt in Voxel-Einheiten; wird zum Ursprung der Geometrie */
  origin?: [number, number, number];
  /** Helligkeitsrauschen pro Voxel (0 = aus), gibt Textur */
  jitter?: number;
  seed?: number;
  /** Nur diese Flächen erzeugen (z. B. ohne Unterseite) */
  skipBottom?: boolean;
}

export interface VoxelGeometry {
  solid: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
}

const tmp = new THREE.Color();

/** Baut aus Voxeln eine Geometrie; verdeckte Innenflächen werden weggelassen. */
export function buildVoxels(vox: Vox[], size: number, opt: VoxelBuildOptions = {}): VoxelGeometry {
  const [ox, oy, oz] = opt.origin ?? [0, 0, 0];
  const jitter = opt.jitter ?? 0.08;
  const seed = opt.seed ?? 0;
  const occ = new Set<string>();
  for (const v of vox) occ.add(v[0] + ',' + v[1] + ',' + v[2]);

  const buf = [0, 1].map(() => ({ pos: [] as number[], nor: [] as number[], col: [] as number[], idx: [] as number[] }));
  for (const v of vox) {
    const [x, y, z, color, glow] = v;
    const b = buf[glow ? 1 : 0];
    tmp.set(color);
    const f = jitter ? 1 + (hash2(x * 7 + y * 13, z * 11 + y, seed) - 0.5) * 2 * jitter : 1;
    const r = Math.min(1, tmp.r * f), g = Math.min(1, tmp.g * f), bl = Math.min(1, tmp.b * f);
    for (const face of FACES) {
      if (opt.skipBottom && face.n[1] === -1) continue;
      if (occ.has(x + face.n[0] + ',' + (y + face.n[1]) + ',' + (z + face.n[2]))) continue;
      const base = b.pos.length / 3;
      for (const c of face.c) {
        b.pos.push((x + c[0] - ox) * size, (y + c[1] - oy) * size, (z + c[2] - oz) * size);
        b.nor.push(face.n[0], face.n[1], face.n[2]);
        b.col.push(r, g, bl);
      }
      b.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const make = (b: (typeof buf)[number]) => {
    if (!b.idx.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    geo.computeBoundingSphere();
    return geo;
  };
  return { solid: make(buf[0]), glow: make(buf[1]) };
}

export const solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/** Erzeugt ein Mesh-Paar (beleuchtet + leuchtend) als Gruppe. */
export function voxelObject(vox: Vox[], size: number, opt: VoxelBuildOptions = {}, shadows = true): THREE.Group {
  const g = new THREE.Group();
  const { solid, glow } = buildVoxels(vox, size, opt);
  if (solid) {
    const m = new THREE.Mesh(solid, solidMaterial);
    m.castShadow = shadows; m.receiveShadow = true;
    g.add(m);
  }
  if (glow) g.add(new THREE.Mesh(glow, glowMaterial));
  return g;
}

/** Kleiner Baukasten für Voxel-Modelle. */
export class VoxBuilder {
  private m = new Map<string, Vox>();
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string, glow = 0): this {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.m.set(x + ',' + y + ',' + z, [x, y, z, c, glow]);
    return this;
  }
  v(x: number, y: number, z: number, c: string, glow = 0): this {
    this.m.set(x + ',' + y + ',' + z, [x, y, z, c, glow]);
    return this;
  }
  del(x: number, y: number, z: number): this {
    this.m.delete(x + ',' + y + ',' + z);
    return this;
  }
  list(): Vox[] {
    return [...this.m.values()];
  }
}
