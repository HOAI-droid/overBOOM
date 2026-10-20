import * as THREE from 'three';
import { Tile, hash2, type Arena } from '@overboom/core';
import { buildVoxels, solidMaterial, voxelObject, VoxBuilder } from './voxel.ts';
import { barrel, crystal, grummel, rubble, torch } from './models.ts';

const PX = 8; // Texturpixel pro Kachel

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Bodentextur: Steinplatten, Moos, Lava – Pixel für Pixel. */
function floorTextures(a: Arena) {
  const S = a.size * PX;
  const color = document.createElement('canvas');
  const glow = document.createElement('canvas');
  color.width = color.height = glow.width = glow.height = S;
  const cg = color.getContext('2d')!, gg = glow.getContext('2d')!;
  const ci = cg.createImageData(S, S), gi = gg.createImageData(S, S);
  const stone = ['#3a2f5c', '#40345f', '#463a68', '#3d3160', '#4b3f6e'].map(rgb);
  const moss = ['#1c4a4c', '#1f5a58', '#23645e'].map(rgb);
  const lava = ['#c2300a', '#ff5a0a', '#ff7a1a', '#ffb02e'].map(rgb);
  for (let tz = 0; tz < a.size; tz++) {
    for (let tx = 0; tx < a.size; tx++) {
      const t = a.tile(tx, tz);
      const base = stone[Math.floor(hash2(tx >> 1, tz >> 1, 3) * stone.length)];
      for (let py = 0; py < PX; py++) {
        for (let px = 0; px < PX; px++) {
          const gx = tx * PX + px, gy = tz * PX + py, i = (gy * S + gx) * 4;
          const n = hash2(gx, gy, 9);
          let c: [number, number, number] = base, f = 0.9 + n * 0.2, glowV = 0;
          // Fugen zwischen den Platten (je 2×2 Kacheln eine Platte)
          const edge = (px === 0 && tx % 2 === 0) || (py === 0 && tz % 2 === 0);
          if (edge) f *= 0.62;
          if (t === Tile.Moss) {
            c = moss[Math.floor(hash2(gx, gy, 4) * moss.length)];
            if (hash2(gx, gy, 5) > 0.82) c = base;
          } else if (t === Tile.Lava) {
            const w = Math.sin(gx * 0.55 + gy * 0.35) + Math.sin(gx * 0.21 - gy * 0.6);
            c = lava[Math.max(0, Math.min(3, Math.floor((w + 2) * 0.9 + n * 0.6)))];
            f = 1; glowV = 255;
          } else if (hash2(gx, gy, 11) > 0.985) {
            f *= 1.35; // kleine Kiesel
          }
          ci.data[i] = Math.min(255, c[0] * f);
          ci.data[i + 1] = Math.min(255, c[1] * f);
          ci.data[i + 2] = Math.min(255, c[2] * f);
          ci.data[i + 3] = 255;
          gi.data[i] = glowV ? c[0] : 0;
          gi.data[i + 1] = glowV ? c[1] : 0;
          gi.data[i + 2] = glowV ? c[2] : 0;
          gi.data[i + 3] = 255;
        }
      }
    }
  }
  cg.putImageData(ci, 0, 0);
  gg.putImageData(gi, 0, 0);
  const mk = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(color, true), emissiveMap: mk(glow, true) };
}

export interface ArenaView {
  group: THREE.Group;
  lavaMaterial: THREE.MeshLambertMaterial;
  torches: { light: THREE.PointLight; x: number; z: number; seed: number }[];
  crystals: { group: THREE.Group; light: THREE.PointLight; seed: number }[];
  grummels: { group: THREE.Group; x: number; z: number; seed: number }[];
  halos: THREE.Sprite[];
}

let haloTex: THREE.Texture | null = null;
export function haloTexture(): THREE.Texture {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  haloTex = new THREE.CanvasTexture(c);
  haloTex.magFilter = THREE.NearestFilter;
  return haloTex;
}

export function makeHalo(color: string, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, toneMapped: false }));
  s.scale.set(size, size, 1);
  return s;
}

export function buildArenaView(a: Arena): ArenaView {
  const group = new THREE.Group();
  const S = a.size;

  // Boden
  const tex = floorTextures(a);
  const lavaMaterial = new THREE.MeshLambertMaterial({ map: tex.map, emissiveMap: tex.emissiveMap, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.6 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), lavaMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(S / 2, 0, S / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // Klippen unter den vorderen Rändern
  const cliff = new VoxBuilder();
  const rock = ['#241b38', '#1f1730', '#2a2142', '#181226'];
  for (let i = 0; i < S; i++) {
    for (const [x, z] of [[i, S - 1], [S - 1, i]] as const) {
      const depth = 2 + Math.floor(hash2(x, z, 21) * 3);
      for (let y = 1; y <= depth; y++) cliff.v(x, -y, z, rock[(x + z + y) % rock.length]);
    }
  }
  const cg = buildVoxels(cliff.list(), 1, { jitter: 0.12, seed: 4 });
  if (cg.solid) group.add(new THREE.Mesh(cg.solid, solidMaterial));

  // Mauern, Säulen (Steinquader 0,5) und Kisten (Bretter 0,25)
  const walls = new VoxBuilder();
  const stones = ['#4b3f6e', '#544777', '#463a66', '#5d4f86', '#4f4273'];
  const crates = new VoxBuilder();
  for (let z = 0; z < S; z++) {
    for (let x = 0; x < S; x++) {
      const t = a.tile(x, z), h = a.height(x, z);
      if (t === Tile.Wall || t === Tile.Pillar) {
        for (let y = 0; y < h * 2; y++) {
          for (let sx = 0; sx < 2; sx++) for (let sz = 0; sz < 2; sz++) {
            const top = y === h * 2 - 1;
            // Zinnen: auf Mauern jede zweite Teilfläche oben weglassen
            if (top && t === Tile.Wall && h < 4 && (sx + sz + x + z) % 2 === 1) continue;
            walls.v(x * 2 + sx, y, z * 2 + sz, stones[Math.floor(hash2(x * 2 + sx, y, z * 2 + sz) * stones.length)]);
          }
        }
      } else if (t === Tile.Crate) {
        for (let y = 0; y < h * 4 - 1; y++) for (let sx = 0; sx < 4; sx++) for (let sz = 0; sz < 4; sz++) {
          const frame = sx === 0 || sx === 3 || sz === 0 || sz === 3 ? (y % 4 === 0 || y % 4 === 2 ? 0.75 : 1) : 1;
          const edge = (sx === 0 || sx === 3) && (sz === 0 || sz === 3);
          crates.v(x * 4 + sx, y, z * 4 + sz, edge ? '#5a3a1e' : frame < 1 ? '#6d4828' : '#8a6038');
        }
      }
    }
  }
  const wg = buildVoxels(walls.list(), 0.5, { jitter: 0.06, seed: 7, skipBottom: true });
  if (wg.solid) { const m = new THREE.Mesh(wg.solid, solidMaterial); m.castShadow = m.receiveShadow = true; group.add(m); }
  const crg = buildVoxels(crates.list(), 0.25, { jitter: 0.08, seed: 9, skipBottom: true });
  if (crg.solid) { const m = new THREE.Mesh(crg.solid, solidMaterial); m.castShadow = m.receiveShadow = true; group.add(m); }

  const torches: ArenaView['torches'] = [];
  const crystals: ArenaView['crystals'] = [];
  const grummels: ArenaView['grummels'] = [];
  const halos: THREE.Sprite[] = [];

  for (const p of a.props) {
    if (p.kind === 'torch') {
      const o = voxelObject(torch(), 0.14, { origin: [0.5, 0, 0.5] }, false);
      o.position.set(p.x, p.y, p.z);
      group.add(o);
      const light = new THREE.PointLight('#ff9a3a', 6, 7, 1.6);
      light.position.set(p.x + 0.6, p.y + 0.8, p.z + 0.6);
      group.add(light);
      const h = makeHalo('#ff9a3a', 1.6);
      h.position.set(p.x, p.y + 0.5, p.z);
      group.add(h); halos.push(h);
      torches.push({ light, x: p.x, z: p.z, seed: p.seed });
    } else if (p.kind === 'crystal') {
      const o = voxelObject(crystal(p.seed), 0.28, { origin: [0.5, 0, 0.5], jitter: 0 }, false);
      o.position.set(p.x, 0, p.z);
      group.add(o);
      const light = new THREE.PointLight('#3de8ff', 5, 6, 1.6);
      light.position.set(p.x, 1.2, p.z);
      group.add(light);
      const h = makeHalo('#3de8ff', 2.2);
      h.position.set(p.x, 0.7, p.z);
      group.add(h); halos.push(h);
      crystals.push({ group: o, light, seed: p.seed });
    } else if (p.kind === 'barrel') {
      const o = voxelObject(barrel(), 0.1, { origin: [0.5, 0, 0.5] });
      o.position.set(p.x, 0, p.z);
      o.rotation.y = p.seed;
      group.add(o);
    } else if (p.kind === 'rubble') {
      const o = voxelObject(rubble(p.seed), 0.16, {}, false);
      o.position.set(p.x, 0, p.z);
      o.rotation.y = p.seed;
      group.add(o);
    } else if (p.kind === 'grummel') {
      const o = voxelObject(grummel(), 0.11, { origin: [0, 0, 0] });
      const holder = new THREE.Group();
      holder.add(o);
      holder.position.set(p.x, 0, p.z);
      group.add(holder);
      grummels.push({ group: holder, x: p.x, z: p.z, seed: p.seed });
    }
  }

  // Lava-Glühen
  for (const [x, z] of [[20.5, 5], [21, 9.5], [5, 20.5], [8.5, 21]] as const) {
    const l = new THREE.PointLight('#ff6a1a', 5, 6, 1.6);
    l.position.set(x, 0.8, z);
    group.add(l);
  }
  return { group, lavaMaterial, torches, crystals, grummels, halos };
}
