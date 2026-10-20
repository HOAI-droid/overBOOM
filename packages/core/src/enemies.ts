import { DT, PLAYER_RADIUS } from './constants.ts';
import type { World } from './sim.ts';
import { EnemyState, JUMP_TIME, type Enemy } from './entities.ts';

/** Ansturm (Sprinter, Pinguin, Boss) */
const CHARGE = 4;
import { Tile } from './arena.ts';
import { BOSS, ELITE, GEGNER, GEGNER_INDEX, KOOP, WELLEN, type BossAngriff } from '../../data/src/index.ts';

const KB_DECAY = Math.pow(0.004, DT);

/** Spawns während der Welle: Rate steigt mit der Welle, jeder Spawn wird 1 s vorher angekündigt. */
export function stepWaves(w: World): void {
  for (const warn of w.warnings) {
    if (!warn.active) continue;
    warn.t -= DT;
    if (warn.t <= 0) {
      warn.active = false;
      spawnEnemy(w, warn.type, warn.x, warn.z, warn.elite);
    }
  }
  w.spawnAcc += WELLEN.spawnRate(w.wave) * (w.isBossWave ? BOSS.spawnAnteil : 1) * w.koop(KOOP.spawnProSpieler) * w.gw.spawn * DT;
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

/** Gegnertyp aus dem Pool der aktuellen Insel */
function pickType(w: World): number {
  const pool = w.insel.gegner;
  let sum = 0;
  for (const g of pool) if (g.abWelle <= w.wave) sum += g.gewicht;
  if (sum <= 0) return 0;
  let r = w.rng.next() * sum;
  for (const g of pool) {
    if (g.abWelle > w.wave) continue;
    r -= g.gewicht;
    if (r <= 0) return GEGNER_INDEX[g.id];
  }
  return GEGNER_INDEX[pool[0].id];
}

function freeSpot(w: World, x: number, z: number): boolean {
  const a = w.arena;
  const tx = Math.floor(x), tz = Math.floor(z);
  const t = a.tile(tx, tz);
  if (a.isSolidTile(tx, tz) || t === Tile.Lava || t === Tile.Poison) return false;
  for (const p of w.players) if (p.alive && Math.hypot(p.x - x, p.z - z) < WELLEN.mindestAbstand) return false;
  for (const b of w.barrels) if (!b.broken && Math.hypot(b.x - x, b.z - z) < 0.8) return false;
  return true;
}

function warn(w: World, type: number, x: number, z: number, elite = false): void {
  for (const warn of w.warnings) {
    if (warn.active) continue;
    warn.active = true;
    warn.x = x; warn.z = z; warn.t = WELLEN.warnung; warn.type = type; warn.elite = elite;
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
    warn(w, type, x, z, w.rng.chance(ELITE.chance(w.wave) * w.gw.elite));
    // Rudeltiere (Grummelbolde, Funkenkobolde) kommen gern zu mehreren
    const rudel = GEGNER[type].rudel ?? 0;
    if (rudel > 0 && w.rng.chance(WELLEN.rudelChance)) {
      const extra = Math.max(1, rudel - 1) + w.rng.int(0, 1);
      for (let i = 0; i < extra; i++) {
        const a = w.rng.next() * Math.PI * 2, d = 0.7 + w.rng.next() * 0.6;
        const gx = x + Math.cos(a) * d, gz = z + Math.sin(a) * d;
        if (freeSpot(w, gx, gz)) warn(w, type, gx, gz);
      }
    }
    return;
  }
}

/** Boss erscheint am Arenarand gegenüber dem Spieler. */
export function spawnBoss(w: World, id: string): void {
  const BOSS_TYPE = GEGNER_INDEX[id] ?? GEGNER_INDEX.baron;
  const p = w.nearestPlayer(w.arena.size / 2, w.arena.size / 2);
  const size = w.arena.size;
  let bx = size / 2, bz = size / 2;
  for (let t = 0; t < 30; t++) {
    const a = w.rng.next() * Math.PI * 2;
    const x = size / 2 + Math.cos(a) * 7, z = size / 2 + Math.sin(a) * 7;
    if (freeSpot(w, x, z) && !w.solidAt(x + 0.8, z) && !w.solidAt(x - 0.8, z) && !w.solidAt(x, z + 0.8) && !w.solidAt(x, z - 0.8)) { bx = x; bz = z; break; }
  }
  const e = spawnEnemy(w, BOSS_TYPE, bx, bz);
  if (!e) return;
  e.maxHp = e.hp = e.def.hp * BOSS.hpFaktor(w.wave) * w.koop(KOOP.bossProSpieler) * w.gw.bossHp;
  e.cd = 2.5;
  e.bossPhase = 1;
  e.summonCd = 0; // Index des nächsten Angriffs
  w.boss = e.slot;
  if (p) e.facing = Math.atan2(p.x - bx, p.z - bz);
  w.events.push({ type: 'bossSpawn', x: bx, z: bz });
}

export function spawnEnemy(w: World, type: number, x: number, z: number, elite = false): Enemy | null {
  const def = GEGNER[type];
  for (const e of w.enemies) {
    if (e.alive) continue;
    e.alive = true;
    e.id = w.nextId++;
    e.def = def;
    e.type = type;
    e.x = e.px = x; e.z = e.pz = z; e.y = e.py = 0;
    e.vx = e.vz = e.kbx = e.kbz = 0;
    e.elite = elite;
    e.r = def.radius * (elite ? ELITE.groesse : 1);
    e.maxHp = e.hp = def.hp * WELLEN.hpFaktor(w.wave) * (elite ? ELITE.hp : 1) * w.koop(KOOP.hpProSpieler) * w.gw.hp;
    e.dmgMul = WELLEN.schadenFaktor(w.wave) * (elite ? ELITE.schaden : 1) * w.gw.schaden;
    e.slow = e.stun = e.burnT = e.burnDps = e.poisonT = e.poisonDps = e.dotClock = 0;
    e.lucky = false;
    e.bossPhase = 1; e.summonCd = 0;
    e.wet = e.acid = e.acidT = e.frost = e.confuse = e.chicken = e.cdx = e.cdz = 0;
    e.cloud = false;
    e.shockT = e.gravT = e.reactT = e.frostT = 0;
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

    // Schaden über Zeit (Brand, Gift) – zweimal pro Sekunde
    if (e.burnT > 0 || e.poisonT > 0) {
      e.dotClock += DT;
      if (e.dotClock >= 0.5) {
        e.dotClock -= 0.5;
        const dmg = (e.burnT > 0 ? e.burnDps : 0) * 0.5 + (e.poisonT > 0 ? e.poisonDps : 0) * 0.5;
        e.burnT = Math.max(0, e.burnT - 0.5);
        e.poisonT = Math.max(0, e.poisonT - 0.5);
        if (e.poisonT <= 0) e.poisonDps = 0;
        if (dmg > 0) { w.damageEnemy(e, dmg, false, 0, 0); if (!e.alive) continue; }
      }
    }
    e.slow = Math.max(0, e.slow - DT);
    e.wet = Math.max(0, e.wet - DT);
    e.shockT = Math.max(0, e.shockT - DT);
    e.gravT = Math.max(0, e.gravT - DT);
    e.reactT = Math.max(0, e.reactT - DT);
    e.frostT = Math.max(0, e.frostT - DT);
    if (e.acidT > 0 && (e.acidT -= DT) <= 0) e.acid = 0;
    if ((e.chicken > 0 || e.confuse > 0) && e.state !== EnemyState.Jump) {
      // verwirrt oder verhühnert: läuft ziellos herum, greift nicht an
      e.chicken = Math.max(0, e.chicken - DT);
      e.confuse = Math.max(0, e.confuse - DT);
      e.state = EnemyState.Walk;
      if ((e.cdx === 0 && e.cdz === 0) || w.rng.chance(DT * 2)) {
        const a = w.rng.next() * Math.PI * 2;
        e.cdx = Math.cos(a); e.cdz = Math.sin(a);
      }
      const sp = e.def.tempo * (e.chicken > 0 ? 0.8 : 0.5);
      e.vx = e.cdx * sp; e.vz = e.cdz * sp;
      e.kbx *= KB_DECAY; e.kbz *= KB_DECAY;
      e.x += (e.vx + e.kbx) * DT; e.z += (e.vz + e.kbz) * DT;
      if (w.collideCircle(e, e.r, true)) { e.cdx = -e.cdx; e.cdz = -e.cdz; }
      e.facing = Math.atan2(e.cdx, e.cdz);
      continue;
    }
    e.cdx = e.cdz = 0;
    if (e.stun > 0) {
      e.stun -= DT;
      e.kbx *= KB_DECAY; e.kbz *= KB_DECAY;
      e.x += e.kbx * DT; e.z += e.kbz * DT;
      e.vx = e.vz = 0;
      w.collideCircle(e, e.r, true);
      continue;
    }
    const slowMul = e.slow > 0 ? (w.synFx.eisplus ? 0.4 : 0.55) : 1;

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
        w.queueBlast(e.x, e.z, (def.explosionsRadius ?? 1.8) * (e.elite ? 1.3 : 1), (def.explosionsSchaden ?? 15) * e.dmgMul, 0, 0, w.newGroup(), true, 'kroete');
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

        case 'boss':
          stepBoss(w, e, dx, dz);
          mx = dx * def.tempo * (e.bossPhase === 2 ? 1.25 : 1); mz = dz * def.tempo * (e.bossPhase === 2 ? 1.25 : 1);
          if (e.state === EnemyState.Aim || e.state === EnemyState.Windup) { mx *= 0.15; mz *= 0.15; }
          if (e.state === CHARGE) { mx = e.cdx * (def.ansturmTempo ?? 9); mz = e.cdz * (def.ansturmTempo ?? 9); }
          break;

        case 'sprinter': case 'rutscher': {
          // Scharren/Anlauf (telegrafiert), dann geradeaus losstürmen
          e.cd -= DT;
          if (e.state === EnemyState.Walk) {
            mx = dx * def.tempo; mz = dz * def.tempo;
            if (d < (def.ansturmAbstand ?? 5) && e.cd <= 0) {
              e.state = EnemyState.Windup; e.stateT = def.verhalten === 'rutscher' ? 0.6 : 0.45;
              w.events.push({ type: 'windup', enemy: def.id, x: e.x, z: e.z });
            }
          } else if (e.state === EnemyState.Windup) {
            e.stateT -= DT;
            if (e.stateT <= 0) { e.state = CHARGE; e.stateT = def.ansturmDauer ?? 0.6; e.cdx = dx; e.cdz = dz; }
          } else if (e.state === CHARGE) {
            e.stateT -= DT;
            mx = e.cdx * (def.ansturmTempo ?? 9); mz = e.cdz * (def.ansturmTempo ?? 9);
            const boom = def.verhalten === 'rutscher' && (d < e.r + 0.5 || e.stateT <= 0);
            if (boom) {
              w.queueBlast(e.x, e.z, (def.explosionsRadius ?? 1.6) * (e.elite ? 1.3 : 1), (def.explosionsSchaden ?? 14) * e.dmgMul, 0, 0, w.newGroup(), true, 'kroete');
              w.killEnemy(e, 0, 0, true);
              continue;
            }
            if (e.stateT <= 0) { e.state = EnemyState.Walk; e.cd = 2.2 + w.rng.next(); e.cdx = e.cdz = 0; }
          }
          break;
        }

        case 'heiler': case 'beschwoerer': case 'minenleger': {
          // Halten Abstand und wirken aus der Distanz
          const want = def.wunschAbstand ?? 5;
          if (d > want + 0.8) { mx = dx * def.tempo; mz = dz * def.tempo; }
          else if (d < want - 0.8) { mx = -dx * def.tempo; mz = -dz * def.tempo; }
          else { mx = -dz * e.strafe * def.tempo * 0.5; mz = dx * e.strafe * def.tempo * 0.5; }
          e.cd -= DT;
          if (e.cd <= 0) {
            if (def.verhalten === 'heiler') {
              e.cd = def.heilIntervall ?? 3;
              healAround(w, e);
            } else if (def.verhalten === 'beschwoerer') {
              e.cd = def.beschwoerIntervall ?? 6;
              summon(w, e, def.beschwoert ?? 'grummelbold', def.beschwoerAnzahl ?? 2);
            } else {
              e.cd = def.minenIntervall ?? 3;
              dropMine(w, e);
            }
            if (w.rng.chance(0.4)) e.strafe = -e.strafe;
          }
          break;
        }

        case 'schild':
          mx = dx * def.tempo; mz = dz * def.tempo;
          break;

        case 'spurleger':
          mx = dx * def.tempo; mz = dz * def.tempo;
          e.cd -= DT;
          if (e.cd <= 0) {
            e.cd = def.spurIntervall ?? 1;
            w.addHazard(def.spur === 'lava' ? 'lava' : 'gift', e.x, e.z, def.spur === 'lava' ? 0.55 : 0.7, def.spur === 'lava' ? 3 : 2.5, (def.spurSchaden ?? 5) * e.dmgMul, '', false, 1, 0, true);
          }
          break;
      }
    }
    mx *= slowMul * w.gw.tempo; mz *= slowMul * w.gw.tempo;

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

    // Lava brennt auch Gegner (außer dem Glutgesindel)
    if (def.spur !== 'lava' && def.verhalten !== 'boss' && w.arena.tile(Math.floor(e.x), Math.floor(e.z)) === Tile.Lava) {
      e.burnT = Math.max(e.burnT, 1); e.burnDps = Math.max(e.burnDps, 8 * WELLEN.hpFaktor(w.wave) ** 0.6);
    }

    // Berührungsschaden (Ansturm trifft härter)
    if (p && d < e.r + PLAYER_RADIUS + 0.05) w.hurtPlayer(p, def.beruehrSchaden * e.dmgMul * (e.state === CHARGE ? 1.5 : 1), e.x, e.z);
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
  hostileShot(w, e, dx, dz, e.def.schussTempo ?? 6, (e.def.schussSchaden ?? 8) * e.dmgMul, e.def.schussGeschoss ?? 'toast', e.def.schussEffekt === 'langsam' ? 'langsam' : 'brand');
  w.events.push({ type: 'enemyShot', x: e.x, z: e.z });
}

/** Feindliches Geschoss (gerade) */
function hostileShot(w: World, e: Enemy, dx: number, dz: number, sp: number, dmg: number, geschoss: string, ladung: string): void {
  for (const pr of w.projectiles) {
    if (pr.alive) continue;
    pr.alive = true;
    pr.hostile = true;
    pr.player = -1;
    pr.geschoss = geschoss; pr.antrieb = 'gerade'; pr.ladung = ladung;
    pr.x = pr.px = e.x + dx * 0.4; pr.z = pr.pz = e.z + dz * 0.4; pr.y = pr.py = 0.75;
    pr.vx = dx * sp; pr.vz = dz * sp; pr.speed = sp;
    pr.dmg = dmg; pr.crit = false;
    pr.target = -1; pr.targetId = 0;
    pr.life = 3.5; pr.t = 0; pr.dur = 0; pr.r = 0.2;
    pr.src = ''; pr.blastMul = 1; pr.pierce = 0; pr.lastHit = 0;
    pr.slot = -1; pr.mask = 0; pr.instabil = 0; pr.bounces = 0; pr.mode = 0; pr.cd = 0; pr.rate = 1;
    return;
  }
}

/** Heiler: heilt alle Gegner im Umkreis (sichtbarer grüner Puls) */
function healAround(w: World, e: Enemy): void {
  const r = e.def.heilRadius ?? 3;
  for (const o of w.enemies) {
    if (!o.alive || o.doom >= 0 || o === e || o.def.verhalten === 'boss') continue;
    if (Math.hypot(o.x - e.x, o.z - e.z) > r) continue;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (e.def.heilMenge ?? 0.2));
  }
  w.events.push({ type: 'enemyHeal', x: e.x, z: e.z, r });
}

/** Portale: Verstärkung erscheint (mit Spawn-Warnung) um den Beschwörer */
function summon(w: World, e: Enemy, id: string, n: number): void {
  const type = GEGNER_INDEX[id] ?? 0;
  if (w.enemyCount >= WELLEN.maxGegner) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + w.rng.next();
    const x = e.x + Math.cos(a) * 1.7, z = e.z + Math.sin(a) * 1.7;
    if (!w.solidAt(x, z)) warn(w, type, x, z);
  }
  w.events.push({ type: 'windup', enemy: e.def.id, x: e.x, z: e.z });
}

/** Minenbot: legt eine feindliche Mine ab (scharf nach kurzer Zeit) */
function dropMine(w: World, e: Enemy): void {
  let n = 0;
  for (const pr of w.projectiles) if (pr.alive && pr.hostile && pr.antrieb === 'ablegen') n++;
  if (n >= 24) return;
  for (const pr of w.projectiles) {
    if (pr.alive) continue;
    pr.alive = true; pr.hostile = true; pr.player = -1;
    pr.geschoss = 'mine'; pr.antrieb = 'ablegen'; pr.ladung = 'explosion';
    pr.x = pr.px = e.x; pr.z = pr.pz = e.z; pr.y = pr.py = 0.12;
    pr.vx = pr.vz = 0; pr.speed = 0;
    pr.dmg = (e.def.minenSchaden ?? 12) * e.dmgMul; pr.crit = false;
    pr.target = -1; pr.targetId = 0; pr.life = 12; pr.t = 0; pr.dur = 0; pr.r = 0.75;
    pr.src = ''; pr.blastMul = 1; pr.pierce = 0; pr.lastHit = 0;
    pr.slot = -1; pr.mask = 0; pr.instabil = 0; pr.bounces = 0; pr.mode = 0; pr.cd = 0.7; pr.rate = 1;
    return;
  }
}

/**
 * Bosse spielen ihre Angriffe der Reihe nach, jeder mit Ankündigung (Aufleuchten).
 * Phase 2 (unter 50 % Leben): längere Liste, kürzere Pausen.
 */
function stepBoss(w: World, e: Enemy, dx: number, dz: number): void {
  const def = e.def;
  const list: BossAngriff[] = (e.bossPhase === 2 ? def.angriffe2 : def.angriffe1) ?? ['bomben'];
  const ph = e.bossPhase === 2 ? BOSS.phase2 : BOSS.phase1;
  if (e.state === CHARGE) {
    e.stateT -= DT;
    if (e.stateT <= 0) { e.state = EnemyState.Walk; e.cd = ph.intervall * 0.6; }
    return;
  }
  e.cd -= DT;
  if (e.state === EnemyState.Walk && e.cd <= 0) {
    e.state = EnemyState.Aim;
    e.stateT = list[e.summonCd % list.length] === 'ansturm' ? 0.75 : 0.6;
    e.cdx = dx; e.cdz = dz;
    w.events.push({ type: 'windup', enemy: def.id, x: e.x, z: e.z });
  } else if (e.state === EnemyState.Aim) {
    e.stateT -= DT;
    if (e.stateT > 0) return;
    const atk = list[e.summonCd % list.length];
    e.summonCd++;
    e.state = EnemyState.Walk;
    e.cd = ph.intervall;
    const p = w.nearestPlayer(e.x, e.z);
    if (!p) return;
    switch (atk) {
      case 'bomben':
        for (let i = 0; i < ph.salve; i++) {
          // erste Bombe genau auf den Spieler, der Rest drumherum
          const a = w.rng.next() * Math.PI * 2, r = i === 0 ? 0 : 1 + w.rng.next() * 2.4;
          throwBomb(w, e, p.x + p.vx * 0.4 + Math.cos(a) * r, p.z + p.vz * 0.4 + Math.sin(a) * r, i * 0.08, 'explosion');
        }
        break;
      case 'sporen':
        for (let i = 0; i < ph.salve; i++) {
          const a = w.rng.next() * Math.PI * 2, r = i === 0 ? 0.3 : 1.2 + w.rng.next() * 2.6;
          throwBomb(w, e, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, i * 0.1, 'gift');
        }
        break;
      case 'ring': {
        const n = e.bossPhase === 2 ? 18 : 12, off = w.rng.next() * Math.PI;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          hostileShot(w, e, Math.cos(a), Math.sin(a), 5.5, 9 * e.dmgMul, def.ringGeschoss ?? 'toast', 'keine');
        }
        w.events.push({ type: 'enemyShot', x: e.x, z: e.z });
        break;
      }
      case 'ansturm':
        e.state = CHARGE;
        e.stateT = def.ansturmDauer ?? 0.8;
        e.cdx = dx; e.cdz = dz;
        break;
      case 'beschwoeren':
        summon(w, e, def.beschwoert ?? 'grummelbold', def.beschwoerAnzahl ?? 3);
        break;
    }
  }
}

function throwBomb(w: World, e: Enemy, tx: number, tz: number, delay: number, ladung: 'explosion' | 'gift'): void {
  const size = w.arena.size;
  tx = Math.max(1.2, Math.min(size - 1.6, tx));
  tz = Math.max(1.2, Math.min(size - 1.6, tz));
  for (const pr of w.projectiles) {
    if (pr.alive) continue;
    pr.alive = true;
    pr.hostile = true;
    pr.player = -1;
    pr.geschoss = ladung === 'gift' ? 'spore' : 'bombe'; pr.antrieb = 'zielbogen'; pr.ladung = ladung;
    pr.x = pr.px = pr.sx = e.x; pr.z = pr.pz = pr.sz = e.z; pr.y = pr.py = 2.2;
    pr.tx = tx; pr.tz = tz;
    pr.vx = tx - e.x; pr.vz = tz - e.z; pr.speed = 1;
    pr.dmg = BOSS.bombenSchaden * e.dmgMul; pr.crit = false;
    pr.target = -1; pr.targetId = 0;
    pr.t = -delay; pr.dur = BOSS.flugzeit; pr.life = BOSS.flugzeit + delay + 0.5;
    pr.r = BOSS.bombenRadius;
    pr.src = ''; pr.blastMul = 1; pr.pierce = 0; pr.lastHit = 0;
    pr.slot = -1; pr.mask = 0; pr.instabil = 0; pr.bounces = 0; pr.mode = 0; pr.cd = 0; pr.rate = 1;
    w.events.push({ type: 'enemyShot', x: e.x, z: e.z });
    return;
  }
}
