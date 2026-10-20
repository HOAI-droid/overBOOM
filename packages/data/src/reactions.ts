/**
 * OVERBOOM – Elementar-Reaktionen. Trifft ein Element einen Gegner, der schon unter
 * einem anderen Element steht, gibt es eine Reaktion mit eigenem Effekt.
 * Sechs Elemente → 15 Kombinationen, jede mit eigenem Namen und Effekt.
 */

export type Reaktionselement = 'feuer' | 'eis' | 'blitz' | 'gift' | 'nass' | 'grav';

/** Welche Ladung welches Element trägt */
export const LADUNG_ELEMENT: Record<string, Reaktionselement> = {
  brand: 'feuer', lava: 'feuer',
  frost: 'eis',
  kettenblitz: 'blitz',
  gift: 'gift', saeure: 'gift',
  wasser: 'nass',
  schwerkraft: 'grav', magnet: 'grav'
};

export interface Reaktion {
  id: string;
  elemente: [Reaktionselement, Reaktionselement];
  name: string;
  text: string;
  farbe: string;
}

export const REAKTIONEN: Reaktion[] = [
  { id: 'dampfexplosion', elemente: ['feuer', 'eis'], name: 'Dampfexplosion!', text: 'Feuer trifft Eis: Es knallt in einer heißen Dampfwolke.', farbe: '#e8f4ff' },
  { id: 'dampfwolke', elemente: ['feuer', 'nass'], name: 'Dampfwolke!', text: 'Feuer trifft Nässe: Zischender Dampf, Gegner sehen nichts und stolpern.', farbe: '#c8d8e8' },
  { id: 'stinkbombe', elemente: ['feuer', 'gift'], name: 'Stinkbombe!', text: 'Feuer trifft Gift: Eine grüne Explosion verteilt das Gift ringsum.', farbe: '#a8ff5a' },
  { id: 'plasmabrand', elemente: ['feuer', 'blitz'], name: 'Plasmabrand!', text: 'Feuer trifft Blitz: Ein Plasmaball platzt.', farbe: '#ff8af0' },
  { id: 'feuerwirbel', elemente: ['feuer', 'grav'], name: 'Feuerwirbel!', text: 'Feuer im Sog: Eine Lavaspirale zündet alles in der Nähe an.', farbe: '#ff7a1a' },
  { id: 'splitterschock', elemente: ['blitz', 'eis'], name: 'Splitterschock!', text: 'Blitz trifft Eis: Der Gegner zerspringt in Eissplitter.', farbe: '#a8f6ff' },
  { id: 'kettenschock', elemente: ['blitz', 'nass'], name: 'Kettenschock!', text: 'Blitz trifft Nässe: Alle nassen Gegner in der Nähe kriegen eine gewischt.', farbe: '#3de8ff' },
  { id: 'nervengift', elemente: ['blitz', 'gift'], name: 'Nervengift!', text: 'Blitz trifft Gift: Gegner zucken und stehen still.', farbe: '#c8ff3a' },
  { id: 'plasmakern', elemente: ['blitz', 'grav'], name: 'Plasmakern!', text: 'Blitz im Sog: Ein Mega-Kettenblitz springt von Gegner zu Gegner.', farbe: '#b0a2ff' },
  { id: 'schockfrost', elemente: ['eis', 'nass'], name: 'Schockfrost!', text: 'Eis trifft Nässe: Alles in der Nähe gefriert sofort.', farbe: '#ffffff' },
  { id: 'frostgift', elemente: ['eis', 'gift'], name: 'Frostgift!', text: 'Eis trifft Gift: Gefrorenes Gift wirkt doppelt.', farbe: '#7dffd8' },
  { id: 'eisimplosion', elemente: ['eis', 'grav'], name: 'Eisimplosion!', text: 'Eis im Sog: Alles im Wirbel friert ein.', farbe: '#d8f8ff' },
  { id: 'sumpf', elemente: ['gift', 'nass'], name: 'Giftsumpf!', text: 'Gift trifft Nässe: Ein blubbernder Giftsumpf entsteht.', farbe: '#5dbb3a' },
  { id: 'giftstrudel', elemente: ['gift', 'grav'], name: 'Giftstrudel!', text: 'Gift im Sog: Alle im Wirbel werden vergiftet.', farbe: '#9aff3a' },
  { id: 'strudel', elemente: ['nass', 'grav'], name: 'Strudel!', text: 'Nässe im Sog: Ein Wasserstrudel zieht alles zusammen.', farbe: '#3d9bff' }
];

const key = (a: string, b: string) => (a < b ? a + '+' + b : b + '+' + a);
const BY_PAIR: Record<string, Reaktion> = Object.fromEntries(REAKTIONEN.map((r) => [key(r.elemente[0], r.elemente[1]), r]));

/** Reaktion zweier Elemente (Reihenfolge egal) */
export function findeReaktion(a: Reaktionselement, b: Reaktionselement): Reaktion | undefined {
  return a === b ? undefined : BY_PAIR[key(a, b)];
}
