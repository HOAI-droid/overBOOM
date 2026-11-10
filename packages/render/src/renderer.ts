import * as THREE from 'three';
import { DETAIL } from './hd/index.ts';
import type { Player, SimEvent, World } from '@overboom/core';
import { buildArenaView, paletteOf, type ArenaView } from './arenaView.ts';
import { HELD_BY_ID, KOOP } from '@overboom/data';
import type { Arena } from '@overboom/core';
import { HeroView } from './heroView.ts';
import { Effects, FX } from './effects.ts';
import { CombatView } from './combatView.ts';
import { ENEMY_DEBRIS, shotColor } from './models.ts';
import { WorldMapView, type MapState } from './worldMap.ts';
import { Atmosphaere, LOOK } from './atmosphaere.ts';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GodrayPass } from './godrays.ts';

export interface RenderOptions {
  /** Pixel auf der kurzen Bildschirmseite (Low-Res-Look). 270 = Standard */
  internalShort?: number;
  /** sichtbare Welteinheiten auf der kurzen Seite */
  viewShort?: number;
  shadows?: boolean;
  /** Stärke des Screen-Shakes (0 = aus, 1 = normal) – Barrierefreiheit */
  shake?: number;
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
  /** Fülllicht aus Kamerarichtung: Gesichter und Vorderseiten liegen sonst im Schatten */
  private front: THREE.DirectionalLight;
  private arena: ArenaView;
  private arenaSrc: Arena;
  private hemi: THREE.HemisphereLight;
  private heroKeys: string[] = [];
  private heroes: HeroView[] = [];
  private effects: Effects;
  private combat: CombatView;
  private camTarget = new THREE.Vector3();
  private camDir = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
  private iw = 480;
  private ih = 270;
  private wpp = 1;
  private shake = 0;
  private rngState = 12345;
  private clock = 0;
  private lastStop = -1;
  /** Gewöhnung ans Wackeln: steigt mit jeder Explosion, klingt in ~1 s ab (Dauerfeuer wackelt kaum) */
  private unruhe = 0;
  private cssW = 1;
  private cssH = 1;
  private offX = 0;
  private offY = 0;
  private tmpV = new THREE.Vector3();
  private heroPos: { x: number; z: number; visible: boolean }[] = [];
  private opt: Required<RenderOptions>;
  private map: WorldMapView | null = null;
  /** eigener Spieler (Kamera folgt ihm) */
  local = 0;
  /** Koop-Zoom: 1 = normal, größer = weiter weg */
  private zoom = 1;
  private zoomTarget = 1;
  private mapShown = false;
  private ndc = { x: 0, y: 0 };

  private world: World;
  /** neuer Look: Nachbearbeitung (Umgebungsverdeckung, Leuchten, Farbe) und Atmosphäre */
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  private godrays: GodrayPass | null = null;
  private tiltH: ShaderPass | null = null;
  private tiltV: ShaderPass | null = null;
  private atmo: Atmosphaere | null = null;

  constructor(canvas: HTMLCanvasElement, world: World, opt: RenderOptions = {}) {
    this.world = world;
    this.opt = { internalShort: opt.internalShort ?? 270, viewShort: opt.viewShort ?? 11.5, shadows: opt.shadows ?? true, shake: opt.shake ?? 1 };
    this.effects = new Effects(this.rnd);
    this.combat = new CombatView(world, this.effects);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = this.opt.shadows;
    // neuer Look: weich auslaufende Schattenränder (PCF mit Radius; ?sm=soft zum Vergleich)
    const smArt = new URLSearchParams(location.search).get('sm');
    this.renderer.shadowMap.type = LOOK.neu ? (smArt === 'soft' ? THREE.PCFSoftShadowMap : smArt === 'vsm' ? THREE.VSMShadowMap : THREE.PCFShadowMap) : THREE.PCFShadowMap;
    this.renderer.setClearColor('#0b0814');
    if (LOOK.neu) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    }

    this.rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: true });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    // Stencil-Puffer: Held-Silhouette nur hinter Mauern

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
    this.hemi = new THREE.HemisphereLight('#b0a2f0', '#3a2050', 2.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe6c8', 3.2);
    this.sun.castShadow = this.opt.shadows;
    const smGr = LOOK.neu ? Number(new URLSearchParams(location.search).get('smap')) || 2048 : 1024;
    this.sun.shadow.mapSize.set(smGr, smGr);

    const sc = this.sun.shadow.camera;
    sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 0.5; sc.far = 60;
    // Ebene 1: unsichtbare Schatten-Stellvertreter (kleine Modelle für die feinen Gegner)
    sc.layers.enable(1);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.front = new THREE.DirectionalLight('#fff4e8', 0.95);
    this.front.castShadow = false;
    this.scene.add(this.front, this.front.target);
    if (LOOK.neu) {
      // kräftige Schatten mit weichem Rand (VSM: Radius = Weichheit)
      this.sun.shadow.radius = Number(new URLSearchParams(location.search).get('smr')) || 7; this.sun.shadow.blurSamples = 12; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.02;
      this.sun.shadow.intensity = 1; this.sun.intensity = 3.6;
      const qq = new URLSearchParams(location.search);
      this.hemi.intensity = Number(qq.get('hemi')) || 0.9; this.front.intensity = Number(qq.get('front')) || 0.35;
      if (qq.get('exp')) this.renderer.toneMappingExposure = Number(qq.get('exp'));
      this.atmo = new Atmosphaere();
      this.scene.add(this.atmo.group);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtao = new GTAOPass(this.scene, this.camera, 4, 4);
      this.gtao.blendIntensity = 1.0;
      this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
      const q = new URLSearchParams(location.search);
      this.gtao.enabled = q.get('gtao') !== '0';
      this.composer.addPass(this.gtao);
      if (q.get('tm') === '0') this.renderer.toneMapping = THREE.NoToneMapping;
      this.godrays = new GodrayPass(this.camera, this.sun);
      this.godrays.enabled = q.get('rays') !== '0';
      this.composer.addPass(this.godrays);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.45, 0.5, 0.92);
      this.bloom.enabled = q.get('bloom') !== '0';
      this.composer.addPass(this.bloom);
      this.grade = new ShaderPass(new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Color('#ffd9a8') }, uRes: { value: new THREE.Vector2(1, 1) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform sampler2D tDiffuse; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            // warme Lichter, kühle Schatten, Vignette
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(c, c * uTint, smoothstep(0.3, 1.0, l) * 0.35);
            c = mix(c, c * vec3(0.85, 0.9, 1.1), (1.0 - smoothstep(0.0, 0.4, l)) * 0.3);
            c = mix(vec3(l), c, 1.12);
            vec2 q = vUv - 0.5;
            c *= 1.0 - dot(q, q) * 0.55;
            gl_FragColor = vec4(c, 1.0);
          }`
      }));
      this.composer.addPass(this.grade);
      // Tilt-Shift: Schärfe nur in einem Band um die Bildmitte, oben und unten weich (zwei Richtungen)
      const tilt = (richtung: [number, number]) => new ShaderPass(new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uDir: { value: new THREE.Vector2(...richtung) }, uStaerke: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform sampler2D tDiffuse; uniform vec2 uRes, uDir; uniform float uStaerke; varying vec2 vUv;
          void main(){
            float d = abs(vUv.y - 0.5) * 2.0;
            // ab 35 % vom Zentrum beginnt die Unschärfe, am Rand bis zu 7 Pixel (bei 900p)
            float r = smoothstep(0.35, 1.0, d) * uStaerke * uRes.y / 130.0;
            vec2 step = uDir * r / uRes;
            vec3 c = vec3(0.0); float ws = 0.0;
            for (int i = -4; i <= 4; i++) {
              float w = exp(-float(i * i) / 6.0);
              c += texture2D(tDiffuse, vUv + step * float(i)).rgb * w; ws += w;
            }
            gl_FragColor = vec4(c / ws, 1.0);
          }`
      }));
      this.tiltH = tilt([1, 0]); this.tiltV = tilt([0, 1]);
      const ts = q.get('tilt');
      for (const t of [this.tiltH, this.tiltV]) { t.enabled = ts !== '0'; if (ts) t.uniforms.uStaerke.value = Number(ts) || 1; }
      this.composer.addPass(this.tiltH);
      this.composer.addPass(this.tiltV);
      this.composer.addPass(new OutputPass());
    }

    this.arenaSrc = world.arena;
    this.arena = buildArenaView(world.arena);
    this.scene.add(this.arena.group, this.effects.group, this.combat.group);
    this.applyPalette();
    this.atmo?.build(world.arena, paletteOf(world.arena));
    for (const p of world.players) this.addHero(p);

    const sp = world.players[0] ?? { x: world.arena.spawn.x, z: world.arena.spawn.z };
    this.camTarget.set(sp.x, 0, sp.z);
  }

  private addHero(p: Player) {
    const old = this.heroes[p.id];
    if (old) this.scene.remove(old.root);
    const h = new HeroView(p.color, HELD_BY_ID[p.held]?.farbe ?? p.color);
    this.heroes[p.id] = h;
    this.heroKeys[p.id] = p.held;
    this.scene.add(h.root);
  }

  /** Licht und Himmel nach Inselpalette */
  private applyPalette(): void {
    const pal = paletteOf(this.world.arena);
    this.hemi.color.set(pal.himmel);
    this.sun.color.set(pal.sonne);
    this.renderer.setClearColor(pal.nebel);
    if (LOOK.neu) {
      // Himmel als Verlauf hinter allem, Bodenlicht warm von unten
      this.hemi.groundColor.set(new THREE.Color(pal.nebel).lerp(new THREE.Color(pal.sonne), 0.35));
      this.scene.background = himmelTextur(pal.himmel, pal.nebel);
      this.godrays?.setSonne(new THREE.Color(pal.sonne));
    }
  }

  /** Andere Welt anzeigen (Koop-Start, Spiegelwelt) */
  setWorld(w: World): void {
    if (w === this.world) return;
    this.world = w;
    this.combat.setWorld(w);
    for (const h of this.heroes) if (h) this.scene.remove(h.root);
    this.heroes = [];
    this.heroKeys = [];
    this.rebuildArena();
  }

  /** Insel gewechselt: Arena neu aufbauen */
  private rebuildArena(): void {
    this.scene.remove(this.arena.group);
    this.arena.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial && o.material.map) { o.material.map.dispose(); o.material.emissiveMap?.dispose(); o.material.dispose(); }
    });
    this.arena = buildArenaView(this.world.arena);
    this.arenaSrc = this.world.arena;
    this.scene.add(this.arena.group);
    this.applyPalette();
    this.atmo?.build(this.world.arena, paletteOf(this.world.arena));
  }

  private rnd = () => {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  };

  private dpr = 1;

  resize(width: number, height: number, dpr: number): void {
    this.dpr = dpr;
    this.renderer.setPixelRatio(Math.min(2, dpr));
    this.renderer.setSize(width, height, false);
    this.cssW = width; this.cssH = height;
    const aspect = width / height, s = this.opt.internalShort;
    if (aspect >= 1) { this.ih = s; this.iw = Math.round(s * aspect); }
    else { this.iw = s; this.ih = Math.round(s / aspect); }
    this.rt.setSize(this.iw + 2, this.ih + 2);
    if (this.composer) {
      const pr = Math.min(2, dpr);
      this.composer.setSize(width, height);
      this.composer.setPixelRatio(pr);
      this.gtao?.setSize(width * pr, height * pr);
      this.godrays?.setSize(width * pr, height * pr);
      this.bloom?.setSize(width * pr, height * pr);
      this.grade?.uniforms.uRes.value.set(width * pr, height * pr);
      this.tiltH?.uniforms.uRes.value.set(width * pr, height * pr);
      this.tiltV?.uniforms.uRes.value.set(width * pr, height * pr);
    }
    this.post.mat.uniforms.uInner.value.set(this.iw, this.ih);
    this.post.mat.uniforms.uFull.value.set(this.iw + 2, this.ih + 2);
    this.applyFrustum();
  }

  private applyFrustum(): void {
    this.wpp = (this.opt.viewShort * this.zoom) / this.opt.internalShort;
    const hw = ((this.iw + 2) / 2) * this.wpp, hh = ((this.ih + 2) / 2) * this.wpp;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh, near: 0.1, far: 200 });
    this.camera.updateProjectionMatrix();
  }

  get internalSize() { return { w: this.iw, h: this.ih }; }

  /** Einstellungen live ändern */
  setShake(v: number): void { this.opt.shake = Math.max(0, Math.min(2, v)); }
  setShadows(on: boolean): void {
    if (this.opt.shadows === on) return;
    this.opt.shadows = on;
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    // Materialien müssen neu übersetzt werden
    this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
  }
  /** Render-Auflösung (kurze Bildseite in Pixeln) */
  setResolution(short: number): void {
    const s = Math.max(144, Math.min(720, Math.round(short)));
    if (s === this.opt.internalShort) return;
    this.opt.internalShort = s;
    this.resize(this.cssW, this.cssH, this.dpr);
  }
  get resolution(): number { return this.opt.internalShort; }
  /** Detailstufe: feine Modelle (true) oder kleine; baut Gegner und Helden neu */
  setDetail(hd: boolean): void {
    if (DETAIL.hd === hd) return;
    DETAIL.hd = hd;
    this.combat.setDetail();
    for (const h of this.heroes) if (h) this.scene.remove(h.root);
    this.heroes = [];
    this.heroKeys = [];
  }
  get detail(): boolean { return DETAIL.hd; }

  /**
   * Erzeugt Effekte aus den Simulations-Ereignissen eines Ticks.
   * Rückgabe: gewünschter Hit-Stop in Sekunden (0 = keiner).
   */
  handleEvents(events: readonly SimEvent[]): number {
    const fx = this.effects;
    let stop = 0;
    // Wackeln addiert sich kaum: der stärkste Stoß zählt, Wiederholungen nur ein wenig
    const kick = (amount: number) => { this.shake = Math.min(0.45, Math.max(this.shake, amount) + amount * 0.05); };
    // Hit-Stop: wichtig = Tod, Nuke, Bossphase (immer); sonst höchstens alle 0,6 s
    const halt = (t: number, wichtig = false) => {
      if (!wichtig && this.clock - this.lastStop < 0.6) return;
      stop = Math.max(stop, t);
      this.lastStop = wichtig ? -1 : this.clock;
    };
    for (const e of events) {
      switch (e.type) {
        case 'dash': fx.dash(e.x, e.z, e.dirX, e.dirZ); this.heroes[e.player]?.punch(0.35); kick(0.03); break;
        case 'step': fx.step(e.x, e.z); break;
        case 'bump': fx.bump(e.x, e.z); this.heroes[e.player]?.punch(0.5); kick(0.1); break;
        case 'fire': {
          if (e.slot < 0) { fx.muzzle(e.x, 0.9, e.z, e.dirX, e.dirZ, 0xffe28a); break; }
          const m = this.combat.muzzle(e.player, e.slot, this.tmpV);
          const color = e.weapon === 'raketenwerfer' ? 0xff9a3a : e.weapon === 'teslastab' ? 0x3de8ff : e.weapon.includes(':') ? 0xff3df0 : 0xffe28a;
          fx.muzzle(m.x, m.y, m.z, e.dirX, e.dirZ, color);
          this.combat.kick(e.player, e.slot);
          break;
        }
        case 'hit': fx.hit(e.x, e.y, e.z, e.crit); break;
        case 'kill': fx.burst(e.x, e.z, ENEMY_DEBRIS[e.enemy] ?? ENEMY_DEBRIS.grummelbold); break;
        case 'explosion': {
          const wave = e.source === 'welle';
          fx.explosion(e.x, e.z, e.r, wave, e.chain);
          // kleine Explosionen wackeln kaum, große spürbar; viele hintereinander gewöhnen ab
          const gross = Math.max(0, e.r - 1.5);
          kick((0.03 + gross * 0.07) * (wave ? 0.4 : 1) / (1 + this.unruhe));
          this.unruhe = Math.min(6, this.unruhe + (wave ? 0.2 : 0.5));
          // Hit-Stop nur bei großen Momenten (lange Kette oder sehr großer Knall)
          if (!wave && (e.chain >= 3 || e.r >= 4)) halt(0.06);
          break;
        }
        case 'zap': fx.zap(e.pts); kick(0.02); break;
        case 'spark': fx.spark(e.x, e.y, e.z, e.hostile); break;
        case 'spawn': fx.spawn(e.x, e.z); break;
        case 'windup': fx.windup(e.x, e.z, e.enemy === 'toastomat' ? 0xff2a4a : 0xff7a1a); break;
        case 'enemyShot': fx.muzzle(e.x, 0.8, e.z, 0, 0, 0xff7a1a); break;
        case 'pickup': fx.pickup(e.x, e.z); break;
        case 'hurt': fx.hurt(e.x, e.z); this.heroes[e.player]?.punch(0.6); kick(0.25); halt(0.08); break;
        case 'death': fx.explosion(e.x, e.z, 2.4); kick(0.45); halt(0.2, true); break;
        case 'waveClear': kick(0.1); break;
        case 'levelUp': fx.levelUp(e.x, e.z); break;
        case 'enemyHeal': fx.enemyHeal(e.x, e.z, e.r); break;
        case 'block': fx.block(e.x, e.z); break;
        case 'split': fx.burst(e.x, e.z, ENEMY_DEBRIS.schleimi); break;
        case 'keks': fx.keks(e.x, e.z); break;
        case 'reaction': fx.reaction(e.x, e.z, e.farbe); kick(0.04 / (1 + this.unruhe)); break;
        case 'nova': fx.reaction(e.x, e.z, e.farbe); break;
        case 'overboom': fx.nuke(e.x, e.z); kick(0.3); break;
        case 'nuke': fx.nuke(e.x, e.z); kick(0.4); halt(0.12, true); break;
        case 'storm': fx.storm(e.x, e.z); kick(0.08); break;
        case 'shock': if (e.phase === 'entladen') { fx.shock(this.world.arena); kick(0.15); } break;
        case 'beam': fx.beam(e.x, e.z, e.x2, e.z2, shotColor(e.geschoss)); break;
        case 'cone': fx.cone(e.x, e.z, e.dirX, e.dirZ, e.range, shotColor(e.geschoss), e.geschoss === 'flamme'); break;
        case 'swing': fx.swing(e.x, e.z, e.dirX, e.dirZ, e.range, shotColor(e.geschoss)); kick(0.015); break;
        case 'teleport': fx.teleport(e.x, e.z, shotColor(e.geschoss)); break;
        case 'kawumm': kick(0.12); break;
        case 'fusion': fx.fusion(e.x, e.z, !!e.rezept); break;
        case 'evolve': fx.fusion(e.x, e.z, true); break;
        case 'star': fx.levelUp(e.x, e.z); break;
        case 'heal': fx.heal(e.x, e.z); break;
        case 'dodge': fx.dodge(e.x, e.z); break;
        case 'bossSpawn': fx.explosion(e.x, e.z, 2.5, true); kick(0.45); break;
        case 'telegraph': fx.telegraph(e.x, e.z, e.r, e.t, e.art); break;
        case 'arenaBricht': kick(0.8); break;
        case 'bossPhase': fx.explosion(e.x, e.z, 2, true); kick(0.35); halt(0.15, true); break;
      }
    }
    return stop;
  }

  /** Weltpunkt → CSS-Pixel im Canvas (für Schadenszahlen und Beschriftungen). */
  project(x: number, y: number, z: number, out: { x: number; y: number }): { x: number; y: number } {
    const v = this.tmpV.set(x, y, z).project(this.camera);
    const rx = (v.x * 0.5 + 0.5) * (this.iw + 2), ry = (v.y * 0.5 + 0.5) * (this.ih + 2);
    out.x = ((rx - 1 - this.offX) / this.iw) * this.cssW;
    out.y = (1 - (ry - 1 - this.offY) / this.ih) * this.cssH;
    return out;
  }

  /** Weltkarte statt Arena zeichnen (Startbildschirm) */
  renderMap(state: MapState, dt: number, time: number): void {
    if (!this.map) this.map = new WorldMapView();
    if (!this.mapShown) { this.mapShown = true; this.renderer.setClearColor('#3a2a6a'); }
    this.map.resize(this.iw + 2, this.ih + 2);
    this.map.update(state, dt, time);
    this.post.mat.uniforms.uOffset.value.set(0, 0);
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.map.scene, this.map.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.cam);
  }

  /** Bildschirmposition (CSS-Pixel) des Insel-Ankers auf der Weltkarte */
  mapAnchor(id: string, out: { x: number; y: number }): boolean {
    if (!this.map || !this.map.anchor(id, this.ndc)) return false;
    out.x = (this.ndc.x * 0.5 + 0.5) * this.cssW;
    out.y = (0.5 - this.ndc.y * 0.5) * this.cssH;
    return true;
  }

  render(prev: readonly PlayerPose[], players: readonly Player[], alpha: number, dt: number, time: number): void {
    if (this.mapShown) { this.mapShown = false; this.applyPalette(); }
    let focus: { x: number; z: number; vx: number; vz: number } | null = null;
    if (this.world.arena !== this.arenaSrc) this.rebuildArena();
    let far = 0;
    const me = players[this.local] ?? players[0];
    for (const p of players) {
      if (!this.heroes[p.id] || this.heroKeys[p.id] !== p.held) this.addHero(p);
      const a = prev[p.id] ?? p;
      const x = a.x + (p.x - a.x) * alpha, z = a.z + (p.z - a.z) * alpha;
      let df = p.facing - a.facing;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      const hero = this.heroes[p.id];
      hero.downed = p.downed;
      hero.revive = p.reviveT / KOOP.reviveZeit;
      hero.update(x, z, a.facing + df * alpha, Math.hypot(p.vx, p.vz), p.stride, p.dashTime > 0, time, dt);
      // Nach Treffer blinken, tot = weg (niedergeschlagen bleibt sichtbar)
      const visible = p.downed || (p.alive && !(p.invuln > 0 && p.dashTime <= 0 && Math.floor(time * 24) % 2 === 0));
      hero.root.visible = visible;
      const hp = this.heroPos[p.id] ?? (this.heroPos[p.id] = { x, z, visible: p.alive });
      hp.x = x; hp.z = z; hp.visible = p.alive;
      if (p === me) focus = { x, z, vx: p.alive ? p.vx : 0, vz: p.alive ? p.vz : 0 };
    }
    // Koop: Kamera zoomt etwas heraus, damit Mitspieler im Bild bleiben (gedeckelt)
    if (me && players.length > 1) {
      for (const p of players) if (p !== me && (p.alive || p.downed)) far = Math.max(far, Math.hypot(p.x - me.x, p.z - me.z));
      const want = far > 7.5 ? (far > 10 ? 1.4 : 1.2) : 1;
      // Hysterese, damit der Zoom nicht flackert
      if (want > this.zoomTarget || far < (this.zoomTarget > 1.2 ? 9 : 6.5)) this.zoomTarget = want;
    } else this.zoomTarget = 1;
    if (Math.abs(this.zoom - this.zoomTarget) > 0.001) {
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 3);
      if (Math.abs(this.zoom - this.zoomTarget) < 0.01) this.zoom = this.zoomTarget;
      this.applyFrustum();
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
    this.clock = time;
    this.shake *= Math.pow(0.002, dt);
    this.unruhe *= Math.pow(0.15, dt);
    const amp = this.shake * this.opt.shake;
    const sx = (this.rnd() - 0.5) * amp, sz = (this.rnd() - 0.5) * amp;
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
    this.offX = -dr / this.wpp; this.offY = -du / this.wpp;
    this.post.mat.uniforms.uOffset.value.set(this.offX, this.offY);

    // Sonne + Schatten folgen der Kamera; neuer Look: flacher und seitlich, damit Schatten sichtbar fallen
    if (LOOK.neu) this.sun.position.set(target.x + 3, 9.5, target.z - 13);
    else this.sun.position.set(target.x - 7, 14, target.z - 3);
    this.sun.target.position.copy(target);
    // Fülllicht leicht von oben aus Kamerarichtung
    this.front.position.set(target.x + this.camDir.x * 20, target.y + 9, target.z + this.camDir.z * 20);
    this.front.target.position.copy(target);

    // Lebendige Welt
    for (const t of this.arena.torches) t.light.intensity = 5 + Math.sin(time * 11 + t.seed) * 0.8 + Math.sin(time * 23 + t.seed * 3) * 0.6;
    for (const c of this.arena.crystals) { c.light.intensity = 4.5 + Math.sin(time * 2 + c.seed) * 1.2; c.group.position.y = Math.sin(time * 1.6 + c.seed) * 0.03; }
    for (const h of this.arena.halos) (h.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(time * 9 + h.id) * 0.08;
    this.arena.lavaMaterial.emissiveIntensity = 0.55 + Math.sin(time * 2.2) * 0.12;
    if (this.arena.shock) {
      // Tesla-Platten: flackern beim Aufladen, gleißen beim Entladen
      const t = this.world.shockT;
      this.arena.shock.opacity = t >= 4.6 ? 0.9 : t >= 3.5 ? 0.25 + 0.35 * Math.abs(Math.sin(time * 30)) : 0.05;
    }
    for (const b of this.arena.barrels) b.group.visible = !b.prop.broken;
    this.combat.update(alpha, time, dt, this.heroPos);
    this.effects.update(dt);

    if (this.composer) {
      // neuer Look: volle Auflösung direkt auf den Bildschirm, Nachbearbeitung im Composer
      this.atmo?.update(time);
      this.godrays?.setZeit(time);
      this.composer.render();
      return;
    }
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.cam);
  }
}

/** Himmel-Verlauf (Bildhintergrund): oben Himmelsfarbe, unten Dunst */
function himmelTextur(oben: string, unten: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  const o = new THREE.Color(oben), u = new THREE.Color(unten), m = o.clone().lerp(new THREE.Color('#ffd9a8'), 0.45);
  gr.addColorStop(0, o.getStyle()); gr.addColorStop(0.55, m.getStyle()); gr.addColorStop(1, u.getStyle());
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
