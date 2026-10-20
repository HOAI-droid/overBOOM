import * as THREE from 'three';
import type { Player, SimEvent, World } from '@overboom/core';
import { buildArenaView, paletteOf, type ArenaView } from './arenaView.ts';
import { HELD_BY_ID, KOOP } from '@overboom/data';
import type { Arena } from '@overboom/core';
import { HeroView } from './heroView.ts';
import { Effects } from './effects.ts';
import { CombatView } from './combatView.ts';
import { ENEMY_DEBRIS, shotColor } from './models.ts';
import { WorldMapView, type MapState } from './worldMap.ts';

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

  constructor(canvas: HTMLCanvasElement, world: World, opt: RenderOptions = {}) {
    this.world = world;
    this.opt = { internalShort: opt.internalShort ?? 270, viewShort: opt.viewShort ?? 11.5, shadows: opt.shadows ?? true, shake: opt.shake ?? 1 };
    this.effects = new Effects(this.rnd);
    this.combat = new CombatView(world, this.effects);
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
    this.hemi = new THREE.HemisphereLight('#b0a2f0', '#3a2050', 2.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe6c8', 3.2);
    this.sun.castShadow = this.opt.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -13; sc.right = 13; sc.top = 13; sc.bottom = -13; sc.near = 0.5; sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.arenaSrc = world.arena;
    this.arena = buildArenaView(world.arena);
    this.scene.add(this.arena.group, this.effects.group, this.combat.group);
    this.applyPalette();
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
  }

  private rnd = () => {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  };

  resize(width: number, height: number, dpr: number): void {
    this.renderer.setPixelRatio(Math.min(2, dpr));
    this.renderer.setSize(width, height, false);
    this.cssW = width; this.cssH = height;
    const aspect = width / height, s = this.opt.internalShort;
    if (aspect >= 1) { this.ih = s; this.iw = Math.round(s * aspect); }
    else { this.iw = s; this.ih = Math.round(s / aspect); }
    this.rt.setSize(this.iw + 2, this.ih + 2);
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

  /**
   * Erzeugt Effekte aus den Simulations-Ereignissen eines Ticks.
   * Rückgabe: gewünschter Hit-Stop in Sekunden (0 = keiner).
   */
  handleEvents(events: readonly SimEvent[]): number {
    const fx = this.effects;
    let stop = 0;
    const kick = (amount: number) => { this.shake = Math.min(0.45, Math.max(this.shake, amount) + amount * 0.2); };
    for (const e of events) {
      switch (e.type) {
        case 'dash': fx.dash(e.x, e.z, e.dirX, e.dirZ); this.heroes[e.player]?.punch(0.35); kick(0.08); break;
        case 'step': fx.step(e.x, e.z); break;
        case 'bump': fx.bump(e.x, e.z); this.heroes[e.player]?.punch(0.5); kick(0.2); break;
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
          fx.explosion(e.x, e.z, e.r, wave);
          kick((0.1 + e.r * 0.09) * (wave ? 0.5 : 1));
          if (!wave) stop = Math.max(stop, e.chain >= 2 ? 0.075 : 0.05);
          break;
        }
        case 'zap': fx.zap(e.pts); kick(0.05); break;
        case 'spark': fx.spark(e.x, e.y, e.z, e.hostile); break;
        case 'spawn': fx.spawn(e.x, e.z); break;
        case 'windup': fx.windup(e.x, e.z, e.enemy === 'toastomat' ? 0xff2a4a : 0xff7a1a); break;
        case 'enemyShot': fx.muzzle(e.x, 0.8, e.z, 0, 0, 0xff7a1a); break;
        case 'pickup': fx.pickup(e.x, e.z); break;
        case 'hurt': fx.hurt(e.x, e.z); this.heroes[e.player]?.punch(0.6); kick(0.3); stop = Math.max(stop, 0.11); this.lastStop = -1; break;
        case 'death': fx.explosion(e.x, e.z, 2.4); kick(0.45); stop = 0.2; this.lastStop = -1; break;
        case 'waveClear': kick(0.15); break;
        case 'levelUp': fx.levelUp(e.x, e.z); break;
        case 'enemyHeal': fx.enemyHeal(e.x, e.z, e.r); break;
        case 'block': fx.block(e.x, e.z); break;
        case 'split': fx.burst(e.x, e.z, ENEMY_DEBRIS.schleimi); break;
        case 'keks': fx.keks(e.x, e.z); break;
        case 'reaction': fx.reaction(e.x, e.z, e.farbe); kick(0.08); break;
        case 'nova': fx.reaction(e.x, e.z, e.farbe); break;
        case 'nuke': fx.nuke(e.x, e.z); kick(0.45); stop = Math.max(stop, 0.12); this.lastStop = -1; break;
        case 'storm': fx.storm(e.x, e.z); kick(0.12); break;
        case 'shock': if (e.phase === 'entladen') { fx.shock(this.world.arena); kick(0.15); } break;
        case 'beam': fx.beam(e.x, e.z, e.x2, e.z2, shotColor(e.geschoss)); break;
        case 'cone': fx.cone(e.x, e.z, e.dirX, e.dirZ, e.range, shotColor(e.geschoss), e.geschoss === 'flamme'); break;
        case 'swing': fx.swing(e.x, e.z, e.dirX, e.dirZ, e.range, shotColor(e.geschoss)); kick(0.04); break;
        case 'teleport': fx.teleport(e.x, e.z, shotColor(e.geschoss)); break;
        case 'kawumm': kick(0.2); break;
        case 'fusion': fx.fusion(e.x, e.z, !!e.rezept); break;
        case 'evolve': fx.fusion(e.x, e.z, true); break;
        case 'star': fx.levelUp(e.x, e.z); break;
        case 'heal': fx.heal(e.x, e.z); break;
        case 'dodge': fx.dodge(e.x, e.z); break;
        case 'bossSpawn': fx.explosion(e.x, e.z, 2.5, true); kick(0.45); break;
        case 'bossPhase': fx.explosion(e.x, e.z, 2, true); kick(0.35); stop = Math.max(stop, 0.15); this.lastStop = -1; break;
      }
    }
    // Hit-Stop nicht im Dauerfeuer: höchstens alle 0,3 s
    if (stop > 0) {
      if (this.clock - this.lastStop < 0.3) return 0;
      this.lastStop = this.clock;
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

    // Sonne + Schatten folgen der Kamera
    this.sun.position.set(target.x - 7, 14, target.z - 3);
    this.sun.target.position.copy(target);

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

    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.post.scene, this.post.cam);
  }
}
