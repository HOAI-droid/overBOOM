/**
 * OVERBOOM – Spieler-Werte. Alle Boni (Level-Up, Items) addieren sich auf diese Grundwerte.
 */

export type StatKey =
  | 'maxHp' | 'regen' | 'lebensraub' | 'schaden' | 'angriff' | 'krit' | 'reichweite'
  | 'ruestung' | 'ausweichen' | 'tempo' | 'glueck' | 'ernte' | 'explosion' | 'magnet';

export type Stats = Record<StatKey, number>;

export interface StatInfo {
  name: string;
  /** '%' = Prozentwert, '' = absolut */
  einheit: '%' | '';
  text: string;
}

export const STAT_KEYS: StatKey[] = [
  'maxHp', 'regen', 'lebensraub', 'schaden', 'angriff', 'krit', 'reichweite',
  'ruestung', 'ausweichen', 'tempo', 'glueck', 'ernte', 'explosion', 'magnet'
];

export const STAT_INFO: Record<StatKey, StatInfo> = {
  maxHp: { name: 'Max. Leben', einheit: '', text: 'Mehr Leben.' },
  regen: { name: 'Regeneration', einheit: '', text: 'Heilt 0,1 Leben pro Sekunde und Punkt.' },
  lebensraub: { name: 'Lebensraub', einheit: '%', text: 'Chance, bei einem Treffer 1 Leben zu heilen.' },
  schaden: { name: 'Schaden', einheit: '%', text: 'Mehr Schaden mit allen Waffen.' },
  angriff: { name: 'Feuerrate', einheit: '%', text: 'Alle Waffen feuern schneller.' },
  krit: { name: 'Krit-Chance', einheit: '%', text: 'Chance auf doppelten Schaden.' },
  reichweite: { name: 'Reichweite', einheit: '%', text: 'Waffen zielen weiter.' },
  ruestung: { name: 'Rüstung', einheit: '', text: 'Weniger Schaden durch Treffer.' },
  ausweichen: { name: 'Ausweichen', einheit: '%', text: 'Chance, einem Treffer komplett zu entgehen (max. 60 %).' },
  tempo: { name: 'Lauftempo', einheit: '%', text: 'Schneller laufen.' },
  glueck: { name: 'Glück', einheit: '', text: 'Bessere Angebote im Shop und beim Level-Up.' },
  ernte: { name: 'Ernte', einheit: '', text: 'Bonus-Kristalle am Ende jeder Welle.' },
  explosion: { name: 'Explosionsradius', einheit: '%', text: 'Größere Explosionen.' },
  magnet: { name: 'Sammelradius', einheit: '%', text: 'Kristalle fliegen dir von weiter weg zu.' }
};

export function baseStats(): Stats {
  return {
    maxHp: 0, regen: 0, lebensraub: 0, schaden: 0, angriff: 0, krit: 0, reichweite: 0,
    ruestung: 0, ausweichen: 0, tempo: 0, glueck: 0, ernte: 0, explosion: 0, magnet: 0
  };
}

/** Seltenheit I–V: Grau, Blau, Lila, Gold, Rot („OVERBOOM") */
export const SELTENHEIT = [
  { name: 'Gewöhnlich', farbe: '#9a94b0' },
  { name: 'Selten', farbe: '#3d9bff' },
  { name: 'Episch', farbe: '#b05dff' },
  { name: 'Legendär', farbe: '#ffd23f' },
  { name: 'OVERBOOM', farbe: '#ff3d3d' }
] as const;

export const TIER_ZAHL = ['I', 'II', 'III', 'IV', 'V'] as const;
