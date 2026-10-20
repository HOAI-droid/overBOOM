import { World, Tile, DT, spawnEnemy, type InputState } from '../src/index.ts';
import { ANTRIEBE, GEGNER, LADUNGEN, REZEPTE, WAFFEN, WELLEN, fusionsWaffe, waffeById } from '../../data/src/index.ts';

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

// Boss auf Welle 10: erscheint, wirft Bomben, Welle endet mit seinem Tod
{
  const w = new World(25, 1, { god: true, wave: 10 });
  const boss = w.enemies[w.boss];
  ok(w.boss >= 0 && boss.alive && boss.def.id === 'baron', 'Welle 10: Baron von Bumm erscheint');
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

if (fails) { console.log(`\n${fails} Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Tests bestanden');
