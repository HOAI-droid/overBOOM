/**
 * Balancing-Bot: spielt komplette Reisen (Startinsel bis Finale) mit einfacher Shop-Strategie.
 * Aufruf: node --experimental-strip-types packages/core/test/balance-bot.ts [Runs] [ErsterRun] [Startinsel] [Spieler]
 * Kein Test im engeren Sinn – liefert Zahlen zum Justieren von balance.ts:
 * Todeswelle, tiefstes Leben je Insel und die Dauer jedes Bosskampfs.
 */
import { World, weaponDamage, weaponRate, type InputState, type Player } from '../src/index.ts';
import { WELLEN, SPIELER } from '../../data/src/index.ts';
import { HELDEN, PLAETZE, type Ausruestung } from '../../data/src/index.ts';

function botInput(w: World, p: Player, t: number): InputState {
  // Weicht Gegnern und Geschossen aus und kreist um die Mitte
  let fx = 0, fz = 0;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const dx = p.x - e.x, dz = p.z - e.z, d2 = dx * dx + dz * dz;
    if (d2 < 16) { fx += dx / d2; fz += dz / d2; }
  }
  for (const pr of w.projectiles) {
    if (!pr.alive || !pr.hostile) continue;
    const dx = p.x - pr.x, dz = p.z - pr.z, d2 = dx * dx + dz * dz;
    if (d2 < 6) { fx += (dx / d2) * 1.5; fz += (dz / d2) * 1.5; }
  }
  const c = w.arena.size / 2, a = t * 0.02 + p.id * 1.6;
  const tx = c + Math.cos(a) * 5 - p.x, tz = c + Math.sin(a) * 5 - p.z;
  fx += tx * 0.05; fz += tz * 0.05;
  const l = Math.hypot(fx, fz) || 1;
  const danger = w.projectiles.some((pr) => pr.alive && pr.hostile && Math.hypot(pr.x - p.x, pr.z - p.z) < 1.5);
  return { mx: fx / l, mz: fz / l, dash: danger || t % 90 === 0 };
}

/** grober Wert eines Ausrüstungsteils */
const wert = (a: Ausruestung | null) => (a ? Object.values(a.werte).reduce((s, v) => s + (v ?? 0), 0) + a.seltenheit * 4 + (a.set ? 6 : 0) : -1);

function gear(w: World, p: Player): void {
  // bestes Teil je Platz anlegen, Rest verschrotten
  for (let guard = 0; guard < 30; guard++) {
    let done = true;
    for (let i = 0; i < p.beute.length; i++) {
      const a = p.beute[i];
      const plaetze = PLAETZE.filter((x) => x.art === a.art);
      const schwach = plaetze.map((x) => x.id).sort((x, y) => wert(p.ausruestung[x]) - wert(p.ausruestung[y]))[0];
      if (schwach && wert(a) > wert(p.ausruestung[schwach])) { w.command(p.id, { type: 'equip', index: i, platz: schwach }); done = false; break; }
    }
    if (done) break;
  }
  while (p.beute.length) w.command(p.id, { type: 'scrap', index: 0 });
}

function shop(w: World, p: Player): void {
  while (p.pendingLevels > 0) {
    const pref = ['muckis', 'zappelfinger', 'pelz', 'topfdeckel', 'kekspause', 'adlerauge'];
    let best = 0, bs = -1;
    p.upgradeOffers.forEach((o, i) => { const sc = (6 - Math.max(0, pref.indexOf(o.id))) + o.tier * 3; if (sc > bs) { bs = sc; best = i; } });
    w.command(p.id, { type: 'upgrade', index: best });
  }
  for (let round = 0; round < 6; round++) {
    let bought = false;
    for (let i = 0; i < p.offers.length; i++) {
      const o = p.offers[i];
      if (o.sold || o.price > p.crystals) continue;
      if (o.kind === 'waffe') {
        if (p.weapons.length < 6 || p.weapons.some((s) => s.waffe.id === o.id && s.tier === o.tier)) bought = w.command(p.id, { type: 'buy', index: i }) || bought;
      } else bought = w.command(p.id, { type: 'buy', index: i }) || bought;
    }
    for (let s = 0; s < p.weapons.length; s++) w.command(p.id, { type: 'merge', slot: s });
    if (!bought && !w.command(p.id, { type: 'reroll' })) break;
    if (!bought && p.crystals < 30) break;
  }
  gear(w, p);
  w.command(p.id, { type: 'ready' });
}

const runs = Number(process.argv[2] ?? 4);
const first = Number(process.argv[3] ?? 0);
const start = process.argv[4] ?? 'gackerfeld';
const spieler = Number(process.argv[5] ?? 1);
/** Messlauf: unverwundbar, protokolliert Spielerstärke und Gegnerskalierung je 5 Wellen */
const mess = process.argv[6] === 'mess';
for (let r = first; r < first + runs; r++) {
  const w = new World(100 + r, spieler, { choose: true, god: mess });
  const kurve: string[] = [];
  const held = (k: number) => HELDEN[(r * 3 + k) % HELDEN.length].id;
  for (let i = 0; i < spieler; i++) w.command(i, i === 0 ? { type: 'start', held: held(i), insel: start } : { type: 'start', held: held(i) });
  let t = 0;
  const bossZeit: string[] = [];
  let bossStart = -1, bossName = '';
  // tiefstes Leben (in %) je Insel
  const minHp: number[] = [];
  let lastShop = -1;
  while (w.phase !== 'ende' && w.phase !== 'sieg' && t < 30 * 60 * 60 * 4) {
    if (w.phase === 'shop' && lastShop !== w.wave) {
      lastShop = w.wave;
      for (const p of w.players) shop(w, p);
      if (w.wave % 5 === 0) {
        const p = w.players[0];
        const dps = p.weapons.reduce((a, s) => a + weaponDamage(p, s) * weaponRate(p, s), 0);
        const ehp = p.maxHp * (1 + Math.max(0, p.stats.ruestung) / SPIELER.ruestungsKonstante) / (1 - Math.min(60, Math.max(0, p.stats.ausweichen)) / 100);
        kurve.push(`${w.wave}: dps ${dps.toFixed(0)} / hp×${WELLEN.hpFaktor(w.wave).toFixed(1)} = ${(dps / WELLEN.hpFaktor(w.wave)).toFixed(0)} · ehp ${ehp.toFixed(0)} / dmg×${WELLEN.schadenFaktor(w.wave).toFixed(1)} = ${(ehp / WELLEN.schadenFaktor(w.wave)).toFixed(0)} · regen ${p.stats.regen} raub ${p.stats.lebensraub}`);
      }
    }
    w.step(w.players.map((p) => botInput(w, p, t)));
    t++;
    if (w.phase === 'welle') {
      const hp = Math.min(...w.players.filter((p) => p.alive).map((p) => Math.round(100 * p.hp / p.maxHp)));
      minHp[w.reiseIndex] = Math.min(minHp[w.reiseIndex] ?? 100, hp);
      if (w.boss >= 0 && bossStart < 0) { bossStart = t; bossName = w.enemies[w.boss].def.id; }
    }
    if (bossStart >= 0 && (w.boss < 0 || !w.enemies[w.boss]?.alive)) {
      bossZeit.push(`${bossName.slice(0, 10)}@${w.wave}:${((t - bossStart) / 30).toFixed(0)}s`);
      bossStart = -1;
    }
  }
  const p = w.players[0];
  const insel = `${w.insel.id} (${w.reiseIndex + 1}/${w.reise.length}), Inselwelle ${w.inselWelle}`;
  console.log(`Run ${r} (${p.held}): ${w.phase} in Welle ${w.wave} – ${insel}, Level ${p.level}, Kills ${w.stats.kills}, Zeit ${(t / 30 / 60).toFixed(0)} min`);
  console.log(`   tiefstes Leben je Insel: ${minHp.map((v) => v ?? '-').join(' / ')} %`);
  console.log(`   Bosse: ${bossZeit.join('  ')}`);
  if (mess) console.log('   ' + kurve.join('\n   '));
  console.log(`   Waffen: ${p.weapons.map((s) => s.waffe.id.slice(0, 6) + s.tier).join(',')} · Items ${Object.values(p.items).reduce((a, b) => a + b, 0)} · Ausrüstung ${Object.values(p.ausruestung).filter(Boolean).map((a) => a!.seltenheit).join('')}`);
}
