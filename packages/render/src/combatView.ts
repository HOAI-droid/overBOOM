import * as THREE from 'three';
import { EnemyState, type World } from '@overboom/core';
import { ELITE, GEGNER, SELTENHEIT } from '@overboom/data';
import { VoxelInstances } from './instanced.ts';
import { voxelObject } from './voxel.ts';
import { PROJECTILE_IDS, baron, crown, gem, grummel, kroete, projectileModel, spawnMarker, targetRing, toastomat, weaponModel } from './models.ts';
import type { Effects } from './effects.ts';

const ENEMY_MODELS: Record<string, { vox: () => ReturnType<typeof grummel>; size: number; top: number; cap: number }> = {
  grummelbold: { vox: grummel, size: 0.11, top: 1.1, cap: 200 },
  bombenkroete: { vox: kroete, size: 0.1, top: 1.35, cap: 200 },
  toastomat: { vox: toastomat, size: 0.1, top: 1.3, cap: 200 },
  baron: { vox: baron, size: 0.1, top: 3, cap: 4 }
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Elastisches Aufploppen beim Erscheinen */
function popIn(t: number): number {
  if (t >= 1) return 1;
  const c = 1.70158 * 1.4;
  const x = t - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

interface WeaponVis { root: THREE.Group; aim: number; kick: number }

/** Darstellung von Gegnern, Geschossen, Kristallen, Spawn-Warnungen und den schwebenden Waffen. */
export class CombatView {
  readonly group = new THREE.Group();
  private enemies: VoxelInstances[];
  private shots = new Map<string, VoxelInstances>();
  private gems: VoxelInstances;
  private markers: VoxelInstances;
  private crowns: VoxelInstances;
  private rings: VoxelInstances;
  private weapons: WeaponVis[][] = [];
  private loadouts: number[] = [];
  private m = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private scl = new THREE.Vector3();

  constructor(private world: World, private fx: Effects) {
    this.enemies = GEGNER.map((g) => {
      const m = ENEMY_MODELS[g.id] ?? ENEMY_MODELS.grummelbold;
      const inst = new VoxelInstances(m.vox(), m.size, m.cap, { jitter: 0.06 });
      this.group.add(inst.group);
      return inst;
    });
    for (const id of PROJECTILE_IDS) {
      const size = id === 'toast' || id === 'bombe' ? 0.09 : 0.07;
      const inst = new VoxelInstances(projectileModel(id), size, id === 'kugel' ? 400 : 200, { jitter: 0, shadows: id === 'bombe', origin: [0.5, 0.5, 0.5] });
      this.shots.set(id, inst);
      this.group.add(inst.group);
    }
    this.gems = new VoxelInstances(gem(), 0.07, 320, { jitter: 0, shadows: false, origin: [1, 0, 1] });
    this.markers = new VoxelInstances(spawnMarker(), 0.1, 48, { jitter: 0, shadows: false, origin: [0.5, 0, 0.5] });
    this.crowns = new VoxelInstances(crown(), 0.07, 64, { jitter: 0, shadows: false, origin: [0.5, 0, 0.5] });
    this.rings = new VoxelInstances(targetRing(), 1 / 9, 64, { jitter: 0, shadows: false, origin: [0.5, 0, 0.5] });
    this.group.add(this.gems.group, this.markers.group, this.crowns.group, this.rings.group);
  }

  /** Rückstoß der Waffe nach einem Schuss */
  kick(player: number, slot: number): void {
    const v = this.weapons[player]?.[slot];
    if (v) v.kick = 1;
  }

  private weaponVis(player: number): WeaponVis[] {
    const p = this.world.players[player];
    let list = this.weapons[player];
    if (!list || this.loadouts[player] !== p.loadout) {
      // Waffen haben sich geändert (Kauf, Merge, Verkauf): Modelle neu bauen
      for (const v of list ?? []) {
        this.group.remove(v.root);
        v.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      }
      list = p.weapons.map((s) => {
        const root = new THREE.Group();
        const glow = SELTENHEIT[s.tier - 1]?.farbe ?? '#3de8ff';
        const m = voxelObject(weaponModel(s.waffe.id, s.waffe.gruppe, glow), 0.07, { origin: [0.5, 0.5, 0.5], jitter: 0.05 });
        m.scale.setScalar(1 + (s.tier - 1) * 0.12);
        root.add(m);
        this.group.add(root);
        return { root, aim: s.aim, kick: 0 };
      });
      this.weapons[player] = list;
      this.loadouts[player] = p.loadout;
    }
    return list;
  }

  private matrix(x: number, y: number, z: number, yaw: number, pitch: number, roll: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
    this.pos.set(x, y, z);
    this.euler.set(pitch, yaw, roll);
    this.quat.setFromEuler(this.euler);
    this.scl.set(sx, sy, sz);
    return this.m.compose(this.pos, this.quat, this.scl);
  }

  update(alpha: number, time: number, dt: number, heroPos: readonly { x: number; z: number; visible: boolean }[]): void {
    const w = this.world;

    // Gegner
    for (const inst of this.enemies) inst.begin();
    this.crowns.begin();
    for (const e of w.enemies) {
      if (!e.alive) continue;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha), y = lerp(e.py, e.y, alpha);
      const ph = time * 9 + e.id * 1.7;
      const moving = Math.min(1, Math.hypot(e.vx, e.vz) / 1.5);
      let sx = 1, sy = 1, roll = Math.sin(ph) * 0.14 * moving, pitch = 0, hop = Math.abs(Math.sin(ph)) * 0.07 * moving;
      let flash = Math.min(1, e.flash / 0.12);
      // Treffer: kurz quetschen
      const sq = flash * 0.25;
      sx += sq; sy -= sq;
      const pop = popIn(e.age / 0.3);
      if (e.state === EnemyState.Windup) {
        // Kröte bläst sich auf und blinkt – gleich springt sie
        const k = 1 - e.stateT / 0.55;
        sx += k * 0.3; sy += k * 0.25 + Math.sin(time * 50) * 0.04;
        flash = Math.max(flash, (Math.sin(time * 40) * 0.5 + 0.5) * 0.6 * k);
        roll = 0; hop = 0;
      } else if (e.state === EnemyState.Jump) {
        pitch = -0.4; roll = 0; hop = 0;
      } else if (e.state === EnemyState.Aim) {
        flash = Math.max(flash, (Math.sin(time * 30) * 0.5 + 0.5) * 0.35);
        roll = 0; pitch = -0.12; hop = 0;
      }
      if (e.doom >= 0) {
        const k = Math.max(0, 1 - e.doom / 0.35);
        sx += k * 0.35; sy += k * 0.35;
        flash = Math.max(flash, (Math.sin(time * 45) * 0.5 + 0.5) * (0.3 + 0.7 * k));
        roll = Math.sin(time * 60 + e.id) * 0.15;
      }
      if (e.stun > 0) { roll = Math.sin(time * 20) * 0.2; hop = 0; }
      const jx = e.doom >= 0 ? Math.sin(time * 70 + e.id) * 0.03 : 0;
      const big = e.elite ? ELITE.groesse : 1;
      this.enemies[e.type].push(this.matrix(x + jx, y + hop, z, e.facing, pitch, roll, sx * pop * big, sy * pop * big, sx * pop * big), flash);
      const info = ENEMY_MODELS[e.def.id] ?? ENEMY_MODELS.grummelbold;
      if (e.elite) {
        this.crowns.push(this.matrix(x + jx, y + hop + info.top * big * sy * pop + Math.sin(time * 4) * 0.04, z, time * 1.5, 0, 0, 1.2, 1.2, 1.2));
      }
      // Statuseffekte als kleine Partikel
      if (e.burnT > 0 && this.fx.chance(dt * 14)) this.fx.burning(x, y + info.top * 0.5 * big, z);
      if (e.poisonT > 0 && this.fx.chance(dt * 8)) this.fx.poisoned(x, y + info.top * 0.6 * big, z);
      if (e.slow > 0 && this.fx.chance(dt * 8)) this.fx.chilled(x, y + info.top * 0.5 * big, z);
      if (e.stun > 0 && this.fx.chance(dt * 10)) this.fx.dizzy(x, y + info.top * big + 0.15, z, time);
    }
    for (const inst of this.enemies) inst.end();
    this.crowns.end();

    // Geschosse
    for (const inst of this.shots.values()) inst.begin();
    this.rings.begin();
    for (const pr of w.projectiles) {
      if (!pr.alive) continue;
      const inst = this.shots.get(pr.geschoss) ?? this.shots.get('kugel')!;
      if (pr.hostile && pr.antrieb === 'zielbogen') {
        // Einschlag-Markierung des Bosses: wird zum Aufprall hin voll
        const k = Math.max(0, Math.min(1, pr.t / pr.dur));
        const r = pr.r * (0.5 + 0.5 * k);
        this.rings.push(this.matrix(pr.tx, 0.03, pr.tz, time * 2, 0, 0, r, 1, r), 0);
      }
      const x = lerp(pr.px, pr.x, alpha), y = lerp(pr.py, pr.y, alpha), z = lerp(pr.pz, pr.z, alpha);
      const yaw = Math.atan2(pr.vx, pr.vz);
      let pitch = 0, roll = 0;
      if (pr.geschoss === 'bombe') {
        pitch = time * 8; roll = time * 5;
        if (pr.t > 0) this.fx.trail(x, y + 0.2, z);
      } else if (pr.antrieb === 'zielbogen' || pr.antrieb === 'bogen') {
        const h = Math.hypot(pr.x - pr.px, pr.z - pr.pz);
        pitch = -Math.atan2(pr.y - pr.py, h || 1e-4);
        if (pr.geschoss === 'rakete') this.fx.trail(x, y, z);
      } else if (pr.geschoss === 'blitzkugel') {
        roll = time * 12; pitch = time * 9;
      } else if (pr.geschoss === 'toast') {
        pitch = time * 14;
      }
      const s = pr.crit ? 1.4 : 1;
      inst.push(this.matrix(x, y, z, yaw, pitch, roll, s, s, s));
    }
    for (const inst of this.shots.values()) inst.end();
    this.rings.end();

    // Kristalle
    this.gems.begin();
    for (const c of w.crystals) {
      if (!c.alive) continue;
      const x = lerp(c.px, c.x, alpha), z = lerp(c.pz, c.z, alpha);
      const s = Math.min(1, c.age / 0.15) * (c.value > 1 ? 1.4 : 1);
      this.gems.push(this.matrix(x, 0.12 + Math.sin(time * 5 + c.x * 3) * 0.05, z, time * 3 + c.z, 0, 0, s, s, s));
    }
    this.gems.end();

    // Spawn-Warnungen
    this.markers.begin();
    for (const wr of w.warnings) {
      if (!wr.active) continue;
      const k = 1 - wr.t;
      const s = 0.7 + 0.3 * Math.abs(Math.sin(time * 10)) + k * 0.2;
      this.markers.push(this.matrix(wr.x, 0.02, wr.z, k * 1.5, 0, 0, s, 1, s));
    }
    this.markers.end();

    // Schwebende Waffen
    for (const p of w.players) {
      const list = this.weaponVis(p.id);
      const hp = heroPos[p.id];
      for (let i = 0; i < list.length; i++) {
        const v = list[i], s = p.weapons[i];
        v.root.visible = !!hp?.visible;
        if (!hp) continue;
        v.aim = angleLerp(v.aim, s.aim, Math.min(1, dt * 20));
        v.kick = Math.max(0, v.kick - dt * 7);
        const back = v.kick * 0.18;
        v.root.position.set(hp.x + s.ox - Math.sin(v.aim) * back, 0.78 + Math.sin(time * 3 + i * 2) * 0.05, hp.z + s.oz - Math.cos(v.aim) * back);
        v.root.rotation.set(-v.kick * 0.5, v.aim, 0, 'YXZ');
      }
    }
  }

  /** Position der Waffenmündung (für Mündungsfeuer) */
  muzzle(player: number, slot: number, out: THREE.Vector3): THREE.Vector3 {
    const v = this.weapons[player]?.[slot];
    if (!v) return out.set(0, 0.78, 0);
    return out.set(v.root.position.x + Math.sin(v.aim) * 0.3, v.root.position.y, v.root.position.z + Math.cos(v.aim) * 0.3);
  }
}
