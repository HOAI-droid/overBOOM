import { t } from '@overboom/data';

/**
 * Controller-Symbole (Xbox-Layout) für Hinweise in Menüs und HUD.
 * A grün, B rot, X blau, Y gelb – wie auf dem Controller.
 */
export type PadTaste = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'Menü' | 'Ansicht' | 'Steuerkreuz' | 'L-Stick';

const KLASSE: Record<PadTaste, string> = {
  A: 'a', B: 'b', X: 'x', Y: 'y', LB: 'sch', RB: 'sch', LT: 'sch', RT: 'sch', Menü: 'rund', Ansicht: 'rund', Steuerkreuz: 'kreuz', 'L-Stick': 'stick'
};
const ZEICHEN: Partial<Record<PadTaste, string>> = { Menü: '☰', Ansicht: '⧉', Steuerkreuz: '✚', 'L-Stick': 'L' };

/** Vorlesename (aria-label) der Tasten mit deutschem Namen – erst zur Laufzeit übersetzt */
function tastenName(k: PadTaste): string {
  switch (k) {
    case 'Menü': return t('Menü');
    case 'Ansicht': return t('Ansicht');
    case 'Steuerkreuz': return t('Steuerkreuz');
    case 'L-Stick': return t('L-Stick');
    default: return k;
  }
}

/** Ein Controller-Knopf als kleines Symbol */
export function pad(k: PadTaste): string {
  return `<i class="ob-pad ob-pad-${KLASSE[k]}" aria-label="${tastenName(k)}">${ZEICHEN[k] ?? k}</i>`;
}

/** Standard-Hinweise je Eingabeart (Getter: Text wird erst beim Zugriff in der aktuellen Sprache gebaut) */
export const PAD_HINWEIS = {
  get menue(): string {
    return t('{kreuz} wählen · {a} OK · {b} zurück', { kreuz: pad('Steuerkreuz'), a: pad('A'), b: pad('B') });
  },
  get spiel(): string {
    return t('{stick} laufen · Waffen feuern von selbst · {a} Dash · {y} OVERBOOM · {menue} Pause',
      { stick: pad('L-Stick'), a: pad('A'), y: pad('Y'), menue: pad('Menü') });
  }
};
