/**
 * OVERBOOM – Waffen-Fusion (Kern-Feature)
 *
 * Am Fusions-Amboss werden 2–3 Waffen aus verschiedenen Gruppen verschmolzen.
 * Jede Eingangswaffe liefert mindestens ein Bauteil (Geschoss, Antrieb, Ladung).
 * Die neue Waffe entsteht systemisch aus den Bauteilen – jede Kombination funktioniert.
 * Ausnahme: geheime Rezepte (feste Zutaten) mit eigenem Namen, Effekt und Modell.
 */
import { A, G, L, W, elemente, fusionsName, type Gruppe, type Waffe } from './weapons.ts';
import { evolve } from './mods.ts';

export interface Rezept {
  id: string;
  name: string;
  /** Waffen-IDs (Reihenfolge egal, Mehrfachnennung = mehrfach nötig) */
  zutaten: string[];
  geschoss: string;
  antrieb: string;
  ladung: string;
  /** Multiplikatoren auf die systemisch berechneten Werte */
  schaden: number;
  feuerrate: number;
  reichweite: number;
  spezial: string[];
  text: string;
  /** Hinweis im Rezeptbuch, solange es unentdeckt ist */
  hinweis: string;
}

/**
 * Sonderwirkungen, die die Simulation kennt:
 *   salve3       – 3 Geschosse pro Schuss
 *   cluster      – Explosionen zerfallen in 3 Mini-Explosionen
 *   doppelblitz  – Kettenblitz springt doppelt so oft
 *   implosion    – Schwerkraft-Sog explodiert am Ende
 *   heilkeks     – jeder Treffer kann den Schützen heilen
 *   schwarm6     – 6 statt 3 Begleiter
 *   konfettifrost– Frost verwirrt zusätzlich
 *   orbit6       – 6 Kreisel auf größerem Radius
 *   giftwolke    – vergiftete Gegner hinterlassen Giftpfützen
 *   kueken       – Treffer lassen Küken schlüpfen
 */
export const REZEPTE: Rezept[] = [
  {
    id: 'huhnageddon', name: 'HUHNAGEDDON', zutaten: ['huehnerkanone', 'huehnerkanone', 'huehnerkanone'],
    geschoss: 'ei', antrieb: 'regen', ladung: 'explosion', schaden: 1.4, feuerrate: 1, reichweite: 1.2, spezial: ['salve3'],
    text: 'Ein Riesenhuhn schwebt über dir und legt explodierende Eier. Es ist sehr stolz.',
    hinweis: 'Dreimal dasselbe Federvieh …'
  },
  {
    id: 'kawummageddon', name: 'Kawummageddon', zutaten: ['raketenwerfer', 'dynamitbuendel', 'bombenhagel'],
    geschoss: 'rakete', antrieb: 'zielbogen', ladung: 'explosion', schaden: 1.2, feuerrate: 1, reichweite: 1.1, spezial: ['cluster'],
    text: 'Jede Explosion zerfällt in drei weitere. Nachbarn ziehen weg.',
    hinweis: 'Alles, was im Explosiv-Regal knallt.'
  },
  {
    id: 'donnertoaster', name: 'Donnertoaster', zutaten: ['teleporttoaster', 'teslastab', 'toasterturm'],
    geschoss: 'toast', antrieb: 'turm', ladung: 'kettenblitz', schaden: 1.3, feuerrate: 1.2, reichweite: 1.2, spezial: ['doppelblitz'],
    text: 'Ein Toaster-Turm, der elektrischen Toast verschießt. Frühstück mit Spannung.',
    hinweis: 'Drei Toaster-Sachen und ein bisschen Strom.'
  },
  {
    id: 'schwarzesbuffet', name: 'Schwarzes Buffet', zutaten: ['schwarzlochwerfer', 'magnetkanone', 'bowlingkugel'],
    geschoss: 'schwarzloch', antrieb: 'gerade', ladung: 'schwerkraft', schaden: 1.6, feuerrate: 1, reichweite: 1, spezial: ['implosion'],
    text: 'Saugt alles zusammen – und lässt es dann sehr laut wieder los.',
    hinweis: 'Was anzieht, was zieht und was rollt.'
  },
  {
    id: 'omasgeheimrezept', name: 'Omas Geheimrezept', zutaten: ['keksdose', 'bratpfanne', 'pflasterkanone'],
    geschoss: 'keks', antrieb: 'regen', ladung: 'schall', schaden: 1.5, feuerrate: 1.3, reichweite: 1.1, spezial: ['heilkeks'],
    text: 'Kekse fallen vom Himmel, betäuben Gegner mit einem BOINNNG und heilen dich.',
    hinweis: 'Was Oma in der Küche hat – und im Erste-Hilfe-Kasten.'
  },
  {
    id: 'entensturm', name: 'Quietschendes Inferno', zutaten: ['entenarmee', 'flammenwerfer', 'kampfkazoo'],
    geschoss: 'gummiente', antrieb: 'schwarm', ladung: 'brand', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['schwarm6'],
    text: 'Sechs brennende Quietscheenten. Niemand hat danach gefragt.',
    hinweis: 'Enten, Feuer und Musik.'
  },
  {
    id: 'frostfeuerwerk', name: 'Frostfeuerwerk', zutaten: ['eiszapfenwerfer', 'partykanone', 'sternschnuppenstab'],
    geschoss: 'stern', antrieb: 'regen', ladung: 'frost', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['konfettifrost', 'salve3'],
    text: 'Eiskalte Sternschnuppen mit Konfetti. Gegner frieren – und tanzen dabei.',
    hinweis: 'Eis, Party und ein Wunsch an die Sterne.'
  },
  {
    id: 'saegenkarussell', name: 'Kettensägen-Karussell', zutaten: ['kettensaege', 'schildblasen', 'rasenmaeherbot'],
    geschoss: 'saege', antrieb: 'orbit', ladung: 'lebensraub', schaden: 1.5, feuerrate: 1.5, reichweite: 1, spezial: ['orbit6'],
    text: 'Sechs Kreissägen kreisen um dich. Kuscheln ist gerade schwierig.',
    hinweis: 'Was sägt, was kreist und was mäht.'
  },
  {
    id: 'bienenkoenigin', name: 'Bienenkönigin', zutaten: ['bienenstock', 'giftblaeser', 'pilzbeutel'],
    geschoss: 'biene', antrieb: 'schwarm', ladung: 'gift', schaden: 1.5, feuerrate: 1.3, reichweite: 1.2, spezial: ['giftwolke', 'schwarm6'],
    text: 'Die Königin schickt ihren Hofstaat. Vergiftete Gegner hinterlassen Giftwolken.',
    hinweis: 'Summen, Blubbern und Sporen.'
  },
  {
    id: 'gackerchaos', name: 'Gackerndes Chaos', zutaten: ['huhnifizierer', 'huehnerkanone', 'kuekenkorb'],
    geschoss: 'laser', antrieb: 'strahl', ladung: 'verhuehnern', schaden: 2.5, feuerrate: 2, reichweite: 1.1, spezial: ['kueken'],
    text: 'Ein Strahl, der Gegner in Hühner verwandelt – und Küken schlüpfen lässt.',
    hinweis: 'Alles, was gackert, piepst oder Hühner macht.'
  }
];

export const REZEPT_BY_ID: Record<string, Rezept> = Object.fromEntries(REZEPTE.map((r) => [r.id, r]));

/** Passt die Zutatenliste (Multimenge) zu einem Rezept? */
export function findeRezept(quellen: readonly string[]): Rezept | null {
  const key = [...quellen].sort().join('|');
  for (const r of REZEPTE) if ([...r.zutaten].sort().join('|') === key) return r;
  return null;
}

/** Wie viele Geschosse pro Schuss (Fächer = 5) – für die Schadensverteilung */
const shots = (antrieb: string, spezial: readonly string[] = []) => (antrieb === 'faecher' ? 5 : 1) * (spezial.includes('salve3') ? 3 : 1);

/** Schaden pro Sekunde einer Waffe (grob, ohne Ladungseffekte) */
const dps = (w: Waffe) => w.schaden * w.feuerrate * shots(w.antrieb);

export function instabilitaet(quellen: readonly string[]): number {
  const gruppen = new Set(quellen.map((id) => W[id].gruppe));
  const n = new Set(quellen).size;
  return Math.min(100, (gruppen.size - 1) * 26 + (n - 1) * 10);
}

export interface FusionsWahl {
  /** Waffen-IDs, die das jeweilige Bauteil liefern */
  geschoss: string;
  antrieb: string;
  ladung: string;
}

export function fusionsId(wahl: FusionsWahl): string {
  return `fusion:${wahl.geschoss}+${wahl.antrieb}+${wahl.ladung}`;
}

const cache = new Map<string, Waffe>();

/**
 * Baut die Fusionswaffe. Werte systemisch:
 * Feuerrate und Reichweite vom Antriebs-Spender (passt zur Flugart),
 * Schaden so, dass der DPS dem Mittel der Eingangswaffen entspricht – plus Instabilitäts-Bonus.
 */
export function fusionsWaffe(wahl: FusionsWahl, quellen: readonly string[] = [wahl.geschoss, wahl.antrieb, wahl.ladung]): Waffe {
  const rezept = findeRezept(quellen);
  const id = rezept ? `rezept:${rezept.id}` : fusionsId(wahl);
  const hit = cache.get(id);
  if (hit) return hit;

  const inputs = quellen.map((q) => W[q]);
  const uniq = [...new Set(quellen)];
  const instabil = instabilitaet(quellen);
  const avgDps = inputs.reduce((s, w) => s + dps(w), 0) / inputs.length;
  const gruppen = [...new Set(uniq.map((q) => W[q].gruppe))] as Gruppe[];

  let teile = { geschoss: W[wahl.geschoss].geschoss, antrieb: W[wahl.antrieb].antrieb, ladung: W[wahl.ladung].ladung };
  const rateSrc = W[wahl.antrieb];
  let feuerrate = rateSrc.feuerrate, reichweite = rateSrc.reichweite;
  let spezial: string[] = [];
  let mult = 1 + instabil / 100 * 0.6;
  let name = fusionsName(teile.geschoss, teile.antrieb, teile.ladung);
  let text = `${G[teile.geschoss].name}, ${A[teile.antrieb].name.toLowerCase()}, mit ${L[teile.ladung].name.toLowerCase()}. ${A[teile.antrieb].text} ${L[teile.ladung].text}`;
  if (rezept) {
    teile = { geschoss: rezept.geschoss, antrieb: rezept.antrieb, ladung: rezept.ladung };
    const avg = (f: (w: Waffe) => number) => inputs.reduce((sum, w) => sum + f(w), 0) / inputs.length;
    feuerrate = avg((w) => w.feuerrate) * rezept.feuerrate;
    reichweite = avg((w) => w.reichweite) * rezept.reichweite;
    spezial = rezept.spezial;
    mult *= rezept.schaden;
    name = rezept.name;
    text = rezept.text;
  }
  const schaden = (avgDps * mult) / (feuerrate * shots(teile.antrieb, spezial));
  const w: Waffe = {
    id,
    name,
    gruppe: W[wahl.antrieb].gruppe,
    ...teile,
    schaden: Math.round(schaden * 10) / 10,
    feuerrate: Math.round(feuerrate * 100) / 100,
    reichweite: Math.round(reichweite * 10) / 10,
    text,
    spezial,
    fusion: { teile: { ...wahl }, quellen: uniq, gruppen, elemente: elemente(teile), instabil, rezept: rezept?.id }
  };
  cache.set(id, w);
  return w;
}

/** Waffe nach ID – normale Waffen, Fusionen und Rezepte. */
export function waffeById(id: string): Waffe | undefined {
  if (W[id]) return W[id];
  if (cache.has(id)) return cache.get(id);
  if (id.startsWith('evo:')) {
    const v = id[4] as 'a' | 'b', base = waffeById(id.slice(6));
    if (!base || base.evo || (v !== 'a' && v !== 'b')) return undefined;
    const w = evolve(base, v);
    cache.set(id, w);
    return w;
  }
  if (id.startsWith('fusion:')) {
    const [g, a, l] = id.slice(7).split('+');
    if (W[g] && W[a] && W[l]) return fusionsWaffe({ geschoss: g, antrieb: a, ladung: l }, [g, a, l]);
  }
  if (id.startsWith('rezept:')) {
    const r = REZEPT_BY_ID[id.slice(7)];
    if (r) return fusionsWaffe({ geschoss: r.zutaten[0], antrieb: r.zutaten[1], ladung: r.zutaten[2] }, r.zutaten);
  }
  return undefined;
}

/**
 * Prüft eine Fusion. `quellen` = die ausgewählten Waffen (2–3), `wahl` = wer welches Bauteil liefert.
 * Regeln: keine Fusion von Fusionen, verschiedene Gruppen (außer bei geheimen Rezepten),
 * jede Waffe liefert mindestens ein Bauteil.
 */
export function pruefeFusion(quellen: readonly string[], wahl: FusionsWahl): string | null {
  if (quellen.length < 2 || quellen.length > 3) return 'Wähle 2 oder 3 Waffen.';
  if (quellen.some((q) => !W[q])) return 'Fusionen lassen sich nicht weiter verschmelzen – aber mergen!';
  if (findeRezept(quellen)) return null;
  const gruppen = quellen.map((q) => W[q].gruppe);
  if (new Set(gruppen).size !== gruppen.length) return 'Die Waffen müssen aus verschiedenen Gruppen kommen.';
  const used = [wahl.geschoss, wahl.antrieb, wahl.ladung];
  if (used.some((u) => !quellen.includes(u))) return 'Jedes Bauteil muss von einer gewählten Waffe kommen.';
  if (quellen.some((q) => !used.includes(q))) return 'Jede Waffe muss mindestens ein Bauteil liefern.';
  return null;
}

export const AMBOSS = {
  /** Schmiedelohn in Kristallen */
  preis: (welle: number) => 5 + welle * 3,
  /** Bonus-Explosion bei Krit: Chance = Instabilität × Faktor */
  kawummChance: 0.5,
  kawummRadius: 1.6,
  kawummSchaden: 0.8
};
