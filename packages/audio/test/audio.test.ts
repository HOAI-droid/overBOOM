import { SOUNDS } from '../src/sounds.ts';
import { TRACKS } from '../src/music.ts';
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
ok(Object.values(TRACKS).every((t) => t.bass.length === 16 && t.lead.length === 32 && t.drums.length === 16 && t.akkorde.length > 0), `${Object.keys(TRACKS).length} Musikstücke mit gültigen Mustern`);
if (fails) { console.log(`\n${fails} Audio-Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Audio-Tests bestanden');
