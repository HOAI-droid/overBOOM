import type { World, SimEvent, Phase } from '../../core/src/index.ts';
import type { Crystal, Enemy, Hazard, Projectile, Warning } from '../../core/src/entities.ts';
import { MAX_CRYSTALS, MAX_ENEMIES, MAX_HAZARDS, MAX_PROJECTILES, MAX_WARNINGS } from '../../core/src/entities.ts';
import { ANTRIEBE, GEGNER, GESCHOSSE } from '../../data/src/index.ts';
import { Reader, Table, Writer, type Field } from './codec.ts';


/**
 * Host → Client: kompakter Binär-Snapshot des sichtbaren Weltzustands
 * (Spieler, Gegner, Geschosse, Kristalle, Pfützen, Warnungen, Fässer) plus die
 * Ereignisse seit dem letzten Snapshot (Effekte entstehen beim Client lokal daraus).
 */

const PHASES: Phase[] = ['wahl', 'welle', 'pause', 'shop', 'sieg', 'ende'];

/** Geschoss-/Antriebs-Namen als Index (Simulation nutzt ein paar zusätzliche) */
const GESCHOSS_IDS = [...new Set([...GESCHOSSE.map((g) => g.id), 'bombe', 'feder', 'funke', 'schneeball', 'spore', 'toast', 'kueken', 'drohne', 'mine', 'ei', 'laser', 'kugel', 'blitzkugel'])];
const ANTRIEB_IDS = [...new Set([...ANTRIEBE.map((a) => a.id), 'kueken', 'drohne'])];
const HAZARD_KINDS: Hazard['kind'][] = ['lava', 'gift', 'sog'];
const gIndex = new Map(GESCHOSS_IDS.map((id, i) => [id, i]));
const aIndex = new Map(ANTRIEB_IDS.map((id, i) => [id, i]));

const f = <T>(name: string, k: Field<T>['k'], s: number, get: (e: T) => number, set: (e: T, v: number) => void): Field<T> => ({ name, k, s, get, set });

const ENEMY_FIELDS: Field<Enemy>[] = [
  f('slot', 'u16', 1, (e) => e.slot, () => {}),
  f('id', 'u32', 1, (e) => e.id, (e, v) => { e.id = v; }),
  f('type', 'u8', 1, (e) => e.type, (e, v) => { e.type = v; e.def = GEGNER[v] ?? GEGNER[0]; }),
  f('x', 'i16', 100, (e) => e.x, (e, v) => { e.x = v; }),
  f('y', 'i16', 100, (e) => e.y, (e, v) => { e.y = v; }),
  f('z', 'i16', 100, (e) => e.z, (e, v) => { e.z = v; }),
  f('vx', 'i16', 100, (e) => e.vx, (e, v) => { e.vx = v; }),
  f('vz', 'i16', 100, (e) => e.vz, (e, v) => { e.vz = v; }),
  f('facing', 'i16', 10000, (e) => Math.atan2(Math.sin(e.facing), Math.cos(e.facing)), (e, v) => { e.facing = v; }),
  f('flash', 'u8', 1000, (e) => e.flash, (e, v) => { e.flash = v; }),
  f('age', 'u8', 100, (e) => Math.min(2.5, e.age), (e, v) => { e.age = v; }),
  f('state', 'u8', 1, (e) => e.state, (e, v) => { e.state = v; }),
  f('stateT', 'u8', 100, (e) => e.stateT, (e, v) => { e.stateT = v; }),
  f('doom', 'i16', 1000, (e) => e.doom, (e, v) => { e.doom = v; }),
  f('stun', 'u8', 50, (e) => e.stun, (e, v) => { e.stun = v; }),
  f('flags', 'u8', 1, (e) => (e.elite ? 1 : 0), (e, v) => { e.elite = (v & 1) !== 0; }),
  f('chicken', 'u8', 50, (e) => e.chicken, (e, v) => { e.chicken = v; }),
  f('r', 'u8', 100, (e) => e.r, (e, v) => { e.r = v; }),
  f('burnT', 'u8', 50, (e) => e.burnT, (e, v) => { e.burnT = v; }),
  f('poisonT', 'u8', 50, (e) => e.poisonT, (e, v) => { e.poisonT = v; }),
  f('slow', 'u8', 50, (e) => e.slow, (e, v) => { e.slow = v; }),
  f('hp', 'u16', 65535, (e) => Math.max(0, e.hp / (e.maxHp || 1)), (e, v) => { e.hp = v; e.maxHp = 1; })
];

const SHOT_FIELDS: Field<Projectile>[] = [
  f('slot', 'u16', 1, () => 0, () => {}),
  f('x', 'i16', 100, (p) => p.x, (p, v) => { p.x = v; }),
  f('y', 'i16', 100, (p) => p.y, (p, v) => { p.y = v; }),
  f('z', 'i16', 100, (p) => p.z, (p, v) => { p.z = v; }),
  f('vx', 'i16', 100, (p) => p.vx, (p, v) => { p.vx = v; }),
  f('vz', 'i16', 100, (p) => p.vz, (p, v) => { p.vz = v; }),
  f('geschoss', 'u8', 1, (p) => gIndex.get(p.geschoss) ?? 0, (p, v) => { p.geschoss = GESCHOSS_IDS[v] ?? 'kugel'; }),
  f('antrieb', 'u8', 1, (p) => aIndex.get(p.antrieb) ?? 0, (p, v) => { p.antrieb = ANTRIEB_IDS[v] ?? 'gerade'; }),
  f('flags', 'u8', 1, (p) => (p.hostile ? 1 : 0) | (p.crit ? 2 : 0) | (p.cd > p.rate - 0.08 ? 4 : 0),
    (p, v) => { p.hostile = (v & 1) !== 0; p.crit = (v & 2) !== 0; p.rate = 1; p.cd = v & 4 ? 1 : 0; }),
  f('t', 'u16', 1000, (p) => p.t, (p, v) => { p.t = v; }),
  f('life', 'u8', 50, (p) => p.life, (p, v) => { p.life = v; }),
  f('dur', 'u16', 1000, (p) => p.dur, (p, v) => { p.dur = v; }),
  f('tx', 'i16', 100, (p) => p.tx, (p, v) => { p.tx = v; }),
  f('tz', 'i16', 100, (p) => p.tz, (p, v) => { p.tz = v; }),
  f('r', 'u8', 50, (p) => p.r, (p, v) => { p.r = v; })
];

const GEM_FIELDS: Field<Crystal>[] = [
  f('slot', 'u16', 1, () => 0, () => {}),
  f('x', 'i16', 100, (c) => c.x, (c, v) => { c.x = v; }),
  f('z', 'i16', 100, (c) => c.z, (c, v) => { c.z = v; }),
  f('value', 'u8', 1, (c) => c.value, (c, v) => { c.value = v; }),
  f('age', 'u8', 100, (c) => Math.min(2.5, c.age), (c, v) => { c.age = v; })
];

const HAZARD_FIELDS: Field<Hazard>[] = [
  f('slot', 'u16', 1, () => 0, () => {}),
  f('kind', 'u8', 1, (h) => HAZARD_KINDS.indexOf(h.kind), (h, v) => { h.kind = HAZARD_KINDS[v] ?? 'lava'; }),
  f('x', 'i16', 100, (h) => h.x, (h, v) => { h.x = v; }),
  f('z', 'i16', 100, (h) => h.z, (h, v) => { h.z = v; }),
  f('r', 'u8', 50, (h) => h.r, (h, v) => { h.r = v; }),
  f('t', 'u16', 100, (h) => h.t, (h, v) => { h.t = v; }),
  f('max', 'u16', 100, (h) => h.max, (h, v) => { h.max = v; })
];

const WARN_FIELDS: Field<Warning>[] = [
  f('slot', 'u16', 1, () => 0, () => {}),
  f('x', 'i16', 100, (w) => w.x, (w, v) => { w.x = v; }),
  f('z', 'i16', 100, (w) => w.z, (w, v) => { w.z = v; }),
  f('t', 'u8', 100, (w) => w.t, (w, v) => { w.t = v; })
];

export interface PlayerSnap {
  x: number; z: number; vx: number; vz: number; facing: number; stride: number;
  dashTime: number; dashCooldown: number; invuln: number;
  hp: number; maxHp: number; alive: boolean; downed: boolean; ready: boolean; reviveT: number;
  crystals: number; level: number; xp: number;
  /** zuletzt verarbeitete Eingabe dieses Spielers */
  ack: number;
  aims: number[];
}

/** Ein empfangener Snapshot (wiederverwendbar) */
export class Snapshot {
  tick = 0;
  phase: Phase = 'wahl';
  wave = 0;
  waveTime = 0;
  boss = -1;
  shockT = 0;
  enemyCount = 0;
  endless = false;
  stats = { kills: 0, maxChain: 0, explosions: 0, damage: 0, crystals: 0, reactions: 0 };
  players: PlayerSnap[] = [];
  broken: boolean[] = [];
  readonly enemies = new Table<Enemy>(ENEMY_FIELDS, MAX_ENEMIES);
  readonly shots = new Table<Projectile>(SHOT_FIELDS, MAX_PROJECTILES);
  readonly gems = new Table<Crystal>(GEM_FIELDS, MAX_CRYSTALS);
  readonly hazards = new Table<Hazard>(HAZARD_FIELDS, MAX_HAZARDS);
  readonly warnings = new Table<Warning>(WARN_FIELDS, MAX_WARNINGS);
  events: SimEvent[] = [];
  /** Ereignisse schon abgespielt? */
  played = false;
  /** Zeile je Gegner-Slot (−1 = nicht vorhanden), für die Interpolation */
  readonly enemyRow = new Int16Array(MAX_ENEMIES);
  readonly shotRow = new Int16Array(MAX_PROJECTILES);
}

const writer = new Writer();

/** Host: Snapshot bauen. `acks[i]` = letzte verarbeitete Eingabe von Spieler i. */
export function encodeSnapshot(w: World, events: readonly SimEvent[], acks: readonly number[]): ArrayBuffer {
  const out = writer.reset();
  out.put('u8', 1); // Format
  out.put('u32', w.tick);
  out.put('u8', PHASES.indexOf(w.phase));
  out.put('u16', w.wave);
  out.put('f32', Number.isFinite(w.waveTime) ? w.waveTime : 1e9);
  out.put('i16', w.boss);
  out.put('f32', w.shockT);
  out.put('u16', w.enemyCount);
  out.put('u8', w.endless ? 1 : 0);
  const st = w.stats;
  out.put('u32', st.kills); out.put('u16', st.maxChain); out.put('u32', st.explosions); out.put('f32', st.damage); out.put('u32', st.crystals); out.put('u32', st.reactions);
  out.put('u8', w.players.length);
  for (const p of w.players) {
    out.put('f32', p.x); out.put('f32', p.z);
    out.put('i16', p.vx, 100); out.put('i16', p.vz, 100);
    out.put('i16', Math.atan2(Math.sin(p.facing), Math.cos(p.facing)), 10000);
    out.put('f32', p.stride);
    out.put('u8', p.dashTime, 1000); out.put('u8', p.dashCooldown, 100); out.put('u8', p.invuln, 50);
    out.put('u16', p.hp, 10); out.put('u16', p.maxHp, 10);
    out.put('u8', (p.alive ? 1 : 0) | (p.downed ? 2 : 0) | (p.ready ? 4 : 0));
    out.put('u8', p.reviveT, 50);
    out.put('u32', p.crystals); out.put('u16', p.level); out.put('f32', p.xp);
    out.put('u32', acks[p.id] ?? 0);
    out.put('u8', p.weapons.length);
    for (const s of p.weapons) out.put('i16', Math.atan2(Math.sin(s.aim), Math.cos(s.aim)), 10000);
  }
  out.put('u8', w.barrels.length);
  for (let i = 0; i < w.barrels.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8 && i + k < w.barrels.length; k++) if (w.barrels[i + k].broken) b |= 1 << k;
    out.put('u8', b);
  }
  writeTable(out, ENEMY_FIELDS, w.enemies, (e) => e.alive);
  writeTable(out, SHOT_FIELDS, w.projectiles, (p) => p.alive);
  writeTable(out, GEM_FIELDS, w.crystals, (c) => c.alive);
  writeTable(out, HAZARD_FIELDS, w.hazards, (h) => h.active);
  writeTable(out, WARN_FIELDS, w.warnings, (x) => x.active);
  out.text(events.length ? JSON.stringify(events) : '');
  return out.finish();
}

/** Tabelle schreiben; erste Spalte ist immer der Slot (= Index in der Liste) */
function writeTable<T>(out: Writer, fields: Field<T>[], list: readonly T[], include: (e: T) => boolean): void {
  let n = 0;
  for (const e of list) if (include(e)) n++;
  out.put('u16', n);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!include(e)) continue;
    out.put('u16', i);
    for (let c = 1; c < fields.length; c++) { const fl = fields[c]; out.put(fl.k, fl.get(e), fl.s ?? 1); }
  }
}

/** Client: Snapshot lesen (in ein wiederverwendbares Objekt) */
export function decodeSnapshot(buf: ArrayBuffer, s: Snapshot = new Snapshot()): Snapshot {
  const r = new Reader(buf);
  r.get('u8');
  s.tick = r.get('u32');
  s.phase = PHASES[r.get('u8')] ?? 'welle';
  s.wave = r.get('u16');
  const wt = r.get('f32');
  s.waveTime = wt >= 1e8 ? Infinity : wt;
  s.boss = r.get('i16');
  s.shockT = r.get('f32');
  s.enemyCount = r.get('u16');
  s.endless = r.get('u8') === 1;
  s.stats.kills = r.get('u32'); s.stats.maxChain = r.get('u16'); s.stats.explosions = r.get('u32');
  s.stats.damage = r.get('f32'); s.stats.crystals = r.get('u32'); s.stats.reactions = r.get('u32');
  const np = r.get('u8');
  s.players.length = np;
  for (let i = 0; i < np; i++) {
    const p: PlayerSnap = s.players[i] ?? (s.players[i] = { x: 0, z: 0, vx: 0, vz: 0, facing: 0, stride: 0, dashTime: 0, dashCooldown: 0, invuln: 0, hp: 0, maxHp: 1, alive: true, downed: false, ready: false, reviveT: 0, crystals: 0, level: 1, xp: 0, ack: 0, aims: [] });
    p.x = r.get('f32'); p.z = r.get('f32');
    p.vx = r.get('i16', 100); p.vz = r.get('i16', 100);
    p.facing = r.get('i16', 10000);
    p.stride = r.get('f32');
    p.dashTime = r.get('u8', 1000); p.dashCooldown = r.get('u8', 100); p.invuln = r.get('u8', 50);
    p.hp = r.get('u16', 10); p.maxHp = r.get('u16', 10);
    const fl = r.get('u8');
    p.alive = (fl & 1) !== 0; p.downed = (fl & 2) !== 0; p.ready = (fl & 4) !== 0;
    p.reviveT = r.get('u8', 50);
    p.crystals = r.get('u32'); p.level = r.get('u16'); p.xp = r.get('f32');
    p.ack = r.get('u32');
    const nw = r.get('u8');
    p.aims.length = nw;
    for (let k = 0; k < nw; k++) p.aims[k] = r.get('i16', 10000);
  }
  const nb = r.get('u8');
  s.broken.length = nb;
  for (let i = 0; i < nb; i += 8) {
    const b = r.get('u8');
    for (let k = 0; k < 8 && i + k < nb; k++) s.broken[i + k] = (b & (1 << k)) !== 0;
  }
  s.enemies.read(r);
  s.shots.read(r);
  s.gems.read(r);
  s.hazards.read(r);
  s.warnings.read(r);
  const ev = r.text();
  s.events = ev ? JSON.parse(ev) as SimEvent[] : [];
  s.played = false;
  // Zeilen-Index für die Interpolation
  s.enemyRow.fill(-1);
  const es = s.enemies.cols[0];
  for (let i = 0; i < s.enemies.n; i++) s.enemyRow[es[i]] = i;
  s.shotRow.fill(-1);
  const ss = s.shots.cols[0];
  for (let i = 0; i < s.shots.n; i++) s.shotRow[ss[i]] = i;
  return s;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Client: Weltzustand zwischen zwei Snapshots (a älter, b neuer) einsetzen.
 * `self` = eigener Spieler (wird vorhergesagt, nicht interpoliert).
 */
export function applySnapshot(w: World, a: Snapshot, b: Snapshot, t: number, self: number): void {
  w.tick = b.tick;
  w.phase = b.phase;
  w.wave = b.wave;
  w.waveTime = b.waveTime === Infinity ? Infinity : lerp(a.waveTime, b.waveTime, t);
  w.boss = b.boss;
  w.shockT = b.shockT;
  w.enemyCount = b.enemyCount;
  w.endless = b.endless;
  Object.assign(w.stats, b.stats);

  for (let i = 0; i < b.players.length && i < w.players.length; i++) {
    const p = w.players[i], q = b.players[i], o = a.players[i] ?? q;
    if (i !== self) {
      p.x = lerp(o.x, q.x, t); p.z = lerp(o.z, q.z, t);
      p.vx = q.vx; p.vz = q.vz;
      p.facing = lerpAngle(o.facing, q.facing, t);
      p.stride = lerp(o.stride, q.stride, t);
      p.dashTime = q.dashTime;
      p.invuln = q.invuln;
    }
    p.dashCooldown = i === self ? p.dashCooldown : q.dashCooldown;
    p.hp = q.hp; p.maxHp = q.maxHp;
    p.alive = q.alive; p.downed = q.downed; p.ready = q.ready; p.reviveT = q.reviveT;
    p.crystals = q.crystals; p.level = q.level; p.xp = q.xp;
    for (let k = 0; k < p.weapons.length && k < q.aims.length; k++) p.weapons[k].aim = q.aims[k];
    if (i === self) p.invuln = q.invuln;
  }
  for (let i = 0; i < w.barrels.length && i < b.broken.length; i++) w.barrels[i].broken = b.broken[i];

  // Gegner: Menge aus b, Position zwischen a und b
  for (const e of w.enemies) e.alive = false;
  const et = b.enemies, ea = a.enemies;
  const eid = et.col('id'), ex = et.col('x'), ey = et.col('y'), ez = et.col('z'), ef = et.col('facing');
  const aid = ea.col('id'), ax = ea.col('x'), ay = ea.col('y'), az = ea.col('z'), af = ea.col('facing');
  const eslot = et.cols[0];
  for (let i = 0; i < et.n; i++) {
    const e = w.enemies[eslot[i]];
    if (!e) continue;
    et.apply(i, e);
    e.alive = true;
    const j = a.enemyRow[eslot[i]];
    if (j >= 0 && aid[j] === eid[i]) {
      e.x = lerp(ax[j], ex[i], t); e.y = lerp(ay[j], ey[i], t); e.z = lerp(az[j], ez[i], t);
      e.facing = lerpAngle(af[j], ef[i], t);
    }
    e.px = e.x; e.py = e.y; e.pz = e.z;
  }

  // Geschosse
  for (const p of w.projectiles) p.alive = false;
  const st = b.shots, sa = a.shots;
  const sx = st.col('x'), sy = st.col('y'), sz = st.col('z'), sg = st.col('geschoss');
  const qx = sa.col('x'), qy = sa.col('y'), qz = sa.col('z'), qg = sa.col('geschoss');
  const sslot = st.cols[0];
  for (let i = 0; i < st.n; i++) {
    const p = w.projectiles[sslot[i]];
    if (!p) continue;
    const j = a.shotRow[sslot[i]];
    st.apply(i, p);
    p.alive = true;
    if (j >= 0 && qg[j] === sg[i] && Math.hypot(qx[j] - sx[i], qz[j] - sz[i]) < 3) {
      p.x = lerp(qx[j], sx[i], t); p.y = lerp(qy[j], sy[i], t); p.z = lerp(qz[j], sz[i], t);
      p.px = qx[j]; p.py = qy[j]; p.pz = qz[j];
    } else { p.px = p.x; p.py = p.y; p.pz = p.z; }
  }

  // Kristalle, Pfützen, Warnungen (ohne Interpolation)
  for (const c of w.crystals) c.alive = false;
  const gt = b.gems, gs = gt.cols[0];
  for (let i = 0; i < gt.n; i++) { const c = w.crystals[gs[i]]; if (!c) continue; gt.apply(i, c); c.alive = true; c.px = c.x; c.pz = c.z; }
  for (const h of w.hazards) h.active = false;
  const ht = b.hazards, hs = ht.cols[0];
  for (let i = 0; i < ht.n; i++) { const h = w.hazards[hs[i]]; if (!h) continue; ht.apply(i, h); h.active = true; }
  for (const x of w.warnings) x.active = false;
  const wt = b.warnings, ws = wt.cols[0];
  for (let i = 0; i < wt.n; i++) { const x = w.warnings[ws[i]]; if (!x) continue; wt.apply(i, x); x.active = true; }
}
