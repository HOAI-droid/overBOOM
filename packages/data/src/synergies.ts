import type { Element } from './weapons.ts';
import type { StatKey } from './stats.ts';

/**
 * OVERBOOM – Synergien: Elemente aller getragenen Waffen werden gezählt
 * (eine Fusion zählt für alle ihre Elemente). Ab 2/4/6 gibt es Set-Boni.
 *
 * Effekte, die die Simulation kennt:
 *   feuerpfuetzen, mininuke, brandplus, brandsprung, flammenwut,
 *   blitzplus, blitzstark, gewitter, giftplus, giftwolke, seuche,
 *   eisplus, frost2, zersplittern, drohne, drohnenlaser, drohne2,
 *   ranken, kueken, kuekenstark, eierregen, chaostreffer, chaosinstabil
 */
export interface SynergieStufe {
  ab: number;
  text: string;
  werte?: Partial<Record<StatKey, number>>;
  effekt?: string;
}

export interface Synergie {
  element: Element;
  farbe: string;
  stufen: SynergieStufe[];
}

export const SYNERGIEN: Synergie[] = [
  {
    element: 'Explosiv', farbe: '#ff7a1a', stufen: [
      { ab: 2, text: '+15 % Explosionsradius', werte: { explosion: 15 } },
      { ab: 4, text: 'Explosionen hinterlassen manchmal Feuerpfützen', effekt: 'feuerpfuetzen' },
      { ab: 6, text: 'Jede 10. Explosion ist eine Mini-Nuke', effekt: 'mininuke' }
    ]
  },
  {
    element: 'Feuer', farbe: '#ff5a14', stufen: [
      { ab: 2, text: 'Brand macht 50 % mehr Schaden', effekt: 'brandplus' },
      { ab: 4, text: 'Brennende Gegner zünden beim Tod ihre Nachbarn an', effekt: 'brandsprung' },
      { ab: 6, text: '+25 % Schaden gegen Brennende', effekt: 'flammenwut' }
    ]
  },
  {
    element: 'Blitz', farbe: '#3de8ff', stufen: [
      { ab: 2, text: 'Kettenblitze springen 1× mehr', effekt: 'blitzplus' },
      { ab: 4, text: 'Kettenblitze verlieren kaum Kraft', effekt: 'blitzstark' },
      { ab: 6, text: 'Alle 4 s schlägt ein Gewitterblitz ein', effekt: 'gewitter' }
    ]
  },
  {
    element: 'Gift', farbe: '#7dff5a', stufen: [
      { ab: 2, text: 'Gift wirkt 50 % stärker', effekt: 'giftplus' },
      { ab: 4, text: 'Vergiftete hinterlassen beim Tod Giftwolken', effekt: 'giftwolke' },
      { ab: 6, text: 'Vergiftete nehmen 30 % mehr Schaden', effekt: 'seuche' }
    ]
  },
  {
    element: 'Eis', farbe: '#a8f6ff', stufen: [
      { ab: 2, text: 'Frost verlangsamt stärker', effekt: 'eisplus' },
      { ab: 4, text: 'Gegner frieren schon nach 2 Frost-Treffern ein', effekt: 'frost2' },
      { ab: 6, text: 'Eingefrorene nehmen 50 % mehr Schaden', effekt: 'zersplittern' }
    ]
  },
  {
    element: 'Tech', farbe: '#9aa3b5', stufen: [
      { ab: 2, text: '+1 Kampfdrohne begleitet dich', effekt: 'drohne' },
      { ab: 4, text: 'Drohnen schießen Laser', effekt: 'drohnenlaser' },
      { ab: 6, text: '+1 weitere Drohne', effekt: 'drohne2' }
    ]
  },
  {
    element: 'Natur', farbe: '#5dbb3a', stufen: [
      { ab: 2, text: '+3 Regeneration', werte: { regen: 3 } },
      { ab: 4, text: 'Treffer fesseln Gegner manchmal mit Ranken', effekt: 'ranken' },
      { ab: 6, text: '+15 Max. Leben, +3 % Lebensraub', werte: { maxHp: 15, lebensraub: 3 } }
    ]
  },
  {
    element: 'Gacker', farbe: '#ffe04a', stufen: [
      { ab: 2, text: 'Besiegte Gegner lassen manchmal ein Küken schlüpfen', effekt: 'kueken' },
      { ab: 4, text: 'Küken picken doppelt so hart', effekt: 'kuekenstark' },
      { ab: 6, text: 'Alle 6 s regnet es explodierende Eier', effekt: 'eierregen' }
    ]
  },
  {
    element: 'Chaos', farbe: '#ff3df0', stufen: [
      { ab: 2, text: '+15 Glück', werte: { glueck: 15 } },
      { ab: 4, text: 'Treffer lösen manchmal zufällige Elemente aus', effekt: 'chaostreffer' },
      { ab: 6, text: 'Alle Waffen werden instabil (Bonus-Kawumm bei Krit)', effekt: 'chaosinstabil' }
    ]
  }
];

export const SYNERGIE_BY_ELEMENT: Record<string, Synergie> = Object.fromEntries(SYNERGIEN.map((s) => [s.element, s]));
