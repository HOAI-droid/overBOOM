import type { StatKey } from './stats.ts';

/**
 * Passive Items aus dem Shop – stapelbar, oft mit Vor- UND Nachteil.
 * seltenheit: 1–4 (Grau, Blau, Lila, Gold). preis = Grundpreis auf Welle 1.
 */
export interface Item {
  id: string;
  name: string;
  text: string;
  seltenheit: 1 | 2 | 3 | 4;
  preis: number;
  werte: Partial<Record<StatKey, number>>;
  /** höchstens so oft kaufbar */
  max?: number;
  /** Sonderwirkung, die die Simulation kennt */
  spezial?: 'explodiertBeiTreffer';
}

export const ITEMS: Item[] = [
  { id: 'strickschal', name: 'Omas Strickschal', text: 'Kratzt, wärmt, heilt.', seltenheit: 1, preis: 18, werte: { maxHp: 5, regen: 1 } },
  { id: 'kaffeetasse', name: 'Kaffeetasse', text: 'Die Hände zittern. Der Abzug auch.', seltenheit: 1, preis: 18, werte: { angriff: 8, maxHp: -2 } },
  { id: 'huehnerfeder', name: 'Hühnerfeder', text: 'Federleicht – fast wie ein Huhn.', seltenheit: 1, preis: 15, werte: { tempo: 6, ausweichen: 2 } },
  { id: 'rostdeckel', name: 'Rostiger Topfdeckel', text: 'Ein Schild ist ein Schild.', seltenheit: 1, preis: 16, werte: { ruestung: 2, tempo: -2 } },
  { id: 'glueckskeks', name: 'Glückskeks', text: '„Du wirst bald etwas Großes sprengen."', seltenheit: 1, preis: 15, werte: { glueck: 15 } },
  { id: 'kristallschaufel', name: 'Kristallschaufel', text: 'Wer schaufelt, der erntet.', seltenheit: 1, preis: 20, werte: { ernte: 8 } },
  { id: 'magnetsocke', name: 'Magnet im Socken', text: 'Klebt am Fuß. Kristalle auch.', seltenheit: 1, preis: 16, werte: { magnet: 40 } },
  { id: 'fernrohr', name: 'Fernrohr', text: 'Kapitän sieht Gegner. Kapitän schießt.', seltenheit: 2, preis: 30, werte: { reichweite: 18, krit: 2 } },
  { id: 'lupe', name: 'Lupe', text: 'Findet Schwachstellen. Und Krümel.', seltenheit: 2, preis: 32, werte: { krit: 6 } },
  { id: 'muskelshake', name: 'Muskelshake', text: 'Schmeckt nach Turnhalle.', seltenheit: 2, preis: 34, werte: { schaden: 10, angriff: -3 } },
  { id: 'vampirgebiss', name: 'Vampirgebiss', text: 'Aus dem Scherzartikelladen. Funktioniert trotzdem.', seltenheit: 2, preis: 36, werte: { lebensraub: 3, maxHp: -3 } },
  { id: 'gummistiefel', name: 'Turbo-Gummistiefel', text: 'Quietschen bei Höchstgeschwindigkeit.', seltenheit: 2, preis: 30, werte: { tempo: 12, ruestung: -1 } },
  { id: 'pilzsuppe', name: 'Pilzsuppe', text: 'Aus dem Pilzmoor. Riecht auch so.', seltenheit: 2, preis: 28, werte: { regen: 3, tempo: -3 } },
  { id: 'wackelpudding', name: 'Wackelpudding', text: 'Wackelt sich aus jeder Gefahr.', seltenheit: 2, preis: 34, werte: { ausweichen: 8, schaden: -3 } },
  { id: 'herzkissen', name: 'Herzkissen', text: 'Flauschig und lebensverlängernd.', seltenheit: 2, preis: 32, werte: { maxHp: 12, tempo: -3 } },
  { id: 'dynamitweste', name: 'Dynamitweste', text: 'Du explodierst, wenn du getroffen wirst. Das ist gut so.', seltenheit: 2, preis: 42, werte: { explosion: 35, ruestung: -2 }, max: 1, spezial: 'explodiertBeiTreffer' },
  { id: 'toasterbatterie', name: 'Toaster-Batterie', text: 'Aus einem Toastomaten geklaut. Er will sie zurück.', seltenheit: 3, preis: 55, werte: { angriff: 18, schaden: 5, maxHp: -5 } },
  { id: 'bombenguertel', name: 'Bombengürtel', text: 'Modisch und explosiv.', seltenheit: 3, preis: 58, werte: { explosion: 25, schaden: 8 } },
  { id: 'monokel', name: 'Barons Monokel', text: 'Der Baron sucht es schon überall.', seltenheit: 3, preis: 62, werte: { krit: 12, glueck: 10 } },
  { id: 'kochtopfhelm', name: 'Grummel-Kochtopf', text: 'Verbeult, aber bewährt.', seltenheit: 3, preis: 56, werte: { ruestung: 5, maxHp: 5, ausweichen: -4 } },
  { id: 'sternenstaub', name: 'Sternenstaub', text: 'Glitzert. Trifft. Glitzert mehr.', seltenheit: 3, preis: 55, werte: { reichweite: 15, krit: 5, angriff: 5 } },
  { id: 'goldhuhn', name: 'Goldenes Huhn', text: 'Legt keine Eier. Legt Gegner um.', seltenheit: 4, preis: 105, werte: { schaden: 20, angriff: 15, glueck: 20 }, max: 1 },
  { id: 'kawummkern', name: 'Kawumm-Kern', text: 'Ein Splitter vom Großen Kawumm. Brummt leise.', seltenheit: 4, preis: 115, werte: { explosion: 60, schaden: 15, maxHp: -10 }, max: 1 },
  { id: 'kristallkrone', name: 'Kristallkrone', text: 'Schwer auf dem Kopf, leicht im Geldbeutel.', seltenheit: 4, preis: 95, werte: { ernte: 25, glueck: 25 }, max: 1 }
];

import { ITEMS_EXTRA } from './items_extra.ts';
ITEMS.push(...ITEMS_EXTRA);

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
