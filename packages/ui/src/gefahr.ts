import { GEFAHREN, MAX_GEFAHR } from '@overboom/data';

/** − Stufe + mit Name und Beschreibung (alle Stufen bis dahin gelten) */
export function gefahrWahl(n: number, frei: number, aktiv: boolean): string {
  const g = GEFAHREN[n] ?? GEFAHREN[0];
  return `<div class="ob-gefahr" style="--g:${n}">
    <span class="ob-kind">Gefahrenstufe</span>
    <div class="ob-gefahr-row">
      <button type="button" class="ob-btn2" data-act="gefahr" data-d="-1" data-focus="gefahr-" ${aktiv && n > 0 ? '' : 'disabled'} aria-label="leichter">−</button>
      <b>${n} · ${g.name}</b>
      <button type="button" class="ob-btn2" data-act="gefahr" data-d="1" data-focus="gefahr+" ${aktiv && n < frei ? '' : 'disabled'} aria-label="schwerer">+</button>
    </div>
    <small>${n ? GEFAHREN.slice(1, n + 1).map((x) => x.text).join(' ') : g.text}${n >= frei && frei < MAX_GEFAHR ? ' · Gewinne hier, um Stufe ' + (frei + 1) + ' freizuschalten.' : ''}</small>
  </div>`;
}

