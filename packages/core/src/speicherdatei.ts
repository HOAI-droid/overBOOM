import { ladeProfil, type Profil } from './meta.ts';
import { istSpielstand, type Spielstand } from './spielstand.ts';

/** Ein Speicherplatz: Stand am Beginn der zuletzt erreichten Insel (nur solo) */
export interface Speicherplatz {
  stand: Spielstand;
  /** Zeitpunkt des Speicherns (ms seit 1970) */
  datum: number;
}

export const PLATZ_ANZAHL = 3;

/** Inhalt einer .boom-Datei bzw. eines Spielstand-Codes: Profil und alle Speicherplätze */
export interface Speicherdatei {
  typ: 'overboom';
  v: 1;
  datum: number;
  profil: Profil;
  plaetze: (Speicherplatz | null)[];
}

export function istPlatz(x: unknown): x is Speicherplatz {
  const p = x as Speicherplatz;
  return !!p && typeof p.datum === 'number' && istSpielstand(p.stand);
}

/** Prüfsumme (FNV-1a), erkennt beschädigte Dateien */
function pruefsumme(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const nachBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const ausBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)));

/** Speicherdatei als Text (Inhalt der .boom-Datei und zugleich der Code zum Kopieren) */
export function speicherCode(d: Omit<Speicherdatei, 'typ' | 'v'>): string {
  const json = JSON.stringify({ typ: 'overboom', v: 1, datum: d.datum, profil: d.profil, plaetze: d.plaetze });
  return `OB2-${pruefsumme(json)}-${nachBase64(json)}`;
}

/** Text → Speicherdatei, oder null bei falschem Format / beschädigter Datei */
export function speicherAusCode(code: string): Speicherdatei | null {
  const c = code.replace(/\s+/g, '');
  const m = /^OB2-([0-9a-z]+)-(.+)$/.exec(c);
  if (!m) return null;
  try {
    const json = ausBase64(m[2]);
    if (pruefsumme(json) !== m[1]) return null;
    const d = JSON.parse(json) as Speicherdatei;
    if (d?.typ !== 'overboom' || d.v !== 1) return null;
    const plaetze = Array.from({ length: PLATZ_ANZAHL }, (_, i) => (istPlatz(d.plaetze?.[i]) ? d.plaetze[i] : null));
    return { typ: 'overboom', v: 1, datum: typeof d.datum === 'number' ? d.datum : 0, profil: ladeProfil(JSON.stringify(d.profil ?? {})), plaetze };
  } catch {
    return null;
  }
}

/** Dateiname aus Datum und Uhrzeit, z. B. 261021-2341.boom */
export function boomDateiname(datum: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(datum.getFullYear() % 100)}${z(datum.getMonth() + 1)}${z(datum.getDate())}-${z(datum.getHours())}${z(datum.getMinutes())}.boom`;
}
