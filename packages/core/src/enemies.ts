import { DT, PLAYER_RADIUS } from './constants.ts';
import type { World } from './sim.ts';
import { EnemyState, JUMP_TIME, type Enemy } from './entities.ts';
import { Tile } from './arena.ts';
import { GEGNER, WELLEN } from '../../data/src/index.ts';

const KB_DECAY = Math.pow(0.004, DT);

/** Spawns während der Welle: Rate steigt mit der Welle, jeder Spawn wird 1 s vorher angekündigt. */
export function stepWaves(w: World): void {
  for (const warn of w.warnings) {
    if (!warn.active) continue;
    warn.t -= DT;
    if (warn.t <= 0) {
      warn.active = false;
      spawnEnemy(w, warn.type, warn.x, warn.z);
    }
  }
  w.spawnAcc += WELLEN.spawnRate(w.wave) * DT;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    trySpawn(w);
  }
}

function pendingWarnings(w: World): number {
  let n = 0;
  for (const warn of w.warnings) if (warn.active) n++;
  return n;
}

function pickType(w: World): number {
  let sum = 0;
  for (const g of GEGNER) if (g.abWelle <= w.wave) sum += g.gewicht;
  let r = w.rng.next() * sum;
  for (let i = 0; i < GEGNER.length; i++) {
    const g = GEGNER[i];
    if (g.abWelle > w.wave) continue;
    r -= g.gewicht;
    if (r <= 0) return i;
  }
  return 0;
}

function freeSpot(w: World, x: number, z: number): boolean {
  const a = w.arena;
  const tx = Math.floor(x), tz = Math.floor(z);
  if (a.isSolidTile(tx, tz) || a.tile(tx, tz) === Tile.Lava) return false;
  for (const p of w.players) if (p.alive && Math.hypot(p.x - x, p.z - z) < WELLEN.mindestAbstand) return false;
  for (const b of w.barrels) if (!b.broken && Math.hypot(b.x - x, b.z - z) < 0.8) return false;
  return true;
}

function warn(w: World, type: number, x: number, z: number): void {
  for (const warn of w.warnings) {
    if (warn.active) continue;
    warn.active = true;
    warn.x = x; warn.z = z; warn.t = WELLEN.warnung; warn.type = type;
    return;
  }
}

function trySpawn(w: World): void {
  if (w.enemyCount + pendingWarnings(w) >= WELLEN.maxGegner) return;
  const type = pickType(w);
  const size = w.arena.size;
  const p = w.nearestPlayer(size / 2, size / 2);
  // Bevorzugt in Sichtweite des Spielers, sonst irgendwo in der Arena
  for (let tries = 0; tries < 20; tries++) {
    let x: number, z: number;
    if (p && tries < 12) {
      const a = w.rng.next() * Math.PI * 2, d = WELLEN.mindestAbstand + w.rng.next() * 5;
      x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else {
      x = w.rng.range(1.5, size - 1.5); z = w.rng.range(1.5, size - 1.5);
    }
    if (!freeSpot(w, x, z)) continue;
    warn(w, type, x, z);
    // Grummelbolde kommen gern im Rudel
    if (GEGNER[type].id === 'grummelbold' && w.rng.chance(WELLEN.rudelChance)) {
      const extra = 2 + w.rng.int(0, 2);
      for (let i = 0; i < extra; i++) {
        const a = w.rng.next() * Math.PI * 2, d = 0.7 + w.rng.next() * 0.6;
        const gx = x + Math.cos(a) * d, gz = z + Math.sin(a) * d;
        if (freeSpot(w, gx, gz)) warn(w, type, gx, gz);
      }
    }
    return;
  }
}

export function spawnEnemy(w: World, type: number, x: number, z: number): Enemy | null {
  const def = GEGNER[type];
  for (const e of w.enemies) {
    if (e.alive) continue;
    e.alive = true;
    e.id = w.nextId++;
    e.def = def;
    e.type = type;
    e.x = e.px = x; e.z = e.pz = z; e.y = e.py = 0;
    e.vx = e.vz = e.kbx = e.kbz = 0;
    e.r = def.radius;
    e.maxHp = e.hp = def.hp * WELLEN.hpFaktor(w.wave);
    const p = w.nearestPlayer(x, z);
    e.facing = p ? Math.atan2(p.x - x, p.z - z) : 0;
    e.flash = 0; e.age = 0;
    e.state = EnemyState.Walk; e.stateT = 0;
    e.cd = 0.6 + w.rng.next() * 1.2;
    e.doom = -1;
    e.strafe = w.rng.chance(0.5) ? 1 : -1;
    w.enemyCount++;
    w.events.push({ type: 'spawn', enemy: def.id, x, z });
    return e;
  }
  return null;
}

export function stepEnemies(w: World): void {
  for (const e of w.enemies) {
    if (!e.alive) continue;
    e.age += DT;
    e.flash = Math.max(0, e.flash - DT);
    if (e.doom >= 0) {
      e.doom -= DT;
      if (e.doom < 0) { e.doom = 0; w.doomEnemy(e); }
      continue;
    }

    const p = w.nearestPlayer(e.x, e.z);
    let dx = 0, dz = 0, d = 99;
    if (p) {
      dx = p.x - e.x; dz = p.z - e.z;
      d = Math.hypot(dx, dz) || 1e-6;
      dx /= d; dz /= d;
    }
    const def = e.def;
    let mx = 0, mz = 0;

    if (e.state === EnemyState.Jump) {
      // Kröten-Sprung: feste Flugbahn, landet mit Knall
      e.stateT += DT;
      const k = Math.min(1, e.stateT / JUMP_TIME);
      e.x = e.jx0 + (e.jx1 - e.jx0) * k;
      e.z = e.jz0 + (e.jz1 - e.jz0) * k;
      e.y = Math.sin(Math.PI * k) * 1.3;
      if (k >= 1) {
        e.y = 0;
        w.collideCircle(e, e.r, false);
        w.queueBlast(e.x, e.z, def.explosionsRadius ?? 1.8, def.explosionsSchaden ?? 15, 0, 0, w.newGroup(), true, 'kroete');
        w.killEnemy(e, 0, 0, true);
      }
      continue;
    }

    if (p) {
      switch (def.verhalten) {
        case 'jagen':
          mx = dx * def.tempo; mz = dz * def.tempo;
          break;

        case 'kamikaze':
          e.cd -= DT;
          if (e.state === EnemyState.Walk) {
            mx = dx * def.tempo; mz = dz * def.tempo;
            if (d < (def.sprungDistanz ?? 2.5) && e.cd <= 0) {
              e.state = EnemyState.Windup;
              e.stateT = 0.55;
              w.events.push({ type: 'windup', enemy: def.id, x: e.x, z: e.z });
            }
          } else if (e.state === EnemyState.Windup) {
            e.stateT -= DT;
            if (e.stateT <= 0) {
              // Sprung auf die aktuelle Spielerposition, Weite begrenzt
              const maxD = (def.sprungDistanz ?? 2.5) + 0.6, jd = Math.min(d, maxD);
              e.state = EnemyState.Jump;
              e.stateT = 0;
              e.jx0 = e.x; e.jz0 = e.z;
              e.jx1 = e.x + dx * jd; e.jz1 = e.z + dz * jd;
            }
          }
          break;

        case 'fernkampf': {
          e.cd -= DT;
          const want = def.wunschAbstand ?? 5;
          if (e.state === EnemyState.Walk) {
            if (d > want + 0.8) { mx = dx * def.tempo; mz = dz * def.tempo; }
            else if (d < want - 0.8) { mx = -dx * def.tempo; mz = -dz * def.tempo; }
            else { mx = -dz * e.strafe * def.tempo * 0.5; mz = dx * e.strafe * def.tempo * 0.5; }
            if (e.cd <= 0 && d < want + 3) {
              e.state = EnemyState.Aim;
              e.stateT = 0.45;
              w.events.push({ type: 'windup', enemy: def.id, x: e.x, z: e.z });
            }
          } else if (e.state === EnemyState.Aim) {
            e.stateT -= DT;
            if (e.stateT <= 0) {
              shootToast(w, e, dx, dz);
              e.cd = (def.schussIntervall ?? 2.4) * (0.85 + w.rng.next() * 0.3);
              e.state = EnemyState.Walk;
              if (w.rng.chance(0.3)) e.strafe = -e.strafe;
            }
          }
          break;
        }
      }
    }

    const acc = Math.min(1, DT * 10);
    e.vx += (mx - e.vx) * acc;
    e.vz += (mz - e.vz) * acc;
    e.kbx *= KB_DECAY; e.kbz *= KB_DECAY;
    e.x += (e.vx + e.kbx) * DT;
    e.z += (e.vz + e.kbz) * DT;
    if (w.collideCircle(e, e.r, true)) { e.kbx *= 0.5; e.kbz *= 0.5; }

    // Blickrichtung: zum Spieler, beim Laufen in Laufrichtung
    if (p) {
      const target = Math.atan2(dx, dz);
      let df = target - e.facing;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      e.facing += df * Math.min(1, DT * 8);
    }

    // Berührungsschaden
    if (p && d < e.r + PLAYER_RADIUS + 0.05) w.hurtPlayer(p, def.beruehrSchaden, e.x, e.z);
  }

  separate(w);
}

/** Gegner schieben sich gegenseitig auseinander, statt zu verschmelzen. */
function separate(w: World): void {
  const h = w.hash;
  for (const e of w.enemies) {
    if (!e.alive || e.state === EnemyState.Jump) continue;
    const n = h.query(e.x, e.z, 1);
    for (let i = 0; i < n; i++) {
      const o = w.enemies[h.result[i]];
      if (o.slot <= e.slot || !o.alive || o.state === EnemyState.Jump) continue;
      const dx = o.x - e.x, dz = o.z - e.z, min = e.r + o.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
      const push = (min - d) * 0.5;
      e.x -= nx * push; e.z -= nz * push;
      o.x += nx * push; o.z += nz * push;
    }
  }
}

function shootToast(w: World, e: Enemy, dx: number, dz: number): void {
  for (const pr of w.projectiles) {
    if (pr.alive) continue;
    const sp = e.def.schussTempo ?? 6;
    pr.alive = true;
    pr.hostile = true;
    pr.player = -1;
    pr.geschoss = 'toast'; pr.antrieb = 'gerade'; pr.ladung = 'brand';
    pr.x = pr.px = e.x + dx * 0.4; pr.z = pr.pz = e.z + dz * 0.4; pr.y = pr.py = 0.75;
    pr.vx = dx * sp; pr.vz = dz * sp; pr.speed = sp;
    pr.dmg = e.def.schussSchaden ?? 8; pr.crit = false;
    pr.target = -1; pr.targetId = 0;
    pr.life = 3; pr.t = 0; pr.dur = 0; pr.r = 0.2;
    w.events.push({ type: 'enemyShot', x: e.x, z: e.z });
    return;
  }
}
