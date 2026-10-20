/**
 * Spieldaten übersetzen: Namen, Beschreibungen, Lore usw. werden beim Start einmal
 * in die gewählte Sprache umgeschrieben (die Logik arbeitet nur mit IDs).
 * Derselbe Durchlauf sammelt für `tools/i18n.ts` alle deutschen Texte für den Katalog.
 *
 * Nicht übersetzt werden Werte, die zugleich Logik-Schlüssel sind (Elemente, Waffengruppen,
 * IDs) – die übersetzt die Oberfläche beim Anzeigen mit t().
 */
import { t } from './i18n.ts';
import { GESCHOSSE, ANTRIEBE, LADUNGEN, WAFFEN } from './weapons.ts';
import { GEGNER } from './enemies.ts';
import { STAT_INFO, SELTENHEIT } from './stats.ts';
import { UPGRADES } from './upgrades.ts';
import { ITEMS } from './items.ts';
import { REZEPTE } from './fusion.ts';
import { INSELN } from './islands.ts';
import { HELDEN } from './heroes.ts';
import { SYNERGIEN } from './synergies.ts';
import { REAKTIONEN } from './reactions.ts';
import { MODS, EVOLUTION, EVO_NAMEN } from './mods.ts';
import { PLAETZE, SETS, AUSRUESTUNG_TEXTE } from './equipment.ts';
import { WELT, INSEL_LORE, BOSS_LORE, WELLEN_SPRUECHE, SPRUECHE_TOD, TIPPS, PERK_INFO, VERHALTEN_INFO, BOSS_ANGRIFF_INFO, WAFFEN_ZITATE, GRUPPEN_ZITATE, REZEPT_ZITATE, SPEZIAL_INFO, setzeSiegText, SIEG_TEXT } from './lore.ts';
import { KARTEN, ART_INFO, ERFOLGE, HELD_FREI, KARTEN_SET } from './cards.ts';
import { GEFAHREN } from './danger.ts';

/** Felder, die Anzeigetext enthalten */
const FELDER = new Set([
  'name', 'text', 'titel', 'spruch', 'fraktion', 'gefahrText', 'hinweis', 'typzeile', 'flavor', 'zitat',
  'bedingung', 'glanzBedingung', 'mehrzahl', 'gesperrt', 'ankunft', 'befreit', 'auftritt', 'wut', 'sieg',
  'untertitel', 'kartenSet', 'kartenSetKurz', 'kurz'
]);
/** Felder mit Listen von Anzeigetexten */
const LISTEN = new Set(['intro']);

/** Wurzeln mit Objekten, deren Anzeigefelder übersetzt werden */
const OBJEKTE: unknown[] = [
  GESCHOSSE, ANTRIEBE, LADUNGEN, WAFFEN, GEGNER, STAT_INFO, SELTENHEIT, UPGRADES, ITEMS, REZEPTE, INSELN, HELDEN,
  SYNERGIEN, REAKTIONEN, MODS, EVOLUTION, PLAETZE, SETS, WELT, INSEL_LORE, BOSS_LORE, PERK_INFO, VERHALTEN_INFO,
  SPEZIAL_INFO, KARTEN, ART_INFO, ERFOLGE, HELD_FREI, KARTEN_SET, GEFAHREN
];
/** Listen von Texten (jeder Eintrag ein Text) */
const TEXTLISTEN: string[][] = [WELLEN_SPRUECHE, SPRUECHE_TOD, TIPPS, ...Object.values(GRUPPEN_ZITATE)];
/** Tabellen Schlüssel → Text */
const TEXTTABELLEN: Record<string, string>[] = [BOSS_ANGRIFF_INFO, WAFFEN_ZITATE, REZEPT_ZITATE];

type Fn = (s: string) => string;

function durchlaufe(f: Fn): void {
  const gesehen = new Set<unknown>();
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object' || gesehen.has(o)) return;
    gesehen.add(o);
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    const r = o as Record<string, unknown>;
    for (const k of Object.keys(r)) {
      const v = r[k];
      if (typeof v === 'string') { if (FELDER.has(k) && v) r[k] = f(v); }
      else if (LISTEN.has(k) && Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (typeof v[i] === 'string') v[i] = f(v[i]); }
      else walk(v);
    }
  };
  for (const o of OBJEKTE) walk(o);
  for (const l of TEXTLISTEN) for (let i = 0; i < l.length; i++) l[i] = f(l[i]);
  for (const tab of TEXTTABELLEN) for (const k of Object.keys(tab)) tab[k] = f(tab[k]);
  for (const paar of Object.values(EVO_NAMEN)) { paar[0] = f(paar[0]); paar[1] = f(paar[1]); }
  setzeSiegText(f(SIEG_TEXT));
}

let erledigt = false;

/** Spieldaten in die aktuelle Sprache übersetzen (einmal beim Start, nach setzeWoerterbuch) */
export function lokalisiereDaten(): void {
  if (erledigt) return;
  erledigt = true;
  durchlaufe((s) => t(s));
}

/** alle deutschen Datentexte (für den Übersetzungskatalog) – nur vor lokalisiereDaten() aufrufen */
export function datenTexte(): string[] {
  const set = new Set<string>();
  durchlaufe((s) => { set.add(s); return s; });
  for (const s of AUSRUESTUNG_TEXTE) set.add(s);
  return [...set];
}
