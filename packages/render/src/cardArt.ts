import * as THREE from 'three';
import { hash2 } from '@overboom/core';
import { HELD_BY_ID, ITEM_BY_ID, KARTE_BY_ID, SELTENHEIT, W, waffeById, type Karte } from '@overboom/data';
import { buildVoxels, glowMaterial, solidMaterial, VoxBuilder, type Vox } from './voxel.ts';
import { HERO_VOXEL, heroParts, rezeptModell, weaponModel } from './models.ts';
import { ENEMY_MODELS } from './combatView.ts';
import { HD_GEGNER } from './hd/index.ts';

/** Silhouette für noch nicht gefundene Karten */
const silhouette = new THREE.MeshBasicMaterial({ color: '#3d2f6e' });

/** Prozedurales Item-Modell: Form nach ID, Farbe nach Seltenheit */
function itemModel(id: string): Vox[] {
  const it = ITEM_BY_ID[id];
  const rare = SELTENHEIT[(it?.seltenheit ?? 1) - 1].farbe;
  const h = (k: number) => hash2(id.length * 13 + id.charCodeAt(0), id.charCodeAt(id.length - 1) + k, 7);
  const farben = ['#ff7a1a', '#3de8ff', '#ff3df0', '#7dff5a', '#ffd23f', '#ff3d6a', '#c9bfe8'];
  const main = farben[Math.floor(h(1) * farben.length)];
  const b = new VoxBuilder();
  switch (Math.floor(h(2) * 6)) {
    case 0: // Trank
      b.box(-2, 2, 0, 3, -2, 2, '#c8e8f0').box(-1, 1, 1, 3, -1, 1, main, 1).box(-1, 1, 4, 5, -1, 1, '#c8e8f0').box(-1, 1, 6, 6, -1, 1, '#8a5a3a');
      break;
    case 1: // Truhe
      b.box(-3, 3, 0, 3, -2, 2, '#8a5a3a').box(-3, 3, 4, 5, -2, 2, '#6b4b2e').box(-3, 3, 3, 3, -2, 2, rare).v(0, 3, 3, '#ffd23f', 1);
      break;
    case 2: // Kugel / Edelstein
      for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) if (Math.abs(x) + Math.abs(y) + Math.abs(z) <= 4) b.v(x, y + 4, z, main, y > 0 ? 1 : 0);
      break;
    case 3: // Zahnrad
      for (let a = 0; a < 16; a++) {
        const r = a % 2 ? 4 : 3;
        for (let k = 2; k <= r; k++) b.v(Math.round(Math.cos(a / 16 * Math.PI * 2) * k), Math.round(Math.sin(a / 16 * Math.PI * 2) * k) + 4, 0, '#9aa3b5');
      }
      b.box(-1, 1, 3, 5, -1, 1, main, 1);
      break;
    case 4: // Münze / Medaille
      for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (x * x + y * y <= 10) b.v(x, y + 4, 0, x * x + y * y <= 3 ? main : '#ffd23f', x * x + y * y <= 3 ? 1 : 0);
      b.box(-1, 1, 8, 9, 0, 0, rare);
      break;
    default: // Paket mit Schleife
      b.box(-3, 3, 0, 5, -3, 3, main).box(0, 0, 0, 6, -3, 3, rare).box(-3, 3, 0, 6, 0, 0, rare).v(-1, 7, 0, rare).v(1, 7, 0, rare);
  }
  return b.list();
}

/** Voxel und Größe des Artworks zu einer Karte */
function modellTeile(k: Karte): { teile: { vox: Vox[]; pivot?: [number, number, number] }[]; size: number } {
  switch (k.art) {
    case 'held': {
      const p = heroParts(HELD_BY_ID[k.ref]?.farbe ?? '#3de8ff');
      return {
        size: HERO_VOXEL,
        teile: [{ vox: p.body }, { vox: p.legL }, { vox: p.legR }, { vox: p.armL }, { vox: p.armR }]
      };
    }
    case 'waffe': {
      const w = W[k.ref];
      return { size: 0.07, teile: [{ vox: weaponModel(k.ref, w?.gruppe, SELTENHEIT[k.seltenheit - 1].farbe) }] };
    }
    case 'rezept': {
      const w = waffeById(`rezept:${k.ref}`);
      const f = w?.fusion;
      const vox = f && w ? rezeptModell(k.ref, f.teile.antrieb, W[f.teile.antrieb]?.gruppe ?? w.gruppe, w.geschoss, w.ladung, f.instabil) : weaponModel('pistole');
      return { size: 0.08, teile: [{ vox }] };
    }
    case 'gegner':
    case 'boss': {
      // Karten zeigen immer das feine Modell (falls vorhanden)
      const m = HD_GEGNER[k.ref] ?? ENEMY_MODELS[k.ref];
      return { size: m?.size ?? 0.1, teile: [{ vox: m ? m.vox() : [] }] };
    }
    case 'item':
      return { size: 0.08, teile: [{ vox: itemModel(k.ref) }] };
  }
}

/**
 * Rendert die Voxel-Artworks der Sammelkarten: Vorschaubilder (gecacht) und
 * eine drehbare Live-Ansicht für die Großansicht. Eigener kleiner WebGL-Kontext.
 */
export class CardArt {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private holder = new THREE.Group();
  private cache = new Map<string, string>();
  private liveId = '';
  private liveLocked = false;
  private box = new THREE.Box3();
  private size = new THREE.Vector3();
  private center = new THREE.Vector3();

  constructor(private res = 96) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = res;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight('#d8ccff', '#3a2050', 2.6));
    const sun = new THREE.DirectionalLight('#fff2dc', 2.4);
    sun.position.set(-3, 5, 4);
    this.scene.add(sun, this.holder);
    this.camera.position.set(0, 1.2, 6);
    this.camera.lookAt(0, 0, 0);
  }

  private build(k: Karte, locked: boolean): void {
    for (const c of [...this.holder.children]) {
      this.holder.remove(c);
      c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    }
    const { teile, size } = modellTeile(k);
    const g = new THREE.Group();
    for (const t of teile) {
      const { solid, glow } = buildVoxels(t.vox, size, { jitter: 0.05 });
      if (solid) g.add(new THREE.Mesh(solid, locked ? silhouette : solidMaterial));
      if (glow) g.add(new THREE.Mesh(glow, locked ? silhouette : glowMaterial));
    }
    // Einpassen: Mitte auf den Ursprung, Kamera passend zoomen
    this.box.setFromObject(g);
    this.box.getCenter(this.center);
    this.box.getSize(this.size);
    g.position.sub(this.center);
    this.holder.add(g);
    const r = Math.max(this.size.x, this.size.y, this.size.z) * 0.62 || 1;
    Object.assign(this.camera, { left: -r, right: r, top: r, bottom: -r });
    this.camera.updateProjectionMatrix();
  }

  private draw(angle: number): void {
    this.holder.rotation.set(0, angle, 0);
    this.renderer.render(this.scene, this.camera);
  }

  /** Vorschaubild als Data-URL (gecacht) */
  thumb(k: Karte, locked: boolean): string {
    const key = k.id + (locked ? ':x' : '');
    let url = this.cache.get(key);
    if (!url) {
      this.build(k, locked);
      this.draw(-0.6);
      url = this.canvas.toDataURL();
      this.cache.set(key, url);
      // Live-Ansicht wiederherstellen
      const live = this.liveId && KARTE_BY_ID[this.liveId];
      if (live) this.build(live, this.liveLocked);
    }
    return url;
  }

  /** schon im Cache? (für schrittweises Erzeugen) */
  hasThumb(k: Karte, locked: boolean): boolean {
    return this.cache.has(k.id + (locked ? ':x' : ''));
  }

  /** Live-Ansicht: Modell wählen; `update` dreht es */
  live(k: Karte, locked: boolean): void {
    this.liveId = k.id;
    this.liveLocked = locked;
    this.build(k, locked);
  }

  update(time: number): void {
    if (!this.liveId) return;
    this.draw(-0.6 + Math.sin(time * 0.9) * 0.9);
  }

  get liveKarte(): string { return this.liveId; }
  get liveGesperrt(): boolean { return this.liveLocked; }
}
