/**
 * Sprachtest: Jede Sprache übersetzt jeden Text des Katalogs, Platzhalter stimmen,
 * und alle Fusionsnamen lassen sich in jeder Sprache bilden.
 */
import { katalog, platzhalter, SPRACHEN } from '../../../tools/i18n-katalog.ts';
import { GESCHOSSE, ANTRIEBE, LADUNGEN, fusionsName, ladeWoerterbuch, setzeWoerterbuch, t } from '../src/index.ts';

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
console.log('\n— Sprachen —');

const k = katalog();
ok(k.length > 2000, `Katalog: ${k.length} Texte`);
ok(t('Welle {n}', { n: 3 }) === 'Welle 3', 'Deutsch: Platzhalter werden ersetzt');
ok(fusionsName('kugel', 'gerade', 'explosion').length > 3, `Deutsch: Fusionsname „${fusionsName('kugel', 'gerade', 'explosion')}“`);

for (const sp of SPRACHEN) {
  const w = await ladeWoerterbuch(sp);
  if (!w) { ok(false, `${sp}: Wörterbuch fehlt`); continue; }
  const fehlt = k.filter((e) => !w.texte[e.de]);
  ok(fehlt.length === 0, `${sp}: alle ${k.length} Texte übersetzt${fehlt.length ? ` – es fehlen ${fehlt.length}, z. B. ${JSON.stringify(fehlt[0].de).slice(0, 60)}` : ''}`);
  const falsch = k.filter((e) => w.texte[e.de] && platzhalter(e.de) !== platzhalter(w.texte[e.de]));
  ok(falsch.length === 0, `${sp}: Platzhalter stimmen${falsch.length ? ` – falsch: ${JSON.stringify(falsch[0].de).slice(0, 60)}` : ''}`);
  const f = w.fusion;
  const luecken = [...GESCHOSSE.filter((g) => !f.adj[g.id]?.m || !f.adj[g.id]?.f), ...ANTRIEBE.filter((x) => !f.nomen[x.id]?.wort), ...LADUNGEN.filter((l) => typeof f.element[l.id] !== 'string')];
  ok(luecken.length === 0, `${sp}: Fusions-Grammatik vollständig${luecken.length ? ` – fehlt u. a. ${luecken[0].id}` : ''}`);
  // alle Fusionskombinationen ergeben einen Namen ohne Lücken
  setzeWoerterbuch(sp, w);
  let schlecht = 0, n = 0, beispiel = '';
  for (const g of GESCHOSSE) for (const a of ANTRIEBE) for (const l of LADUNGEN) {
    const name = fusionsName(g.id, a.id, l.id);
    n++;
    if (!name || name.includes('undefined') || name.includes('{') || name.length < 4) schlecht++;
    if (g.id === 'kugel' && a.id === 'gerade' && l.id === 'explosion') beispiel = name;
  }
  ok(schlecht === 0, `${sp}: alle ${n} Fusionsnamen gültig (z. B. „${beispiel}“)`);
  setzeWoerterbuch('de', null);
}

if (fails) { console.log(`\n${fails} Sprachtest(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Sprachtests bestanden');
