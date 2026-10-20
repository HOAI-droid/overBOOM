import type { StatKey } from './stats.ts';

/**
 * OVERBOOM – Die Kawumm-Jäger. Jeder Held hat Startwaffe, Werte und eine Macke (Perk),
 * die die Simulation kennt.
 *
 * Perks:
 *   nurExplosiv    – im Shop nur Waffen mit Explosiv- oder Feuer-Element
 *   turmprofi      – 2 Türme gleichzeitig, Türme +50 % Schaden
 *   zufall         – zufällige Startwaffe, erster Reroll pro Shop gratis
 *   kekse          – alle 8 s ein Keks (+2 Leben)
 *   huehnerfreund  – Gacker-Waffen +40 % Schaden, alle 6 s schlüpft ein Küken
 *   blitzprofi     – Kettenblitze springen 2× weiter
 *   frostprofi     – Gegner frieren schon nach 2 Frost-Treffern ein
 *   giftprofi      – Gift wirkt 60 % stärker
 *   nahkampfprofi  – Nahkampf-Waffen +50 % Schaden
 *   dashprofi      – Dash lädt 40 % schneller und stößt Gegner weg
 *   fusionsprofi   – Schmiedelohn gratis, Fusionen +25 % Schaden
 *   grummelfreund  – Gegner lassen 20 % öfter einen Extra-Kristall fallen
 */
export interface Held {
  id: string;
  name: string;
  titel: string;
  text: string;
  spruch: string;
  /** Waffen-ID oder 'zufall' */
  startWaffe: string;
  werte: Partial<Record<StatKey, number>>;
  perks: string[];
  /** Farbe von Helm und Akzenten */
  farbe: string;
}

export const HELDEN: Held[] = [
  {
    id: 'kawummkid', name: 'Kawumm-Kid', titel: 'Der Neuling',
    text: 'Frisch aus der Kawumm-Jäger-Akademie. Kann alles ein bisschen, nichts so richtig – aber mit Begeisterung.',
    spruch: '„Ich hab den Kurs mit Auszeichnung bestanden. Also, fast."',
    startWaffe: 'pistole', werte: { maxHp: 5, schaden: 5, tempo: 3, glueck: 5 }, perks: [], farbe: '#3de8ff'
  },
  {
    id: 'pyromane', name: 'Der Pyromane', titel: 'Brandstifter mit Diplom',
    text: 'Liebt alles, was knallt. Im Shop gibt es für ihn nur Explosiv- und Feuerwaffen – dafür doppelter Radius.',
    spruch: '„Mehr Kawumm! MEHR!"',
    startWaffe: 'raketenwerfer', werte: { explosion: 100, ruestung: -2 }, perks: ['nurExplosiv'], farbe: '#ff7a1a'
  },
  {
    id: 'ingenieurin', name: 'Die Ingenieurin', titel: 'Schraubt an allem',
    text: 'Baut zwei Türme gleichzeitig, und ihre Türme treffen härter. Nahkampf ist nicht ihr Ding.',
    spruch: '„Das ist kein Turm. Das ist eine Lebenseinstellung."',
    startWaffe: 'geschuetzturm', werte: { reichweite: 10, maxHp: -5 }, perks: ['turmprofi'], farbe: '#ffd23f'
  },
  {
    id: 'gluecksspilz', name: 'Der Glückspilz', titel: 'Hat immer Schwein',
    text: 'Startet mit einer zufälligen Waffe, hat viel Glück und würfelt im Shop einmal gratis neu.',
    spruch: '„Ich hab ein gutes Gefühl. Ich hab immer ein gutes Gefühl."',
    startWaffe: 'zufall', werte: { glueck: 40, ernte: 5 }, perks: ['zufall'], farbe: '#5dff7a'
  },
  {
    id: 'omagranate', name: 'Oma Granate', titel: 'Strickt Splittergranaten',
    text: 'Wirft Granaten wie früher Wollknäuel und verteilt alle paar Sekunden Kekse. Etwas langsam auf den Beinen.',
    spruch: '„Kindchen, iss was. Und dann duck dich."',
    startWaffe: 'granatwerfer', werte: { regen: 3, tempo: -8, maxHp: 5 }, perks: ['kekse'], farbe: '#ff8af0'
  },
  {
    id: 'bauerbruno', name: 'Bauer Bruno', titel: 'Der Hühnerflüsterer',
    text: 'Seine Hühner gehorchen ihm aufs Wort. Gacker-Waffen sind stärker, und Küken laufen ihm ständig nach.',
    spruch: '„Ruhig, Berta. Ziel. Und … GACKER!"',
    startWaffe: 'huehnerkanone', werte: { maxHp: 8, ernte: 5 }, perks: ['huehnerfreund'], farbe: '#e8c860'
  },
  {
    id: 'blitzbettina', name: 'Blitz-Bettina', titel: 'Steht unter Strom',
    text: 'Ihre Kettenblitze springen doppelt so weit. Haare stehen immer zu Berge, Nerven auch.',
    spruch: '„Bzzt! Entschuldigung. Passiert mir dauernd."',
    startWaffe: 'teslastab', werte: { angriff: 15, maxHp: -10 }, perks: ['blitzprofi'], farbe: '#a8f6ff'
  },
  {
    id: 'frostfritz', name: 'Frost-Fritz', titel: 'Hat immer kalte Füße',
    text: 'Gegner frieren bei ihm schon nach zwei Frost-Treffern ein. Trägt drei Schals übereinander.',
    spruch: '„Brrr. Für euch gleich noch mehr Brrr."',
    startWaffe: 'eiszapfenwerfer', werte: { ruestung: 3, tempo: -3 }, perks: ['frostprofi'], farbe: '#d8f8ff'
  },
  {
    id: 'giftgerda', name: 'Giftmischerin Gerda', titel: 'Kocht nicht für Gäste',
    text: 'Ihr Gift wirkt deutlich stärker. Hält sich gern auf Abstand und lächelt dabei unheimlich freundlich.',
    spruch: '„Probier mal. Ist nur ein bisschen grün."',
    startWaffe: 'giftblaeser', werte: { reichweite: 10, lebensraub: 2 }, perks: ['giftprofi'], farbe: '#7dff5a'
  },
  {
    id: 'panzerpaule', name: 'Panzer-Paule', titel: 'Läuft durch Wände (meistens)',
    text: 'Viel Leben, viel Rüstung, Nahkampfwaffen +50 %. Dafür so schnell wie ein Kühlschrank.',
    spruch: '„Ausweichen ist was für Leute ohne Rüstung."',
    startWaffe: 'baseballschlaeger', werte: { maxHp: 30, ruestung: 5, tempo: -18 }, perks: ['nahkampfprofi'], farbe: '#9aa3b5'
  },
  {
    id: 'sprintina', name: 'Sprintina Flitz', titel: 'Schneller als ihr Schatten',
    text: 'Rennt, dasht, rennt. Ihr Dash lädt schneller und schubst Gegner weg. Wenig Leben – nicht getroffen werden!',
    spruch: '„Fang mich doch! Nein, wirklich, versuch es."',
    startWaffe: 'wurfsterne', werte: { tempo: 25, ausweichen: 8, maxHp: -20 }, perks: ['dashprofi'], farbe: '#ff3df0'
  },
  {
    id: 'fusionski', name: 'Prof. Fusionski', titel: 'Erfinder des Ambosses',
    text: 'Verschmilzt Waffen gratis, und seine Fusionen sind stärker. Hat sich dabei leider die Augenbrauen weggesprengt.',
    spruch: '„Wissenschaft! Und ein bisschen Kawumm."',
    startWaffe: 'magnetkanone', werte: { schaden: -5, glueck: 10 }, perks: ['fusionsprofi'], farbe: '#b05dff'
  },
  {
    id: 'grubert', name: 'Grubert der Bekehrte', titel: 'Ex-Grummelbold',
    text: 'Ein Grummelbold, der die Seiten gewechselt hat. Kennt alle Kristallverstecke: Gegner lassen öfter Extra-Kristalle fallen.',
    spruch: '„Grmpf. Ich bin jetzt einer von den Guten. Grmpf."',
    startWaffe: 'grummelpfeife', werte: { ernte: 10, glueck: 10, maxHp: -5 }, perks: ['grummelfreund'], farbe: '#6cc24a'
  }
];

export const HELD_BY_ID: Record<string, Held> = Object.fromEntries(HELDEN.map((h) => [h.id, h]));
