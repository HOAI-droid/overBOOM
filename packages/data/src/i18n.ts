/**
 * Mehrsprachigkeit. Ausgangssprache ist Deutsch: Der deutsche Text ist zugleich der
 * Schlüssel („Solo spielen“ → „Play solo“). So bleibt der Code lesbar.
 *
 * Regeln für Texte im Code:
 * - Sichtbare Texte immer über `t('…')` – mit einfachem Anführungszeichen und ohne
 *   Verkettung, damit `tools/i18n.ts` sie findet.
 * - Veränderliche Teile als Platzhalter: `t('Welle {n}', { n: 3 })`.
 * - Spieldaten (Namen, Beschreibungen …) übersetzt `lokalisiereDaten()` beim Start.
 *
 * Die Wörterbücher liegen in `i18n/<sprache>.ts` und werden erst bei Bedarf geladen.
 */

export type Sprache = 'de' | 'en' | 'es' | 'fr';

export const SPRACHEN: { id: Sprache; name: string; flagge: string }[] = [
  { id: 'en', name: 'English', flagge: 'EN' },
  { id: 'de', name: 'Deutsch', flagge: 'DE' },
  { id: 'es', name: 'Español', flagge: 'ES' },
  { id: 'fr', name: 'Français', flagge: 'FR' }
];

export const istSprache = (s: unknown): s is Sprache => s === 'de' || s === 'en' || s === 'es' || s === 'fr';

/** Wortbausteine für Fusionsnamen in einer Sprache (Deutsch: aus weapons.ts) */
export interface FusionsGrammatik {
  /** Adjektiv je Geschoss: männlich/weiblich (Englisch: beide gleich) */
  adj: Record<string, { m: string; f: string }>;
  /** Element-/Ladungswort je Ladung */
  element: Record<string, string>;
  /** Nomen je Antrieb mit grammatischem Geschlecht */
  nomen: Record<string, { wort: string; genus: 'm' | 'f' }>;
  /** Reihenfolge, z. B. "{adj} {element} {nomen}" oder "{nomen} {element} {adj}" */
  muster: string;
}

export interface Woerterbuch {
  /** deutscher Text → Übersetzung */
  texte: Record<string, string>;
  fusion: FusionsGrammatik;
}

let sprache: Sprache = 'de';
let texte: Record<string, string> | null = null;
let grammatik: FusionsGrammatik | null = null;

export function aktuelleSprache(): Sprache { return sprache; }

/** Wörterbuch aktivieren (Deutsch: null) */
export function setzeWoerterbuch(s: Sprache, w: Woerterbuch | null): void {
  sprache = s;
  texte = w?.texte ?? null;
  grammatik = w?.fusion ?? null;
}

/** Fusions-Grammatik der aktuellen Sprache (null = Deutsch) */
export function fusionsGrammatik(): FusionsGrammatik | null { return grammatik; }

/** Übersetzen: deutscher Text (Schlüssel) → aktuelle Sprache; Platzhalter {name} werden ersetzt */
export function t(de: string, werte?: Record<string, string | number>): string {
  let s = (texte && texte[de]) || de;
  if (werte) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in werte ? String(werte[k]) : m));
  return s;
}

/**
 * Text-Marke: übersetzt NICHT, sondern markiert einen deutschen Text für den Katalog.
 * Für Texte, die erst woanders angezeigt werden (z. B. Fehlergründe vom Host) –
 * dort dann mit t(text) übersetzen.
 */
export const tx = (de: string): string => de;

/** Wörterbuch einer Sprache laden (getrennte Dateien, damit nur die gewählte Sprache geladen wird) */
export async function ladeWoerterbuch(s: Sprache): Promise<Woerterbuch | null> {
  switch (s) {
    case 'en': return (await import('./i18n/en.ts')).default;
    case 'es': return (await import('./i18n/es.ts')).default;
    case 'fr': return (await import('./i18n/fr.ts')).default;
    default: return null;
  }
}

const LOCALE: Record<Sprache, string> = { de: 'de-DE', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' };
/** Zahl im Format der aktuellen Sprache (Dezimalkomma/-punkt, Tausender) */
export function zahl(v: number): string { return v.toLocaleString(LOCALE[sprache]); }

/** passende Sprache zur Systemsprache (z. B. „de-AT“ → de), sonst Englisch */
export function spracheAus(systemSprache: string): Sprache {
  const k = systemSprache.slice(0, 2).toLowerCase();
  return istSprache(k) ? k : 'en';
}
