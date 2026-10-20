/**
 * OVERBOOM – Gefahrenstufen 0–10: jede Stufe bringt einen
 * zusätzlichen Modifikator und enthält alle darunter. Freigeschaltet wird die
 * nächste Stufe durch einen Sieg auf der höchsten bisher geschafften.
 */

export interface GefahrWerte {
  /** Gegnerleben × */
  hp: number;
  /** Gegnerschaden × */
  schaden: number;
  /** Spawnrate × */
  spawn: number;
  /** Elite-Chance × */
  elite: number;
  /** Shop-Preise × */
  preise: number;
  /** Heilung × */
  heilung: number;
  /** Boss-Leben × */
  bossHp: number;
  /** Gegnertempo × */
  tempo: number;
  /** Kristalle × */
  kristalle: number;
  /** Gegner explodieren beim Tod (schadet dir) */
  todesBumm: boolean;
}

export interface Gefahrenstufe {
  stufe: number;
  name: string;
  text: string;
  mod: Partial<GefahrWerte>;
}

export const GEFAHREN: Gefahrenstufe[] = [
  { stufe: 0, name: 'Gemütlich', text: 'Keine Extras – genau richtig zum Kennenlernen.', mod: {} },
  { stufe: 1, name: 'Würzig', text: 'Gegner haben 12 % mehr Leben.', mod: { hp: 1.12 } },
  { stufe: 2, name: 'Scharf', text: 'Doppelt so viele Elite-Gegner.', mod: { elite: 2 } },
  { stufe: 3, name: 'Feurig', text: 'Gegner treffen 15 % härter.', mod: { schaden: 1.15 } },
  { stufe: 4, name: 'Teuer', text: 'Der Shop wird 15 % teurer.', mod: { preise: 1.15 } },
  { stufe: 5, name: 'Gedränge', text: '20 % mehr Gegner.', mod: { spawn: 1.2 } },
  { stufe: 6, name: 'Knausrig', text: 'Heilung wirkt 25 % schwächer.', mod: { heilung: 0.75 } },
  { stufe: 7, name: 'Boss-Laune', text: 'Bosse haben 35 % mehr Leben.', mod: { bossHp: 1.35 } },
  { stufe: 8, name: 'Hektisch', text: 'Gegner laufen 12 % schneller.', mod: { tempo: 1.12 } },
  { stufe: 9, name: 'Mager', text: '15 % weniger Kristalle.', mod: { kristalle: 0.85 } },
  { stufe: 10, name: 'OVERBOOM', text: 'Alle Gegner explodieren beim Tod – auch in deine Richtung!', mod: { todesBumm: true } }
];

export const MAX_GEFAHR = GEFAHREN.length - 1;

/** Alle Modifikatoren bis einschließlich `stufe` zusammengerechnet */
export function gefahrWerte(stufe: number): GefahrWerte {
  const w: GefahrWerte = { hp: 1, schaden: 1, spawn: 1, elite: 1, preise: 1, heilung: 1, bossHp: 1, tempo: 1, kristalle: 1, todesBumm: false };
  for (const g of GEFAHREN) {
    if (g.stufe > stufe) break;
    const m = g.mod;
    if (m.hp) w.hp *= m.hp;
    if (m.schaden) w.schaden *= m.schaden;
    if (m.spawn) w.spawn *= m.spawn;
    if (m.elite) w.elite *= m.elite;
    if (m.preise) w.preise *= m.preise;
    if (m.heilung) w.heilung *= m.heilung;
    if (m.bossHp) w.bossHp *= m.bossHp;
    if (m.tempo) w.tempo *= m.tempo;
    if (m.kristalle) w.kristalle *= m.kristalle;
    if (m.todesBumm) w.todesBumm = true;
  }
  return w;
}
