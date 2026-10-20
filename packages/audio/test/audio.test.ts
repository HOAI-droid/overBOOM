import { SOUNDS } from '../src/sounds.ts';
import { CHIP, Komponist, MUSIK_STILE, STIMMUNGEN, type MusikNote } from '../src/komponist.ts';
import { SR } from '../src/synth.ts';

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
console.log('\n— Audio —');
const t0 = performance.now();
let bad: string[] = [], loud: string[] = [], total = 0;
for (const [name, gen] of Object.entries(SOUNDS)) {
  const d = gen();
  total += d.length;
  let peak = 0, finite = d.length > 0;
  for (const v of d) { if (!Number.isFinite(v)) finite = false; peak = Math.max(peak, Math.abs(v)); }
  if (!finite || peak < 0.01) bad.push(name);
  if (peak > 1.2) loud.push(`${name} (${peak.toFixed(2)})`);
}
ok(bad.length === 0, `${Object.keys(SOUNDS).length} Soundeffekte erzeugt${bad.length ? ' – kaputt: ' + bad.join(', ') : ''}`);
ok(loud.length === 0, `kein Sound übersteuert${loud.length ? ': ' + loud.join(', ') : ''}`);
ok(performance.now() - t0 < 1500, `Erzeugung in ${(performance.now() - t0).toFixed(0)} ms (${(total / SR).toFixed(1)} s Audio)`);
ok(Object.values(CHIP).every((t) => t.bass.length === 16 && t.lead.length === 32 && t.drums.length === 16 && t.akkorde.length > 0), `${Object.keys(CHIP).length} Chiptune-Stücke mit gültigen Mustern`);

// Prozedurale Musik: jeder Stil × jede Stimmung, 64 Takte mit wechselnder Intensität
{
  const t1 = performance.now();
  const buf: MusikNote[] = [];
  const fehler: string[] = [];
  const spielen = (stil: (typeof MUSIK_STILE)[number], st: (typeof STIMMUNGEN)[number], seed: number, intens: (takt: number) => number) => {
    const k = new Komponist(stil, st, seed);
    const takte: string[] = [];
    const proStufe = [0, 0, 0], taktZahl = [0, 0, 0];
    for (let step = 0; step < 64 * 16; step++) {
      const takt = Math.floor(step / 16);
      k.schritt(step, intens(takt), buf);
      if (step % 16 === 0) { takte.push(''); taktZahl[k.aktuelleStufe]++; }
      for (const n of buf) {
        takte[takt] += `${n.inst}${n.noten.join('.')}|${step % 16};`;
        proStufe[k.aktuelleStufe]++;
        const ok2 = Number.isFinite(n.dauer) && n.dauer > 0 && n.vel > 0 && n.vel <= 1 && n.versatz >= 0 && n.versatz < 1
          && n.noten.every((m) => Number.isFinite(m) && m >= 24 && m <= 100);
        if (!ok2) fehler.push(`${stil}/${st}: ${JSON.stringify(n)}`);
      }
    }
    return { takte, proStufe, taktZahl, bpm: k.bpm };
  };
  const welle = (t: number) => (t % 24 < 8 ? 0.15 : t % 24 < 16 ? 0.55 : 0.9);
  let vielfalt = true, dichte = true, stufen = true, det = true;
  const info: string[] = [];
  for (const stil of MUSIK_STILE) for (const st of STIMMUNGEN) {
    const r = spielen(stil, st, 42, welle);
    const verschieden = new Set(r.takte).size;
    const leer = r.takte.filter((t) => !t).length;
    if (stil !== 'chip' && verschieden < 12) { vielfalt = false; info.push(`${stil}/${st}: nur ${verschieden} verschiedene Takte`); }
    if (leer > 4) { dichte = false; info.push(`${stil}/${st}: ${leer} leere Takte`); }
    // in der Kampf-Stimmung: wilde Takte dichter als ruhige
    if (stil !== 'chip' && st === 'kampf') {
      const d0 = r.proStufe[0] / Math.max(1, r.taktZahl[0]), d2 = r.proStufe[2] / Math.max(1, r.taktZahl[2]);
      if (!(r.taktZahl[0] > 0 && r.taktZahl[2] > 0 && d2 > d0 * 1.3)) { stufen = false; info.push(`${stil}: Stufe 0 ${d0.toFixed(1)} vs. Stufe 2 ${d2.toFixed(1)} Noten/Takt`); }
    }
    const r2 = spielen(stil, st, 42, welle);
    if (r2.takte.join() !== r.takte.join()) { det = false; info.push(`${stil}/${st}: nicht reproduzierbar`); }
  }
  ok(fehler.length === 0, `Musik: alle Noten gültig${fehler.length ? ' – ' + fehler.slice(0, 3).join(' / ') : ''}`);
  ok(vielfalt, `Musik: genug Abwechslung (≥ 12 verschiedene Takte in 64)${vielfalt ? '' : ' – ' + info.join('; ')}`);
  ok(dichte, `Musik: keine längeren Pausen${dichte ? '' : ' – ' + info.join('; ')}`);
  ok(stufen, `Musik: Intensität macht die Musik dichter${stufen ? '' : ' – ' + info.join('; ')}`);
  ok(det, 'Musik: gleicher Seed → gleiche Musik');
  const a = spielen('rock', 'kampf', 1, () => 0.5).takte.join(), b = spielen('rock', 'kampf', 2, () => 0.5).takte.join();
  ok(a !== b, 'Musik: anderer Seed → andere Musik');
  ok(performance.now() - t1 < 2000, `Musik-Komponist schnell genug (${(performance.now() - t1).toFixed(0)} ms für ${MUSIK_STILE.length * STIMMUNGEN.length * 2} × 64 Takte)`);
}
if (fails) { console.log(`\n${fails} Audio-Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Audio-Tests bestanden');
