import { A, G, L, W, WAFFEN, elemente, type Element, type Waffe } from './weapons.ts';
import { GEGNER, type GegnerDef } from './enemies.ts';
import { HELDEN, type Held } from './heroes.ts';
import { ITEMS, type Item } from './items.ts';
import { REZEPTE, waffeById, type Rezept } from './fusion.ts';
import { SPIELER } from './balance.ts';
import { STAT_INFO, type StatKey } from './stats.ts';
import { BOSS_ANGRIFF_INFO, GRUPPEN_ZITATE, PERK_INFO, REZEPT_ZITATE, SPEZIAL_INFO, VERHALTEN_INFO, WAFFEN_ZITATE, WELT, waehle } from './lore.ts';

/**
 * OVERBOOM – Sammelkarten (Set 1 „Das Große Kawumm").
 * Jede Waffe, jedes Rezept, jeder Held, jedes Item, jeder Gegner und jeder Boss ist eine Karte.
 * Karten geben keinen Spielvorteil – sie werden nur durchs Spielen freigeschaltet.
 */

export type KartenArt = 'held' | 'waffe' | 'rezept' | 'gegner' | 'boss' | 'item';

export interface Faehigkeit { name: string; text: string }

export interface Karte {
  /** z. B. „waffe:pistole" */
  id: string;
  /** laufende Nummer im Set (1 …) */
  nr: number;
  art: KartenArt;
  /** ID in den Spieldaten */
  ref: string;
  name: string;
  elemente: Element[];
  /** Hauptwert: Waffen „Wucht", Helden/Gegner „HP", Items „Preis" */
  wert: { name: string; zahl: number };
  typzeile: string;
  faehigkeiten: Faehigkeit[];
  flavor: string;
  zitat: string;
  /** 1–5 (Gewöhnlich … OVERBOOM) */
  seltenheit: number;
  /** wie man die Karte bekommt */
  bedingung: string;
  /** wie man die Glanzkarte bekommt */
  glanzBedingung: string;
}

/** Elemente: Farbe und 5×5-Pixelsymbol (# = gefüllt) */
export const ELEMENT_INFO: Record<Element, { farbe: string; symbol: string[] }> = {
  Feuer: { farbe: '#ff5a14', symbol: ['..#..', '.##..', '.###.', '#####', '.###.'] },
  Blitz: { farbe: '#3de8ff', symbol: ['..##.', '.##..', '####.', '..##.', '.##..'] },
  Gift: { farbe: '#7dff5a', symbol: ['.###.', '#.#.#', '#####', '.#.#.', '.#.#.'] },
  Eis: { farbe: '#a8f6ff', symbol: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'] },
  Explosiv: { farbe: '#ff7a1a', symbol: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'] },
  Tech: { farbe: '#9aa3b5', symbol: ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'] },
  Natur: { farbe: '#5dbb3a', symbol: ['..##.', '.####', '.###.', '..#..', '.##..'] },
  Gacker: { farbe: '#ffe04a', symbol: ['.##..', '.###.', '####.', '.###.', '..#..'] },
  Chaos: { farbe: '#ff3df0', symbol: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] }
};

export const ELEMENT_LISTE = Object.keys(ELEMENT_INFO) as Element[];

export const ART_INFO: Record<KartenArt, { name: string; mehrzahl: string }> = {
  held: { name: 'Held', mehrzahl: 'Helden' },
  waffe: { name: 'Waffe', mehrzahl: 'Waffen' },
  rezept: { name: 'Fusionswaffe', mehrzahl: 'Rezepte' },
  gegner: { name: 'Gegner', mehrzahl: 'Gegner' },
  boss: { name: 'Boss', mehrzahl: 'Bosse' },
  item: { name: 'Item', mehrzahl: 'Items' }
};

/** Schwellen der Freischaltung */
export const KARTEN_REGELN = {
  gegnerKills: 50,
  gegnerGlanz: 500,
  bossGlanz: 5,
  itemGlanz: 5
};

const GRUPPE_SELTENHEIT: Record<string, number> = {
  Feuerwaffen: 1, Werfer: 1, Nahkampf: 2, Explosiv: 2, Elementar: 2, Support: 2,
  Energie: 3, 'Drohnen & Türme': 3, 'Beschwörung': 3, Exotisch: 4
};

const FRAKTION_ELEMENT: Record<string, Element[]> = {
  'Grummel-Fraktion': ['Natur'], Sumpfbande: ['Gift'], Blechbrut: ['Tech'], 'Hühner-Kult': ['Gacker'],
  Funkenbande: ['Blitz'], Glutgesindel: ['Feuer'], Frostfrieder: ['Eis'], Bummburg: ['Explosiv']
};

const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('de-DE');

export function wertText(k: StatKey, v: number): string {
  const info = STAT_INFO[k];
  return `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}${info.einheit ? ' %' : ''} ${info.name}`;
}

/** Wucht = grober Schaden pro Sekunde auf Stufe I */
export function wucht(w: Waffe): number {
  const n = (w.antrieb === 'faecher' ? 5 : 1) * (w.spezial?.includes('salve3') ? 3 : 1);
  return Math.max(1, Math.round(w.schaden * w.feuerrate * n));
}

function bauteile(w: Waffe): Faehigkeit[] {
  return [
    { name: G[w.geschoss].name, text: G[w.geschoss].text },
    { name: A[w.antrieb].name, text: A[w.antrieb].text },
    { name: L[w.ladung].name, text: L[w.ladung].text }
  ];
}

function heldKarte(h: Held): Omit<Karte, 'nr'> {
  const start = h.startWaffe === 'zufall' ? 'zufällig' : W[h.startWaffe]?.name ?? h.startWaffe;
  const el = h.startWaffe !== 'zufall' && W[h.startWaffe] ? elemente(W[h.startWaffe]) : (['Chaos'] as Element[]);
  const werte = (Object.keys(h.werte) as StatKey[]).map((k) => wertText(k, h.werte[k]!)).join(', ');
  return {
    id: `held:${h.id}`, art: 'held', ref: h.id, name: h.name, elemente: el,
    wert: { name: 'HP', zahl: SPIELER.maxHp + (h.werte.maxHp ?? 0) },
    typzeile: `Held — ${h.titel}`,
    faehigkeiten: [
      { name: 'Startwaffe', text: start },
      ...h.perks.map((p) => PERK_INFO[p] ?? { name: p, text: '' }),
      ...(werte ? [{ name: 'Talente', text: werte }] : [])
    ].slice(0, 3),
    flavor: h.text, zitat: h.spruch,
    seltenheit: h.id === 'kawummkid' ? 2 : 3,
    bedingung: `Spiele einen Run mit ${h.name}.`,
    glanzBedingung: `Gewinne einen Run mit ${h.name}.`
  };
}

function waffenKarte(w: Waffe): Omit<Karte, 'nr'> {
  return {
    id: `waffe:${w.id}`, art: 'waffe', ref: w.id, name: w.name, elemente: elemente(w),
    wert: { name: 'Wucht', zahl: wucht(w) },
    typzeile: `Waffe — ${w.gruppe}`,
    faehigkeiten: bauteile(w),
    flavor: w.text,
    zitat: WAFFEN_ZITATE[w.id] ?? waehle(GRUPPEN_ZITATE[w.gruppe] ?? ['„Kawumm."'], w.id),
    seltenheit: GRUPPE_SELTENHEIT[w.gruppe] ?? 2,
    bedingung: 'Benutze die Waffe in einem Run.',
    glanzBedingung: 'Bringe die Waffe auf 5 Sterne.'
  };
}

function rezeptKarte(r: Rezept): Omit<Karte, 'nr'> {
  const w = waffeById(`rezept:${r.id}`)!;
  const gruppen = w.fusion?.gruppen ?? [];
  return {
    id: `rezept:${r.id}`, art: 'rezept', ref: r.id, name: r.name, elemente: w.fusion?.elemente ?? elemente(w),
    wert: { name: 'Wucht', zahl: wucht(w) },
    typzeile: `Fusionswaffe — ${[...new Set(gruppen)].join(' · ')}`,
    faehigkeiten: [
      ...r.spezial.map((s) => SPEZIAL_INFO[s] ?? { name: s, text: '' }),
      { name: 'Zutaten', text: r.zutaten.map((z) => W[z]?.name ?? z).join(' + ') }
    ].slice(0, 3),
    flavor: r.text,
    zitat: REZEPT_ZITATE[r.id] ?? '„Was passiert, wenn man DAS zusammensteckt?" – Prof. Fusionski',
    seltenheit: 5,
    bedingung: `Entdecke das Rezept am Amboss. Hinweis: ${r.hinweis}`,
    glanzBedingung: 'Bringe die Rezept-Waffe auf Stufe V.'
  };
}

function gegnerKarte(g: GegnerDef): Omit<Karte, 'nr'> {
  const boss = g.verhalten === 'boss';
  const v = VERHALTEN_INFO[g.verhalten] ?? { name: g.verhalten, text: '' };
  const faehigkeiten: Faehigkeit[] = [v];
  if (boss) {
    const angriffe = [...new Set([...(g.angriffe1 ?? []), ...(g.angriffe2 ?? [])])];
    if (angriffe.length) faehigkeiten.push({ name: 'Angriffe', text: angriffe.map((a) => BOSS_ANGRIFF_INFO[a] ?? a).join(', ') + '.' });
  } else if (g.teiltSich) faehigkeiten.push({ name: 'Zellteilung', text: `Zerfällt in ${g.teiltSich.anzahl} kleinere Gegner.` });
  else if (g.explosionsRadius) faehigkeiten.push({ name: 'Kawumm', text: 'Explodiert beim Tod und reißt andere mit.' });
  faehigkeiten.push({ name: 'Fraktion', text: g.fraktion });
  return {
    id: `gegner:${g.id}`, art: boss ? 'boss' : 'gegner', ref: g.id, name: g.name, elemente: FRAKTION_ELEMENT[g.fraktion] ?? [],
    wert: { name: 'HP', zahl: g.hp },
    typzeile: `${boss ? 'Boss' : 'Gegner'} — ${g.fraktion}`,
    faehigkeiten: faehigkeiten.slice(0, 3),
    flavor: g.text, zitat: g.spruch,
    seltenheit: g.id === 'baron' ? 5 : boss ? 4 : g.abWelle >= 6 || g.hp >= 60 ? 2 : 1,
    bedingung: boss ? `Besiege ${g.name}.` : `Besiege ${KARTEN_REGELN.gegnerKills} ${g.name}.`,
    glanzBedingung: boss ? `Besiege ${g.name} ${KARTEN_REGELN.bossGlanz}×.` : `Besiege ${KARTEN_REGELN.gegnerGlanz} ${g.name}.`
  };
}

function itemElemente(it: Item): Element[] {
  const el: Element[] = [];
  if (it.werte.explosion && it.werte.explosion > 0) el.push('Explosiv');
  if ((it.werte.regen ?? 0) > 0 || (it.werte.lebensraub ?? 0) > 0) el.push('Natur');
  if ((it.werte.glueck ?? 0) >= 15) el.push('Chaos');
  if ((it.werte.angriff ?? 0) >= 10) el.push('Tech');
  return el.slice(0, 2);
}

function itemKarte(it: Item): Omit<Karte, 'nr'> {
  const keys = Object.keys(it.werte) as StatKey[];
  const plus = keys.filter((k) => it.werte[k]! > 0), minus = keys.filter((k) => it.werte[k]! < 0);
  const f: Faehigkeit[] = [];
  if (plus.length) f.push({ name: 'Vorteil', text: plus.map((k) => wertText(k, it.werte[k]!)).join(', ') });
  if (minus.length) f.push({ name: 'Haken', text: minus.map((k) => wertText(k, it.werte[k]!)).join(', ') });
  if (it.spezial) f.push({ name: 'Kawumm-Weste', text: 'Du explodierst, wenn du getroffen wirst.' });
  if (it.max) f.push({ name: 'Einzigartig', text: `Höchstens ${it.max}× pro Run.` });
  return {
    id: `item:${it.id}`, art: 'item', ref: it.id, name: it.name, elemente: itemElemente(it),
    wert: { name: 'Preis', zahl: it.preis },
    typzeile: `Item — ${it.max === 1 ? 'Einzigartig' : 'Stapelbar'}`,
    faehigkeiten: f.slice(0, 3),
    flavor: it.text, zitat: '',
    seltenheit: it.seltenheit,
    bedingung: 'Kaufe das Item im Shop.',
    glanzBedingung: it.max === 1 ? 'Gewinne einen Run mit diesem Item.' : `Besitze ${KARTEN_REGELN.itemGlanz} Stück gleichzeitig.`
  };
}

function baueKarten(): Karte[] {
  const roh: Omit<Karte, 'nr'>[] = [
    ...HELDEN.map(heldKarte),
    ...WAFFEN.map(waffenKarte),
    ...REZEPTE.map(rezeptKarte),
    ...GEGNER.filter((g) => g.verhalten !== 'boss').map(gegnerKarte),
    ...GEGNER.filter((g) => g.verhalten === 'boss').map(gegnerKarte),
    ...ITEMS.map(itemKarte)
  ];
  return roh.map((k, i) => ({ ...k, nr: i + 1 }));
}

export const KARTEN: Karte[] = baueKarten();
export const KARTE_BY_ID: Record<string, Karte> = Object.fromEntries(KARTEN.map((k) => [k.id, k]));

/** „087/262" */
export function kartenNummer(k: Karte): string {
  const n = String(KARTEN.length).length;
  return `${String(k.nr).padStart(n, '0')}/${KARTEN.length}`;
}

export const KARTEN_SET = { name: WELT.kartenSet, kurz: WELT.kartenSetKurz };

/* ------------------------------------------------------------------ */
/* Erfolge – jeder schaltet zusätzlich eine bestimmte Glanzkarte frei  */
/* ------------------------------------------------------------------ */

export type MetaStat =
  | 'runs' | 'siege' | 'kills' | 'maxKette' | 'fusionen' | 'rezepte' | 'reaktionen'
  | 'befreit' | 'evolutionen' | 'kristalle' | 'sets' | 'bestWelle' | 'bosse';

export interface Erfolg {
  id: string;
  name: string;
  text: string;
  stat: MetaStat;
  ziel: number;
  /** Karte, die dadurch glänzt */
  karte: string;
}

export const ERFOLGE: Erfolg[] = [
  { id: 'erster_run', name: 'Frisch von der Akademie', text: 'Spiele deinen ersten Run.', stat: 'runs', ziel: 1, karte: 'held:kawummkid' },
  { id: 'welle10', name: 'Halbzeit', text: 'Erreiche Welle 10.', stat: 'bestWelle', ziel: 10, karte: 'waffe:pistole' },
  { id: 'boss1', name: 'Bossknacker', text: 'Besiege deinen ersten Boss.', stat: 'bosse', ziel: 1, karte: 'gegner:grummelbold' },
  { id: 'sieg1', name: 'Krawummia atmet auf', text: 'Gewinne einen Run.', stat: 'siege', ziel: 1, karte: 'gegner:baron' },
  { id: 'sieg5', name: 'Serientäter', text: 'Gewinne 5 Runs.', stat: 'siege', ziel: 5, karte: 'waffe:raketenwerfer' },
  { id: 'kette25', name: 'Kettenreaktion', text: 'Löse eine Kette mit 25 Explosionen aus.', stat: 'maxKette', ziel: 25, karte: 'gegner:bombenkroete' },
  { id: 'kette50', name: 'OVERBOOM', text: 'Löse eine Kette mit 50 Explosionen aus.', stat: 'maxKette', ziel: 50, karte: 'waffe:dynamitbuendel' },
  { id: 'kills1000', name: 'Aufräumkommando', text: 'Besiege insgesamt 1.000 Gegner.', stat: 'kills', ziel: 1000, karte: 'waffe:schrotflinte' },
  { id: 'kills10000', name: 'Die Bande schrumpft', text: 'Besiege insgesamt 10.000 Gegner.', stat: 'kills', ziel: 10000, karte: 'waffe:minigun' },
  { id: 'fusion10', name: 'Amboss-Stammgast', text: 'Verschmelze 10 Waffen.', stat: 'fusionen', ziel: 10, karte: 'held:fusionski' },
  { id: 'rezepte5', name: 'Hobbykoch', text: 'Entdecke 5 geheime Rezepte.', stat: 'rezepte', ziel: 5, karte: 'waffe:keksdose' },
  { id: 'rezepte20', name: 'Sternekoch', text: 'Entdecke 20 geheime Rezepte.', stat: 'rezepte', ziel: 20, karte: 'held:omagranate' },
  { id: 'reaktion100', name: 'Chemiebaukasten', text: 'Löse 100 Elementar-Reaktionen aus.', stat: 'reaktionen', ziel: 100, karte: 'waffe:teslastab' },
  { id: 'befreit3', name: 'Inselhüpfer', text: 'Befreie 3 Inseln.', stat: 'befreit', ziel: 3, karte: 'gegner:kampfhuhn' },
  { id: 'befreit7', name: 'Befreier von Krawummia', text: 'Befreie alle 7 Inseln.', stat: 'befreit', ziel: 7, karte: 'gegner:koenig_gockel' },
  { id: 'evo1', name: 'Darwin wäre stolz', text: 'Lass eine Waffe evolvieren.', stat: 'evolutionen', ziel: 1, karte: 'waffe:huehnerkanone' },
  { id: 'kristalle5000', name: 'Kristallkönig', text: 'Sammle insgesamt 5.000 Kristalle.', stat: 'kristalle', ziel: 5000, karte: 'item:kristallkrone' },
  { id: 'set1', name: 'Gut angezogen', text: 'Trage ein komplettes Ausrüstungs-Set.', stat: 'sets', ziel: 1, karte: 'item:kochtopfhelm' }
];

/* ------------------------------------------------------------------ */
/* Helden-Freischaltung (Meta-Progression)                              */
/* ------------------------------------------------------------------ */

/** Helden ohne Eintrag sind von Anfang an spielbar */
export const HELD_FREI: Record<string, { stat: MetaStat; ziel: number; text: string }> = {
  omagranate: { stat: 'siege', ziel: 1, text: 'Gewinne einen Run.' },
  gluecksspilz: { stat: 'rezepte', ziel: 3, text: 'Entdecke 3 geheime Rezepte.' },
  blitzbettina: { stat: 'befreit', ziel: 2, text: 'Befreie 2 Inseln.' },
  frostfritz: { stat: 'befreit', ziel: 5, text: 'Befreie 5 Inseln.' },
  giftgerda: { stat: 'reaktionen', ziel: 100, text: 'Löse 100 Elementar-Reaktionen aus.' },
  panzerpaule: { stat: 'bestWelle', ziel: 10, text: 'Erreiche Welle 10.' },
  sprintina: { stat: 'runs', ziel: 5, text: 'Spiele 5 Runs.' },
  fusionski: { stat: 'fusionen', ziel: 5, text: 'Verschmelze 5 Waffen am Amboss.' },
  grubert: { stat: 'kills', ziel: 2000, text: 'Besiege insgesamt 2.000 Gegner.' }
};
