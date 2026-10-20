/**
 * Controller-Symbole (Xbox-Layout) für Hinweise in Menüs und HUD.
 * A grün, B rot, X blau, Y gelb – wie auf dem Controller.
 */
export type PadTaste = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'Menü' | 'Ansicht' | 'Steuerkreuz' | 'L-Stick';

const KLASSE: Record<PadTaste, string> = {
  A: 'a', B: 'b', X: 'x', Y: 'y', LB: 'sch', RB: 'sch', LT: 'sch', RT: 'sch', Menü: 'rund', Ansicht: 'rund', Steuerkreuz: 'kreuz', 'L-Stick': 'stick'
};
const ZEICHEN: Partial<Record<PadTaste, string>> = { Menü: '☰', Ansicht: '⧉', Steuerkreuz: '✚', 'L-Stick': 'L' };

/** Ein Controller-Knopf als kleines Symbol */
export function pad(t: PadTaste): string {
  return `<i class="ob-pad ob-pad-${KLASSE[t]}" aria-label="${t}">${ZEICHEN[t] ?? t}</i>`;
}

/** Standard-Hinweise je Eingabeart */
export const PAD_HINWEIS = {
  menue: `${pad('Steuerkreuz')} wählen · ${pad('A')} OK · ${pad('B')} zurück`,
  spiel: `${pad('L-Stick')} laufen · Waffen feuern von selbst · ${pad('A')} Dash · ${pad('Y')} OVERBOOM · ${pad('Menü')} Pause`
};
