import { World, Tile, DT, spawnEnemy, type InputState } from '../src/index.ts';
import { GEGNER, WELLEN } from '../../data/src/index.ts';

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

const f1 = fight(99, 30 * 70, { god: true });
const f2 = fight(99, 30 * 70, { god: true });
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
  const w = new World(5, 1, { god: true });
  for (let t = 0; t < Math.round(WELLEN.dauer(1) / DT) + 2; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(w.phase === 'pause' && w.wave === 1, `nach ${WELLEN.dauer(1)} s: Pause (Phase ${w.phase})`);
  let maxBefore = 0;
  for (let t = 0; t < 40; t++) { w.step([{ mx: 0, mz: 0, dash: false }]); maxBefore = Math.max(maxBefore, w.enemyCount); }
  for (let t = 0; t < 60; t++) w.step([{ mx: 0, mz: 0, dash: false }]);
  ok(w.enemyCount === 0, 'Wellenende: alle Gegner zerplatzen');
  let allMagnet = true;
  for (const c of w.crystals) if (c.alive && !c.magnet) allMagnet = false;
  ok(allMagnet, 'Wellenende: Kristalle fliegen zum Spieler');
  for (let t = 0; t < Math.round(WELLEN.pause / DT); t++) w.step([{ mx: 0, mz: 0, dash: false }]);
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
  const w = new World(11, 1);
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

if (fails) { console.log(`\n${fails} Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Tests bestanden');
