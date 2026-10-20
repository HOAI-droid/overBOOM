import { W, type Waffe } from './weapons.ts';

/**
 * OVERBOOM – Waffen-Mods und Waffen-Level (Sterne/Evolutionen).
 *
 * Mods: ab Stufe II hat jede Waffe Mod-Slots (II: 1, III: 2, IV: 3, V: 4).
 * Sterne: Waffen sammeln Kills; jeder Stern gibt einen kleinen Bonus,
 * Stern 5 schaltet eine Evolution frei (Wahl aus 2 Varianten).
 */

export interface Mod {
  id: string;
  name: string;
  text: string;
  /** 1–4 */
  seltenheit: number;
  preis: number;
}

export const MODS: Mod[] = [
  { id: 'doppelschuss', name: 'Doppelschuss', text: 'Feuert doppelt so viele Geschosse (Strahlen/Schläge: +60 % Schaden).', seltenheit: 3, preis: 55 },
  { id: 'zielsuchend', name: 'Zielsuch-Chip', text: 'Gerade Geschosse lenken aufs Ziel.', seltenheit: 1, preis: 22 },
  { id: 'querschlaeger', name: 'Querschläger', text: 'Gerade Geschosse prallen 2× ab und suchen sich ein neues Ziel.', seltenheit: 2, preis: 35 },
  { id: 'nachbrenner', name: 'Nachbrenner', text: 'Geschosse fliegen 40 % schneller und treffen 15 % härter.', seltenheit: 1, preis: 25 },
  { id: 'clusterbombe', name: 'Clusterbombe', text: 'Treffer zerfallen in 4 Splitter.', seltenheit: 2, preis: 38 },
  { id: 'brandmunition', name: 'Brandmunition', text: 'Treffer setzen Gegner in Brand.', seltenheit: 1, preis: 24 },
  { id: 'kettenblitz', name: 'Kettenblitz-Spule', text: '15 % Chance, dass ein Treffer einen Kettenblitz auslöst.', seltenheit: 2, preis: 40 },
  { id: 'gravkern', name: 'Gravitations-Kern', text: 'Treffer ziehen Gegner in der Nähe zusammen.', seltenheit: 3, preis: 48 },
  { id: 'frostkern', name: 'Frostkern', text: 'Treffer verlangsamen und unterkühlen.', seltenheit: 1, preis: 24 },
  { id: 'giftspitze', name: 'Giftspitze', text: 'Treffer vergiften (stapelt sich).', seltenheit: 1, preis: 24 },
  { id: 'vampirzahn', name: 'Vampirzahn', text: 'Heilt dich um 2 % des Schadens.', seltenheit: 2, preis: 36 },
  { id: 'gluecksbringer', name: 'Glücksbringer', text: 'Getroffene Gegner lassen öfter doppelt Kristalle fallen.', seltenheit: 2, preis: 30 }
];

export const MOD_BY_ID: Record<string, Mod> = Object.fromEntries(MODS.map((m) => [m.id, m]));

/** Mod-Slots je Stufe I–V */
export const MOD_SLOTS = [0, 1, 2, 3, 4];

export const STERNE = {
  /** Kills für Stern 1–5 */
  kills: [8, 25, 60, 120, 220],
  schadenProStern: 0.06,
  feuerrateProStern: 0.03
};

/** Eigene Namen für Evolutionen bekannter Waffen: [Variante A „Mehr", Variante B „Größer"] */
const EVO_NAMEN: Record<string, [string, string]> = {
  raketenwerfer: ['Schwarmraketen', 'Atomrakete'],
  pistole: ['Doppelpistolen', 'Handkanone'],
  schrotflinte: ['Streuschrotflinte', 'Elefantenflinte'],
  minigun: ['Kreischende Minigun', 'Mega-Gatling'],
  teslastab: ['Gewitterstab', 'Donnerkeil'],
  flammenwerfer: ['Flammenfächer', 'Drachenatem'],
  huehnerkanone: ['Hühnerschwarm', 'Riesenhuhn-Kanone'],
  granatwerfer: ['Granatenhagel', 'Großkaliber-Granate'],
  dynamitbuendel: ['Dynamit-Feuerwerk', 'Dynamit-Fass'],
  bratpfanne: ['Pfannen-Wirbel', 'Gusseisen-Pfanne'],
  baseballschlaeger: ['Doppelschläger', 'Home-Run-Keule'],
  bienenstock: ['Bienenvolk', 'Königinnenstock'],
  eiszapfenwerfer: ['Eissplitter-Kanone', 'Gletscherspeer'],
  laserpistole: ['Laser-Disco', 'Todesstrahl'],
  kampfkazoo: ['Kazoo-Orchester', 'Mega-Kazoo'],
  bowlingkugel: ['Bowling-Bahn', 'Abrissbirne'],
  geschuetzturm: ['Turm-Batterie', 'Festungsgeschütz'],
  schwarzlochwerfer: ['Sternhaufen-Werfer', 'Supermassiv-Werfer']
};

/** Varianten: A = mehr Geschosse (Salve), B = größer und stärker */
export const EVOLUTION = {
  a: { schaden: 0.62, feuerrate: 1, text: 'Feuert in Salven zu dritt.', spezial: 'salve3' },
  b: { schaden: 2.4, feuerrate: 0.85, text: 'Riesig, langsamer, verheerend: 2,4× Schaden und +50 % Explosionsradius.', spezial: 'gross' }
} as const;

export function evoName(base: Waffe, v: 'a' | 'b'): string {
  const custom = EVO_NAMEN[base.id];
  if (custom) return custom[v === 'a' ? 0 : 1];
  return (v === 'a' ? 'Schwarm-' : 'Mega-') + base.name;
}

/** Evolvierte Waffe aus einer Grundwaffe (auch Fusionen). */
export function evolve(base: Waffe, v: 'a' | 'b'): Waffe {
  const e = EVOLUTION[v];
  return {
    ...base,
    id: `evo:${v}:${base.id}`,
    name: evoName(base, v),
    schaden: Math.round(base.schaden * e.schaden * 10) / 10,
    feuerrate: Math.round(base.feuerrate * e.feuerrate * 100) / 100,
    text: `${e.text} ${base.text}`,
    spezial: [...(base.spezial ?? []).filter((s) => s !== e.spezial), e.spezial],
    evo: v
  };
}

/** Hilfe für Tests: Grundwaffe existiert? */
export const hatEvoName = (id: string) => !!EVO_NAMEN[id] && !!W[id];
