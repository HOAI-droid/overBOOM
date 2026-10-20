// Prozedurale Arenen: jede Insel sieht pro Seed anders aus, behält aber ihren Stil.
import { createArena, Tile, type Arena, type ArenaStyle } from '../src/arena.ts';

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };

const STILE: ArenaStyle[] = ['festung', 'lava', 'eis', 'gift', 'strom', 'schrott', 'heu'];
const SEEDS = 200;
const seedOf = (k: number) => (k * 2654435761 + 12345) >>> 0;

const fest = (t: number) => t === Tile.Wall || t === Tile.Pillar || t === Tile.Crate || t === Tile.Lava;
const hindernis = (t: number) => t === Tile.Pillar || t === Tile.Crate || t === Tile.Lava;
const normal = (t: number) => t === Tile.Floor || t === Tile.Moss;

/** Anzahl begehbarer Kacheln, die von der Mitte aus nicht erreichbar sind */
function abgeschnitten(a: Arena): number {
  const S = a.size, seen = new Uint8Array(S * S);
  const st = [Math.floor(a.spawn.z) * S + Math.floor(a.spawn.x)];
  seen[st[0]] = 1;
  while (st.length) {
    const i = st.pop()!, x = i % S, z = (i - x) / S;
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      if (nx < 1 || nz < 1 || nx > S - 2 || nz > S - 2) continue;
      const j = nz * S + nx;
      if (seen[j] || fest(a.tiles[j])) continue;
      seen[j] = 1; st.push(j);
    }
  }
  let n = 0;
  for (let z = 1; z <= S - 2; z++) for (let x = 1; x <= S - 2; x++) if (!seen[z * S + x] && !fest(a.tile(x, z))) n++;
  return n;
}

/** kleinster Chebyshev-Abstand zwischen zwei verschiedenen Hindernis-Gruppen (8er-Nachbarschaft) */
function minLuecke(a: Arena): number {
  const S = a.size, grp = new Int32Array(S * S).fill(-1);
  let g = 0;
  for (let i = 0; i < S * S; i++) {
    if (grp[i] >= 0 || !hindernis(a.tiles[i])) continue;
    const st = [i]; grp[i] = g;
    while (st.length) {
      const k = st.pop()!, x = k % S, z = (k - x) / S;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
        const j = nz * S + nx;
        if (grp[j] < 0 && hindernis(a.tiles[j])) { grp[j] = g; st.push(j); }
      }
    }
    g++;
  }
  let best = 99;
  for (let i = 0; i < S * S; i++) {
    if (grp[i] < 0) continue;
    const x = i % S, z = (i - x) / S;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
      const j = nz * S + nx;
      if (grp[j] >= 0 && grp[j] !== grp[i]) best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dz)));
    }
  }
  return best;
}

/** freie Boss-Spawnpunkte auf dem Ring (wie spawnBoss in enemies.ts) */
function bossRing(a: Arena): number {
  const c = a.size / 2, n = 48;
  let free = 0;
  for (let k = 0; k < n; k++) {
    const w = (k / n) * Math.PI * 2, x = c + Math.cos(w) * 7, z = c + Math.sin(w) * 7;
    const t = a.tile(Math.floor(x), Math.floor(z));
    if (a.isSolidTile(Math.floor(x), Math.floor(z)) || t === Tile.Lava || t === Tile.Poison) continue;
    if ([[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]].some(([ox, oz]) => a.isSolidTile(Math.floor(x + ox), Math.floor(z + oz)))) continue;
    free++;
  }
  return free / n;
}

const fingerprint = (a: Arena) => Buffer.from(a.tiles).toString('base64') + '|' + Buffer.from(a.heights).toString('base64') + '|' + JSON.stringify(a.props);

const HAZARD: Partial<Record<ArenaStyle, number>> = { festung: Tile.Lava, lava: Tile.Lava, eis: Tile.Ice, gift: Tile.Poison, strom: Tile.Shock };

for (const stil of STILE) {
  let mitteFrei = true, randFrei = true, erreichbar = true, mauern = true, ring = 1, luecke = 99, propsOk = true, fackeln = true, determin = true, groesse = true;
  let solidMin = 1e9, solidMax = 0, solidSum = 0, hazMin = 1e9, hazMax = 0, fassMin = 1e9, kristallMin = 1e9;
  const layouts = new Set<string>();
  for (let k = 0; k < SEEDS; k++) {
    const seed = seedOf(k);
    const a = createArena(seed, stil);
    const S = a.size, c = S / 2;
    if (a.tiles.length !== S * S || a.heights.length !== S * S || a.style !== stil || a.seed !== seed || a.spawn.x !== c || a.spawn.z !== c) groesse = false;
    if (k < 40 && fingerprint(createArena(seed, stil)) !== fingerprint(a)) determin = false;
    layouts.add(Buffer.from(a.tiles).toString('base64'));

    let solid = 0, haz = 0;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const t = a.tile(x, z);
      const mitte = Math.abs(x - c) < 3.5 && Math.abs(z - c) < 3.5;
      if (mitte && !normal(t)) mitteFrei = false;
      const amRand = x <= 2 || z <= 2 || x >= S - 3 || z >= S - 3;
      if (amRand && (x > 0 && z > 0) && hindernis(t)) randFrei = false;
      if (hindernis(t)) solid++;
      if (HAZARD[stil] !== undefined && t === HAZARD[stil]) haz++;
    }
    for (let i = 0; i < S; i++) if (a.tile(i, 0) !== Tile.Wall || a.tile(0, i) !== Tile.Wall || a.height(i, 0) < 2 || a.height(0, i) < 2) mauern = false;
    // Türme: Höhe 4, Abstand 5–7, jeweils mit Fackel
    for (const [wx, wz] of [[1, 0], [0, 1]]) {
      const tuerme: number[] = [];
      for (let i = 1; i < S; i++) if (a.height(i * wx, i * wz) === 4) tuerme.push(i);
      if (tuerme.length < 3 || tuerme[0] > 4) fackeln = false;
      for (let q = 1; q < tuerme.length; q++) if (tuerme[q] - tuerme[q - 1] < 5 || tuerme[q] - tuerme[q - 1] > 7) fackeln = false;
      for (const i of tuerme) if (!a.props.some((p) => p.kind === 'torch' && Math.floor(p.x) === i * wx && Math.floor(p.z) === i * wz && p.y === 4)) fackeln = false;
    }
    for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) {
      const t = a.tile(x, z), h = a.height(x, z);
      if (t === Tile.Pillar && (h < 1 || h > 3)) mauern = false;
      if (t === Tile.Crate && (h < 1 || h > 2)) mauern = false;
    }
    if (abgeschnitten(a) > 0) erreichbar = false;
    ring = Math.min(ring, bossRing(a));
    luecke = Math.min(luecke, minLuecke(a));
    for (const p of a.props) {
      if (p.kind === 'torch') continue;
      const tx = Math.floor(p.x), tz = Math.floor(p.z);
      if (!normal(a.tile(tx, tz))) propsOk = false;
      if (p.r > 0 && Math.abs(tx - c) < 3.5 && Math.abs(tz - c) < 3.5) propsOk = false;
    }
    const fass = a.props.filter((p) => p.kind === (stil === 'heu' ? 'heu' : 'barrel')).length;
    if (stil === 'eis' && fass > 0) propsOk = false;
    fassMin = Math.min(fassMin, fass);
    kristallMin = Math.min(kristallMin, a.props.filter((p) => p.kind === 'crystal').length);
    solidMin = Math.min(solidMin, solid); solidMax = Math.max(solidMax, solid); solidSum += solid;
    hazMin = Math.min(hazMin, haz); hazMax = Math.max(hazMax, haz);
  }
  const P = `[${stil}]`;
  ok(groesse, `${P} Rückgabeform (Größe, Stil, Seed, Spawn in der Mitte)`);
  ok(determin, `${P} gleicher Seed → identische Kacheln, Höhen und Props`);
  ok(layouts.size >= SEEDS - 2, `${P} verschiedene Seeds → verschiedene Layouts (${layouts.size}/${SEEDS})`);
  ok(mitteFrei, `${P} Mitte frei (keine Hindernisse, keine Gefahrenflächen)`);
  ok(randFrei, `${P} 2 Kacheln Rand ohne Hindernisse`);
  ok(mauern, `${P} hintere Mauern, Säulen-/Kistenhöhen im Rahmen`);
  ok(fackeln, `${P} Türme mit Fackeln im Abstand 5–7`);
  ok(erreichbar, `${P} alle begehbaren Kacheln von der Mitte erreichbar`);
  ok(luecke >= 3, `${P} zwischen Hindernissen mindestens 2 Kacheln Platz (kleinster Abstand ${luecke})`);
  ok(ring >= 0.5, `${P} Boss-Spawnring mindestens zur Hälfte frei (min. ${(ring * 100).toFixed(0)} %)`);
  ok(propsOk, `${P} Fässer/Heu/Kristalle/Geröll nur auf normalem Boden`);
  ok(kristallMin === 2, `${P} immer 2 Kristalle (min. ${kristallMin})`);
  if (stil !== 'eis') ok(fassMin >= 1, `${P} explosive Fässer bzw. Heuballen vorhanden (min. ${fassMin})`);
  const solidAvg = solidSum / SEEDS;
  // Bereich der festen Kacheln (Säulen, Kisten, Lava) – grob wie die alten, handgesetzten Arenen
  const [lo, hi] = stil === 'lava' ? [55, 100] : stil === 'festung' ? [25, 60] : stil === 'schrott' ? [12, 30] : [6, 20];
  ok(solidMin >= lo && solidMax <= hi, `${P} feste Kacheln ${solidMin}–${solidMax} (Ø ${solidAvg.toFixed(1)}, erlaubt ${lo}–${hi})`);
  if (HAZARD[stil] !== undefined) {
    const [hl, hh] = stil === 'lava' ? [50, 90] : stil === 'festung' ? [18, 45] : stil === 'eis' ? [80, 140] : stil === 'gift' ? [30, 65] : [32, 32];
    ok(hazMin >= hl && hazMax <= hh, `${P} Gefahrenflächen ${hazMin}–${hazMax} Kacheln (erlaubt ${hl}–${hh})`);
  }
}

// Verschiedene Stile mit gleichem Seed sehen verschieden aus
{
  const a = createArena(99, 'eis'), b = createArena(99, 'heu');
  let same = 0;
  for (let i = 0; i < a.tiles.length; i++) if (a.tiles[i] === Tile.Pillar && b.tiles[i] === Tile.Pillar) same++;
  ok(same < 4, `gleicher Seed, anderer Stil → andere Säulen (${same} gleich)`);
}

if (fails) { console.log(`\n${fails} Arena-Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Arena-Tests bestanden');
