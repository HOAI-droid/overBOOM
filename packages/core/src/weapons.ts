import { DT, PLAYER_RADIUS } from './constants.ts';
import type { World, Player } from './sim.ts';
import type { Enemy, Projectile, WeaponSlot } from './entities.ts';
import { KAMPF, type Waffe } from '../../data/src/index.ts';

/**
 * Waffen feuern automatisch auf den nächsten Gegner in Reichweite.
 * Verhalten entsteht systemisch aus den Bauteilen:
 *   Antrieb → Flugbahn (gerade, Fächer, zielsuchend, zielsuchend im Bogen)
 *   Ladung  → Wirkung beim Treffer (Explosion, Kettenblitz, Rückstoß, sonst reiner Schaden)
 * Noch nicht umgesetzte Antriebe fliegen vorerst gerade.
 */

const FLIGHT: Record<string, 'gerade' | 'zielsuchend' | 'zielbogen'> = {
  gerade: 'gerade', faecher: 'gerade', zielsuchend: 'zielsuchend', zielbogen: 'zielbogen'
};

const zapIds = new Int32Array(16);

export function stepWeapons(w: World): void {
  for (const p of w.players) {
    if (!p.alive) continue;
    for (let i = 0; i < p.weapons.length; i++) {
      const s = p.weapons[i];
      const wx = p.x + s.ox, wz = p.z + s.oz;
      s.cd -= DT;
      const t = w.nearestEnemy(wx, wz, s.waffe.reichweite);
      s.target = t;
      if (t < 0) { if (s.cd < 0) s.cd = 0; continue; }
      const e = w.enemies[t];
      const dx = e.x - wx, dz = e.z - wz, d = Math.hypot(dx, dz) || 1e-6;
      s.aim = Math.atan2(dx, dz);
      if (s.cd > 0) continue;
      s.cd = Math.max(0.02, s.cd + 1 / s.waffe.feuerrate);
      fire(w, p, i, s, e, wx, wz, dx / d, dz / d, d);
    }
  }
}

function fire(w: World, p: Player, slot: number, s: WeaponSlot, e: Enemy, x: number, z: number, dx: number, dz: number, dist: number): void {
  const waffe = s.waffe;
  const crit = w.rng.chance(KAMPF.kritChance);
  const dmg = waffe.schaden * (crit ? KAMPF.kritFaktor : 1);
  const speed = KAMPF.tempo[waffe.antrieb] ?? KAMPF.tempo.gerade;
  if (waffe.antrieb === 'faecher') {
    for (let k = -2; k <= 2; k++) {
      const a = Math.atan2(dx, dz) + k * 0.18;
      spawnShot(w, p, waffe, x, z, Math.sin(a), Math.cos(a), speed, dmg, crit, e, dist);
    }
  } else {
    spawnShot(w, p, waffe, x, z, dx, dz, speed, dmg, crit, e, dist);
  }
  w.events.push({ type: 'fire', player: p.id, slot, weapon: waffe.id, x, z, dirX: dx, dirZ: dz });
}

function spawnShot(w: World, p: Player, waffe: Waffe, x: number, z: number, dx: number, dz: number, speed: number, dmg: number, crit: boolean, e: Enemy, dist: number): void {
  for (const pr of w.projectiles) {
    if (pr.alive) continue;
    const flight = FLIGHT[waffe.antrieb] ?? 'gerade';
    pr.alive = true;
    pr.hostile = false;
    pr.player = p.id;
    pr.geschoss = waffe.geschoss;
    pr.antrieb = flight;
    pr.ladung = waffe.ladung;
    pr.x = pr.px = pr.sx = x; pr.z = pr.pz = pr.sz = z; pr.y = pr.py = 0.7;
    pr.vx = dx * speed; pr.vz = dz * speed; pr.speed = speed;
    pr.dmg = dmg; pr.crit = crit;
    pr.target = e.slot; pr.targetId = e.id;
    pr.tx = e.x; pr.tz = e.z;
    pr.t = 0;
    pr.r = 0.15;
    if (flight === 'zielbogen') {
      pr.dur = Math.max(0.45, Math.min(1.2, dist / speed));
      pr.life = pr.dur + 0.5;
    } else if (flight === 'zielsuchend') {
      pr.life = 2.5;
    } else {
      pr.life = (waffe.reichweite / speed) * 1.25 + 0.1;
    }
    return;
  }
}

function liveTarget(w: World, pr: Projectile): Enemy | null {
  if (pr.target < 0) return null;
  const e = w.enemies[pr.target];
  return e.alive && e.id === pr.targetId && e.doom < 0 ? e : null;
}

function findHit(w: World, pr: Projectile): Enemy | null {
  const n = w.hash.query(pr.x, pr.z, 0.9);
  let best: Enemy | null = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.hash.result[i]];
    if (!e.alive || e.doom >= 0) continue;
    const d = Math.hypot(e.x - pr.x, e.z - pr.z);
    if (d < e.r + pr.r && d < bd) { bd = d; best = e; }
  }
  return best;
}

export function stepProjectiles(w: World): void {
  for (const pr of w.projectiles) {
    if (!pr.alive) continue;
    pr.t += DT;
    pr.life -= DT;
    if (pr.hostile) { stepHostile(w, pr); continue; }

    const tgt = liveTarget(w, pr);

    if (pr.antrieb === 'zielbogen') {
      // Steigt auf und stürzt sich auf das Ziel – fliegt über Wände
      if (tgt) { pr.tx = tgt.x; pr.tz = tgt.z; }
      const k = Math.min(1, pr.t / pr.dur);
      const ease = k * k * (3 - 2 * k);
      pr.x = pr.sx + (pr.tx - pr.sx) * ease;
      pr.z = pr.sz + (pr.tz - pr.sz) * ease;
      const span = Math.hypot(pr.tx - pr.sx, pr.tz - pr.sz);
      pr.y = 0.7 - 0.5 * k + Math.sin(Math.PI * k) * (1.1 + span * 0.16);
      pr.vx = (pr.x - pr.px) / DT; pr.vz = (pr.z - pr.pz) / DT;
      if (k >= 1) impact(w, pr, tgt && Math.hypot(tgt.x - pr.x, tgt.z - pr.z) < tgt.r + 0.5 ? tgt : null);
      continue;
    }

    if (pr.antrieb === 'zielsuchend' && tgt) {
      // Lenkt immer schärfer ein, damit es sicher trifft
      const cur = Math.atan2(pr.vx, pr.vz);
      let diff = Math.atan2(tgt.x - pr.x, tgt.z - pr.z) - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const rate = (5 + pr.t * 10) * DT;
      const a = cur + Math.max(-rate, Math.min(rate, diff));
      pr.vx = Math.sin(a) * pr.speed; pr.vz = Math.cos(a) * pr.speed;
    }

    // Zwei Teilschritte gegen Durchtunneln
    for (let sub = 0; sub < 2 && pr.alive; sub++) {
      pr.x += pr.vx * DT * 0.5;
      pr.z += pr.vz * DT * 0.5;
      if (w.solidAt(pr.x, pr.z)) {
        if (pr.ladung === 'explosion') impact(w, pr, null);
        else { pr.alive = false; w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: false }); }
        break;
      }
      const e = findHit(w, pr);
      if (e) { impact(w, pr, e); break; }
      for (const b of w.barrels) {
        if (!b.broken && Math.hypot(b.x - pr.x, b.z - pr.z) < b.r + pr.r) {
          w.breakBarrel(b, 0, 0);
          impact(w, pr, null);
          break;
        }
      }
    }
    if (pr.alive && pr.life <= 0) {
      pr.alive = false;
      w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: false });
    }
  }
}

function stepHostile(w: World, pr: Projectile): void {
  for (let sub = 0; sub < 2; sub++) {
    pr.x += pr.vx * DT * 0.5;
    pr.z += pr.vz * DT * 0.5;
    if (w.solidAt(pr.x, pr.z)) {
      pr.alive = false;
      w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: true });
      return;
    }
    for (const p of w.players) {
      if (!p.alive) continue;
      if (Math.hypot(p.x - pr.x, p.z - pr.z) < PLAYER_RADIUS + pr.r) {
        // Beim Dash fliegt der Toast einfach durch
        if (p.dashTime > 0 || p.invuln > 0) continue;
        w.hurtPlayer(p, pr.dmg, pr.x - pr.vx, pr.z - pr.vz);
        pr.alive = false;
        w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: true });
        return;
      }
    }
  }
  if (pr.life <= 0) pr.alive = false;
}

/** Wirkung beim Aufschlag – bestimmt von der Ladung. */
function impact(w: World, pr: Projectile, e: Enemy | null): void {
  pr.alive = false;
  const sp = Math.hypot(pr.vx, pr.vz) || 1;
  const dx = pr.vx / sp, dz = pr.vz / sp;
  switch (pr.ladung) {
    case 'explosion':
      w.queueBlast(pr.x, pr.z, KAMPF.explosionsRadius, pr.dmg, 0, 0, w.newGroup(), false, 'waffe');
      return;
    case 'kettenblitz':
      if (e) { zap(w, pr, e); return; }
      break;
    case 'rueckstoss':
      if (e) { w.damageEnemy(e, pr.dmg, pr.crit, dx * KAMPF.rueckstoss, dz * KAMPF.rueckstoss); return; }
      break;
    default:
      if (e) { w.damageEnemy(e, pr.dmg, pr.crit, dx * 1.5, dz * 1.5); return; }
  }
  w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: false });
}

/** Blitz springt von Gegner zu Gegner, jeder Sprung etwas schwächer. */
function zap(w: World, pr: Projectile, first: Enemy): void {
  const pts: number[] = [pr.x, pr.y, pr.z];
  let cur: Enemy | null = first;
  let dmg = pr.dmg;
  let n = 0;
  const range2 = KAMPF.blitzReichweite * KAMPF.blitzReichweite;
  for (let j = 0; j <= KAMPF.blitzSpruenge && cur; j++) {
    zapIds[n++] = cur.id;
    const cx: number = cur.x, cz: number = cur.z;
    pts.push(cx, 0.6 + cur.y, cz);
    w.damageEnemy(cur, dmg, pr.crit && j === 0, 0, 0);
    dmg *= KAMPF.blitzAbfall;
    let next: Enemy | null = null, bd = range2;
    const m = w.hash.query(cx, cz, KAMPF.blitzReichweite);
    for (let i = 0; i < m; i++) {
      const e = w.enemies[w.hash.result[i]];
      if (!e.alive || e.doom >= 0) continue;
      let seen = false;
      for (let k = 0; k < n; k++) if (zapIds[k] === e.id) { seen = true; break; }
      if (seen) continue;
      const d2 = (e.x - cx) ** 2 + (e.z - cz) ** 2;
      if (d2 < bd) { bd = d2; next = e; }
    }
    cur = next;
  }
  w.events.push({ type: 'zap', pts });
}
