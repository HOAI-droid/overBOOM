import { DT, PLAYER_RADIUS } from './constants.ts';
import type { World, Player } from './sim.ts';
import type { Enemy, Projectile, WeaponSlot } from './entities.ts';
import { AMBOSS, KAMPF, LADUNG_ELEMENT, STERNE, STUFEN, elemente, findeReaktion, type Reaktionselement, type Waffe } from '../../data/src/index.ts';

/**
 * Waffen feuern automatisch auf den nächsten Gegner in Reichweite.
 * Alles entsteht systemisch aus den drei Bauteilen – deshalb funktioniert jede Fusion:
 *   Geschoss → wie es aussieht (Renderer)
 *   Antrieb  → wie es fliegt / trifft (alle 19 Antriebe unten)
 *   Ladung   → was beim Treffer passiert (alle 22 Ladungen in hitEnemy/impactAt)
 */

/** Sonderwirkungen geheimer Rezepte als Bitmaske */
export const SP = {
  salve3: 1, cluster: 2, doppelblitz: 4, implosion: 8, heilkeks: 16,
  schwarm6: 32, konfettifrost: 64, orbit6: 128, giftwolke: 256, kueken: 512,
  /** Evolution „Mega": größere Explosionen */
  gross: 1024
} as const;

/** Mods als Bitmaske */
export const MOD = {
  doppelschuss: 1, zielsuchend: 2, querschlaeger: 4, nachbrenner: 8, clusterbombe: 16, brandmunition: 32,
  kettenblitz: 64, gravkern: 128, frostkern: 256, giftspitze: 512, vampirzahn: 1024, gluecksbringer: 2048
} as const;

export function modMask(mods: readonly string[]): number {
  let m = 0;
  for (const id of mods) m |= (MOD as Record<string, number>)[id] ?? 0;
  return m;
}

export function spezialMask(w: Waffe): number {
  let m = 0;
  for (const s of w.spezial ?? []) m |= (SP as Record<string, number>)[s] ?? 0;
  return m;
}

const zapIds = new Int32Array(24);
const scratch = new Int32Array(256);
/** eigener Puffer für Reaktionen (die laufen mitten in Flächenangriffen) */
const scratch2 = new Int32Array(256);

/** Kontext eines Treffers – ein einziges wiederverwendetes Objekt (keine Allokation) */
interface HitCtx {
  /** Mods (Bitmaske) */
  mods: number;
  player: number;
  ladung: string;
  geschoss: string;
  src: string;
  blastMul: number;
  instabil: number;
  mask: number;
  dmg: number;
  crit: boolean;
}
const ctx: HitCtx = { mods: 0, player: 0, ladung: '', geschoss: '', src: '', blastMul: 1, instabil: 0, mask: 0, dmg: 0, crit: false };

function ctxFromShot(pr: Projectile): HitCtx {
  ctx.player = pr.player; ctx.ladung = pr.ladung; ctx.geschoss = pr.geschoss; ctx.src = pr.src;
  ctx.blastMul = pr.blastMul; ctx.instabil = pr.instabil; ctx.mask = pr.mask; ctx.dmg = pr.dmg; ctx.crit = pr.crit;
  ctx.mods = pr.mods;
  return ctx;
}

function ctxFromSlot(p: Player, s: WeaponSlot, dmg: number, crit: boolean): HitCtx {
  const w = s.waffe;
  ctx.player = p.id; ctx.ladung = w.ladung; ctx.geschoss = w.geschoss; ctx.src = w.id;
  ctx.blastMul = Math.max(0.3, 1 + p.stats.explosion / 100) * (s.mask & SP.gross ? 1.5 : 1); ctx.instabil = w.fusion?.instabil ?? 0;
  ctx.mask = s.mask; ctx.dmg = dmg; ctx.crit = crit;
  ctx.mods = s.modMask;
  return ctx;
}

/** Effektive Werte einer Waffe aus Grundwert × Stufe × Spielerwerten */
export function weaponDamage(p: Player, s: WeaponSlot): number {
  const w = s.waffe;
  let perk = 1;
  if (p.perk.nahkampfprofi && w.gruppe === 'Nahkampf') perk *= 1.5;
  if (p.perk.turmprofi && w.antrieb === 'turm') perk *= 1.5;
  if (p.perk.fusionsprofi && w.fusion) perk *= 1.25;
  if (p.perk.huehnerfreund && (w.fusion ? w.fusion.elemente : elemente(w)).includes('Gacker')) perk *= 1.4;
  const stars = 1 + s.stars * STERNE.schadenProStern;
  const instant = w.antrieb === 'strahl' || w.antrieb === 'kegel' || w.antrieb === 'nahkampf' || w.antrieb === 'teleport';
  const mods = (s.modMask & MOD.nachbrenner ? 1.15 : 1) * (s.modMask & MOD.doppelschuss && instant ? 1.6 : 1);
  return w.schaden * STUFEN.schaden[s.tier - 1] * Math.max(0.1, 1 + p.stats.schaden / 100) * perk * stars * mods;
}
export function weaponRate(p: Player, s: WeaponSlot): number {
  return s.waffe.feuerrate * STUFEN.feuerrate[s.tier - 1] * Math.max(0.2, 1 + p.stats.angriff / 100) * (1 + s.stars * STERNE.feuerrateProStern);
}
export function weaponRange(p: Player, s: WeaponSlot): number {
  return Math.max(1.5, s.waffe.reichweite * (1 + p.stats.reichweite / 100));
}

/** Persistente Antriebe: Begleiter, Türme, Minen – höchstens so viele gleichzeitig pro Waffe */
function cap(antrieb: string, mask: number, p?: Player): number {
  switch (antrieb) {
    case 'orbit': return mask & SP.orbit6 ? 6 : 3;
    case 'schwarm': return mask & SP.schwarm6 ? 6 : 3;
    case 'turm': return p?.perk.turmprofi ? 2 : 1;
    case 'ablegen': return 8;
    default: return Infinity;
  }
}

/** Zusätzliche Suchweite, damit Minen/Türme/Kreisel schon vor Kontakt entstehen */
function extraRange(antrieb: string): number {
  return antrieb === 'ablegen' ? 4 : antrieb === 'turm' || antrieb === 'orbit' ? 2 : 0;
}

export function stepWeapons(w: World): void {
  for (const p of w.players) {
    if (!p.alive) continue;
    for (let i = 0; i < p.weapons.length; i++) {
      const s = p.weapons[i];
      const wx = p.x + s.ox, wz = p.z + s.oz;
      s.cd -= DT;
      const range = weaponRange(p, s);
      const t = w.nearestEnemy(wx, wz, range + extraRange(s.waffe.antrieb));
      s.target = t;
      if (t < 0) { if (s.cd < 0) s.cd = 0; continue; }
      const e = w.enemies[t];
      const dx = e.x - wx, dz = e.z - wz, d = Math.hypot(dx, dz) || 1e-6;
      s.aim = Math.atan2(dx, dz);
      if (s.cd > 0) continue;
      // Türme feuern selbst – die Waffe baut nur alle 8 s einen neuen
      const interval = s.waffe.antrieb === 'turm' ? TURRET_LIFE / cap('turm', 0, p) : 1 / weaponRate(p, s);
      s.cd = Math.max(0.02, s.cd + interval);
      fire(w, p, i, s, e, wx, wz, dx / d, dz / d, d, range);
    }
  }
}

const TURRET_LIFE = 8;

function fire(w: World, p: Player, slot: number, s: WeaponSlot, e: Enemy, x: number, z: number, dx: number, dz: number, dist: number, range: number): void {
  const waffe = s.waffe;
  const a = waffe.antrieb;
  const crit = w.rng.next() * 100 < KAMPF.kritChance * 100 + p.stats.krit;
  const dmg = weaponDamage(p, s) * (crit ? KAMPF.kritFaktor : 1);
  const speed = (KAMPF.tempo[a] ?? KAMPF.tempo.gerade) * (s.modMask & MOD.nachbrenner ? 1.4 : 1);
  const volley = (s.mask & SP.salve3 ? 3 : 1) * (s.modMask & MOD.doppelschuss ? 2 : 1);

  if (cap(a, s.mask, p) < Infinity && countOwned(w, p.id, slot) >= cap(a, s.mask, p)) {
    // Begleiter/Türme/Minen voll – nichts Neues
    return;
  }

  switch (a) {
    case 'strahl': beam(w, ctxFromSlot(p, s, dmg, crit), x, z, dx, dz, range); break;
    case 'kegel': cone(w, ctxFromSlot(p, s, dmg, crit), x, z, dx, dz, range); break;
    case 'nahkampf': swing(w, ctxFromSlot(p, s, dmg, crit), p.x, p.z, dx, dz, range); break;
    case 'teleport':
      // erscheint direkt im Ziel – kein Ausweichen möglich
      w.events.push({ type: 'teleport', x: e.x, z: e.z, geschoss: waffe.geschoss });
      impactAt(w, ctxFromSlot(p, s, dmg, crit), e.x, e.z, e, dx, dz);
      break;
    case 'faecher':
      for (let k = -2; k <= 2; k++) for (let v = 0; v < (s.modMask & MOD.doppelschuss ? 2 : 1); v++) {
        const ang = Math.atan2(dx, dz) + k * 0.18 + v * 0.09;
        spawnShot(w, p, s, slot, 'gerade', x, z, Math.sin(ang), Math.cos(ang), speed, dmg, crit, e, dist, range);
      }
      break;
    case 'regen':
      for (let k = 0; k < volley; k++) {
        const ang = w.rng.next() * Math.PI * 2, r = k === 0 ? w.rng.next() * 0.8 : 0.8 + w.rng.next() * 1.6;
        const pr = spawnShot(w, p, s, slot, 'regen', x, z, dx, dz, speed, dmg, crit, e, dist, range);
        if (pr) { pr.tx = e.x + Math.cos(ang) * r; pr.tz = e.z + Math.sin(ang) * r; pr.x = pr.px = pr.tx; pr.z = pr.pz = pr.tz; pr.t = -k * 0.12; }
      }
      break;
    default: {
      let flight = FLIGHTS.has(a) ? a : 'gerade';
      // Mods verändern gerade Geschosse
      if (flight === 'gerade' && s.modMask & MOD.querschlaeger) flight = 'abprall';
      else if (flight === 'gerade' && s.modMask & MOD.zielsuchend) flight = 'zielsuchend';
      for (let k = 0; k < volley; k++) {
        const ang = Math.atan2(dx, dz) + (k - (volley - 1) / 2) * 0.25;
        spawnShot(w, p, s, slot, flight, x, z, Math.sin(ang), Math.cos(ang), speed, dmg, crit, e, dist, range);
      }
    }
  }
  w.events.push({ type: 'fire', player: p.id, slot, weapon: waffe.id, x, z, dirX: dx, dirZ: dz });
}

const FLIGHTS = new Set(['gerade', 'zielsuchend', 'zielbogen', 'bogen', 'abprall', 'bumerang', 'spirale', 'huepfend', 'ablegen', 'turm', 'schwarm', 'orbit', 'rollen', 'regen']);

function countOwned(w: World, player: number, slot: number): number {
  let n = 0;
  for (const pr of w.projectiles) if (pr.alive && !pr.hostile && pr.player === player && pr.slot === slot) n++;
  return n;
}

function freeProjectile(w: World): Projectile | null {
  for (const pr of w.projectiles) if (!pr.alive) return pr;
  return null;
}

function spawnShot(w: World, p: Player, s: WeaponSlot, slot: number, flight: string, x: number, z: number, dx: number, dz: number, speed: number, dmg: number, crit: boolean, e: Enemy, dist: number, range: number): Projectile | null {
  const pr = freeProjectile(w);
  if (!pr) return null;
  const waffe = s.waffe;
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
  pr.src = waffe.id;
  pr.blastMul = Math.max(0.3, 1 + p.stats.explosion / 100);
  pr.pierce = waffe.ladung === 'plasma' ? 3 : 0;
  pr.lastHit = 0;
  pr.slot = -1;
  pr.mask = s.mask;
  pr.instabil = waffe.fusion?.instabil ?? 0;
  pr.bounces = 0; pr.mode = 0; pr.cd = 0; pr.rate = 1;
  pr.mods = s.modMask;
  if (s.mask & SP.gross) { pr.blastMul *= 1.5; pr.r *= 1.4; }
  pr.ang = Math.atan2(dz, dx); pr.rad = 0;
  pr.life = (range / speed) * 1.25 + 0.1;

  switch (flight) {
    case 'zielbogen': case 'bogen':
      pr.dur = Math.max(0.45, Math.min(1.2, dist / speed));
      pr.life = pr.dur + 0.5;
      if (flight === 'bogen') { pr.tx = e.x + e.vx * pr.dur * 0.6; pr.tz = e.z + e.vz * pr.dur * 0.6; }
      break;
    case 'zielsuchend': pr.life = 2.5; break;
    case 'abprall': pr.bounces = waffe.antrieb === 'abprall' ? 4 : 2; pr.life = 3; break;
    case 'huepfend': pr.bounces = 3; pr.dur = Math.max(0.35, Math.min(0.8, dist / speed)); pr.life = 4; break;
    case 'bumerang': pr.dur = range / speed; pr.life = pr.dur * 2 + 1.5; pr.pierce = 99; break;
    case 'spirale': pr.rad = 0.4; pr.ang = Math.atan2(dz, dx); pr.life = range / 2.4; pr.pierce = 2; break;
    case 'rollen': pr.y = pr.py = 0.25; pr.pierce = 99; pr.r = 0.3; break;
    case 'regen': pr.y = pr.py = 7; pr.dur = 0.55; pr.life = 2; pr.r = 0.9; break;
    case 'ablegen':
      pr.x = pr.px = p.x; pr.z = pr.pz = p.z; pr.y = pr.py = 0.12; pr.vx = pr.vz = 0;
      pr.life = 12; pr.slot = slot; pr.r = 0.7; pr.cd = 0.4;
      break;
    case 'turm':
      pr.x = pr.px = x; pr.z = pr.pz = z; pr.y = pr.py = 0;
      pr.vx = dx; pr.vz = dz;
      pr.life = TURRET_LIFE; pr.slot = slot; pr.rad = range; pr.rate = 1 / weaponRate(p, s); pr.cd = 0.3;
      break;
    case 'orbit':
      pr.slot = slot; pr.life = 4; pr.rad = s.mask & SP.orbit6 ? 1.8 : 1.3; pr.r = 0.3;
      pr.ang = countOwned(w, p.id, slot) * (Math.PI * 2 / cap('orbit', s.mask)) + w.tick * DT * 3.2;
      pr.x = pr.px = p.x + Math.cos(pr.ang) * pr.rad; pr.z = pr.pz = p.z + Math.sin(pr.ang) * pr.rad;
      break;
    case 'schwarm':
      pr.slot = slot; pr.life = 7; pr.rad = range; pr.r = 0.25; pr.cd = 0.2;
      pr.ang = w.rng.next() * Math.PI * 2;
      break;
  }
  return pr;
}

/** Kleine Splitter-Geschosse (Ladung „Splitter"), fliegen sternförmig auseinander. */
function spawnSplinters(w: World, c: HitCtx, x: number, z: number, skipId: number): void {
  let made = 0;
  for (const pr of w.projectiles) {
    if (made >= 4) break;
    if (pr.alive) continue;
    const a = made * Math.PI * 0.5 + 0.4;
    initChild(pr, c, x, z, 0.7, Math.sin(a), Math.cos(a), 11, c.dmg * 0.4);
    pr.geschoss = 'kugel'; pr.ladung = 'keine'; pr.life = 0.35; pr.r = 0.12; pr.lastHit = skipId;
    made++;
  }
}

/** Neues Geschoss mit Eigenschaften des Treffer-Kontexts (Splitter, Turm-Schüsse, Küken) */
function initChild(pr: Projectile, c: HitCtx, x: number, z: number, y: number, dx: number, dz: number, speed: number, dmg: number): void {
  pr.alive = true; pr.hostile = false; pr.player = c.player;
  pr.geschoss = c.geschoss; pr.antrieb = 'gerade'; pr.ladung = c.ladung;
  pr.x = pr.px = pr.sx = x; pr.z = pr.pz = pr.sz = z; pr.y = pr.py = y;
  pr.speed = speed; pr.vx = dx * speed; pr.vz = dz * speed;
  pr.dmg = dmg; pr.crit = false;
  pr.target = -1; pr.targetId = 0; pr.t = 0; pr.life = 1; pr.r = 0.15;
  pr.src = c.src; pr.blastMul = c.blastMul; pr.pierce = c.ladung === 'plasma' ? 3 : 0; pr.lastHit = 0;
  pr.slot = -1; pr.mask = c.mask & ~SP.salve3; pr.instabil = c.instabil; pr.mods = c.mods & ~(MOD.clusterbombe | MOD.doppelschuss);
  pr.bounces = 0; pr.mode = 0; pr.ang = 0; pr.rad = 0; pr.cd = 0; pr.rate = 1; pr.dur = 0;
}

/** Küken für Bauer Bruno (Helden-Macke) */
export function spawnChickFor(w: World, p: Player, x: number, z: number, dmg: number): void {
  ctx.player = p.id; ctx.ladung = 'keine'; ctx.geschoss = 'kueken'; ctx.src = 'kueken';
  ctx.blastMul = 1; ctx.instabil = 0; ctx.mask = 0; ctx.dmg = dmg / 0.3; ctx.crit = false;
  spawnChick(w, ctx, x, z);
}

function spawnChick(w: World, c: HitCtx, x: number, z: number): void {
  let n = 0;
  for (const pr of w.projectiles) if (pr.alive && pr.antrieb === 'kueken') n++;
  if (n >= (w.players[c.player]?.syn.kuekenstark ? 24 : 16)) return;
  const pr = freeProjectile(w);
  if (!pr) return;
  initChild(pr, c, x, z, 0.1, 0, 0, 3.4, Math.max(1, c.dmg * 0.3) * (w.players[c.player]?.syn.kuekenstark ? 2 : 1));
  pr.antrieb = 'kueken'; pr.geschoss = 'kueken'; pr.ladung = 'keine';
  pr.life = 5; pr.r = 0.3; pr.cd = 0.2;
}

/* ------------------------------------------------------------------ */
/* Treffer                                                              */
/* ------------------------------------------------------------------ */

function liveTarget(w: World, pr: Projectile): Enemy | null {
  if (pr.target < 0) return null;
  const e = w.enemies[pr.target];
  return e.alive && e.id === pr.targetId && e.doom < 0 ? e : null;
}

function findHit(w: World, x: number, z: number, r: number, skipId: number): Enemy | null {
  const n = w.hash.query(x, z, r + 1.2);
  let best: Enemy | null = null, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.hash.result[i]];
    if (!e.alive || e.doom >= 0 || e.id === skipId) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < e.r + r && d < bd) { bd = d; best = e; }
  }
  return best;
}

/**
 * Aufschlag mit voller Ladungswirkung (Primärtreffer).
 * Explosion und Kettenblitz wirken hier; alles andere über hitEnemy.
 */
function impactAt(w: World, c: HitCtx, x: number, z: number, e: Enemy | null, dx: number, dz: number): void {
  switch (c.ladung) {
    case 'explosion': {
      const g = w.newGroup();
      const r = KAMPF.explosionsRadius * c.blastMul;
      const owner = w.players[c.player];
      // Explosiv-Synergie 6: jede 10. Explosion ist eine Mini-Nuke
      if (owner?.syn.mininuke && ++owner.boomCount % 10 === 0) {
        w.queueBlast(x, z, r * 2.2, c.dmg * 3, 0, 0, g, false, 'nuke', c.src);
        w.events.push({ type: 'nuke', x, z });
      } else w.queueBlast(x, z, r, c.dmg, 0, 0, g, false, 'waffe', c.src);
      if (owner?.syn.feuerpfuetzen && w.rng.chance(0.35)) w.addHazard('lava', x, z, 0.9, 2.5, c.dmg * 0.25, c.src, false, 1, 0);
      if (c.mask & SP.cluster) {
        for (let k = 0; k < 3; k++) {
          const a = k * 2.094 + w.rng.next();
          w.queueBlast(x + Math.cos(a) * r * 0.8, z + Math.sin(a) * r * 0.8, r * 0.6, c.dmg * 0.5, 0.15 + k * 0.05, 1, g, false, 'waffe', c.src);
        }
      }
      if (e) kawumm(w, c, e);
      return;
    }
    case 'kettenblitz':
      if (e) { zap(w, c, e); kawumm(w, c, e); return; }
      break;
    case 'schwerkraft':
      w.addHazard('sog', x, z, 2.6, 2, 0, c.src, (c.mask & SP.implosion) !== 0, c.blastMul, c.dmg);
      if (e) hitEnemy(w, c, e, dx, dz, true);
      return;
  }
  if (e) hitEnemy(w, c, e, dx, dz, true);
  else w.events.push({ type: 'spark', x, y: 0.5, z, hostile: false });
}

/** Schaden + Statuswirkung der Ladung an einem Gegner. */
function hitEnemy(w: World, c: HitCtx, e: Enemy, dx: number, dz: number, primary: boolean): void {
  if (!e.alive || e.doom >= 0) return;
  const owner = w.players[c.player];
  const boss = e.def.verhalten === 'boss';
  const syn = owner?.syn;
  // Elementar-Reaktion, bevor der neue Status greift
  const inc = LADUNG_ELEMENT[c.ladung];
  if (inc && e.reactT <= 0) react(w, c, e, inc);
  if (!e.alive) return;
  let kb = 1.5;
  let dmg = c.dmg;
  if (syn?.flammenwut && e.burnT > 0) dmg *= 1.25;
  switch (c.ladung) {
    case 'rueckstoss': kb = KAMPF.rueckstoss; break;
    case 'frost':
      e.slow = Math.max(e.slow, 2);
      e.frostT = 3;
      if (++e.frost >= (owner?.perk.frostprofi || syn?.frost2 ? 2 : 3) && !boss) { e.frost = 0; e.stun = Math.max(e.stun, 1.2); }
      if (c.mask & SP.konfettifrost && !boss) e.confuse = Math.max(e.confuse, 1.2);
      break;
    case 'kleister': e.slow = Math.max(e.slow, 2.5); kb = 3; break;
    case 'kettenblitz': e.shockT = 1.2; break;
    case 'wasser': e.wet = 4; e.slow = Math.max(e.slow, 0.8); break;
    case 'schall': if (!boss) e.stun = Math.max(e.stun, 0.5); break;
    case 'ranken': if (!boss) e.stun = Math.max(e.stun, 1); break;
    case 'konfetti': if (!boss) e.confuse = Math.max(e.confuse, 1.5); break;
    case 'brand': e.burnT = 3; e.burnDps = Math.max(e.burnDps, c.dmg * 0.35 * (syn?.brandplus ? 1.5 : 1)); break;
    case 'lava':
      e.burnT = 3; e.burnDps = Math.max(e.burnDps, c.dmg * 0.25);
      if (primary) w.addHazard('lava', e.x, e.z, 0.9, 4, c.dmg * 0.5, c.src, false, 1, 0);
      break;
    case 'gift':
      e.poisonT = 4;
      e.poisonDps = Math.min(c.dmg * 1.5, e.poisonDps + c.dmg * 0.15) * (owner?.perk.giftprofi ? 1.6 : 1) * (syn?.giftplus ? 1.5 : 1);
      if (c.mask & SP.giftwolke || syn?.giftwolke) e.cloud = true;
      break;
    case 'saeure': e.acid = Math.min(10, e.acid + 1); e.acidT = 4; break;
    case 'glueck': e.lucky = true; break;
    case 'magnet': pull(w, e.x, e.z, 2.4, true); kb = 0; break;
    case 'schwerkraft': kb = 0; break;
    case 'lebensraub': if (owner) w.lifesteal(owner, c.dmg * 0.02); break;
    case 'heilung':
      for (const p of w.players) if (Math.hypot(p.x - e.x, p.z - e.z) < 3 && w.rng.chance(0.3)) w.heal(p, 1);
      break;
    case 'kueken': if (primary && w.rng.chance(0.5)) spawnChick(w, c, e.x, e.z); break;
    case 'verhuehnern': if (!boss) e.chicken = Math.max(e.chicken, 3); break;
    case 'splitter': if (primary) spawnSplinters(w, c, e.x, e.z, e.id); break;
  }
  if (c.mask & SP.heilkeks && owner && w.rng.chance(0.15)) w.heal(owner, 1);
  // Mods
  const m = c.mods;
  if (m && primary) {
    if (m & MOD.brandmunition) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, c.dmg * 0.25); }
    if (m & MOD.frostkern) { e.slow = Math.max(e.slow, 1.5); e.frostT = 3; }
    if (m & MOD.giftspitze) { e.poisonT = 4; e.poisonDps = Math.min(c.dmg, e.poisonDps + c.dmg * 0.1); }
    if (m & MOD.gluecksbringer && w.rng.chance(0.15)) e.lucky = true;
    if (m & MOD.vampirzahn && owner) w.lifesteal(owner, c.dmg * 0.02);
    if (m & MOD.gravkern) pull(w, e.x, e.z, 1.8, false, 4);
    if (m & MOD.clusterbombe && c.ladung !== 'splitter') spawnSplinters(w, c, e.x, e.z, e.id);
    if (m & MOD.kettenblitz && c.ladung !== 'kettenblitz' && w.rng.chance(0.15)) {
      const save = c.ladung, saveMods = c.mods;
      c.ladung = 'kettenblitz'; c.mods = 0;
      zap(w, c, e);
      c.ladung = save; c.mods = saveMods;
    }
  }
  // Natur-Synergie: Ranken fesseln
  if (syn?.ranken && primary && !boss && w.rng.chance(0.1)) e.stun = Math.max(e.stun, 1);
  // Chaos-Synergie: zufälliges Element
  if (syn?.chaostreffer && primary && w.rng.chance(0.08)) chaosStatus(w, e, c.dmg, boss);
  if (c.mask & SP.kueken && primary && w.rng.chance(0.3)) spawnChick(w, c, e.x, e.z);

  w.damageEnemy(e, dmg, c.crit && primary, dx * kb, dz * kb, 0, 0, c.src);
  if (owner && owner.stats.lebensraub > 0 && w.rng.next() * 100 < owner.stats.lebensraub) w.heal(owner, 1);
  if (primary) kawumm(w, c, e);
}

/** Instabile Fusionen: Krit kann einen Bonus-„Kawumm" auslösen – nie schädlich für Spieler. */
function kawumm(w: World, c: HitCtx, e: Enemy): void {
  const instabil = w.players[c.player]?.syn.chaosinstabil ? Math.max(40, c.instabil) : c.instabil;
  if (!c.crit || instabil <= 0) return;
  if (w.rng.next() >= (instabil / 100) * AMBOSS.kawummChance) return;
  w.queueBlast(e.x, e.z, AMBOSS.kawummRadius * c.blastMul, c.dmg * AMBOSS.kawummSchaden, 0.06, 0, w.newGroup(), false, 'kawumm', c.src);
  w.events.push({ type: 'kawumm', x: e.x, z: e.z });
}

/** Zieht Gegner (und optional Kristalle) zu einem Punkt. */
export function pull(w: World, x: number, z: number, r: number, crystals: boolean, strength = 6): void {
  const n = w.hash.query(x, z, r);
  for (let i = 0; i < n; i++) {
    const e = w.enemies[w.hash.result[i]];
    if (!e.alive || e.def.verhalten === 'boss') continue;
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
    if (d > r || d < 0.25) continue;
    e.kbx += (dx / d) * strength; e.kbz += (dz / d) * strength;
    if (strength > 0) e.gravT = Math.max(e.gravT, 1);
  }
  if (!crystals) return;
  for (const cr of w.crystals) {
    if (!cr.alive) continue;
    const dx = x - cr.x, dz = z - cr.z, d = Math.hypot(dx, dz);
    if (d < r * 1.5 && d > 0.2) { cr.vx += (dx / d) * 5; cr.vz += (dz / d) * 5; }
  }
}

/** Blitz springt von Gegner zu Gegner; nasse Gegner leiten doppelt so weit. */
function zap(w: World, c: HitCtx, first: Enemy): void {
  const pts: number[] = [first.x, 0.8 + first.y, first.z];
  let cur: Enemy | null = first;
  let dmg = c.dmg;
  let n = 0;
  const owner = w.players[c.player];
  const jumps = KAMPF.blitzSpruenge * (c.mask & SP.doppelblitz ? 2 : 1) + (owner?.syn.blitzplus ? 1 : 0);
  const falloff = owner?.syn.blitzstark ? 0.95 : KAMPF.blitzAbfall;
  for (let j = 0; j <= jumps && cur; j++) {
    zapIds[n++] = cur.id;
    const cx: number = cur.x, cz: number = cur.z;
    if (j > 0) pts.push(cx, 0.6 + cur.y, cz);
    const reach = KAMPF.blitzReichweite * (cur.wet > 0 ? 2 : 1) * (w.players[c.player]?.perk.blitzprofi ? 2 : 1);
    c.dmg = dmg;
    cur.shockT = 1.2;
    hitEnemy(w, c, cur, 0, 0, false);
    dmg *= falloff;
    let next: Enemy | null = null, bd = reach * reach;
    const m = w.hash.query(cx, cz, reach);
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
    if (n >= zapIds.length) break;
  }
  if (pts.length === 3) pts.push(first.x + 0.01, 0.2, first.z);
  w.events.push({ type: 'zap', pts });
}

/* ------------------------------------------------------------------ */
/* Sofort-Angriffe: Strahl, Kegel, Rundumschlag                         */
/* ------------------------------------------------------------------ */

function collect(w: World, x: number, z: number, r: number): number {
  const n = w.hash.query(x, z, r);
  let m = 0;
  for (let i = 0; i < n && m < scratch.length; i++) scratch[m++] = w.hash.result[i];
  return m;
}

/** Strahl: trifft alles auf einer Linie bis zur ersten Wand. Ladung wirkt am ersten Gegner. */
function beam(w: World, c: HitCtx, x: number, z: number, dx: number, dz: number, range: number): void {
  let len = 0;
  while (len < range && !w.solidAt(x + dx * len, z + dz * len)) len += 0.25;
  const ex = x + dx * len, ez = z + dz * len;
  const m = collect(w, x + dx * len / 2, z + dz * len / 2, len / 2 + 0.8);
  let first: Enemy | null = null, fd = Infinity;
  for (let i = 0; i < m; i++) {
    const e = w.enemies[scratch[i]];
    if (!e.alive || e.doom >= 0) continue;
    const t = (e.x - x) * dx + (e.z - z) * dz;
    if (t < 0 || t > len) continue;
    const off = Math.abs((e.x - x) * dz - (e.z - z) * dx);
    if (off > e.r + 0.3) continue;
    if (t < fd) { fd = t; first = e; }
  }
  for (let i = 0; i < m; i++) {
    const e = w.enemies[scratch[i]];
    if (e === first || !e.alive || e.doom >= 0) continue;
    const t = (e.x - x) * dx + (e.z - z) * dz;
    if (t < 0 || t > len || Math.abs((e.x - x) * dz - (e.z - z) * dx) > e.r + 0.3) continue;
    hitEnemy(w, c, e, dx, dz, false);
  }
  if (first) impactAt(w, c, first.x, first.z, first, dx, dz);
  w.events.push({ type: 'beam', x, z, x2: ex, z2: ez, geschoss: c.geschoss });
}

/** Kegel direkt vor der Waffe (Flammenwerfer, Wasserwerfer …) */
function cone(w: World, c: HitCtx, x: number, z: number, dx: number, dz: number, range: number): void {
  areaArc(w, c, x, z, dx, dz, range, 0.55);
  w.events.push({ type: 'cone', x, z, dirX: dx, dirZ: dz, range, geschoss: c.geschoss });
}

/** Rundumschlag im Halbkreis um die Figur */
function swing(w: World, c: HitCtx, x: number, z: number, dx: number, dz: number, range: number): void {
  areaArc(w, c, x, z, dx, dz, range + 0.5, 1.6);
  w.events.push({ type: 'swing', x, z, dirX: dx, dirZ: dz, range: range + 0.5, geschoss: c.geschoss });
}

function areaArc(w: World, c: HitCtx, x: number, z: number, dx: number, dz: number, range: number, half: number): void {
  const m = collect(w, x, z, range + 0.6);
  const aim = Math.atan2(dx, dz);
  let first: Enemy | null = null, fd = Infinity;
  for (let i = 0; i < m; i++) {
    const e = w.enemies[scratch[i]];
    if (!e.alive || e.doom >= 0) continue;
    const ex = e.x - x, ez = e.z - z, d = Math.hypot(ex, ez);
    if (d > range + e.r) continue;
    let da = Math.atan2(ex, ez) - aim;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > half && d > e.r + 0.3) continue;
    if (d < fd) { fd = d; first = e; }
    scratch[i] = -1 - scratch[i]; // markiert: getroffen
  }
  for (let i = 0; i < m; i++) {
    if (scratch[i] >= 0) continue;
    const e = w.enemies[-1 - scratch[i]];
    if (e === first) continue;
    const d = Math.hypot(e.x - x, e.z - z) || 1;
    hitEnemy(w, c, e, (e.x - x) / d, (e.z - z) / d, false);
  }
  if (first) {
    const d = Math.hypot(first.x - x, first.z - z) || 1;
    impactAt(w, c, first.x, first.z, first, (first.x - x) / d, (first.z - z) / d);
  }
}

/* ------------------------------------------------------------------ */
/* Geschosse bewegen                                                    */
/* ------------------------------------------------------------------ */

/** Flug im Bogen: steigt auf, fällt aufs Ziel (fliegt über Wände). */
function arc(pr: Projectile, follow: Enemy | null): number {
  if (follow) { pr.tx = follow.x; pr.tz = follow.z; }
  const k = Math.max(0, Math.min(1, pr.t / pr.dur));
  const ease = k * k * (3 - 2 * k);
  pr.x = pr.sx + (pr.tx - pr.sx) * ease;
  pr.z = pr.sz + (pr.tz - pr.sz) * ease;
  const span = Math.hypot(pr.tx - pr.sx, pr.tz - pr.sz);
  const y0 = pr.hostile ? 2.2 : pr.antrieb === 'huepfend' ? 0.2 : 0.7;
  pr.y = y0 - (y0 - 0.2) * k + Math.sin(Math.PI * k) * (pr.antrieb === 'huepfend' ? 0.6 + span * 0.12 : 1.1 + span * 0.16);
  pr.vx = (pr.x - pr.px) / DT; pr.vz = (pr.z - pr.pz) / DT;
  return k;
}

function expire(w: World, pr: Projectile): void {
  pr.alive = false;
  if (pr.antrieb !== 'orbit' && pr.antrieb !== 'schwarm' && pr.antrieb !== 'turm' && pr.antrieb !== 'kueken') {
    w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: false });
  }
}

export function stepProjectiles(w: World): void {
  for (const pr of w.projectiles) {
    if (!pr.alive) continue;
    pr.t += DT;
    pr.life -= DT;
    if (pr.hostile) { stepHostile(w, pr); continue; }
    switch (pr.antrieb) {
      case 'zielbogen': case 'bogen': stepArc(w, pr); break;
      case 'huepfend': stepHop(w, pr); break;
      case 'regen': stepRain(w, pr); break;
      case 'ablegen': stepMine(w, pr); break;
      case 'turm': stepTurret(w, pr); break;
      case 'orbit': stepOrbit(w, pr); break;
      case 'schwarm': stepSwarm(w, pr); break;
      case 'kueken': stepChick(w, pr); break;
      case 'drohne': stepDrone(w, pr); break;
      default: stepLinear(w, pr);
    }
    if (pr.alive && pr.life <= 0) expire(w, pr);
  }
}

function stepArc(w: World, pr: Projectile): void {
  const tgt = liveTarget(w, pr);
  const k = arc(pr, pr.antrieb === 'zielbogen' ? tgt : null);
  if (k < 1) return;
  pr.alive = false;
  const near = tgt && Math.hypot(tgt.x - pr.x, tgt.z - pr.z) < tgt.r + 0.5 ? tgt : findHit(w, pr.x, pr.z, 0.6, 0);
  impactAt(w, ctxFromShot(pr), pr.x, pr.z, near, pr.vx / (Math.hypot(pr.vx, pr.vz) || 1), pr.vz / (Math.hypot(pr.vx, pr.vz) || 1));
}

/** Hüpft 3×, trifft bei jedem Aufprall */
function stepHop(w: World, pr: Projectile): void {
  const k = arc(pr, null);
  if (k < 1) return;
  const e = findHit(w, pr.x, pr.z, 0.7, 0);
  impactAt(w, ctxFromShot(pr), pr.x, pr.z, e, 0, 0);
  if (--pr.bounces <= 0 || w.solidAt(pr.x, pr.z)) { pr.alive = false; return; }
  // nächster Hüpfer: zum nächsten Gegner in der Nähe, sonst geradeaus weiter
  const n = w.nearestEnemy(pr.x, pr.z, 3, e ? e.id : -1);
  const dx = pr.tx - pr.sx, dz = pr.tz - pr.sz, d = Math.hypot(dx, dz) || 1;
  pr.sx = pr.x; pr.sz = pr.z;
  if (n >= 0) { pr.tx = w.enemies[n].x; pr.tz = w.enemies[n].z; }
  else { pr.tx = pr.x + (dx / d) * 2; pr.tz = pr.z + (dz / d) * 2; }
  pr.t = 0; pr.dur = 0.45;
}

/** Fällt vom Himmel und trifft alles im kleinen Umkreis */
function stepRain(w: World, pr: Projectile): void {
  if (pr.t < 0) return;
  const k = Math.min(1, pr.t / pr.dur);
  pr.y = 7 * (1 - k * k);
  if (k < 1) return;
  pr.alive = false;
  const c = ctxFromShot(pr);
  const m = collect(w, pr.x, pr.z, pr.r + 1);
  let first: Enemy | null = null, fd = Infinity;
  for (let i = 0; i < m; i++) {
    const e = w.enemies[scratch[i]];
    if (!e.alive || e.doom >= 0) continue;
    const d = Math.hypot(e.x - pr.x, e.z - pr.z);
    if (d > pr.r + e.r) continue;
    if (d < fd) { fd = d; first = e; }
  }
  if (c.ladung !== 'explosion') {
    for (let i = 0; i < m; i++) {
      const e = w.enemies[scratch[i]];
      if (e === first || !e.alive || e.doom >= 0 || Math.hypot(e.x - pr.x, e.z - pr.z) > pr.r + e.r) continue;
      hitEnemy(w, c, e, 0, 0, false);
    }
  }
  impactAt(w, c, pr.x, pr.z, first, 0, 0);
}

/** Mine: scharf nach kurzer Zeit, löst bei Kontakt aus */
function stepMine(w: World, pr: Projectile): void {
  pr.cd -= DT;
  if (pr.cd > 0) return;
  const e = findHit(w, pr.x, pr.z, pr.r, 0);
  if (!e) return;
  pr.alive = false;
  impactAt(w, ctxFromShot(pr), pr.x, pr.z, e, 0, 0);
}

/** Turm: steht 8 s und schießt selbst */
function stepTurret(w: World, pr: Projectile): void {
  pr.cd -= DT;
  if (pr.cd > 0) return;
  const t = w.nearestEnemy(pr.x, pr.z, pr.rad);
  if (t < 0) { pr.cd = 0.1; return; }
  pr.cd = pr.rate;
  const e = w.enemies[t];
  const dx = e.x - pr.x, dz = e.z - pr.z, d = Math.hypot(dx, dz) || 1;
  pr.vx = dx / d; pr.vz = dz / d; // Blickrichtung
  const shot = freeProjectile(w);
  if (!shot) return;
  initChild(shot, ctxFromShot(pr), pr.x + (dx / d) * 0.4, pr.z + (dz / d) * 0.4, 0.9, dx / d, dz / d, KAMPF.tempo.gerade, pr.dmg);
  shot.life = (pr.rad / KAMPF.tempo.gerade) * 1.25;
  w.events.push({ type: 'fire', player: pr.player, slot: -1, weapon: pr.src, x: pr.x, z: pr.z, dirX: dx / d, dirZ: dz / d });
}

/** Kreisel um die Figur; trifft bei Berührung (pro Gegner kurze Pause) */
function stepOrbit(w: World, pr: Projectile): void {
  const p = w.players[pr.player];
  if (!p || !p.alive) { pr.alive = false; return; }
  pr.ang += 3.2 * DT;
  pr.x = p.x + Math.cos(pr.ang) * pr.rad;
  pr.z = p.z + Math.sin(pr.ang) * pr.rad;
  pr.vx = -Math.sin(pr.ang); pr.vz = Math.cos(pr.ang);
  pr.cd -= DT;
  const e = findHit(w, pr.x, pr.z, pr.r, pr.cd > 0 ? pr.lastHit : 0);
  if (e && (e.id !== pr.lastHit || pr.cd <= 0)) {
    impactAt(w, ctxFromShot(pr), e.x, e.z, e, pr.vx, pr.vz);
    pr.lastHit = e.id; pr.cd = 0.35;
  }
}

/** Begleiter: kreisen um die Figur, stürzen sich auf Gegner, kommen zurück */
function stepSwarm(w: World, pr: Projectile): void {
  const p = w.players[pr.player];
  if (!p || !p.alive) { pr.alive = false; return; }
  pr.cd -= DT;
  pr.ang += 2.4 * DT;
  const hx = p.x + Math.cos(pr.ang) * 1.1, hz = p.z + Math.sin(pr.ang) * 1.1;
  let tx = hx, tz = hz, sp = 7;
  if (pr.mode === 0 && pr.cd <= 0) {
    const t = w.nearestEnemy(p.x, p.z, pr.rad);
    if (t >= 0) { pr.mode = 1; pr.target = t; pr.targetId = w.enemies[t].id; }
  }
  if (pr.mode === 1) {
    const e = liveTarget(w, pr);
    if (!e) pr.mode = 2;
    else {
      tx = e.x; tz = e.z; sp = 10;
      if (Math.hypot(e.x - pr.x, e.z - pr.z) < e.r + pr.r) {
        impactAt(w, ctxFromShot(pr), e.x, e.z, e, pr.vx, pr.vz);
        pr.mode = 2; pr.cd = 0.6;
      }
    }
  } else if (pr.mode === 2 && Math.hypot(hx - pr.x, hz - pr.z) < 0.4) pr.mode = 0;
  const dx = tx - pr.x, dz = tz - pr.z, d = Math.hypot(dx, dz);
  const step = Math.min(d, sp * DT);
  if (d > 1e-4) { pr.vx = dx / d; pr.vz = dz / d; pr.x += pr.vx * step; pr.z += pr.vz * step; }
  pr.y = 0.9 + Math.sin(pr.t * 6 + pr.ang) * 0.12;
}

/** Küken: rennt zum nächsten Gegner und pickt */
function stepChick(w: World, pr: Projectile): void {
  pr.cd -= DT;
  const t = w.nearestEnemy(pr.x, pr.z, 7);
  if (t < 0) return;
  const e = w.enemies[t];
  const dx = e.x - pr.x, dz = e.z - pr.z, d = Math.hypot(dx, dz) || 1;
  pr.vx = dx / d; pr.vz = dz / d;
  if (d > e.r + 0.2) {
    pr.x += pr.vx * pr.speed * DT; pr.z += pr.vz * pr.speed * DT;
    w.collideCircle(pr, 0.15, false);
  } else if (pr.cd <= 0) {
    pr.cd = 0.5;
    w.damageEnemy(e, pr.dmg, false, pr.vx, pr.vz, 0, 0, pr.src);
  }
  pr.y = Math.abs(Math.sin(pr.t * 14)) * 0.12;
}

/** Gerade, zielsuchend, Querschläger, Bumerang, Spirale, Rollen */
function stepLinear(w: World, pr: Projectile): void {
  const a = pr.antrieb;
  if (a === 'zielsuchend') {
    const tgt = liveTarget(w, pr);
    if (tgt) {
      const cur = Math.atan2(pr.vx, pr.vz);
      let diff = Math.atan2(tgt.x - pr.x, tgt.z - pr.z) - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const rate = (5 + pr.t * 10) * DT;
      const ang = cur + Math.max(-rate, Math.min(rate, diff));
      pr.vx = Math.sin(ang) * pr.speed; pr.vz = Math.cos(ang) * pr.speed;
    }
  } else if (a === 'spirale') {
    pr.ang += 5 * DT;
    pr.rad += 2.4 * DT;
    const nx = pr.sx + Math.cos(pr.ang) * pr.rad, nz = pr.sz + Math.sin(pr.ang) * pr.rad;
    pr.vx = (nx - pr.x) / DT; pr.vz = (nz - pr.z) / DT;
  } else if (a === 'bumerang' && pr.mode === 0 && pr.t >= pr.dur) {
    pr.mode = 1; pr.lastHit = 0;
  }
  if (a === 'bumerang' && pr.mode === 1) {
    const p = w.players[pr.player];
    if (!p) { pr.alive = false; return; }
    const dx = p.x - pr.x, dz = p.z - pr.z, d = Math.hypot(dx, dz);
    if (d < 0.5) { pr.alive = false; return; }
    pr.vx = (dx / d) * pr.speed; pr.vz = (dz / d) * pr.speed;
  }

  const c = ctxFromShot(pr);
  for (let sub = 0; sub < 2 && pr.alive; sub++) {
    const ox = pr.x, oz = pr.z;
    pr.x += pr.vx * DT * 0.5;
    pr.z += pr.vz * DT * 0.5;
    if (w.solidAt(pr.x, pr.z) && !(a === 'bumerang' && pr.mode === 1)) {
      if (a === 'abprall' && pr.bounces > 0) {
        // an der Wand abprallen
        pr.bounces--;
        if (w.solidAt(pr.x, oz)) pr.vx = -pr.vx;
        if (w.solidAt(ox, pr.z)) pr.vz = -pr.vz;
        pr.x = ox; pr.z = oz;
        continue;
      }
      if (pr.ladung === 'explosion') { pr.alive = false; impactAt(w, c, pr.x, pr.z, null, 0, 0); }
      else expire(w, pr);
      return;
    }
    const e = findHit(w, pr.x, pr.z, pr.r, pr.lastHit);
    if (e) {
      const sp = Math.hypot(pr.vx, pr.vz) || 1;
      impactAt(w, c, e.x, e.z, e, pr.vx / sp, pr.vz / sp);
      pr.lastHit = e.id;
      if (a === 'abprall' && pr.bounces > 0) {
        // zum nächsten Gegner weiterspringen
        pr.bounces--;
        const n = w.nearestEnemy(pr.x, pr.z, 5, e.id);
        if (n < 0) { pr.alive = false; return; }
        const t = w.enemies[n], dx = t.x - pr.x, dz = t.z - pr.z, d = Math.hypot(dx, dz) || 1;
        pr.vx = (dx / d) * pr.speed; pr.vz = (dz / d) * pr.speed;
        pr.life = Math.max(pr.life, 1);
        continue;
      }
      if (pr.pierce > 0) {
        pr.pierce--;
        if (pr.ladung === 'plasma') pr.dmg *= 1.1;
        continue;
      }
      pr.alive = false;
      return;
    }
    for (const b of w.barrels) {
      if (!b.broken && Math.hypot(b.x - pr.x, b.z - pr.z) < b.r + pr.r) {
        w.breakBarrel(b, 0, 0, pr.src);
        if (pr.pierce < 99) { pr.alive = false; impactAt(w, c, pr.x, pr.z, null, 0, 0); return; }
      }
    }
  }
}

function stepHostile(w: World, pr: Projectile): void {
  if (pr.antrieb === 'zielbogen') {
    // Boss-Bombe: Ziel steht fest (rot markiert), Explosion bzw. Giftwolke trifft Spieler
    if (pr.t < 0) { pr.x = pr.px; pr.z = pr.pz; return; }
    const k = arc(pr, null);
    if (k >= 1) {
      pr.alive = false;
      if (pr.ladung === 'gift') w.addHazard('gift', pr.x, pr.z, pr.r * 0.8, 4, pr.dmg, '', false, 1, 0, true);
      else w.queueBlast(pr.x, pr.z, pr.r, pr.dmg, 0, 0, w.newGroup(), true, 'boss');
    }
    return;
  }
  if (pr.antrieb === 'ablegen') {
    // feindliche Mine: scharf nach kurzer Zeit, zündet, wenn ein Spieler drauftritt
    pr.cd -= DT;
    if (pr.cd > 0) return;
    for (const p of w.players) {
      if (!p.alive || Math.hypot(p.x - pr.x, p.z - pr.z) > pr.r) continue;
      pr.alive = false;
      w.queueBlast(pr.x, pr.z, 1.6, pr.dmg, 0.15, 0, w.newGroup(), true, 'boss');
      return;
    }
    if (pr.life <= 0) pr.alive = false;
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
        if (pr.ladung === 'langsam') p.slowT = Math.max(p.slowT, 1.6);
        pr.alive = false;
        w.events.push({ type: 'spark', x: pr.x, y: pr.y, z: pr.z, hostile: true });
        return;
      }
    }
  }
  if (pr.life <= 0) pr.alive = false;
}

/* ------------------------------------------------------------------ */
/* Elementar-Reaktionen                                                 */
/* ------------------------------------------------------------------ */

const ORDER: Reaktionselement[] = ['feuer', 'eis', 'blitz', 'gift', 'nass', 'grav'];

function hasElement(e: Enemy, el: Reaktionselement): boolean {
  switch (el) {
    case 'feuer': return e.burnT > 0;
    case 'eis': return e.frostT > 0;
    case 'blitz': return e.shockT > 0;
    case 'gift': return e.poisonT > 0;
    case 'nass': return e.wet > 0;
    case 'grav': return e.gravT > 0;
  }
}

function around(w: World, x: number, z: number, r: number): number {
  const n = w.hash.query(x, z, r + 0.5);
  let m = 0;
  for (let i = 0; i < n && m < scratch2.length; i++) scratch2[m++] = w.hash.result[i];
  return m;
}

/** Löst eine Reaktion aus, wenn der Gegner schon unter einem anderen Element steht. */
function react(w: World, c: HitCtx, e: Enemy, inc: Reaktionselement): void {
  let r = null;
  for (const el of ORDER) {
    if (el === inc || !hasElement(e, el)) continue;
    r = findeReaktion(inc, el);
    if (r) break;
  }
  if (!r) return;
  e.reactT = 0.5;
  w.stats.reactions++;
  w.events.push({ type: 'reaction', id: r.id, name: r.name, farbe: r.farbe, x: e.x, z: e.z });
  const dmg = c.dmg, x = e.x, z = e.z;
  const each = (rad: number, fn: (o: Enemy) => void) => {
    const m = around(w, x, z, rad);
    for (let i = 0; i < m; i++) {
      const o = w.enemies[scratch2[i]];
      if (o.alive && o.doom < 0 && Math.hypot(o.x - x, o.z - z) <= rad + o.r) fn(o);
    }
  };
  const stun = (o: Enemy, t: number) => { if (o.def.verhalten !== 'boss') o.stun = Math.max(o.stun, t); };
  switch (r.id) {
    case 'dampfexplosion':
      e.burnT = 0; e.slow = 0; e.frost = 0; e.frostT = 0;
      w.queueBlast(x, z, 2 * c.blastMul, dmg * 2.5, 0, 0, w.newGroup(), false, 'reaktion', c.src);
      break;
    case 'dampfwolke':
      e.wet = 0;
      each(2.2, (o) => { stun(o, 1.4); o.burnT = 0; });
      break;
    case 'stinkbombe':
      w.queueBlast(x, z, 1.8 * c.blastMul, dmg * 1.5, 0, 0, w.newGroup(), false, 'reaktion', c.src);
      each(2.4, (o) => { o.poisonT = 4; o.poisonDps = Math.max(o.poisonDps, e.poisonDps, dmg * 0.3); });
      break;
    case 'plasmabrand':
      w.queueBlast(x, z, 1.6 * c.blastMul, dmg * 2, 0, 0, w.newGroup(), false, 'reaktion', c.src);
      break;
    case 'feuerwirbel':
      w.addHazard('lava', x, z, 1.6, 4, dmg * 0.6, c.src, false, 1, 0);
      each(2, (o) => { o.burnT = 3; o.burnDps = Math.max(o.burnDps, dmg * 0.4); });
      break;
    case 'splitterschock':
      e.slow = 0; e.frost = 0; e.frostT = 0;
      spawnSplinters(w, c, x, z, e.id);
      w.damageEnemy(e, dmg * 2.5, true, 0, 0, 0, 0, c.src);
      break;
    case 'kettenschock': {
      const pts: number[] = [x, 0.8, z];
      each(5, (o) => {
        if (o.wet <= 0) return;
        o.wet = 0;
        pts.push(o.x, 0.8, o.z, x, 0.8, z);
        w.damageEnemy(o, dmg * 2, false, 0, 0, 0, 0, c.src);
      });
      if (pts.length > 3) w.events.push({ type: 'zap', pts: pts.slice(0, 18) });
      break;
    }
    case 'nervengift':
      stun(e, 1.8);
      each(1.5, (o) => stun(o, 1));
      break;
    case 'plasmakern': {
      const save = c.mask;
      c.mask |= SP.doppelblitz;
      c.dmg = dmg * 1.5;
      zap(w, c, e);
      c.mask = save;
      break;
    }
    case 'schockfrost':
      e.wet = 0;
      stun(e, 2.5);
      each(1.8, (o) => { if (o.wet > 0) { o.wet = 0; stun(o, 2.5); } });
      break;
    case 'frostgift':
      e.poisonDps = Math.min(e.poisonDps * 2, dmg * 3);
      e.poisonT = Math.max(e.poisonT, 4);
      break;
    case 'eisimplosion':
      each(2.2, (o) => { stun(o, 1.5); o.slow = Math.max(o.slow, 3); });
      break;
    case 'sumpf':
      w.addHazard('gift', x, z, 1.4, 4, dmg * 0.6, c.src, false, 1, 0);
      break;
    case 'giftstrudel':
      each(2.2, (o) => { o.poisonT = 4; o.poisonDps = Math.max(o.poisonDps, dmg * 0.4); });
      break;
    case 'strudel':
      pull(w, x, z, 2.8, true, 10);
      each(2.8, (o) => { o.slow = Math.max(o.slow, 2); });
      break;
  }
}

/** Chaos-Synergie: zufälliger Status */
function chaosStatus(w: World, e: Enemy, dmg: number, boss: boolean): void {
  switch (Math.floor(w.rng.next() * 6)) {
    case 0: e.burnT = 3; e.burnDps = Math.max(e.burnDps, dmg * 0.35); break;
    case 1: e.slow = Math.max(e.slow, 2); e.frost++; e.frostT = 3; break;
    case 2: e.poisonT = 4; e.poisonDps = Math.max(e.poisonDps, dmg * 0.2); break;
    case 3: e.wet = 4; break;
    case 4: if (!boss) e.confuse = Math.max(e.confuse, 1.5); break;
    default: if (!boss) e.chicken = Math.max(e.chicken, 2); break;
  }
}

/* ------------------------------------------------------------------ */
/* Synergie-Helfer: Gewitter, Eierregen, Drohnen                        */
/* ------------------------------------------------------------------ */

/** Blitz-Synergie 6: ein Gewitterblitz trifft einen zufälligen Gegner in der Nähe */
export function stormStrike(w: World, p: Player, dmg: number): void {
  const t = w.nearestEnemy(p.x + (w.rng.next() - 0.5) * 8, p.z + (w.rng.next() - 0.5) * 8, 9);
  if (t < 0) return;
  const e = w.enemies[t];
  ctx.player = p.id; ctx.ladung = 'kettenblitz'; ctx.geschoss = 'blitzkugel'; ctx.src = 'gewitter';
  ctx.blastMul = 1; ctx.instabil = 0; ctx.mask = 0; ctx.dmg = dmg; ctx.crit = false;
  w.events.push({ type: 'storm', x: e.x, z: e.z });
  zap(w, ctx, e);
}

/** Gacker-Synergie 6: ein explodierendes Ei fällt vom Himmel */
export function rainEgg(w: World, p: Player, x: number, z: number, dmg: number, delay: number): void {
  const pr = freeProjectile(w);
  if (!pr) return;
  ctx.player = p.id; ctx.ladung = 'explosion'; ctx.geschoss = 'ei'; ctx.src = 'eierregen';
  ctx.blastMul = Math.max(0.3, 1 + p.stats.explosion / 100); ctx.instabil = 0; ctx.mask = 0; ctx.dmg = dmg; ctx.crit = false;
  initChild(pr, ctx, x, z, 7, 0, 0, 0, dmg);
  pr.antrieb = 'regen'; pr.tx = x; pr.tz = z; pr.dur = 0.55; pr.life = 2 + delay; pr.r = 0.9; pr.t = -delay;
}

/** Tech-Synergie: so viele Drohnen wie die Stufe erlaubt */
export function maintainDrones(w: World, p: Player, want: number, dmg: number): void {
  let have = 0;
  for (const pr of w.projectiles) {
    if (!pr.alive || pr.hostile || pr.antrieb !== 'drohne' || pr.player !== p.id) continue;
    if (++have > want || !p.alive) pr.alive = false;
    else pr.dmg = dmg;
  }
  for (let i = have; i < want && p.alive; i++) {
    const pr = freeProjectile(w);
    if (!pr) return;
    ctx.player = p.id; ctx.ladung = 'keine'; ctx.geschoss = 'drohne'; ctx.src = 'drohne';
    ctx.blastMul = 1; ctx.instabil = 0; ctx.mask = 0; ctx.dmg = dmg; ctx.crit = false;
    initChild(pr, ctx, p.x, p.z, 1.3, 0, 0, 0, dmg);
    pr.antrieb = 'drohne'; pr.life = 1e9; pr.slot = -2; pr.ang = i * Math.PI; pr.cd = 0.5 + i * 0.4;
  }
}

/** Drohne: kreist über der Figur und schießt (ab Tech 4: Laser) */
function stepDrone(w: World, pr: Projectile): void {
  const p = w.players[pr.player];
  if (!p || !p.alive) { pr.alive = false; return; }
  pr.ang += 1.8 * DT;
  pr.x = p.x + Math.cos(pr.ang) * 1.3; pr.z = p.z + Math.sin(pr.ang) * 1.3;
  pr.y = 1.3 + Math.sin(pr.t * 3) * 0.1;
  pr.cd -= DT;
  if (pr.cd > 0 || w.phase !== 'welle') return;
  const t = w.nearestEnemy(pr.x, pr.z, 7);
  if (t < 0) { pr.cd = 0.2; return; }
  pr.cd = 0.9;
  const e = w.enemies[t];
  const dx = e.x - pr.x, dz = e.z - pr.z, d = Math.hypot(dx, dz) || 1;
  pr.vx = dx / d; pr.vz = dz / d;
  const c = ctxFromShot(pr);
  if (p.syn.drohnenlaser) {
    c.ladung = 'plasma'; c.geschoss = 'laser';
    beam(w, c, pr.x, pr.z, dx / d, dz / d, 7);
    return;
  }
  const shot = freeProjectile(w);
  if (!shot) return;
  initChild(shot, c, pr.x, pr.z, 1.1, dx / d, dz / d, 14, pr.dmg);
  shot.geschoss = 'laser'; shot.life = 0.7;
}

/** Ein Treffer mit beliebiger Ladung (Tests, Debug) */
export function debugHit(w: World, p: Player, e: Enemy, ladung: string, dmg: number): void {
  ctx.player = p.id; ctx.ladung = ladung; ctx.geschoss = 'kugel'; ctx.src = 'debug';
  ctx.blastMul = 1; ctx.instabil = 0; ctx.mask = 0; ctx.dmg = dmg; ctx.crit = false;
  hitEnemy(w, ctx, e, 0, 0, true);
}
