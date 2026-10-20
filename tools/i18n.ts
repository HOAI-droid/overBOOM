/**
 * Übersetzungs-Werkzeug.
 *
 *   node --experimental-strip-types tools/i18n.ts katalog   → i18n/katalog.json (+ Teildateien für Übersetzer)
 *   node --experimental-strip-types tools/i18n.ts pruefen   → fehlende/überzählige Einträge, Platzhalter
 *   node --experimental-strip-types tools/i18n.ts bauen     → i18n/<sprache>.json → i18n/<sprache>.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GESCHOSSE, ANTRIEBE, LADUNGEN, type Woerterbuch } from '../packages/data/src/index.ts';
import { I18N, SPRACHEN, katalog, platzhalter, fusionsQuellen } from './i18n-katalog.ts';

const cmd = process.argv[2];
if (cmd === 'katalog') {
  const k = katalog();
  writeFileSync(join(I18N, 'katalog.json'), JSON.stringify({ texte: k, fusion: fusionsQuellen() }, null, 1));
  // Teildateien für die Übersetzung (je ~450 Texte)
  const n = 450;
  for (let i = 0; i * n < k.length; i++) writeFileSync(join(I18N, `teil-${i + 1}.json`), JSON.stringify(k.slice(i * n, (i + 1) * n), null, 1));
  console.log(`${k.length} Texte (${k.filter((e) => e.quelle.startsWith('daten')).length} aus Daten, ${k.filter((e) => !e.quelle.startsWith('daten')).length} aus dem Quelltext), ${Math.ceil(k.length / n)} Teildateien`);
} else if (cmd === 'pruefen' || cmd === 'bauen') {
  const k = katalog();
  let fehler = 0;
  for (const sp of SPRACHEN) {
    const datei = join(I18N, `${sp}.json`);
    if (!existsSync(datei)) { console.log(`${sp}: ${datei} fehlt`); fehler++; continue; }
    const w = JSON.parse(readFileSync(datei, 'utf8')) as Woerterbuch;
    const fehlt = k.filter((e) => !(e.de in w.texte) || !w.texte[e.de]);
    const platz = k.filter((e) => e.de in w.texte && platzhalter(e.de) !== platzhalter(w.texte[e.de]));
    const keys = new Set(k.map((e) => e.de));
    const zuviel = Object.keys(w.texte).filter((s) => !keys.has(s));
    const f = w.fusion;
    const fusionFehlt = [
      ...GESCHOSSE.filter((g) => !f?.adj?.[g.id]?.m || !f.adj[g.id].f).map((g) => 'adj:' + g.id),
      ...ANTRIEBE.filter((a) => !f?.nomen?.[a.id]?.wort).map((a) => 'nomen:' + a.id),
      ...LADUNGEN.filter((l) => typeof f?.element?.[l.id] !== 'string').map((l) => 'element:' + l.id)
    ];
    console.log(`${sp}: ${Object.keys(w.texte).length} Einträge · fehlen ${fehlt.length} · Platzhalter falsch ${platz.length} · überzählig ${zuviel.length} · Fusion fehlt ${fusionFehlt.length}`);
    for (const e of fehlt.slice(0, 10)) console.log('   fehlt:', JSON.stringify(e.de).slice(0, 100));
    for (const e of platz.slice(0, 10)) console.log('   Platzhalter:', JSON.stringify(e.de).slice(0, 80), '→', JSON.stringify(w.texte[e.de]).slice(0, 80));
    for (const s of fusionFehlt.slice(0, 10)) console.log('   Fusion:', s);
    fehler += fehlt.length + platz.length + fusionFehlt.length;
    if (cmd === 'bauen') {
      // nur bekannte Schlüssel übernehmen, sortiert (stabile Diffs)
      const texte: Record<string, string> = {};
      for (const e of k) if (w.texte[e.de]) texte[e.de] = w.texte[e.de];
      const ts = `import type { Woerterbuch } from '../i18n.ts';\n\n// Erzeugt von tools/i18n.ts aus ${sp}.json – nicht von Hand bearbeiten.\nconst w: Woerterbuch = ${JSON.stringify({ texte, fusion: w.fusion }, null, 1)};\nexport default w;\n`;
      writeFileSync(join(I18N, `${sp}.ts`), ts);
    }
  }
  if (cmd === 'bauen') console.log('Wörterbücher erzeugt.');
  if (fehler) process.exitCode = 1;
} else {
  console.log('Aufruf: tools/i18n.ts katalog | pruefen | bauen');
}
