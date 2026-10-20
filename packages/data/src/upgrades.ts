import type { StatKey } from './stats.ts';

/**
 * Level-Up-Upgrades: nach der Welle wählt man pro Level 1 aus 4.
 * `werte` = Bonus je Seltenheit (I–IV).
 */
export interface Upgrade {
  id: string;
  name: string;
  stat: StatKey;
  werte: [number, number, number, number];
}

export const UPGRADES: Upgrade[] = [
  { id: 'pelz', name: 'Dicker Pelz', stat: 'maxHp', werte: [3, 6, 9, 12] },
  { id: 'kekspause', name: 'Kekspause', stat: 'regen', werte: [2, 3, 4, 5] },
  { id: 'vampirzaehne', name: 'Vampirzähne', stat: 'lebensraub', werte: [1, 2, 3, 4] },
  { id: 'muckis', name: 'Muckis', stat: 'schaden', werte: [5, 8, 12, 16] },
  { id: 'zappelfinger', name: 'Zappelfinger', stat: 'angriff', werte: [5, 10, 15, 20] },
  { id: 'adlerauge', name: 'Adlerauge', stat: 'krit', werte: [3, 5, 7, 9] },
  { id: 'fernglas', name: 'Fernglas', stat: 'reichweite', werte: [8, 12, 16, 20] },
  { id: 'topfdeckel', name: 'Topfdeckel', stat: 'ruestung', werte: [1, 2, 3, 4] },
  { id: 'flinkefuesse', name: 'Flinke Füße', stat: 'ausweichen', werte: [3, 6, 9, 12] },
  { id: 'turbosocken', name: 'Turbo-Socken', stat: 'tempo', werte: [3, 6, 9, 12] },
  { id: 'hufeisen', name: 'Hufeisen', stat: 'glueck', werte: [5, 10, 15, 20] },
  { id: 'kristallsieb', name: 'Kristallsieb', stat: 'ernte', werte: [5, 8, 10, 12] },
  { id: 'schiesspulver', name: 'Extra-Schießpulver', stat: 'explosion', werte: [8, 12, 16, 20] },
  { id: 'magnetschuhe', name: 'Magnetschuhe', stat: 'magnet', werte: [15, 25, 35, 45] }
];

export const UPGRADE_BY_ID: Record<string, Upgrade> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
