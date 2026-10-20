import { DT, PLAYER_RADIUS } from './constants.ts';
import type { World, Player } from './sim.ts';
import type { Enemy, Projectile, WeaponSlot } from './entities.ts';
import { KAMPF, STUFEN, type Waffe } from '../../data/src/index.ts';

/**
 * Waffen feuern automatisch auf den nächsten Gegner in Reichweite.
 * Verhalten entsteht systemisch aus den Bauteilen:
 *   Antrieb → Flugbahn (gerade, Fächer, zielsuchend, Bogenwurf, zielsuchend im Bogen)
 *   Ladung  → Wirkung beim Treffer (Explosion, Kettenblitz, Rückstoß, Frost, Brand, Gift …)
 * Noch nicht umgesetzte Antriebe fliegen vorerst gerade.
 */

type Flight = 'gerade' | 'zielsuchend' | 'zielbogen' | 'bogen';

const FLIGHT: Record<string, Flight> = {
  gerade: 'gerade', faecher: 'gerade', zielsuchend: 'zielsuchend', zielbogen: 'zielbogen', bogen: 'bogen'
};

const zapIds = new Int32Array(16);

/** Effektive Werte einer Waffe aus Grundwert × Stufe × Spielerwerten */
export function weaponDamage(p: Player, s: WeaponSlot): number {
  return s.waffe.schaden * STUFEN.schaden[s.tier - 1] * Math.max(0.1, 1 + p.stats.schaden / 100);
}
export function weaponRate(p: Player, s: WeaponSlot): number {
  return s.waffe.feuerrate * STUFEN.feuerrate[s.tier - 1] * Math.max(0.2, 1 + p.stats.angriff / 100);
}
export function weaponRange(p: Player, s: WeaponSlot): number {
  return Math.max(1.5, s.waffe.reichweite * (1 + p.stats.reichweite / 100));
}

export function stepWeapons(w: World): void {
  for (const p of w.players) {
    if (!p.alive) continue;
    for (let i = 0; i < p.weapons.length; i++) {
      const s = p.weapons[i];
      const wx = p.x + s.ox, wz = p.z + s.oz;
      s.cd -= DT;
      const t = w.nearestEnemy(wx, wz, weaponRange(p, s));
      s.target = t;
      if (t < 0) { if (s.cd < 0) s.cd = 0; continue; }
      const e = w.enemies[t];
      const dx = e.x - wx, dz = e.z - wz, d = Math.hypot(dx, dz) || 1e-6;
      s.aim = Math.atan2(dx, dz);
      if (s.cd > 0) continue;
      s.cd = Math.max(0.02, s.cd + 1 / weaponRate(p, s));
      fire(w, p, i, s, e, wx, wz, dx / d, dz / d, d);
    }
  }
}

function fire(w: World, p: Player, slot: number, s: WeaponSlot, e: Enemy, x: number, z: number, dx: number, dz: number, dist: number): void {
  const waffe = s.waffe;
  const crit = w.rng.next() * 100 < KAMPF.kritChance * 100 + p.stats.krit;
  const dmg = weaponDamage(p, s) * (crit ? KAMPF.kritFaktor : 1);
  const speed = KAMPF.tempo[waffe.antrieb] ?? KAMPF.tempo.gerade;
  if (waffe.antrieb === 'faecher') {
    for (let k = -2; k <= 2; k++) {
      const a = Math.atan2(dx, dz) + k * 0.18;
      spawnShot(w, p, s, x, z, Math.sin(a), Math.cos(a), speed, dmg, crit, e, dist);
    }
  } else {
    spawnShot(w, p, s, x, z, dx, dz, speed, dmg, crit, e, dist);
  }
  w.events.push({ type: 'fire', player: p.id, slot, weapon: waffe.id, x, z, dirX: dx, dirZ: dz });
}

function initShot(pr: Projectile, p: Player, waffe: Waffe, flight: Flight, x: number, z: number, dx: number, dz: number, speed: number, dmg: number, crit: boolean): void {
  pr.alive = true;
  pr.hostile = false;
  pr.player = p.id;
  pr.geschoss = waffe.geschoss;
  pr.antrieb = flight;
  pr.ladung = waffe.ladung;
  pr.x = pr.px = pr.sx = x; pr.z = pr.pz = pr.sz = z; pr.y = pr.py = 0.7;
  pr.vx = dx * speed; pr.vz = dz * speed; pr.speed = speed;
  pr.dmg = dmg; pr.crit = crit;
  pr.target = -1; pr.targetId = 0;
  pr.t = 0;
  pr.r = 0.15;
  pr.src = waffe.id;
  pr.blastMul = Math.max(0.3, 1 + p.stats.explosion / 100);
  pr.pierce = waffe.ladung === 'plasma' ? 3 : 0;
  pr.lastHit = 0;
}

function spawnShot(w: World, p: Player, s: WeaponSlot, x: number, z: number, dx: number, dz: number, speed: number, dmg: number, crit: boolean, e: Enemy, dist: number): void {
  for (const pr of w.projectiles) {
    if (pr.alive) continue;
    const waffe = s.waffe;
    const flight = FLIGHT[waffe.antrieb] ?? 'gerade';
    initShot(pr, p, waffe, flight, x, z, dx, dz, speed, dmg, crit);
    pr.target = e.slot; pr.targetId = e.id;
    pr.tx = e.x; pr.tz = e.z;
    if (flight === 'zielbogen' || flight === 'bogen') {
      pr.dur = Math.max(0.45, Math.min(1.2, dist / speed));
      pr.life = pr.dur + 0.5;
      if (flight === 'bogen') { pr.tx = e.x + e.vx * pr.dur * 0.6; pr.tz = e.z + e.vz * pr.dur * 0.6; }
    } else if (flight === 'zielsuchend') {
      pr.life = 2.5;
    } else {
      pr.life = (weaponRange(p, s) / speed) * 1.25 + 0.1;
    }
    return;
  }
}

/** Kleine Splitter-Geschosse (Ladung „Splitter"), fliegen sternförmig auseinander. */
function spawnSplinters(w: World, from: Projectile, x: number, z: number, skipId: number): void {
  let made = 0;
  for (const pr of w.projectiles) {
    if (made >= 4) break;
    if (pr.alive) continue;
    const a = made * Math.PI * 0.5 + 0.4;
    pr.alive = true; pr.hostile = false; pr.player = from.player;
    pr.geschoss = 'kugel'; pr.antrieb = 'gerade'; pr.ladung = 'keine';
    pr.x = pr.px = x; pr.z = pr.pz = z; pr.y = pr.py = from.y;
    pr.speed = 11; pr.vx = Math.sin(a) * 11; pr.vz = Math.cos(a) * 11;
    pr.dmg = from.dmg * 0.4; pr.crit = false;
    pr.target = -1; pr.targetId = 0; pr.t = 0; pr.life = 0.35; pr.r = 0.12;
    pr.src = from.src; pr.blastMul = 1; pr.pierce = 0; pr.lastHit = skipId;
    made++;
  }
}

function liveTarget(w: World, pr: Projectile): Enemy | null {
  if (pr.target < 0) return null;
  const e = w.enemies[pr.target];
  return e.alive && e.id === pr.targetId && e.doom < 0 ? e : null;
}

function findHit(w: World, pr: Projectile): Enemy | null {
  const n = w.hash.query(pr.x, pr.z, 1.4);
  let best: Enemy | null = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.hash.result[i]];
    if (!e.alive || e.doom >= 0 || e.id === pr.lastHit) continue;
    const d = Math.hypot(e.x - pr.x, e.z - pr.z);
    if (d < e.r + pr.r && d < bd) { bd = d; best = e; }
  }
  return best;
}

/** Flug im Bogen: steigt auf, fällt aufs Ziel (fliegt über Wände). */
function arc(pr: Projectile, follow: Enemy | null): number {
  if (follow) { pr.tx = follow.x; pr.tz = follow.z; }
  const k = Math.max(0, Math.min(1, pr.t / pr.dur));
  const ease = k * k * (3 - 2 * k);
  pr.x = pr.sx + (pr.tx - pr.sx) * ease;
  pr.z = pr.sz + (pr.tz - pr.sz) * ease;
  const span = Math.hypot(pr.tx - pr.sx, pr.tz - pr.sz);
  const y0 = pr.hostile ? 2.2 : 0.7;
  pr.y = y0 - (y0 - 0.2) * k + Math.sin(Math.PI * k) * (1.1 + span * 0.16);
  pr.vx = (pr.x - pr.px) / DT; pr.vz = (pr.z - pr.pz) / DT;
  return k;
}

export function stepProjectiles(w: World): void {
  for (const pr of w.projectiles) {
    if (!pr.alive) continue;
    pr.t += DT;
    pr.life -= DT;
    if (pr.hostile) { stepHostile(w, pr); continue; }

    const tgt = liveTarget(w, pr);

    if (pr.antrieb === 'zielbogen' || pr.antrieb === 'bogen') {
      const k = arc(pr, pr.antrieb === 'zielbogen' ? tgt : null);
      if (k >= 1) {
        // Aufschlag: trifft, was in der Nähe steht
        const near = tgt && Math.hypot(tgt.x - pr.x, tgt.z - pr.z) < tgt.r + 0.5 ? tgt : findHitAt(w, pr.x, pr.z, 0.6);
        impact(w, pr, near);
      }
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
      if (e) { impact(w, pr, e); continue; }
      for (const b of w.barrels) {
        if (!b.broken && Math.hypot(b.x - pr.x, b.z - pr.z) < b.r + pr.r) {
          w.breakBarrel(b, 0, 0, pr.src);
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

function findHitAt(w: World, x: number, z: number, r: number): Enemy | null {
  const n = w.hash.query(x, z, r + 1);
  let best: Enemy | null = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.hash.result[i]];
    if (!e.alive || e.doom >= 0) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < e.r + r && d < bd) { bd = d; best = e; }
  }
  return best;
}

function stepHostile(w: World, pr: Projectile): void {
  if (pr.antrieb === 'zielbogen') {
    // Boss-Bombe: Ziel steht fest (rot markiert), Explosion trifft Spieler
    if (pr.t < 0) { pr.x = pr.px; pr.z = pr.pz; return; }
    const k = arc(pr, null);
    if (k >= 1) {
      pr.alive = false;
      w.queueBlast(pr.x, pr.z, pr.r, pr.dmg, 0, 0, w.newGroup(), true, 'boss');
    }
    return;
  }
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
  const sp = Math.hypot(pr.vx, pr.vz) || 1;
  const dx = pr.vx / sp, dz = pr.vz / sp;
  const owner = w.players[pr.player];
  let pierced = false;

  switch (pr.ladung) {
    case 'explosion':
      pr.alive = false;
      w.queueBlast(pr.x, pr.z, KAMPF.explosionsRadius * pr.blastMul, pr.dmg, 0, 0, w.newGroup(), false, 'waffe', pr.src);
      return;
    case 'kettenblitz':
      pr.alive = false;
      if (e) { zap(w, pr, e); lifesteal(w, owner); return; }
      w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: false });
      return;
  }

  if (!e) {
    pr.alive = false;
    w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: false });
    return;
  }

  let kb = 1.5;
  switch (pr.ladung) {
    case 'rueckstoss': kb = KAMPF.rueckstoss; break;
    case 'plasma':
      // durchschlägt Gegner, jeder Durchschlag +10 %
      if (pr.pierce > 0) { pr.pierce--; pierced = true; }
      break;
    case 'frost': case 'kleister': case 'wasser': e.slow = Math.max(e.slow, 2); break;
    case 'schall': e.stun = Math.max(e.stun, 0.5); break;
    case 'ranken': e.stun = Math.max(e.stun, 1); break;
    case 'konfetti': e.stun = Math.max(e.stun, 1.2); break;
    case 'brand': case 'lava':
      e.burnT = 3; e.burnDps = Math.max(e.burnDps, pr.dmg * 0.35);
      break;
    case 'gift': case 'saeure':
      e.poisonT = 4; e.poisonDps = Math.min(pr.dmg * 1.5, e.poisonDps + pr.dmg * 0.15);
      break;
    case 'glueck': e.lucky = true; break;
    case 'schwerkraft': case 'magnet': pull(w, e.x, e.z, pr.ladung === 'schwerkraft' ? 3 : 2.4); kb = 0; break;
    case 'lebensraub': if (owner && w.rng.chance(0.25)) w.heal(owner, 1); break;
    case 'heilung': if (owner && w.rng.chance(0.3)) w.heal(owner, 1); break;
    case 'splitter': spawnSplinters(w, pr, e.x, e.z, e.id); break;
  }

  w.damageEnemy(e, pr.dmg, pr.crit, dx * kb, dz * kb, 0, 0, pr.src);
  lifesteal(w, owner);
  if (pierced) {
    pr.lastHit = e.id;
    pr.dmg *= 1.1;
    return;
  }
  pr.alive = false;
}

function lifesteal(w: World, p: Player | undefined): void {
  if (p && p.stats.lebensraub > 0 && w.rng.next() * 100 < p.stats.lebensraub) w.heal(p, 1);
}

/** Zieht Gegner zu einem Punkt (Schwerkraft, Magnet) – gut für Explosionen danach. */
function pull(w: World, x: number, z: number, r: number): void {
  const n = w.hash.query(x, z, r);
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.hash.result[i]];
    if (!e.alive || e.def.verhalten === 'boss') continue;
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
    if (d > r || d < 0.2) continue;
    e.kbx += (dx / d) * 6; e.kbz += (dz / d) * 6;
  }
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
    w.damageEnemy(cur, dmg, pr.crit && j === 0, 0, 0, 0, 0, pr.src);
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
