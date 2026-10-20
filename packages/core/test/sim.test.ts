import { World, Tile, DT, spawnEnemy, type InputState } from '../src/index.ts';
import { ANTRIEBE, GEGNER, GEGNER_INDEX, HELDEN, INSELN, REAKTIONEN, LADUNG_ELEMENT, SYNERGIEN, LADUNGEN, REZEPTE, WAFFEN, WELLEN, fusionsWaffe, waffeById } from '../../data/src/index.ts';
import { Tile as T } from '../src/arena.ts';
import * as D from '../../data/src/index.ts';
import { Rng } from '../src/rng.ts';
import * as Core from '../src/index.ts';

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };
const typeOf = (id: string) => GEGNER.findIndex((g) => g.id === id);

/* ------------------------------------------------------------------ */
/* Phase 1: Bewegung                                                    */
/* ------------------------------------------------------------------ */

function run(seed: number, script: (t: number) => InputState, ticks: number, combat = false) {
  const w = new World(seed, 1, { combat });
  let solidHits = 0, dashes = 0;
  for (let t = 0; t < ticks; t++) {
    w.step([script(t)]);
    const p = w.players[0];
    const r = 0.29;
    for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (w.arena.isSolidTile(Math.floor(p.x + ox), Math.floor(p.z + oz))) solidHits++;
    dashes += w.events.filter((e) => e.type === 'dash').length;
  }
  return { w, solidHits, dashes };
}

// Wildes Herumlaufen inkl. Dash gegen Wände
const wild = (t: number): InputState => {
  const a = Math.floor(t / 45) * 2.1;
  return { mx: Math.cos(a), mz: Math.sin(a), dash: t % 20 === 0 };
};
const a = run(42, wild, 3000);
const b = run(42, wild, 3000);
ok(a.w.snapshot() === b.w.snapshot(), 'deterministisch: gleicher Seed + gleiche Eingaben = gleicher Zustand');
ok(a.solidHits === 0, `Spieler steckt nie in Wänden (Treffer: ${a.solidHits})`);
ok(a.dashes > 10, `Dash wird ausgelöst (${a.dashes}×)`);

const s = run(1, () => ({ mx: 1, mz: 0, dash: false }), 15);
const dist = s.w.players[0].x - s.w.arena.spawn.x;
ok(dist > 1.4 && dist < 2.4, `Laufen: ${dist.toFixed(2)} Einheiten in 0,5 s`);

const d = run(1, (t) => ({ mx: 1, mz: 0, dash: t === 0 }), 8);
const dd = d.w.players[0].x - d.w.arena.spawn.x;
ok(dd > 2.2, `Dash: ${dd.toFixed(2)} Einheiten in ${(8 * DT).toFixed(2)} s`);

const w7 = new World(7, 1, { combat: false });
ok(w7.arena.tile(0, 5) === Tile.Wall, 'Hintere Mauer vorhanden');
ok(!w7.arena.isSolidTile(Math.floor(w7.arena.spawn.x), Math.floor(w7.arena.spawn.z)), 'Spawn ist frei');

/* ------------------------------------------------------------------ */
/* Phase 2: Kampf                                                       */
/* ------------------------------------------------------------------ */

// Kreisender Bot: weicht aus und dasht gelegentlich
const bot = (t: number): InputState => {
  const a = t * 0.035;
  return { mx: Math.cos(a), mz: Math.sin(a), dash: t % 50 === 0 };
};

function fight(seed: number, ticks: number, opt = {}) {
  const w = new World(seed, 1, opt);
  let kills = 0, fires = 0, explosions = 0, pickups = 0, hits = 0, nan = false, chains = 0, waveStarts = 0, inWall = 0;
  for (let t = 0; t < ticks; t++) {
    w.step([bot(t)]);
    for (const e of w.events) {
      if (e.type === 'kill') kills++;
      else if (e.type === 'fire') fires++;
      else if (e.type === 'explosion') explosions++;
      else if (e.type === 'pickup') pickups++;
      else if (e.type === 'hit') hits++;
      else if (e.type === 'chain') chains++;
      else if (e.type === 'waveStart') waveStarts++;
    }
    for (const e of w.enemies) {
      if (!e.alive) continue;
      if (!Number.isFinite(e.x) || !Number.isFinite(e.z) || !Number.isFinite(e.hp)) nan = true;
      if (e.y === 0 && w.solidAt(e.x, e.z)) inWall++;
    }
    const p = w.players[0];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) nan = true;
  }
  return { w, kills, fires, explosions, pickups, hits, nan, chains, waveStarts, inWall };
}

const f1 = fight(99, 30 * 70, { god: true, autoShop: true });
const f2 = fight(99, 30 * 70, { god: true, autoShop: true });
ok(f1.w.snapshot() === f2.w.snapshot(), 'Kampf deterministisch (70 s, gleiche Eingaben)');
ok(!f1.nan, 'keine NaN-Positionen');
ok(f1.inWall === 0, `Gegner stecken nie in Wänden (${f1.inWall})`);
ok(f1.fires > 50, `Waffen feuern automatisch (${f1.fires} Schüsse)`);
ok(f1.hits > 30, `Treffer (${f1.hits})`);
ok(f1.kills > 15, `Gegner sterben (${f1.kills})`);
ok(f1.explosions > 5, `Explosionen (${f1.explosions})`);
ok(f1.pickups > 10, `Kristalle werden eingesammelt (${f1.pickups}, Summe ${f1.w.players[0].crystals})`);
ok(f1.w.wave >= 3, `Wellen laufen durch (jetzt Welle ${f1.w.wave})`);

// Wellen-Timer: Welle 1 dauert 20 s, danach Pause
{
  const w = new World(5, 1, { god: true, autoShop: true });
  for (let t = 0; t < Math.round(WELLEN.dauer(1) / DT) + 2; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(w.phase === 'pause' && w.wave === 1, `nach ${WELLEN.dauer(1)} s: Pause (Phase ${w.phase})`);
  let maxBefore = 0;
  for (let t = 0; t < 40; t++) { w.step([{ mx: 0, mz: 0, dash: false }]); maxBefore = Math.max(maxBefore, w.enemyCount); }
  for (let t = 0; t < 60; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(w.enemyCount === 0, 'Wellenende: alle Gegner zerplatzen');
  let allMagnet = true;
  for (const c of w.crystals) if (c.alive && !c.magnet) allMagnet = false;
  ok(allMagnet, 'Wellenende: Kristalle fliegen zum Spieler');
  for (let t = 0; t < Math.round(WELLEN.pause / DT) + 2; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(w.phase === 'welle' && w.wave === 2, `danach startet Welle 2 (jetzt ${w.phase} ${w.wave})`);
}

// Kettenreaktion: Reihe von Bomben-Kröten, die erste wird erschossen
{
  const w = new World(3, 1, { combat: true });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999;
  const p = w.players[0];
  p.weapons = [];
  const k = typeOf('bombenkroete');
  const row = [];
  for (let i = 0; i < 8; i++) row.push(spawnEnemy(w, k, p.x - 3 - i * 1.2, p.z - 3)!);
  for (const e of row) e.cd = 999; // kein Sprung
  w.damageEnemy(row[0], 999, false, 0, 0);
  let maxChain = 0, booms = 0;
  for (let t = 0; t < 60; t++) {
    w.step([{ mx: 0, mz: 0, dash: false }]);
    for (const e of w.events) {
      if (e.type === 'chain') maxChain = Math.max(maxChain, e.count);
      if (e.type === 'explosion') booms++;
    }
  }
  ok(row.every((e) => !e.alive), 'Kettenreaktion: alle 8 Kröten hochgegangen');
  ok(maxChain >= 8, `CHAIN ×${maxChain} gemeldet (${booms} Explosionen)`);
}

// Fass explodiert und reißt Gegner mit
{
  const w = new World(3, 1, { combat: true });
  w.spawnAcc = -999;
  for (const warn of w.warnings) warn.active = false;
  w.players[0].weapons = [];
  const bar = w.barrels[0];
  const g = spawnEnemy(w, typeOf('grummelbold'), bar.x + 1, bar.z)!;
  w.breakBarrel(bar, 0, 0);
  for (let t = 0; t < 5; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(bar.broken && !g.alive, 'Explosives Fass zerstört nahen Grummelbold');
}

// Kröte springt und verletzt den Spieler; Dash macht unverwundbar
{
  const w = new World(3, 1, { combat: true });
  w.spawnAcc = -999;
  for (const warn of w.warnings) warn.active = false;
  const p = w.players[0];
  p.weapons = [];
  spawnEnemy(w, typeOf('bombenkroete'), p.x + 2, p.z)!.cd = 0;
  let hurt = 0;
  for (let t = 0; t < 60; t++) { w.step([{ mx: 0, mz: 0, dash: false }]); hurt += w.events.filter((e) => e.type === 'hurt').length; }
  ok(hurt > 0 && p.hp < p.maxHp, `Kröten-Sprung trifft den Spieler (HP ${p.hp}/${p.maxHp})`);
}

// Toastomat schießt Toast
{
  const w = new World(3, 1, { combat: true, wave: 2 });
  w.spawnAcc = -999;
  for (const warn of w.warnings) warn.active = false;
  const p = w.players[0];
  p.weapons = [];
  spawnEnemy(w, typeOf('toastomat'), p.x + 4.5, p.z)!.cd = 0;
  let shots = 0;
  for (let t = 0; t < 120; t++) { w.step([{ mx: 0, mz: 0, dash: false }]); shots += w.events.filter((e) => e.type === 'enemyShot').length; }
  ok(shots >= 1, `Toastomat schießt (${shots}×)`);
}

// Tod beendet den Run, reset() startet neu
{
  const w = new World(11, 1, { autoShop: true });
  for (let t = 0; t < 30 * 240 && w.phase !== 'ende'; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(w.phase === 'ende' && !w.players[0].alive, `Stillstehen ist tödlich (Ende in Welle ${w.wave})`);
  w.reset();
  ok(w.phase === 'welle' && w.wave === 1 && w.players[0].alive && w.enemyCount === 0, 'Neustart setzt alles zurück');
}

// Leistung: 140 Gegner + Waffenfeuer
{
  const w = new World(8, 1, { god: true, wave: 8 });
  w.spawnAcc = -999;
  for (let i = 0; i < 140; i++) {
    const x = 2 + (i % 12) * 2, z = 2 + Math.floor(i / 12) * 2;
    if (!w.solidAt(x + 0.3, z + 0.3)) { const e = spawnEnemy(w, i % 3, x + 0.3, z + 0.3)!; e.hp = e.maxHp = 1e9; }
  }
  const t0 = performance.now();
  const N = 300;
  for (let t = 0; t < N; t++) w.step([bot(t)]);
  const ms = (performance.now() - t0) / N;
  ok(ms < 4 && w.enemyCount > 100, `Tick mit ${w.enemyCount} Gegnern: ${ms.toFixed(3)} ms (Budget 33 ms)`);
}

/* ------------------------------------------------------------------ */
/* Phase 3: Shop & Progression                                          */
/* ------------------------------------------------------------------ */

const idle = { mx: 0, mz: 0, dash: false };
const runUntil = (w: World, cond: () => boolean, max = 30 * 120) => { for (let t = 0; t < max && !cond(); t++) w.step([idle]); };

// Startwahl
{
  const w = new World(21, 1, { choose: true });
  ok(w.phase === 'wahl' && w.players[0].weapons.length === 0, 'Run beginnt mit der Wahl der Startwaffe');
  ok(!w.command(0, { type: 'start', weapon: 'minigun' }), 'nur Startwaffen wählbar');
  ok(w.command(0, { type: 'start', weapon: 'raketenwerfer' }) && w.phase === 'welle' && w.wave === 1, 'Wahl startet Welle 1');
}

// XP und Level-Up
{
  const w = new World(22, 1, { god: true });
  const p = w.players[0];
  runUntil(w, () => w.phase === 'shop');
  ok(w.phase === 'shop', `nach Welle 1 öffnet der Shop (Kristalle ${p.crystals}, Level ${p.level})`);
  ok(p.level > 1 && p.pendingLevels === p.level - 1 && p.upgradeOffers.length === 4, `Level-Up: ${p.pendingLevels} offene Wahl(en) mit je 4 Angeboten`);
  ok(!w.command(0, { type: 'ready' }), 'Weiter erst nach Level-Up-Wahl');
  const before = JSON.stringify(p.stats);
  while (p.pendingLevels > 0) w.command(0, { type: 'upgrade', index: 0 });
  ok(JSON.stringify(p.stats) !== before, 'Upgrade verändert die Werte');
  ok(p.offers.length === 4, 'Shop hat 4 Angebote');

  // Kaufen, Sperren, Reroll
  p.crystals = 9999;
  const lockedId = p.offers[1].id;
  w.command(0, { type: 'lock', index: 1 });
  ok(w.command(0, { type: 'buy', index: 0 }) && p.offers[0].sold, 'Kaufen klappt');
  const c0 = p.crystals;
  ok(w.command(0, { type: 'reroll' }) && p.crystals < c0, `Reroll kostet (${c0 - p.crystals})`);
  ok(p.offers[1].locked && p.offers[1].id === lockedId, 'gesperrtes Angebot bleibt beim Reroll');
  const c1 = p.crystals; w.command(0, { type: 'reroll' });
  ok(c1 - p.crystals > c0 - c1 - 1, 'Reroll-Preis steigt nicht ab');

  // Merge: zwei gleiche Pistolen → Stufe II
  p.weapons = p.weapons.filter((s) => s.waffe.id !== 'pistole');
  p.offers[0] = { kind: 'waffe', id: 'pistole', tier: 1, price: 1, locked: false, sold: false };
  p.offers[2] = { kind: 'waffe', id: 'pistole', tier: 1, price: 1, locked: false, sold: false };
  w.command(0, { type: 'buy', index: 0 }); w.command(0, { type: 'buy', index: 2 });
  const slot = p.weapons.findIndex((s) => s.waffe.id === 'pistole');
  const n0 = p.weapons.length;
  ok(w.command(0, { type: 'merge', slot }) && p.weapons.length === n0 - 1 && p.weapons.some((s) => s.waffe.id === 'pistole' && s.tier === 2), 'Merge: 2× Pistole I → Pistole II');
  const c2 = p.crystals;
  ok(w.command(0, { type: 'sell', slot: 0 }) && p.crystals > c2, 'Verkaufen bringt Kristalle');
  ok(w.command(0, { type: 'ready' }) && w.phase === 'welle' && w.wave === 2, 'Weiter → Welle 2');
}

// Waffenstufe erhöht Schaden, Rüstung senkt Treffer
{
  const w = new World(23, 1);
  const p = w.players[0];
  const s = p.weapons[0];
  const d1 = (s.waffe.schaden * 1);
  s.tier = 3;
  p.stats.schaden = 0;
  const { weaponDamage } = await import('../src/weapons.ts');
  ok(weaponDamage(p, s) > d1 * 2, `Stufe III macht mehr Schaden (${weaponDamage(p, s).toFixed(1)} statt ${d1})`);
  p.stats.ruestung = 15; p.stats.ausweichen = 0;
  const hp = p.hp; w.hurtPlayer(p, 20, p.x + 1, p.z);
  ok(hp - p.hp === 10, `Rüstung 15 halbiert Schaden (${hp - p.hp})`);
}

// Elite-Gegner ab Welle 5
{
  const w = new World(24, 1, { god: true, wave: 9, autoShop: true });
  let elites = 0;
  for (let t = 0; t < 30 * 40; t++) { w.step([bot(t)]); for (const e of w.enemies) if (e.alive && e.elite && e.age < DT * 1.5) elites++; }
  ok(elites > 0, `Elite-Gegner tauchen auf (${elites})`);
}

// Baron von Bumm (Welle 20): erscheint, wirft Bomben, Phase 2, Welle endet mit seinem Tod
{
  const w = new World(25, 1, { god: true, wave: 20 });
  const boss = w.enemies[w.boss];
  ok(w.boss >= 0 && boss.alive && boss.def.id === 'baron', 'Welle 20: Baron von Bumm erscheint');
  ok(w.waveTime === Infinity, 'Boss-Welle hat keinen Timer');
  let bombs = 0, phase2 = false;
  for (let t = 0; t < 30 * 12; t++) {
    w.step([bot(t)]);
    for (const p of w.projectiles) if (p.alive && p.geschoss === 'bombe' && p.t > 0 && p.t <= DT + 1e-9) bombs++;
    if (t === 30 * 4) { w.damageEnemy(boss, boss.hp * 0.6, false, 0, 0); phase2 = w.events.some((e) => e.type === 'bossPhase'); }
  }
  ok(bombs >= 3, `Boss wirft Bomben (${bombs})`);
  ok(phase2 && boss.bossPhase === 2, 'unter 50 % Leben: Phase 2');
  w.damageEnemy(boss, 1e9, false, 0, 0);
  ok(!boss.alive && w.phase === 'pause', 'Boss besiegt → Welle vorbei');
}

// Sieg nach Welle 20, dann optional Endlos
{
  const w = new World(26, 1, { god: true, wave: 20 });
  w.damageEnemy(w.enemies[w.boss], 1e9, false, 0, 0);
  runUntil(w, () => w.phase !== 'pause');
  ok(w.phase === 'sieg', 'Welle 20 geschafft → Sieg');
  ok(w.command(0, { type: 'endless' }) && w.phase === 'shop', 'Endlos-Modus öffnet den Shop');
  while (w.players[0].pendingLevels) w.command(0, { type: 'upgrade', index: 0 });
  w.command(0, { type: 'ready' });
  ok(w.wave === 21 && w.phase === 'welle', 'weiter mit Welle 21');
}

// MVP-Statistik
{
  const w = new World(27, 1, { god: true, autoShop: true });
  for (let t = 0; t < 30 * 30; t++) w.step([bot(t)]);
  const ws = Object.entries(w.stats.waffen).sort((a, b) => b[1] - a[1]);
  ok(ws.length >= 2 && ws[0][1] > 0, `Schaden pro Waffe (MVP: ${ws[0]?.[0]} ${Math.round(ws[0]?.[1] ?? 0)})`);
}

// Shop-Determinismus: gleiche Befehle → gleicher Zustand
{
  const play = () => {
    const w = new World(28, 1, { god: true });
    runUntil(w, () => w.phase === 'shop');
    while (w.players[0].pendingLevels) w.command(0, { type: 'upgrade', index: 1 });
    w.command(0, { type: 'buy', index: 0 }); w.command(0, { type: 'reroll' }); w.command(0, { type: 'ready' });
    for (let t = 0; t < 300; t++) w.step([bot(t)]);
    return w.snapshot();
  };
  ok(play() === play(), 'Shop + Kampf deterministisch');
}

/* ------------------------------------------------------------------ */
/* Phase 4: Waffen-Fusion                                               */
/* ------------------------------------------------------------------ */

ok(fusionsWaffe({ geschoss: 'huehnerkanone', antrieb: 'raketenwerfer', ladung: 'teslastab' }).name === 'Gackernde Blitzrakete', 'Namensgenerator: „Gackernde Blitzrakete"');
ok(fusionsWaffe({ geschoss: 'bowlingkugel', antrieb: 'bananarang', ladung: 'kuekenkorb' }).name === 'Rollender Kükenbumerang', 'Namensgenerator: „Rollender Kükenbumerang"');
{
  const f = fusionsWaffe({ geschoss: 'pistole', antrieb: 'teslastab', ladung: 'raketenwerfer' });
  ok(waffeById(f.id) === f && f.fusion!.instabil > 0, `Fusion per ID wiederherstellbar, Instabilität ${f.fusion!.instabil} %`);
}

/** Ein Kampf mit einer bestimmten Waffe gegen eine Gegnertraube */
function trial(id: string, seconds = 3) {
  const w = new World(77, 1, { god: true });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999;
  const p = w.players[0];
  p.weapons = [];
  const { addWeapon } = progression;
  addWeapon(p, id, 1);
  for (let i = 0; i < 14; i++) spawnEnemy(w, i % 3, p.x + 2 + (i % 4) * 0.8, p.z - 1.5 + Math.floor(i / 4) * 0.8)!.cd = 99;
  let nan = false;
  for (let t = 0; t < 30 * seconds; t++) {
    w.step([idle]);
    for (const pr of w.projectiles) if (pr.alive && !(Number.isFinite(pr.x) && Number.isFinite(pr.z) && Number.isFinite(pr.y))) nan = true;
    for (const e of w.enemies) if (e.alive && !(Number.isFinite(e.x) && Number.isFinite(e.hp))) nan = true;
  }
  return { dmg: w.stats.damage, nan };
}
const progression = await import('../src/progression.ts');

// Jede Antrieb × Ladung-Kombination (mit wechselnden Geschossen) muss funktionieren
{
  const byAntrieb = Object.fromEntries(ANTRIEBE.map((a) => [a.id, WAFFEN.find((w) => w.antrieb === a.id)!.id]));
  const byLadung = Object.fromEntries(LADUNGEN.map((l) => [l.id, WAFFEN.find((w) => w.ladung === l.id)!.id]));
  let combos = 0, broken: string[] = [], silent: string[] = [];
  const t0 = performance.now();
  ANTRIEBE.forEach((a, ai) => LADUNGEN.forEach((l, li) => {
    const g = WAFFEN[(ai * 7 + li * 3) % WAFFEN.length].id;
    const quellen = [...new Set([g, byAntrieb[a.id], byLadung[l.id]])];
    const f = fusionsWaffe({ geschoss: g, antrieb: byAntrieb[a.id], ladung: byLadung[l.id] }, quellen);
    if (f.fusion?.rezept) return;
    combos++;
    const r = trial(f.id, 2);
    if (r.nan) broken.push(f.name);
    if (r.dmg <= 0) silent.push(`${a.id}+${l.id}`);
  }));
  ok(broken.length === 0, `${combos} Antrieb×Ladung-Fusionen ohne NaN/Absturz (${((performance.now() - t0) / 1000).toFixed(1)} s)${broken.length ? ': ' + broken.slice(0, 5).join(', ') : ''}`);
  ok(silent.length === 0, `alle machen Schaden${silent.length ? ' – stumm: ' + silent.slice(0, 8).join(', ') : ''}`);
}

// 300 zufällige Fusionen aus beliebigen Waffen
{
  const r = new (await import('../src/rng.ts')).Rng(5);
  let bad = 0, zero = 0;
  for (let i = 0; i < 300; i++) {
    const pick = () => WAFFEN[Math.floor(r.next() * WAFFEN.length)].id;
    const g = pick(), a = pick(), l = pick();
    const f = fusionsWaffe({ geschoss: g, antrieb: a, ladung: l }, [g, a, l]);
    if (!f.name || !(f.schaden > 0) || !(f.feuerrate > 0)) bad++;
    if (i < 60) { const t = trial(f.id, 2); if (t.nan) bad++; if (t.dmg <= 0) zero++; }
  }
  ok(bad === 0 && zero === 0, `300 Zufallsfusionen haben Namen und Werte, 60 davon im Kampf getestet (${bad} defekt, ${zero} ohne Schaden)`);
}

// Alle 60 Grundwaffen funktionieren (alle Antriebe sind jetzt simuliert)
{
  const silent = WAFFEN.filter((w) => trial(w.id, 3).dmg <= 0).map((w) => w.name);
  ok(silent.length === 0, `alle 60 Waffen machen Schaden${silent.length ? ' – stumm: ' + silent.join(', ') : ''}`);
}

// Geheime Rezepte
{
  for (const rz of REZEPTE) {
    const f = fusionsWaffe({ geschoss: rz.zutaten[0], antrieb: rz.zutaten[1], ladung: rz.zutaten[2] }, rz.zutaten);
    if (f.fusion?.rezept !== rz.id) ok(false, `Rezept ${rz.name} wird nicht erkannt`);
  }
  const silent = REZEPTE.filter((rz) => trial(`rezept:${rz.id}`, 3).dmg <= 0).map((rz) => rz.name);
  ok(silent.length === 0, `alle ${REZEPTE.length} geheimen Rezepte erkannt und kampftauglich${silent.length ? ' – stumm: ' + silent.join(', ') : ''}`);
}

// Amboss-Befehl
{
  const w = new World(31, 1, { god: true });
  const p = w.players[0];
  runUntil(w, () => w.phase === 'shop');
  while (p.pendingLevels) w.command(0, { type: 'upgrade', index: 0 });
  p.crystals = 500;
  // Startwaffen: Pistole (Feuerwaffen), Raketenwerfer (Explosiv), Tesla-Stab (Elementar)
  ok(!w.command(0, { type: 'fuse', slots: [0, 1, 2], geschoss: 0, antrieb: 0, ladung: 0 }), 'Fusion abgelehnt, wenn nicht jede Waffe ein Bauteil liefert');
  const c0 = p.crystals;
  ok(w.command(0, { type: 'fuse', slots: [0, 1, 2], geschoss: 0, antrieb: 1, ladung: 2 }), 'Fusion aus 3 Waffen klappt');
  ok(p.weapons.length === 1 && p.weapons[0].waffe.fusion !== undefined && p.crystals < c0, `Ergebnis: „${p.weapons[0].waffe.name}" (Schmiedelohn ${c0 - p.crystals})`);
  ok(!w.command(0, { type: 'fuse', slots: [0], geschoss: 0, antrieb: 0, ladung: 0 }), 'eine Waffe allein lässt sich nicht verschmelzen');
  // Rezept per Befehl
  p.weapons = [];
  for (let k = 0; k < 3; k++) progression.addWeapon(p, 'huehnerkanone', 1);
  w.command(0, { type: 'fuse', slots: [0, 1, 2], geschoss: 0, antrieb: 1, ladung: 2 });
  ok(p.weapons[0]?.waffe.name === 'HUHNAGEDDON', '3× Hühnerkanone = HUHNAGEDDON');
  // gleiche Gruppe ohne Rezept: abgelehnt
  p.weapons = [];
  progression.addWeapon(p, 'pistole', 1); progression.addWeapon(p, 'minigun', 1);
  ok(!w.command(0, { type: 'fuse', slots: [0, 1], geschoss: 0, antrieb: 1, ladung: 0 }), 'gleiche Gruppe ohne Rezept wird abgelehnt');
  w.command(0, { type: 'ready' });
  for (let t = 0; t < 30 * 8; t++) w.step([bot(t)]);
  ok(w.phase === 'welle', 'Welle läuft mit Fusionswaffe weiter');
}

// Instabilität: Krits lösen Bonus-Kawumm aus
{
  const w = new World(32, 1, { god: true });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999;
  const p = w.players[0];
  p.weapons = [];
  progression.addWeapon(p, fusionsWaffe({ geschoss: 'pistole', antrieb: 'teslastab', ladung: 'bowlingkugel' }).id, 1);
  p.stats.krit = 100;
  w.waveTime = 1e9;
  let kawumm = 0;
  for (let t = 0; t < 30 * 40; t++) {
    if (w.enemyCount < 6) for (let i = 0; i < 6; i++) { const e = spawnEnemy(w, 0, p.x + 3 + i * 0.3, p.z + 1)!; e.hp = e.maxHp = 1e6; e.cd = 99; }
    w.step([idle]);
    kawumm += w.events.filter((e) => e.type === 'kawumm').length;
  }
  ok(kawumm > 5, `instabile Fusion: Bonus-Kawumm bei Krits (${kawumm}×)`);
}

/* ------------------------------------------------------------------ */
/* Phase 5 / Etappe 1: Helden, Inseln, Gegner                           */
/* ------------------------------------------------------------------ */

ok(GEGNER.filter((g) => g.verhalten !== 'boss').length >= 15 && GEGNER.filter((g) => g.verhalten === 'boss').length >= 4, `${GEGNER.filter((g) => g.verhalten !== 'boss').length} Gegnertypen, ${GEGNER.filter((g) => g.verhalten === 'boss').length} Bosse`);
ok(HELDEN.length >= 12, `${HELDEN.length} Helden`);

// Jede Insel: eigene Arena, nur Gegner ihrer Fraktion, Inselboss auf Welle 10
for (const insel of INSELN) {
  const w = new World(40, 1, { god: true, insel: insel.id, autoShop: true });
  const pool = new Set(insel.gegner.map((g) => g.id));
  let foreign = '', types = new Set<string>(), nan = false;
  for (let t = 0; t < 30 * 50; t++) {
    w.step([bot(t)]);
    for (const e of w.enemies) if (e.alive) {
      types.add(e.def.id);
      if (!pool.has(e.def.id) && !GEGNER[GEGNER_INDEX[e.def.id]].abWelle) foreign = e.def.id;
      if (!Number.isFinite(e.x) || !Number.isFinite(e.hp)) nan = true;
    }
  }
  const allowed = [...types].every((id) => pool.has(id) || id === 'schleimchen' || id === 'grummelbold' || GEGNER.some((g) => g.beschwoert === id));
  const wb = new World(41, 1, { god: true, insel: insel.id, wave: 10 });
  ok(allowed && !nan && types.size >= 2 && w.arena.style === insel.gefahr && wb.enemies[wb.boss]?.def.id === insel.boss,
    `${insel.name}: Arena „${insel.gefahr}", Gegner ${[...types].join('/')}, Boss ${wb.enemies[wb.boss]?.def.name}${foreign ? ' FREMD ' + foreign : ''}`);
}

// Jeder Held: Start klappt, Werte und Startwaffe stimmen
for (const h of HELDEN) {
  const w = new World(42, 1, { choose: true });
  const okStart = w.command(0, { type: 'start', held: h.id, insel: 'gackerfeld' });
  const p = w.players[0];
  const weaponOk = h.startWaffe === 'zufall' ? p.weapons.length === 1 : p.weapons[0]?.waffe.id === h.startWaffe;
  for (let t = 0; t < 30 * 8; t++) w.step([bot(t)]);
  if (!(okStart && weaponOk && w.insel.id === 'gackerfeld' && p.held === h.id)) ok(false, `Held ${h.name} startet nicht korrekt`);
}
ok(true, 'alle Helden starten mit Startwaffe auf der gewählten Insel');
{
  const w = new World(43, 1, { choose: true });
  w.command(0, { type: 'start', held: 'panzerpaule' });
  ok(w.players[0].maxHp > 80 && w.players[0].stats.ruestung >= 5, `Panzer-Paule: ${w.players[0].maxHp} Leben, Rüstung ${w.players[0].stats.ruestung}`);
  const w2 = new World(43, 1, { choose: true });
  w2.command(0, { type: 'start', held: 'pyromane' });
  const p2 = w2.players[0];
  runUntil(w2, () => w2.phase === 'shop');
  while (p2.pendingLevels) w2.command(0, { type: 'upgrade', index: 0 });
  let wrong = 0;
  for (let r = 0; r < 30; r++) { p2.crystals = 999; w2.command(0, { type: 'reroll' }); for (const o of p2.offers) if (o.kind === 'waffe' && !(waffeById(o.id)!.fusion?.elemente ?? (await import('../../data/src/index.ts')).elemente(waffeById(o.id)!)).some((e) => e === 'Explosiv' || e === 'Feuer')) wrong++; }
  ok(wrong === 0, 'Pyromane: im Shop nur Explosiv-/Feuerwaffen');
  const w3 = new World(43, 1, { choose: true });
  w3.command(0, { type: 'start', held: 'omagranate' });
  let keks = 0;
  for (let t = 0; t < 30 * 20; t++) { w3.step([bot(t)]); keks += w3.events.filter((e) => e.type === 'keks').length; }
  ok(keks >= 2, `Oma Granate verteilt Kekse (${keks}×)`);
}

/** Einzelgegner gegen stillstehenden Spieler testen */
function duel(id: string, opt: { insel?: string; seconds?: number; hp?: number } = {}) {
  const w = new World(44, 1, { god: true, insel: opt.insel ?? 'bummburg' });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999;
  const p = w.players[0];
  p.weapons = [];
  const e = spawnEnemy(w, GEGNER_INDEX[id], p.x + 3, p.z + 0.5)!;
  if (opt.hp) e.hp = e.maxHp = opt.hp;
  const ev: Record<string, number> = {};
  let hostile = 0, hazards = 0;
  for (let t = 0; t < 30 * (opt.seconds ?? 8); t++) {
    w.step([idle]);
    for (const x of w.events) ev[x.type] = (ev[x.type] ?? 0) + 1;
    hostile = Math.max(hostile, w.projectiles.filter((q) => q.alive && q.hostile).length);
    hazards = Math.max(hazards, w.hazards.filter((h) => h.active && h.hostile).length);
  }
  return { w, e, ev, hostile, hazards };
}
{
  const d1 = duel('kampfhuhn');
  ok((d1.ev.hurt ?? 0) > 0 && (d1.ev.windup ?? 0) > 0, `Kampfhuhn: scharrt (Ansage) und stürmt (${d1.ev.windup}× Anlauf)`);
  const d2 = duel('minenbot', { seconds: 10 });
  ok(d2.hostile > 0, `Minenbot legt Minen (${d2.hostile})`);
  const d3 = duel('pilzling');
  ok(d3.hazards > 0, `Pilzling hinterlässt Giftwolken (${d3.hazards})`);
  const d4 = duel('lavaklops');
  ok(d4.hazards > 0, `Lavaklops hinterlässt eine Lavaspur (${d4.hazards})`);
  const d5 = duel('kultist', { seconds: 10 });
  ok(d5.w.enemyCount > 1, `Kultist öffnet Portale (${d5.w.enemyCount - 1} Grummelbolde)`);
  const d6 = duel('schneemann');
  ok((d6.ev.enemyShot ?? 0) > 0, `Schneemann wirft Schneebälle (${d6.ev.enemyShot})`);
  const d7 = duel('bombenpinguin');
  ok(!d7.e.alive && (d7.ev.explosion ?? 0) > 0, 'Bombenpinguin rutscht heran und explodiert');
  const d8 = duel('funkenkobold');
  ok((d8.ev.enemyShot ?? 0) > 0, 'Funkenkobold schießt Funken');
}
// Schleimi teilt sich
{
  const w = new World(45, 1, { god: true });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999; w.players[0].weapons = [];
  const e = spawnEnemy(w, GEGNER_INDEX.schleimi, 10, 10)!;
  w.damageEnemy(e, 1e6, false, 0, 0);
  ok(w.enemies.filter((q) => q.alive && q.def.id === 'schleimchen').length === 2, 'Schleimi zerfällt in 2 Schleimchen');
}
// Vogelscheuche heilt
{
  const w = new World(46, 1, { god: true });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999; w.players[0].weapons = [];
  const h = spawnEnemy(w, GEGNER_INDEX.vogelscheuche, 20, 20)!;
  const g = spawnEnemy(w, GEGNER_INDEX.grummelbold, 21, 20)!;
  g.hp = 1; h.cd = 0.1;
  for (let t = 0; t < 10; t++) w.step([idle]);
  ok(g.hp > 1, `Vogelscheuche heilt Verbündete (${g.hp.toFixed(1)} HP)`);
}
// Tesla-Ritter blockt von vorne
{
  const w = new World(47, 1, { god: true });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999;
  const e = spawnEnemy(w, GEGNER_INDEX.teslaritter, 10, 10)!;
  e.facing = 0; // Blick nach +z
  const hp0 = e.hp;
  w.damageEnemy(e, 10, false, 0, -1); // Treffer von vorne (schiebt nach -z)
  const front = hp0 - e.hp;
  w.damageEnemy(e, 10, false, 0, 1);  // Treffer von hinten
  const back = hp0 - front - e.hp;
  ok(front < 3 && back > 9, `Tesla-Ritter: vorne ${front.toFixed(1)}, hinten ${back.toFixed(1)} Schaden`);
}
// Alle Bosse spielen ihre Angriffe
for (const id of ['koenig_gockel', 'megatoaster', 'morchella', 'baron']) {
  const w = new World(48, 1, { god: true, wave: 10 });
  for (const warn of w.warnings) warn.active = false;
  for (const e of w.enemies) e.alive = false;
  w.enemyCount = 0;
  w.spawnAcc = -999;
  (await import('../src/enemies.ts')).spawnBoss(w, id);
  const boss = w.enemies[w.boss];
  boss.hp = boss.maxHp * 0.4; boss.bossPhase = 2;
  let shots = 0, warns = 0, haz = 0;
  for (let t = 0; t < 30 * 16; t++) {
    w.step([bot(t)]);
    shots = Math.max(shots, w.projectiles.filter((q) => q.alive && q.hostile).length);
    warns = Math.max(warns, w.warnings.filter((q) => q.active).length);
    haz = Math.max(haz, w.hazards.filter((h) => h.active && h.hostile).length);
  }
  ok(boss.alive && shots + haz > 0 && warns > 0, `${boss.def.name}: Angriffe laufen (Geschosse ${shots}, Pfützen ${haz}, Beschwörungen ${warns})`);
}
// Bodengefahren
{
  const lava = new World(49, 1, { insel: 'lavakessel' });
  const p = lava.players[0];
  let tx = -1, tz = -1;
  for (let z = 2; z < 26 && tx < 0; z++) for (let x = 2; x < 26; x++) if (lava.arena.tile(x, z) === T.Lava) { tx = x; tz = z; break; }
  for (const warn of lava.warnings) warn.active = false; lava.spawnAcc = -999;
  p.x = tx + 0.5; p.z = tz + 0.5;
  const hp = p.hp; lava.step([idle]);
  ok(p.hp < hp, `Lava verbrennt den Spieler (${hp} → ${p.hp})`);

  const ice = new World(50, 1, { insel: 'frostfass', combat: false });
  const q = ice.players[0];
  for (let t = 0; t < 30; t++) ice.step([{ mx: 1, mz: 0, dash: false }]);
  const speed = Math.hypot(q.vx, q.vz);
  let slide = 0;
  for (let t = 0; t < 10; t++) { ice.step([idle]); slide += Math.hypot(q.vx, q.vz); }
  ok(ice.arena.tile(Math.floor(q.x), Math.floor(q.z)) !== T.Ice || slide > speed * 2, `Eis: Spieler rutscht nach (${slide.toFixed(1)})`);

  const zap = new World(51, 1, { insel: 'funkenschlund' });
  const r = zap.players[0];
  for (const warn of zap.warnings) warn.active = false; zap.spawnAcc = -999;
  let sx = -1, sz = -1;
  for (let z = 2; z < 26 && sx < 0; z++) for (let x = 2; x < 26; x++) if (zap.arena.tile(x, z) === T.Shock) { sx = x; sz = z; break; }
  let shocks = 0; const hp2 = r.hp;
  for (let t = 0; t < 30 * 6; t++) { r.x = sx + 0.5; r.z = sz + 0.5; r.vx = r.vz = 0; zap.step([idle]); shocks += zap.events.filter((e) => e.type === 'shock').length; }
  ok(shocks >= 2 && r.hp < hp2, `Tesla-Platten laden und entladen (${shocks} Ereignisse, ${hp2} → ${r.hp})`);
}
// Heuballen brennen
{
  const w = new World(52, 1, { insel: 'gackerfeld' });
  const heu = w.barrels.find((b) => b.kind === 'heu')!;
  w.breakBarrel(heu, 0, 0);
  ok(!!heu && w.hazards.some((h) => h.active && h.kind === 'lava'), 'Heuballen brennen nach dem Anschießen');
}

/* ------------------------------------------------------------------ */
/* Phase 5 / Etappe 2: Synergien und Reaktionen                         */
/* ------------------------------------------------------------------ */

const W2 = await import('../src/weapons.ts');
function calm(seed = 60, opt = {}) {
  const w = new World(seed, 1, { god: true, ...opt });
  for (const warn of w.warnings) warn.active = false;
  w.spawnAcc = -999;
  w.waveTime = 1e9;
  w.players[0].weapons = [];
  return w;
}
function give(w: World, ids: string[]) {
  const p = w.players[0];
  p.weapons = [];
  for (const id of ids) progression.addWeapon(p, id, 1);
  return p;
}

// Alle 15 Reaktionen lassen sich auslösen
{
  const ladungFor: Record<string, string> = {};
  for (const [l, el] of Object.entries(LADUNG_ELEMENT)) if (!ladungFor[el]) ladungFor[el] = l;
  const missing: string[] = [];
  for (const r of REAKTIONEN) {
    const w = calm();
    const p = w.players[0];
    const e = spawnEnemy(w, GEGNER_INDEX.schrottgolem, p.x + 3, p.z)!;
    e.hp = e.maxHp = 1e6;
    w.hash.clear(); for (const q of w.enemies) if (q.alive) w.hash.insert(q.slot, q.x, q.z);
    W2.debugHit(w, p, e, ladungFor[r.elemente[0]], 10);
    e.reactT = 0;
    w.events.length = 0;
    W2.debugHit(w, p, e, ladungFor[r.elemente[1]], 10);
    if (!w.events.some((x) => x.type === 'reaction' && x.id === r.id)) missing.push(r.id);
  }
  ok(missing.length === 0, `alle ${REAKTIONEN.length} Elementar-Reaktionen auslösbar${missing.length ? ' – fehlt: ' + missing.join(', ') : ''}`);
}
// Reaktion mit Wirkung: Kettenschock trifft alle nassen Gegner
{
  const w = calm();
  const p = w.players[0];
  const es = [0, 1, 2].map((i) => { const e = spawnEnemy(w, GEGNER_INDEX.schrottgolem, p.x + 3 + i, p.z)!; e.hp = e.maxHp = 1000; e.wet = 4; return e; });
  w.hash.clear(); for (const q of w.enemies) if (q.alive) w.hash.insert(q.slot, q.x, q.z);
  W2.debugHit(w, p, es[0], 'kettenblitz', 10);
  ok(es.every((e) => e.hp < 1000 && e.wet === 0), `Kettenschock: alle nassen Gegner getroffen (${es.map((e) => Math.round(1000 - e.hp)).join('/')})`);
}
// Synergien zählen Elemente und geben Boni
{
  const w = calm();
  const p = give(w, ['raketenwerfer', 'dynamitbuendel']);
  ok(p.synCount.Explosiv === 2 && p.stats.explosion >= 15, `Explosiv 2: +${p.stats.explosion} % Radius`);
  const f = fusionsWaffe({ geschoss: 'teslastab', antrieb: 'raketenwerfer', ladung: 'flammenwerfer' });
  give(w, [f.id]);
  ok(Object.keys(p.synCount).length === f.fusion!.elemente.length, `Fusion zählt für alle ihre Elemente (${f.fusion!.elemente.join(', ')})`);
}
// Tech 2: Drohne kämpft mit
{
  const w = calm();
  const p = give(w, ['laserpistole', 'kampfdrohne']);
  for (let i = 0; i < 4; i++) { const e = spawnEnemy(w, 0, p.x + 3, p.z + i)!; e.hp = e.maxHp = 1e6; e.cd = 99; }
  p.weapons.forEach((s) => (s.cd = 1e9));
  for (let t = 0; t < 30 * 5; t++) w.step([idle]);
  const drones = w.projectiles.filter((q) => q.alive && q.antrieb === 'drohne').length;
  ok(p.syn.drohne && drones === 1 && (w.stats.waffen.drohne ?? 0) > 0, `Tech 2: ${drones} Drohne, ${Math.round(w.stats.waffen.drohne ?? 0)} Schaden`);
}
// Stufe 6: Mini-Nuke, Gewitter, Eierregen
for (const [el, ids, ev] of [
  ['Explosiv', ['raketenwerfer', 'dynamitbuendel', 'bombenhagel', 'klebebombe', 'granatwerfer', 'minenleger'], 'nuke'],
  ['Blitz', ['teslastab', 'teslaturm', 'teslastab', 'teslaturm', 'teslastab', 'teslaturm'], 'storm'],
  ['Gacker', ['huehnerkanone', 'kuekenkorb', 'fauleeier', 'kuckucksuhr', 'huhnifizierer', 'huehnerkanone'], 'zap']
] as const) {
  const w = calm();
  const p = give(w, [...ids]);
  for (let i = 0; i < 8; i++) { const e = spawnEnemy(w, 0, p.x + 2.5 + (i % 3), p.z - 1 + Math.floor(i / 3))!; e.hp = e.maxHp = 1e6; e.cd = 99; }
  let n = 0, explosions = 0;
  for (let t = 0; t < 30 * 15; t++) { w.step([idle]); n += w.events.filter((x) => x.type === ev).length; explosions += w.events.filter((x) => x.type === 'explosion').length; }
  const lvl = SYNERGIEN.find((s) => s.element === el)!.stufen[2].effekt!;
  ok(p.syn[lvl] && (el === 'Gacker' ? explosions > 10 : n > 0), `${el} 6 (${lvl}): ${el === 'Gacker' ? explosions + ' Explosionen' : n + '× ' + ev}`);
}

/* ------------------------------------------------------------------ */
/* Phase 5 / Etappe 3: Sterne, Evolutionen, Mods                        */
/* ------------------------------------------------------------------ */

// Kills geben Sterne
{
  const w = calm(70);
  const p = give(w, ['pistole']);
  let stars = 0;
  for (let t = 0; t < 30 * 90 && p.weapons[0].stars < 2; t++) {
    if (w.enemyCount < 4) for (let k = 0; k < 4; k++) spawnEnemy(w, 0, p.x + 3 + k * 0.5, p.z + 1)!.cd = 99;
    w.step([idle]);
    stars += w.events.filter((e) => e.type === 'star').length;
  }
  ok(p.weapons[0].stars >= 2 && stars >= 2, `Pistole sammelt Sterne (${p.weapons[0].kills} Kills → ${p.weapons[0].stars} ★)`);
}
// Evolution bei 5 Sternen
{
  const w = new World(71, 1, { god: true });
  const p = w.players[0];
  runUntil(w, () => w.phase === 'shop');
  while (p.pendingLevels) w.command(0, { type: 'upgrade', index: 0 });
  const slot = p.weapons.findIndex((x) => x.waffe.id === 'raketenwerfer');
  ok(!w.command(0, { type: 'evolve', slot, variant: 'b' }), 'Evolution erst ab 5 Sternen');
  p.weapons[slot].stars = 5;
  const dmg0 = W2.weaponDamage(p, p.weapons[slot]);
  ok(w.command(0, { type: 'evolve', slot, variant: 'b' }) && p.weapons[slot].waffe.name === 'Atomrakete', `Raketenwerfer → ${p.weapons[slot].waffe.name}`);
  ok(W2.weaponDamage(p, p.weapons[slot]) > dmg0 * 2, `Atomrakete macht mehr Schaden (${dmg0.toFixed(0)} → ${W2.weaponDamage(p, p.weapons[slot]).toFixed(0)})`);
  ok(!w.command(0, { type: 'evolve', slot, variant: 'a' }), 'evolvierte Waffen evolvieren nicht nochmal');
  const other = p.weapons.findIndex((x) => x.waffe.id === 'pistole');
  p.weapons[other].stars = 5;
  w.command(0, { type: 'evolve', slot: other, variant: 'a' });
  ok(p.weapons[other].waffe.name === 'Doppelpistolen' && (p.weapons[other].mask & W2.SP.salve3) !== 0, 'Pistole → Doppelpistolen (Salve)');
  const f = fusionsWaffe({ geschoss: 'pistole', antrieb: 'teslastab', ladung: 'raketenwerfer' });
  ok(waffeById(`evo:b:${f.id}`)?.name === 'Mega-' + f.name, `auch Fusionen evolvieren („Mega-${f.name}")`);
}
// Mods: kaufen, einbauen, wirken
{
  const w = new World(72, 1, { god: true });
  const p = w.players[0];
  runUntil(w, () => w.phase === 'shop');
  while (p.pendingLevels) w.command(0, { type: 'upgrade', index: 0 });
  p.crystals = 999;
  p.offers[0] = { kind: 'mod', id: 'brandmunition', tier: 1, price: 10, locked: false, sold: false };
  p.offers[1] = { kind: 'mod', id: 'doppelschuss', tier: 3, price: 10, locked: false, sold: false };
  w.command(0, { type: 'buy', index: 0 }); w.command(0, { type: 'buy', index: 1 });
  ok(p.modInv.length === 2, 'Mods landen im Inventar');
  const slot = p.weapons.findIndex((x) => x.waffe.id === 'pistole');
  ok(!w.command(0, { type: 'installMod', slot, index: 0 }), 'Stufe I hat keinen Mod-Slot');
  p.weapons[slot].tier = 3;
  ok(w.command(0, { type: 'installMod', slot, index: 0 }) && w.command(0, { type: 'installMod', slot, index: 0 }), 'Stufe III: 2 Mods eingebaut');
  ok(p.weapons[slot].mods.length === 2 && p.modInv.length === 0, `Pistole mit ${p.weapons[slot].mods.join(' + ')}`);
  w.command(0, { type: 'ready' });
  for (const warn of w.warnings) warn.active = false; w.spawnAcc = -999;
  p.weapons = p.weapons.filter((x, k) => k === slot);
  for (let k = 0; k < 3; k++) { const e = spawnEnemy(w, GEGNER_INDEX.schrottgolem, p.x + 4, p.z + k)!; e.hp = e.maxHp = 1e6; e.cd = 99; }
  let shots = 0, burning = false;
  for (let t = 0; t < 30 * 3; t++) {
    w.step([idle]);
    shots = Math.max(shots, w.projectiles.filter((q) => q.alive && q.src === 'pistole').length);
    if (w.enemies.some((e) => e.alive && e.burnT > 0)) burning = true;
  }
  ok(shots >= 2 && burning, `Doppelschuss (${shots} Kugeln gleichzeitig) und Brandmunition wirken`);
}
// Merge behält Sterne
{
  const w = new World(73, 1, { god: true });
  const p = w.players[0];
  runUntil(w, () => w.phase === 'shop');
  while (p.pendingLevels) w.command(0, { type: 'upgrade', index: 0 });
  p.weapons = [];
  progression.addWeapon(p, 'pistole', 1); progression.addWeapon(p, 'pistole', 1);
  p.weapons[1].stars = 3; p.weapons[1].kills = 70;
  w.command(0, { type: 'merge', slot: 0 });
  ok(p.weapons.length === 1 && p.weapons[0].tier === 2 && p.weapons[0].stars === 3, 'Merge: Stufe II, Sterne bleiben');
}

// Ausrüstung: Shop-Kauf, Anlegen, Set-Boni, Verschrotten, Boss-Beute
{
  ok(D.ITEMS.length >= 150 && new Set(D.ITEMS.map((i) => i.id)).size === D.ITEMS.length, `${D.ITEMS.length} Items, alle IDs eindeutig`);
  const w = new World(74, 1, { god: true });
  const p = w.players[0];
  runUntil(w, () => w.phase === 'shop');
  while (p.pendingLevels) w.command(0, { type: 'upgrade', index: 0 });
  p.crystals = 999;
  const hp0 = p.maxHp;
  const set = D.SET_BY_ID.grummel;
  const teil = (k: number) => ({ uid: 900 + k, art: set.teile[k].art, name: set.teile[k].name, seltenheit: 3, werte: { ...set.teile[k].werte }, set: 'grummel' });
  p.offers[0] = { kind: 'ausruestung', id: 'x', tier: 3, price: 10, locked: false, sold: false, equip: teil(0) };
  ok(w.command(0, { type: 'buy', index: 0 }) && p.beute.length === 1, 'Ausrüstung gekauft → Beute');
  p.beute.push(teil(1), teil(2));
  ok(w.command(0, { type: 'equip', index: 0 }) && p.ausruestung.helm?.set === 'grummel', 'Helm angelegt');
  w.command(0, { type: 'equip', index: 0 }); w.command(0, { type: 'equip', index: 0 });
  // Teile 5+10+0 HP, Set (2) +10, Set (3) +4 Rüstung
  ok(p.maxHp === hp0 + 25 && p.stats.ruestung >= 3 + 1 + 4, `Grummel-Set komplett: +${p.maxHp - hp0} Leben, Rüstung ${p.stats.ruestung}`);
  const r3 = p.stats.ruestung;
  ok(w.command(0, { type: 'unequip', platz: 'stiefel' }) && p.stats.ruestung === r3 - 4 && p.maxHp === hp0 + 25, 'Ablegen: dritter Set-Bonus fällt weg');
  const c0 = p.crystals;
  ok(w.command(0, { type: 'scrap', index: 0 }) && p.crystals > c0 && p.beute.length === 0, `Verschrotten: +${p.crystals - c0} Kristalle`);
  // Ringe: zwei Plätze
  const ring = (u: number) => D.rollAusruestung(() => 0.5, u, 5, 2, 0, 'ring');
  p.beute.push(ring(1), ring(2));
  w.command(0, { type: 'equip', index: 0 }); w.command(0, { type: 'equip', index: 0 });
  ok(!!p.ausruestung.ring1 && !!p.ausruestung.ring2, 'Zwei Ringe angelegt');
  // Boss lässt immer Beute fallen
  w.command(0, { type: 'ready' });
  for (const warn of w.warnings) warn.active = false; w.spawnAcc = -999;
  const b = spawnEnemy(w, GEGNER_INDEX.megatoaster, p.x + 5, p.z)!;
  w.killEnemy(b, 0, 0, false);
  const loot = p.beute.length === 1 && p.beute[0].seltenheit >= 3 && w.events.some((ev) => ev.type === 'loot');
  ok(loot, `Boss-Beute: ${p.beute[0]?.name} (Seltenheit ${p.beute[0]?.seltenheit})`);
  // deterministisch
  const roll = () => { const r = new Rng(5); return D.rollAusruestung(() => r.next(), 1, 8, 4); };
  ok(JSON.stringify(roll()) === JSON.stringify(roll()), `Würfeln ist deterministisch (${roll().name})`);
}

// Phase 6: Karten, Profil, Inseln
{
  ok(D.KARTEN.length >= 220 && new Set(D.KARTEN.map((k) => k.id)).size === D.KARTEN.length, `${D.KARTEN.length} Karten, alle IDs eindeutig`);
  ok(D.KARTEN.every((k) => k.name && k.typzeile && k.faehigkeiten.length >= 1 && k.flavor && k.wert.zahl > 0 && k.seltenheit >= 1 && k.seltenheit <= 5), 'Jede Karte hat Name, Typzeile, Fähigkeit, Flavor, Hauptwert');
  ok(D.ERFOLGE.every((e) => D.KARTE_BY_ID[e.karte]), `${D.ERFOLGE.length} Erfolge zeigen auf echte Karten`);
  ok(D.INSELN.every((i) => D.INSEL_LORE[i.id]) && Object.keys(D.BOSS_LORE).every((b) => D.GEGNER_BY_ID[b]), 'Lore für alle Inseln und Bosse');
  const prof = Core.neuesProfil();
  ok(Core.inselFrei(prof, 'gackerfeld') && !Core.inselFrei(prof, 'funkenschlund'), 'Nur Gackerfeld ist am Anfang frei');
  const w = new World(80, 1, { god: true, insel: 'gackerfeld', held: 'bauerbruno' });
  const meta = new Core.MetaTracker(prof);
  w.step([idle]);
  meta.sync(w);
  ok(prof.karten['held:bauerbruno'] === 1 && prof.stats.runs === 1, 'Held-Karte nach Run-Start');
  ok(w.players[0].weapons.every((s) => prof.karten['waffe:' + s.waffe.id] === 1), 'Startwaffe hat Karte');
  ok(prof.erfolge.includes('erster_run') && prof.karten['held:kawummkid'] === 2, 'Erfolg „erster Run" gibt Glanzkarte');
  for (const warn of w.warnings) warn.active = false; w.spawnAcc = -999;
  const p = w.players[0];
  for (let k = 0; k < D.KARTEN_REGELN.gegnerKills; k++) {
    const e = spawnEnemy(w, GEGNER_INDEX.kampfhuhn, p.x + 6, p.z)!;
    w.events.length = 0; w.killEnemy(e, 0, 0, false); meta.events(w, w.events);
  }
  ok(prof.karten['gegner:kampfhuhn'] === 1 && prof.kills.kampfhuhn === 50, '50 Kampfhühner → Gegnerkarte');
  const b = spawnEnemy(w, GEGNER_INDEX.koenig_gockel, p.x + 6, p.z)!;
  w.events.length = 0; w.killEnemy(b, 0, 0, false); meta.events(w, w.events);
  ok(prof.befreit.includes('gackerfeld') && Core.inselFrei(prof, 'funkenschlund') && !Core.inselFrei(prof, 'rostgrat'), 'Insel-Boss besiegt → Gackerfeld befreit, Funkenschlund frei');
  ok(prof.karten['gegner:koenig_gockel'] === 1 && meta.neues.some((n) => n.art === 'insel'), 'Boss-Karte und Insel-Meldung');
  // Rezept-Fusion → Karte
  w.events.length = 0;
  w.events.push({ type: 'fusion', player: 0, weapon: 'rezept:huhnageddon', name: 'HUHNAGEDDON', rezept: 'huhnageddon', x: 0, z: 0 });
  meta.events(w, w.events);
  ok(prof.karten['rezept:huhnageddon'] === 1 && prof.rezepte.includes('huhnageddon'), 'Rezept entdeckt → Fusionskarte');
  meta.runEnde(w, true);
  ok(prof.karten['held:bauerbruno'] === 2 && prof.erobert.includes('gackerfeld') && prof.stats.siege === 1, 'Sieg → Glanz-Heldenkarte, Insel erobert');
  // Speichern/Laden und Code
  const back = Core.ladeProfil(JSON.stringify(prof));
  ok(JSON.stringify(back) === JSON.stringify(prof), 'Profil übersteht Speichern/Laden');
  const code = Core.profilCode(prof);
  ok(JSON.stringify(Core.profilAusCode(code)) === JSON.stringify(prof) && Core.profilAusCode('Quatsch') === null, `Export-Code (${code.length} Zeichen) und Import`);
  ok(Core.ladeProfil('{kaputt').stats.runs === 0 && Core.ladeProfil('{"karten":5}').karten !== null, 'Kaputtes Profil → frisches Profil');
}

// Phase 6: 40 Rezepte, neue Sonderwirkungen
{
  ok(REZEPTE.length >= 40, `${REZEPTE.length} geheime Rezepte`);
  const keys = REZEPTE.map((r) => [...r.zutaten].sort().join('|'));
  ok(new Set(keys).size === keys.length, 'Keine zwei Rezepte mit denselben Zutaten');
  ok(REZEPTE.every((r) => D.REZEPT_ZITATE[r.id] && r.spezial.every((sp) => D.SPEZIAL_INFO[sp])), 'Jedes Rezept hat Zitat und erklärte Sonderwirkung');
  // Jede neue Sonderwirkung muss sichtbar etwas tun
  const probe = (id: string) => {
    const w = new World(91, 1, { god: true });
    for (const warn of w.warnings) warn.active = false;
    w.spawnAcc = -999;
    const p = w.players[0];
    p.weapons = [];
    progression.addWeapon(p, `rezept:${id}`, 3);
    for (let i = 0; i < 12; i++) { const e = spawnEnemy(w, GEGNER_INDEX.schrottgolem, p.x + 2 + (i % 4) * 0.8, p.z - 1.5 + Math.floor(i / 4) * 0.8)!; e.cd = 99; e.hp = e.maxHp = 1e5; }
    const ev: Record<string, number> = {};
    let lava = 0, gems = 0;
    for (let t = 0; t < 30 * 8; t++) {
      w.step([idle]);
      for (const x of w.events) ev[x.type] = (ev[x.type] ?? 0) + 1;
      lava = Math.max(lava, w.hazards.filter((h) => h.active && h.kind === 'lava').length);
      gems = Math.max(gems, w.crystals.filter((c) => c.active).length);
    }
    return { ev, lava, gems };
  };
  const a = probe('bowlingapokalypse'), b = probe('pommesbude'), c = probe('tiefkuehltruhe'), d = probe('goldesel'), e = probe('todesblick');
  ok((a.ev.explosion ?? 0) > 3, `Mini-Bumm: ${a.ev.explosion} Explosionen`);
  ok(b.lava > 0, `Feuerspur: ${b.lava} Lavapfützen`);
  ok((c.ev.nova ?? 0) > 0, `Frostnova: ${c.ev.nova}×`);
  ok(d.gems + (d.ev.pickup ?? 0) > 0, `Goldregen: ${d.ev.pickup ?? 0} Kristalle eingesammelt`);
  ok((e.ev.storm ?? 0) > 0, `Donnerschlag: ${e.ev.storm}×`);
}

// Phase 7: Koop-Regeln
{
  const w = new World(120, 2, {});
  ok(w.players.length === 2 && w.players[1].name === 'Spieler 2', 'Zwei Spieler mit Namen');
  for (const warn of w.warnings) warn.active = false; w.spawnAcc = -999;
  const [a, b] = w.players;
  b.x = a.x + 6; b.z = a.z;
  a.invuln = 0; a.dashTime = 0;
  w.events.length = 0;
  w.hurtPlayer(a, 9999, a.x + 1, a.z);
  ok(!a.alive && a.downed && w.phase === 'welle' && w.events.some((e) => e.type === 'downed'), 'Koop: Spieler wird niedergeschlagen statt Game Over');
  const step = (n: number, inp = [idle, idle]) => { for (let i = 0; i < n; i++) w.step(inp); };
  step(30);
  ok(a.downed && a.reviveT === 0, 'Ohne Helfer kein Fortschritt');
  b.x = a.x + 0.5; b.z = a.z;
  let rev = false;
  for (let i = 0; i < 30 * 3 && !rev; i++) { w.step([idle, idle]); rev = w.events.some((e) => e.type === 'revive'); }
  ok(rev && a.alive && !a.downed && a.hp === Math.round(a.maxHp * D.KOOP.reviveLeben), `Wiederbelebt mit ${a.hp} Leben nach ~${D.KOOP.reviveZeit} s im Ring`);
  // beide fallen → Ende
  a.invuln = b.invuln = 0;
  w.hurtPlayer(a, 9999, a.x + 1, a.z);
  w.hurtPlayer(b, 9999, b.x + 1, b.z);
  ok(w.phase === 'ende' && !a.downed, 'Alle am Boden → Run vorbei');
  // Gegner-HP skaliert mit Spielerzahl
  const w1 = new World(121, 1, {}), w3 = new World(121, 3, {});
  const e1 = spawnEnemy(w1, 0, 5, 5)!, e3 = spawnEnemy(w3, 0, 5, 5)!;
  ok(Math.abs(e3.maxHp / e1.maxHp - (1 + 2 * D.KOOP.hpProSpieler)) < 1e-6, `Gegner-Leben bei 3 Spielern ×${(e3.maxHp / e1.maxHp).toFixed(2)}`);
  // Wellenende: Niedergeschlagene stehen wieder auf
  const w2 = new World(122, 2, { god: false, autoShop: true });
  for (const warn of w2.warnings) warn.active = false; w2.spawnAcc = -999;
  w2.players[0].invuln = 0;
  w2.hurtPlayer(w2.players[0], 9999, 0, 0);
  w2.clearWave();
  for (let i = 0; i < 30 * 5 && w2.players[0].downed; i++) w2.step([idle, idle]);
  ok(!w2.players[0].downed && w2.players[0].alive, 'Nach der Welle wieder auf den Beinen');
}

// Phase 8: Gefahrenstufen
{
  ok(D.GEFAHREN.length === 11 && D.MAX_GEFAHR === 10, '11 Gefahrenstufen (0–10)');
  const w0 = new World(130, 1, {}), w10 = new World(130, 1, { gefahr: 10 });
  const e0 = spawnEnemy(w0, 0, 5, 5)!, e10 = spawnEnemy(w10, 0, 5, 5)!;
  ok(e10.maxHp > e0.maxHp * 1.1 && e10.dmgMul > e0.dmgMul * 1.1, `Gefahr 10: Gegner ×${(e10.maxHp / e0.maxHp).toFixed(2)} Leben, ×${(e10.dmgMul / e0.dmgMul).toFixed(2)} Schaden`);
  const g = D.gefahrWerte(10);
  ok(g.preise > 1 && g.heilung < 1 && g.tempo > 1 && g.kristalle < 1 && g.todesBumm && D.gefahrWerte(3).preise === 1, 'Stufen addieren sich (Stufe 3 hat noch keine Preiserhöhung)');
  // Todes-Bumm
  for (const warn of w10.warnings) warn.active = false; w10.spawnAcc = -999;
  w10.events.length = 0;
  w10.killEnemy(e10, 0, 0, false);
  let boom = false;
  for (let i = 0; i < 20 && !boom; i++) { w10.step([idle]); boom = w10.events.some((x) => x.type === 'explosion'); }
  ok(boom, 'Gefahr 10: Gegner explodieren beim Tod');
  // Preise im Shop
  const ws = new World(131, 1, { god: true, gefahr: 4 }), wn = new World(131, 1, { god: true });
  for (const w of [ws, wn]) { runUntil(w, () => w.phase === 'shop'); }
  const sum = (w: World) => w.players[0].offers.reduce((a, o) => a + o.price, 0);
  ok(sum(ws) > sum(wn), `Gefahr 4: Shop teurer (${sum(ws)} statt ${sum(wn)} Kristalle)`);
  // Freischaltung durch Sieg
  const prof = Core.neuesProfil();
  const meta = new Core.MetaTracker(prof);
  const wg = new World(132, 1, { god: true, gefahr: 0 });
  wg.step([idle]);
  meta.runEnde(wg, true);
  ok(prof.gefahrFrei === 1 && meta.neues.some((n) => n.art === 'gefahr'), 'Sieg auf Gefahr 0 schaltet Stufe 1 frei');
  ok(Core.heldenFrei(prof).includes('omagranate') && !Core.heldenFrei(Core.neuesProfil()).includes('omagranate'), 'Oma Granate wird durch den ersten Sieg freigeschaltet');
}

// Phase 8: Overkill-Leiste und OVERBOOM-Modus
{
  const w = new World(140, 1, { god: true });
  for (const warn of w.warnings) warn.active = false; w.spawnAcc = -999;
  const p = w.players[0];
  const pist = p.weapons.find((x) => x.waffe.id === 'pistole') ?? p.weapons[0];
  for (let k = 0; k < 200 && p.overkill < 1; k++) { const e = spawnEnemy(w, 0, p.x + 5, p.z)!; w.killEnemy(e, 0, 0, false, pist.waffe.id); }
  ok(p.overkill >= 1 && w.events.some((e) => e.type === 'overkillVoll'), `Overkill-Leiste füllt sich durch Kills (${Math.round(D.OVERKILL.proKill * 1000) / 10} % pro Kill)`);
  const rate0 = W2.weaponRate(p, pist);
  w.step([{ mx: 0, mz: 0, dash: false, boom: true }]);
  ok(p.boomT > 4.8 && p.overkill === 0 && w.events.some((e) => e.type === 'overboom'), 'Auslösen startet 5 s OVERBOOM-Modus');
  ok(Math.abs(W2.weaponRate(p, pist) / rate0 - D.OVERKILL.feuerrate) < 1e-9, 'Doppelte Feuerrate im Modus');
  for (let k = 0; k < 4; k++) { const e = spawnEnemy(w, GEGNER_INDEX.schrottgolem, p.x + 3, p.z + k * 0.5)!; e.hp = e.maxHp = 1e6; e.cd = 99; }
  let booms = 0;
  for (let t = 0; t < 30 * 3; t++) { w.step([idle]); booms += w.events.filter((e) => e.type === 'explosion').length; }
  ok(booms > 3, `Im Modus explodiert jeder Treffer (${booms} Explosionen)`);
  for (let t = 0; t < 30 * 3; t++) w.step([idle]);
  ok(p.boomT === 0, 'Modus endet nach 5 s');
}

if (fails) { console.log(`\n${fails} Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Tests bestanden');
