/**
 * Balancing-Bot: spielt komplette Runs mit einfacher Shop-Strategie.
 * Aufruf: node --experimental-strip-types packages/core/test/balance-bot.ts [Runs]
 * Kein Test im engeren Sinn – liefert Zahlen zum Justieren von balance.ts.
 */
import { World, type InputState } from '../src/index.ts';

function botInput(w: World, t: number): InputState {
  // Weicht dem nächsten Gegner aus und kreist um die Mitte
  const p = w.players[0];
  let fx = 0, fz = 0;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const dx = p.x - e.x, dz = p.z - e.z, d2 = dx * dx + dz * dz;
    if (d2 < 16) { fx += dx / d2; fz += dz / d2; }
  }
  const c = w.arena.size / 2, a = t * 0.02;
  const tx = c + Math.cos(a) * 5 - p.x, tz = c + Math.sin(a) * 5 - p.z;
  fx += tx * 0.05; fz += tz * 0.05;
  const l = Math.hypot(fx, fz) || 1;
  const danger = w.projectiles.some((pr) => pr.alive && pr.hostile && Math.hypot(pr.x - p.x, pr.z - p.z) < 1.5);
  return { mx: fx / l, mz: fz / l, dash: danger || t % 90 === 0 };
}

function shop(w: World): void {
  const p = w.players[0];
  while (p.pendingLevels > 0) {
    const pref = ['muckis', 'zappelfinger', 'pelz', 'topfdeckel', 'kekspause', 'adlerauge'];
    let best = 0, bs = -1;
    p.upgradeOffers.forEach((o, i) => { const sc = (6 - Math.max(0, pref.indexOf(o.id))) + o.tier * 3; if (sc > bs) { bs = sc; best = i; } });
    w.command(0, { type: 'upgrade', index: best });
  }
  for (let round = 0; round < 6; round++) {
    let bought = false;
    for (let i = 0; i < p.offers.length; i++) {
      const o = p.offers[i];
      if (o.sold || o.price > p.crystals) continue;
      if (o.kind === 'waffe') {
        if (p.weapons.length < 6 || p.weapons.some((s) => s.waffe.id === o.id && s.tier === o.tier)) bought = w.command(0, { type: 'buy', index: i }) || bought;
      } else bought = w.command(0, { type: 'buy', index: i }) || bought;
    }
    for (let s = 0; s < p.weapons.length; s++) w.command(0, { type: 'merge', slot: s });
    if (!bought && !w.command(0, { type: 'reroll' })) break;
    if (!bought && p.crystals < 30) break;
  }
  w.command(0, { type: 'ready' });
}

const runs = Number(process.argv[2] ?? 4);
for (let r = 0; r < runs; r++) {
  const w = new World(100 + r, 1, { choose: true });
  w.command(0, { type: 'start', weapon: ['pistole', 'raketenwerfer', 'teslastab', 'schrotflinte'][r % 4] });
  let t = 0;
  const hpAt: string[] = [];
  while (w.phase !== 'ende' && w.phase !== 'sieg' && t < 30 * 60 * 30) {
    if (w.phase === 'shop') { hpAt.push(`${w.wave}:${w.players[0].weapons.map((s) => s.waffe.id.slice(0, 4) + s.tier).join(',')}`); shop(w); }
    w.step([botInput(w, t++)]);
  }
  const p = w.players[0];
  console.log(`Run ${r}: ${w.phase} in Welle ${w.wave}, Level ${p.level}, Kills ${w.stats.kills}, Kette ×${w.stats.maxChain}, Zeit ${(t / 30 / 60).toFixed(1)} min`);
  console.log('   ' + hpAt.slice(-3).join(' | '));
}
