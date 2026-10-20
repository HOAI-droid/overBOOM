import { t as tr } from './i18n.ts';
import type { StatKey } from './stats.ts';

/**
 * OVERBOOM – Ausrüstung: 8 Plätze (Helm, Rüstung, Stiefel, Handschuhe, Amulett, 2 Ringe, Rucksack),
 * jedes Teil mit Seltenheit und zufälligen Affixen. Set-Teile geben zusätzlich Set-Boni.
 * Quellen: Shop-Angebote, Elite-Gegner (manchmal), Bosse (immer).
 */

export type Art = 'helm' | 'ruestung' | 'stiefel' | 'handschuhe' | 'amulett' | 'ring' | 'rucksack';
export type PlatzId = 'helm' | 'ruestung' | 'stiefel' | 'handschuhe' | 'amulett' | 'ring1' | 'ring2' | 'rucksack';

export const PLAETZE: { id: PlatzId; art: Art; name: string }[] = [
  { id: 'helm', art: 'helm', name: 'Helm' },
  { id: 'ruestung', art: 'ruestung', name: 'Rüstung' },
  { id: 'stiefel', art: 'stiefel', name: 'Stiefel' },
  { id: 'handschuhe', art: 'handschuhe', name: 'Handschuhe' },
  { id: 'amulett', art: 'amulett', name: 'Amulett' },
  { id: 'ring1', art: 'ring', name: 'Ring' },
  { id: 'ring2', art: 'ring', name: 'Ring' },
  { id: 'rucksack', art: 'rucksack', name: 'Rucksack' }
];

export interface Ausruestung {
  /** eindeutige Nummer im Run */
  uid: number;
  art: Art;
  name: string;
  /** 1–4 */
  seltenheit: number;
  werte: Partial<Record<StatKey, number>>;
  set?: string;
}

/** Grundteile je Art: Name und Hauptwert */
const BASIS: Record<Art, { name: string; stat: StatKey }[]> = {
  helm: [
    { name: 'Kochtopf', stat: 'ruestung' }, { name: 'Pickelhaube', stat: 'maxHp' }, { name: 'Taucherhelm', stat: 'ruestung' },
    { name: 'Partyhut', stat: 'glueck' }, { name: 'Bauhelm', stat: 'maxHp' }, { name: 'Wikingerhelm', stat: 'schaden' }
  ],
  ruestung: [
    { name: 'Lederweste', stat: 'maxHp' }, { name: 'Kettenhemd', stat: 'ruestung' }, { name: 'Daunenjacke', stat: 'maxHp' },
    { name: 'Schrottpanzer', stat: 'ruestung' }, { name: 'Blaumann', stat: 'regen' }
  ],
  stiefel: [
    { name: 'Turnschuhe', stat: 'tempo' }, { name: 'Gummistiefel', stat: 'ausweichen' }, { name: 'Raketenstiefel', stat: 'tempo' },
    { name: 'Holzschuhe', stat: 'ruestung' }, { name: 'Hausschuhe', stat: 'ausweichen' }
  ],
  handschuhe: [
    { name: 'Boxhandschuhe', stat: 'schaden' }, { name: 'Ofenhandschuhe', stat: 'explosion' }, { name: 'Fingerlose Handschuhe', stat: 'angriff' },
    { name: 'Gartenhandschuhe', stat: 'krit' }, { name: 'Gummihandschuhe', stat: 'angriff' }
  ],
  amulett: [
    { name: 'Hühnerknochen-Amulett', stat: 'glueck' }, { name: 'Kristallanhänger', stat: 'ernte' }, { name: 'Bombenmedaillon', stat: 'explosion' },
    { name: 'Glücksklee', stat: 'glueck' }, { name: 'Zahnkette', stat: 'lebensraub' }
  ],
  ring: [
    { name: 'Schraubenmutter', stat: 'schaden' }, { name: 'Kaugummiautomaten-Ring', stat: 'krit' }, { name: 'Zwiebelring', stat: 'regen' },
    { name: 'Siegelring', stat: 'schaden' }, { name: 'Mondsteinring', stat: 'reichweite' }
  ],
  rucksack: [
    { name: 'Jutebeutel', stat: 'ernte' }, { name: 'Schulranzen', stat: 'magnet' }, { name: 'Picknickkorb', stat: 'regen' },
    { name: 'Wanderrucksack', stat: 'maxHp' }, { name: 'Schatzbeutel', stat: 'ernte' }
  ]
};

/** Wertebereiche je Seltenheit (I–IV) */
const SPANNE: Record<StatKey, [number, number, number, number]> = {
  maxHp: [3, 6, 10, 15], regen: [1, 2, 3, 4], lebensraub: [1, 2, 3, 4], schaden: [3, 5, 8, 12],
  angriff: [3, 6, 9, 13], krit: [2, 3, 5, 7], reichweite: [5, 8, 12, 16], ruestung: [1, 2, 3, 4],
  ausweichen: [2, 3, 5, 7], tempo: [3, 5, 7, 10], glueck: [5, 8, 12, 18], ernte: [3, 5, 8, 12],
  explosion: [5, 8, 12, 18], magnet: [10, 15, 25, 35]
};

const AFFIXE: StatKey[] = ['maxHp', 'regen', 'lebensraub', 'schaden', 'angriff', 'krit', 'reichweite', 'ruestung', 'ausweichen', 'tempo', 'glueck', 'ernte', 'explosion', 'magnet'];

/** Adjektiv nach dem stärksten Zusatzwert */
const PRAEFIX: Record<StatKey, string> = {
  maxHp: 'Zäher', regen: 'Heilsamer', lebensraub: 'Gieriger', schaden: 'Wuchtiger', angriff: 'Hektischer', krit: 'Präziser',
  reichweite: 'Weitsichtiger', ruestung: 'Gepanzerter', ausweichen: 'Flinker', tempo: 'Rasender', glueck: 'Glücklicher',
  ernte: 'Reicher', explosion: 'Explosiver', magnet: 'Magnetischer'
};

export interface SetDef {
  id: string;
  name: string;
  teile: { art: Art; name: string; werte: Partial<Record<StatKey, number>> }[];
  boni: { ab: number; text: string; werte: Partial<Record<StatKey, number>> }[];
}

export const SETS: SetDef[] = [
  {
    id: 'grummel', name: 'Grummel-Garnitur',
    teile: [
      { art: 'helm', name: 'Grummels Kochtopf', werte: { ruestung: 3, maxHp: 5 } },
      { art: 'ruestung', name: 'Grummel-Weste', werte: { maxHp: 10, ruestung: 1 } },
      { art: 'stiefel', name: 'Grummel-Latschen', werte: { tempo: 5, ausweichen: 3 } }
    ],
    boni: [
      { ab: 2, text: '+10 Max. Leben', werte: { maxHp: 10 } },
      { ab: 3, text: '+4 Rüstung, +10 % Schaden', werte: { ruestung: 4, schaden: 10 } }
    ]
  },
  {
    id: 'baron', name: 'Barons Gala-Garderobe',
    teile: [
      { art: 'helm', name: 'Barons Zylinder', werte: { explosion: 12, glueck: 5 } },
      { art: 'amulett', name: 'Monokel an der Kette', werte: { krit: 5, reichweite: 8 } },
      { art: 'handschuhe', name: 'Samthandschuhe', werte: { schaden: 6, angriff: 5 } },
      { art: 'ring', name: 'Barons Siegelring', werte: { schaden: 8 } }
    ],
    boni: [
      { ab: 2, text: '+20 % Explosionsradius', werte: { explosion: 20 } },
      { ab: 4, text: '+10 % Krit, +20 % Schaden', werte: { krit: 10, schaden: 20 } }
    ]
  },
  {
    id: 'funken', name: 'Funkenkluft',
    teile: [
      { art: 'handschuhe', name: 'Isolierhandschuhe', werte: { angriff: 8 } },
      { art: 'stiefel', name: 'Gummi-Galoschen', werte: { tempo: 6, ruestung: 1 } },
      { art: 'rucksack', name: 'Batterie-Rucksack', werte: { angriff: 5, magnet: 20 } }
    ],
    boni: [
      { ab: 2, text: '+12 % Feuerrate', werte: { angriff: 12 } },
      { ab: 3, text: '+10 % Feuerrate, +6 % Krit', werte: { angriff: 10, krit: 6 } }
    ]
  },
  {
    id: 'oma', name: 'Omas Strickset',
    teile: [
      { art: 'helm', name: 'Pudelmütze', werte: { maxHp: 6, regen: 1 } },
      { art: 'ruestung', name: 'Kratzpulli', werte: { maxHp: 12 } },
      { art: 'handschuhe', name: 'Fäustlinge', werte: { regen: 2, ruestung: 1 } },
      { art: 'ring', name: 'Omas Ehering', werte: { lebensraub: 2, glueck: 8 } }
    ],
    boni: [
      { ab: 2, text: '+3 Regeneration', werte: { regen: 3 } },
      { ab: 4, text: '+20 Max. Leben, +4 Regeneration, +3 % Lebensraub', werte: { maxHp: 20, regen: 4, lebensraub: 3 } }
    ]
  }
];

export const SET_BY_ID: Record<string, SetDef> = Object.fromEntries(SETS.map((s) => [s.id, s]));

/**
 * Würfelt ein Ausrüstungsteil. `next` liefert Zufallszahlen in [0, 1) (deterministisch aus der Simulation).
 * setChance: Wahrscheinlichkeit für ein Set-Teil (Bosse: hoch).
 */
/** deutsche Namen der Set-Teile (der Spielzustand speichert immer die deutschen Namen) */
const SET_TEILE_DE: string[][] = SETS.map((s) => s.teile.map((t) => t.name));

/** alle Namensbausteine für den Übersetzungskatalog */
export const AUSRUESTUNG_TEXTE: string[] = [
  ...Object.values(BASIS).flat().map((b) => b.name),
  ...Object.values(PRAEFIX),
  ...SET_TEILE_DE.flat()
];

/** Anzeigename eines Ausrüstungsteils in der aktuellen Sprache */
export function ausruestungsName(a: Pick<Ausruestung, 'name'>): string {
  for (const p of Object.values(PRAEFIX)) {
    if (a.name.startsWith(p + ' ')) return tr('{praefix} {basis}', { praefix: tr(p), basis: tr(a.name.slice(p.length + 1)) });
  }
  return tr(a.name);
}

export function rollAusruestung(next: () => number, uid: number, welle: number, seltenheit: number, setChance = 0.1, art?: Art): Ausruestung {
  if (next() < setChance) {
    const set = SETS[Math.floor(next() * SETS.length)];
    const pool = art ? set.teile.filter((t) => t.art === art) : set.teile;
    const t = (pool.length ? pool : set.teile)[Math.floor(next() * (pool.length || set.teile.length))];
    const deName = SET_TEILE_DE[SETS.indexOf(set)][set.teile.indexOf(t)] ?? t.name;
    return { uid, art: t.art, name: deName, seltenheit: 3, werte: { ...t.werte }, set: set.id };
  }
  const arten = Object.keys(BASIS) as Art[];
  const a = art ?? arten[Math.floor(next() * arten.length)];
  const b = BASIS[a][Math.floor(next() * BASIS[a].length)];
  const r = Math.max(1, Math.min(4, seltenheit));
  const skala = 1 + Math.max(0, welle - 1) * BEUTE.wellenSkala;
  const werte: Partial<Record<StatKey, number>> = {};
  const add = (k: StatKey, f: number) => { werte[k] = (werte[k] ?? 0) + Math.max(1, Math.round(SPANNE[k][r - 1] * f * skala)); };
  add(b.stat, 1.2);
  let top: StatKey = b.stat, topV = 0;
  for (let i = 1; i < r; i++) {
    const k = AFFIXE[Math.floor(next() * AFFIXE.length)];
    add(k, 0.6 + next() * 0.5);
    if (k !== b.stat && (werte[k] ?? 0) > topV) { topV = werte[k] ?? 0; top = k; }
  }
  const name = r >= 2 && top !== b.stat ? `${PRAEFIX[top]} ${b.name}` : b.name;
  return { uid, art: a, name, seltenheit: r, werte };
}

/** Verschrott-Wert in Kristallen */
export function schrottwert(a: Ausruestung, welle: number): number {
  return Math.round((4 + a.seltenheit * a.seltenheit * 3) * (1 + welle * 0.08));
}

/** Kaufpreis im Shop */
export function ausruestungsPreis(a: Ausruestung, welle: number): number {
  return Math.round((10 + a.seltenheit * a.seltenheit * 9) * (1 + (welle - 1) * 0.1));
}

/** Set-Boni für eine Menge angelegter Teile */
export function setBoni(teile: readonly (Ausruestung | null)[]): { set: SetDef; anzahl: number }[] {
  const count: Record<string, number> = {};
  for (const t of teile) if (t?.set) count[t.set] = (count[t.set] ?? 0) + 1;
  return Object.entries(count).map(([id, anzahl]) => ({ set: SET_BY_ID[id], anzahl }));
}

export const BEUTE = {
  /** Chance, dass ein Elite-Gegner Ausrüstung fallen lässt */
  eliteChance: 0.2,
  /** Beute-Wurf (0–100) + Glück × 0,3 + Welle × wellenBonus (höchstens +40): Schwellen der Seltenheit */
  wellenBonus: 1.2,
  selten: 40,
  episch: 75,
  legendaer: 97,
  /** Bosse lassen immer Episch oder besser fallen */
  bossLegendaer: 82,
  /** Werte der Teile wachsen je Welle um diesen Anteil */
  wellenSkala: 0.025,
  /** Rucksack für noch nicht angelegte Teile */
  maxBeute: 10,
  /** Anteil Ausrüstung an Shop-Angeboten */
  shopAnteil: 0.12
};
