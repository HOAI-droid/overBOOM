import * as THREE from 'three';
import type { Player, SimEvent, World } from '@overboom/core';
import { buildArenaView, type ArenaView } from './arenaView.ts';
import { HeroView } from './heroView.ts';
import { Effects } from './effects.ts';

export interface RenderOptions {
  /** Pixel auf der kurzen Bildschirmseite (Low-Res-Look). 270 = Standard */
  internalShort?: number;
  /** sichtbare Welteinheiten auf der kurzen Seite */
  viewShort?: number;
  shadows?: boolean;
}

export interface PlayerPose { x: number; z: number; facing: number }

const ELEVATION = THREE.MathUtils.degToRad(38);
const AZIMUTH = Math.PI / 4;

/**
 * Low-Res-Voxel-Renderer: Szene wird in ein kleines Render-Target gezeichnet
 * und mit Nearest-Neighbor hochskaliert. Die Kamera rastet auf Texel ein;
 * der Rest wird beim Hochskalieren als Subpixel-Versatz ausgeglichen.
 */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera();
  private rt: THREE.WebGLRenderTarget;
  private post: { scene: THREE.Scene; cam: THREE.OrthographicCamera; mat: THREE.ShaderMaterial };
  private sun: THREE.DirectionalLight;
  private arena: ArenaView;
  private heroes: HeroView[] = [];
  private effects = new Effects();
  private camTarget = new THREE.Vector3();
  private camDir = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
  private iw = 480;
  private ih = 270;
  private wpp = 1;
  private shake = 0;
  private rngState = 12345;
  private opt: Required<RenderOptions>;

  constructor(canvas: HTMLCanvasElement, private world: World, opt: RenderOptions = {}) {
    this.opt = { internalShort: opt.internalShort ?? 270, viewShort: opt.viewShort ?? 11, shadows: opt.shadows ?? true };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = this.opt.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor('#0b0814');

    this.rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uInner: { value: new THREE.Vector2(1, 1) },
        uFull: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 uInner; uniform vec2 uFull; uniform vec2 uOffset;
        varying vec2 vUv;
        void main(){
          vec2 p = (vUv * uInner + 1.0 + uOffset) / uFull;
          vec3 c = texture2D(tDiffuse, p).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, 1.15);
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * 0.85;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false
    });
    const ps = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    ps.add(quad);
    this.post = { scene: ps, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };

    // Licht: violetter Himmel, warme Sonne von hinten links
    this.scene.add(new THREE.HemisphereLight('#b0a2f0', '#3a2050', 2.2));
    this.sun = new THREE.DirectionalLight('#ffe6c8', 3.2);
    this.sun.castShadow = this.opt.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 0.5; sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.arena = buildArenaView(world.arena);
    this.scene.add(this.arena.group, this.effects.group);
    for (const p of world.players) this.addHero(p);

    const sp = world.players[0] ?? { x: world.arena.spawn.x, z: world.arena.spawn.z };
    this.camTarget.set(sp.x, 0, sp.z);
  }

  private addHero(p: Player) {
    const h = new HeroView(p.color);
    this.heroes[p.id] = h;
    this.scene.add(h.root);
  }

  private rnd = () => {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  };

  resize(width: number, height: number, dpr: number): void {
    this.renderer.setPixelRatio(Math.min(2, dpr));
    this.renderer.setSize(width, height, false);
    const aspect = width / height, s = this.opt.internalShort;
    if (aspect >= 1) { this.ih = s; this.iw = Math.round(s * aspect); }
    else { this.iw = s; this.ih = Math.round(s / aspect); }
    this.wpp = this.opt.viewShort / s;
    this.rt.setSize(this.iw + 2, this.ih + 2);
    this.post.mat.uniforms.uInner.value.set(this.iw, this.ih);
    this.post.mat.uniforms.uFull.value.set(this.iw + 2, this.ih + 2);
    const hw = ((this.iw + 2) / 2) * this.wpp, hh = ((this.ih + 2) / 2) * this.wpp;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh, near: 0.1, far: 200 });
    this.camera.updateProjectionMatrix();
  }

  get internalSize() { return { w: this.iw, h: this.ih }; }

  handleEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'dash') { this.effects.dash(e.x, e.z, e.dirX, e.dirZ, this.rnd); this.heroes[e.player]?.punch(0.35); this.shake = Math.max(this.shake, 0.08); }
      else if (e.type === 'step') this.effects.step(e.x, e.z, this.rnd);
      else if (e.type === 'bump') { this.effects.bump(e.x, e.z, this.rnd); this.heroes[e.player]?.punch(0.5); this.shake = Math.max(this.shake, 0.22); }
    }
  }

  render(prev: readonly PlayerPose[], players: readonly Player[], alpha: number, dt: number, time: number): void {
    let focus: { x: number; z: number; vx: number; vz: number } | null = null;
    for (const p of players) {
      if (!this.heroes[p.id]) this.addHero(p);
      const a = prev[p.id] ?? p;
      const x = a.x + (p.x - a.x) * alpha, z = a.z + (p.z - a.z) * alpha;
      let df = p.facing - a.facing;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      this.heroes[p.id].update(x, z, a.facing + df * alpha, Math.hypot(p.vx, p.vz), p.stride, p.dashTime > 0, time, dt);
      if (!focus) focus = { x, z, vx: p.vx, vz: p.vz };
    }

    // Kamera folgt mit Vorausblick in Laufrichtung
    if (focus) {
      const look = 0.22;
      const tx = focus.x + Math.max(-1.2, Math.min(1.2, focus.vx * look));
      const tz = focus.z + Math.max(-1.2, Math.min(1.2, focus.vz * look));
      const k = 1 - Math.pow(0.004, dt);
      this.camTarget.x += (tx - this.camTarget.x) * k;
      this.camTarget.z += (tz - this.camTarget.z) * k;
    }
    this.shake *= Math.pow(0.002, dt);
    const sx = (this.rnd() - 0.5) * this.shake, sz = (this.rnd() - 0.5) * this.shake;
    const target = new THREE.Vector3(this.camTarget.x + sx, 0, this.camTarget.z + sz);
    const pos = target.clone().addScaledVector(this.camDir, 40);
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();

    // Auf Texel einrasten, Rest als Subpixel-Versatz an den Hochskalierer geben
    const R = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const U = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const pr = pos.dot(R), pu = pos.dot(U);
    const dr = Math.round(pr / this.wpp) * this.wpp - pr, du = Math.round(pu / this.wpp) * this.wpp - pu;
    this.camera.position.addScaledVector(R, dr).addScaledVector(U, du);
    this.camera.updateMatrixWorld();
    this.post.mat.uniforms.uOffset.value.set(-dr / this.wpp, -du / this.wpp);

    // Sonne + Schatten folgen der Kamera
    this.sun.position.set(target.x - 7, 14, target.z - 3);
    this.sun.target.position.copy(target);

    // Lebendige Welt
    for (const t of this.arena.torches) t.light.intensity = 5 + Math.sin(time * 11 + t.seed) * 0.8 + Math.sin(time * 23 + t.seed * 3) * 0.6;
    for (const c of this.arena.crystals) { c.light.intensity = 4.5 + Math.sin(time * 2 + c.seed) * 1.2; c.group.position.y = Math.sin(time * 1.6 + c.seed) * 0.03; }
    for (const h of this.arena.halos) (h.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(time * 9 + h.id) * 0.08;
    this.arena.lavaMaterial.emissiveIntensity = 0.55 + Math.sin(time * 2.2) * 0.12;
    const hero = players[0];
    for (const g of this.arena.grummels) {
      const bob = Math.abs(Math.sin(time * 3 + g.seed)) * 0.12;
      g.group.position.y = bob;
      if (hero) {
        const want = Math.atan2(hero.x - g.x, hero.z - g.z);
        let d = want - g.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        g.group.rotation.y += d * Math.min(1, dt * 3);
      }
    }
    this.effects.update(dt);

    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.cam);
  }
}
