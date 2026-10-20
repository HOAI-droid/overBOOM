/**
 * Übersetzungs-Katalog (gemeinsam für tools/i18n.ts und den Sprachtest).
 *
 * Der Katalog besteht aus allen deutschen Datentexten (lokalisierung.ts) und allen
 * t('…')-Aufrufen im Quelltext. Die Wörterbücher bilden deutsch → Zielsprache ab.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { datenTexte, GESCHOSSE, ANTRIEBE, LADUNGEN, WAFFEN, ELEMENT_INFO } from '../packages/data/src/index.ts';

export const ROOT = new URL('..', import.meta.url).pathname;
export const I18N = join(ROOT, 'packages/data/src/i18n');
export const SPRACHEN = ['en', 'es', 'fr'] as const;

/** alle .ts-Dateien unter einem Ordner */
function dateien(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== 'test' && n !== 'i18n') out.push(...dateien(p)); }
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** t('…') / tr('…') im Quelltext finden */
export function quelltextTexte(): Map<string, string> {
  const gefunden = new Map<string, string>();
  const ordner = [join(ROOT, 'packages'), join(ROOT, 'apps/web/src')];
  const re = /(?<![\w.])(?:t|tr|tx)\(\s*'((?:\\.|[^'\\])*)'/g;
  for (const o of ordner) for (const f of dateien(o)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) {
      const s = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      if (!gefunden.has(s)) gefunden.set(s, f.replace(ROOT, ''));
    }
  }
  return gefunden;
}

/** dynamische Schlüssel (Element- und Gruppennamen werden mit t(variable) angezeigt) */
function dynamischeTexte(): string[] {
  return [...Object.keys(ELEMENT_INFO), ...new Set(WAFFEN.map((w) => w.gruppe))];
}

export function katalog(): { de: string; quelle: string }[] {
  const m = new Map<string, string>();
  for (const s of datenTexte()) m.set(s, 'daten');
  for (const s of dynamischeTexte()) if (!m.has(s)) m.set(s, 'daten:element/gruppe');
  for (const [s, q] of quelltextTexte()) if (!m.has(s)) m.set(s, q);
  return [...m].map(([de, quelle]) => ({ de, quelle })).filter((e) => e.de.trim() && /[A-Za-zÄÖÜäöüß]/.test(e.de));
}

/** Platzhalter {name} eines Textes */
export const platzhalter = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

export function fusionsQuellen() {
  return {
    geschosse: GESCHOSSE.map((g) => ({ id: g.id, name: g.name, adjektivDe: g.adj })),
    antriebe: ANTRIEBE.map((a) => ({ id: a.id, name: a.name, nomenDe: a.nomen, genusDe: a.genus })),
    ladungen: LADUNGEN.map((l) => ({ id: l.id, name: l.name, wortDe: l.wort }))
  };
}

