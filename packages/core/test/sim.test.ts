import { World, Tile, DT, type InputState } from '../src/index.ts';

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };

function run(seed: number, script: (t: number) => InputState, ticks: number) {
  const w = new World(seed);
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

// Geschwindigkeit
const s = run(1, () => ({ mx: 1, mz: 0, dash: false }), 15);
const dist = s.w.players[0].x - s.w.arena.spawn.x;
ok(dist > 1.4 && dist < 2.4, `Laufen: ${dist.toFixed(2)} Einheiten in 0,5 s`);

// Dash-Strecke
const d = run(1, (t) => ({ mx: 1, mz: 0, dash: t === 0 }), 8);
const dd = d.w.players[0].x - d.w.arena.spawn.x;
ok(dd > 2.2, `Dash: ${dd.toFixed(2)} Einheiten in ${(8 * DT).toFixed(2)} s`);

// Arena
const w = new World(7);
ok(w.arena.tile(0, 5) === Tile.Wall, 'Hintere Mauer vorhanden');
ok(!w.arena.isSolidTile(Math.floor(w.arena.spawn.x), Math.floor(w.arena.spawn.z)), 'Spawn ist frei');

if (fails) { console.log(`\n${fails} Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Tests bestanden');
