import * as THREE from 'three';
import { Tile, hash2, type Arena, type Prop } from '@overboom/core';
import { buildVoxels, solidMaterial, voxelObject, VoxBuilder } from './voxel.ts';
import { barrel, crystal, hayBale, rubble, torch } from './models.ts';
import { INSELN, type Insel } from '@overboom/data';

const PX = 8; // Texturpixel pro Kachel

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const STYLE_INSEL: Record<string, Insel> = Object.fromEntries(INSELN.map((i) => [i.gefahr, i]));

/** Farbpalette der Insel zu einer Arena */
export function paletteOf(a: Arena): Insel['farben'] {
  return (STYLE_INSEL[a.style] ?? INSELN[INSELN.length - 1]).farben;
}

/** Bodentextur: Platten, Flecken, Lava, Eis, Gift, Tesla-Platten – Pixel für Pixel. */
function floorTextures(a: Arena) {
  const pal = paletteOf(a);
  const S = a.size * PX;
  const color = document.createElement('canvas');
  const glow = document.createElement('canvas');
  color.width = color.height = glow.width = glow.height = S;
  const cg = color.getContext('2d')!, gg = glow.getContext('2d')!;
  const ci = cg.createImageData(S, S), gi = gg.createImageData(S, S);
  const stone = pal.boden.map(rgb);
  const moss = pal.fleck.map(rgb);
  const lava = ['#c2300a', '#ff5a0a', '#ff7a1a', '#ffb02e'].map(rgb);
  const ice = ['#a8e8ff', '#c8f4ff', '#88c8e8', '#e8fcff'].map(rgb);
  const poison = ['#3d8a2a', '#5dbb3a', '#2e6a20', '#7dff5a'].map(rgb);
  const plate = ['#4a5068', '#565c78', '#3e4458'].map(rgb);
  const cyan = rgb('#3de8ff');
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
          } else if (t === Tile.Ice) {
            // Eis: hell mit Glanzstreifen
            c = ice[Math.floor(hash2(gx >> 1, gy >> 1, 6) * ice.length)];
            f = (gx + gy) % 9 === 0 ? 1.15 : 0.95 + n * 0.08;
          } else if (t === Tile.Poison) {
            const w = Math.sin(gx * 0.7 + gy * 0.4) + Math.sin(gx * 0.3 - gy * 0.8);
            c = poison[Math.max(0, Math.min(3, Math.floor((w + 2) * 0.9 + n * 0.5)))];
            f = 1; glowV = 110;
          } else if (t === Tile.Shock) {
            // Metallplatte mit Leiterbahnen (leuchten beim Aufladen extra, siehe shockPlates)
            const line = px === 3 || py === 3 || (px + py) % 7 === 0;
            c = line ? cyan : plate[(px * 3 + py) % plate.length];
            f = line ? 0.7 : 1; glowV = line ? 80 : 0;
          } else if (hash2(gx, gy, 11) > 0.985) {
            f *= 1.35; // kleine Kiesel
          }
          if (glowV && glowV < 255) { gi.data[i] = c[0] * glowV / 255; gi.data[i + 1] = c[1] * glowV / 255; gi.data[i + 2] = c[2] * glowV / 255; gi.data[i + 3] = 255; }
          ci.data[i] = Math.min(255, c[0] * f);
          ci.data[i + 1] = Math.min(255, c[1] * f);
          ci.data[i + 2] = Math.min(255, c[2] * f);
          ci.data[i + 3] = 255;
          if (glowV !== 0 && glowV < 255) continue;
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
  barrels: { group: THREE.Group; prop: Prop }[];
  /** leuchtende Tesla-Platten (Deckkraft = Ladezustand) */
  shock: THREE.MeshBasicMaterial | null;
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
  const pal = paletteOf(a);

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
  const rock = pal.klippe;
  for (let i = 0; i < S; i++) {
    for (const [x, z] of [[i, S - 1], [S - 1, i]] as const) {
      const depth = 2 + Math.floor(hash2(x, z, 21) * 3);
      for (let y = 1; y <= depth; y++) cliff.v(x, -y, z, rock[(x + z + y) % rock.length]);
    }
  }
  const cg = buildVoxels(cliff.list(), 1, { jitter: 0.12, seed: 4 });
  if (cg.solid) {
    // Die zufällig verschobenen Ecken (jitter) dürfen nicht durch den Boden stechen –
    // sonst flackern braune Dreiecke über dem Rasen am Spielfeldrand
    const pos = cg.solid.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > -0.03) pos.setY(i, -0.03);
    pos.needsUpdate = true;
    cg.solid.computeBoundingSphere();
    group.add(new THREE.Mesh(cg.solid, solidMaterial));
  }

  // Mauern, Säulen (Steinquader 0,5) und Kisten (Bretter 0,25)
  const walls = new VoxBuilder();
  const stones = pal.wand;
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
  const barrels: ArenaView['barrels'] = [];
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
      barrels.push({ group: o, prop: p });
    } else if (p.kind === 'heu') {
      const o = voxelObject(hayBale(), 0.11, { origin: [0.5, 0, 0.5], jitter: 0.1 });
      o.position.set(p.x, 0, p.z);
      o.rotation.y = p.seed * 0.7;
      group.add(o);
      barrels.push({ group: o, prop: p });
    } else if (p.kind === 'rubble') {
      const o = voxelObject(rubble(p.seed), 0.16, {}, false);
      o.position.set(p.x, 0, p.z);
      o.rotation.y = p.seed;
      group.add(o);
    }
  }

  // Lava-Glühen
  if (a.style === 'festung' || a.style === 'lava') {
    for (const [x, z] of [[20.5, 5], [21, 9.5], [5, 20.5], [8.5, 21]] as const) {
      const l = new THREE.PointLight('#ff6a1a', 5, 6, 1.6);
      l.position.set(x, 0.8, z);
      group.add(l);
    }
  }

  // Tesla-Platten: Overlay, das beim Aufladen hell wird
  let shock: THREE.MeshBasicMaterial | null = null;
  if (a.style === 'strom') {
    shock = new THREE.MeshBasicMaterial({ color: '#3de8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    let n = 0;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (a.tile(x, z) === Tile.Shock) n++;
    const inst = new THREE.InstancedMesh(plane, shock, n);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (a.tile(x, z) === Tile.Shock) inst.setMatrixAt(k++, m.makeTranslation(x + 0.5, 0.02, z + 0.5));
    group.add(inst);
  }
  return { group, lavaMaterial, torches, crystals, barrels, halos, shock };
}
