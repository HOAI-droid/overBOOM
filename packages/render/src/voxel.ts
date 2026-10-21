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
  /** gleichfarbige Nachbarflächen zu Rechtecken zusammenfassen (weniger Dreiecke, gleiches Bild) */
  greedy?: boolean;
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
  const farbe = (v: Vox): [number, number, number] => {
    const [x, y, z, color] = v;
    tmp.set(color);
    const f = jitter ? 1 + (hash2(x * 7 + y * 13, z * 11 + y, seed) - 0.5) * 2 * jitter : 1;
    return [Math.min(1, tmp.r * f), Math.min(1, tmp.g * f), Math.min(1, tmp.b * f)];
  };
  if (opt.greedy ?? jitter === 0) {
    buildGreedy(vox, occ, farbe, buf, size, ox, oy, oz, !!opt.skipBottom);
  } else for (const v of vox) {
    const [x, y, z, , glow] = v;
    const b = buf[glow ? 1 : 0];
    const [r, g, bl] = farbe(v);
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

type Puffer = { pos: number[]; nor: number[]; col: number[]; idx: number[] };

/**
 * Greedy-Meshing: pro Richtung und Ebene werden sichtbare Flächen gleicher Farbe
 * (und gleichen Leuchtens) zu möglichst großen Rechtecken zusammengefasst.
 */
function buildGreedy(vox: Vox[], occ: Set<string>, farbe: (v: Vox) => [number, number, number], buf: Puffer[],
  size: number, ox: number, oy: number, oz: number, skipBottom: boolean): void {
  const o = [ox, oy, oz];
  const cell = [0, 0, 0];
  for (const face of FACES) {
    if (skipBottom && face.n[1] === -1) continue;
    const ax = face.n[0] ? 0 : face.n[1] ? 1 : 2, u = (ax + 1) % 3, w = (ax + 2) % 3;
    // Ebene → (u,w) → Farbschlüssel + Daten
    const ebenen = new Map<number, Map<string, { k: string; c: [number, number, number]; g: number }>>();
    for (const v of vox) {
      if (occ.has(v[0] + face.n[0] + ',' + (v[1] + face.n[1]) + ',' + (v[2] + face.n[2]))) continue;
      const c = farbe(v), g = v[4] ? 1 : 0;
      let e = ebenen.get(v[ax]);
      if (!e) ebenen.set(v[ax], e = new Map());
      e.set(v[u] + ',' + v[w], { k: c.join(',') + '|' + g, c, g });
    }
    for (const [ebene, e] of ebenen) {
      const fertig = new Set<string>();
      const zellen = [...e.keys()].map((k) => k.split(',').map(Number)).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
      for (const [a, b] of zellen) {
        const k0 = a + ',' + b;
        if (fertig.has(k0)) continue;
        const d = e.get(k0)!;
        const passt = (i: number, j: number) => { const k = i + ',' + j; return !fertig.has(k) && e.get(k)?.k === d.k; };
        let bu = 1;
        while (passt(a + bu, b)) bu++;
        let bw = 1;
        hoch: for (;;) { for (let i = 0; i < bu; i++) if (!passt(a + i, b + bw)) break hoch; bw++; }
        for (let i = 0; i < bu; i++) for (let j = 0; j < bw; j++) fertig.add((a + i) + ',' + (b + j));
        const p = buf[d.g], base = p.pos.length / 3;
        for (const c of face.c) {
          cell[ax] = ebene + c[ax]; cell[u] = a + c[u] * bu; cell[w] = b + c[w] * bw;
          p.pos.push((cell[0] - o[0]) * size, (cell[1] - o[1]) * size, (cell[2] - o[2]) * size);
          p.nor.push(face.n[0], face.n[1], face.n[2]);
          p.col.push(d.c[0], d.c[1], d.c[2]);
        }
        p.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    }
  }
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
