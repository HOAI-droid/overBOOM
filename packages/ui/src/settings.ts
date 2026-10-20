/** Spieler-Einstellungen (werden über platform.storage gespeichert) */
export interface Einstellungen {
  gesamt: number;
  effekte: number;
  musik: number;
  /** Screen-Shake 0–2 */
  shake: number;
  /** Blitze/Lichtblitze 0–1 (Photosensitivität) */
  blitze: number;
  /** Partikeldichte 0,25–1 */
  partikel: number;
  zahlen: boolean;
  vibration: boolean;
  /** farbenblind-freundliche Gefahren-Markierungen */
  farbenblind: boolean;
  qualitaet: 'auto' | 'hoch' | 'mittel' | 'niedrig';
}

export const STANDARD: Einstellungen = {
  gesamt: 0.8, effekte: 0.8, musik: 0.5, shake: 1, blitze: 1, partikel: 1,
  zahlen: true, vibration: true, farbenblind: false, qualitaet: 'auto'
};

export function ladeEinstellungen(json: string | null): Einstellungen {
  const e = { ...STANDARD };
  try {
    const d = JSON.parse(json ?? '{}') as Partial<Einstellungen>;
    for (const k of Object.keys(STANDARD) as (keyof Einstellungen)[]) {
      if (d[k] !== undefined && typeof d[k] === typeof STANDARD[k]) (e as Record<string, unknown>)[k] = d[k];
    }
  } catch { /* Standard */ }
  return e;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

function slider(key: keyof Einstellungen, label: string, v: number, min: number, max: number, step: number, fmt = pct): string {
  return `<label class="ob-set"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-set="${key}" data-focus="set-${key}"><b>${fmt(v)}</b></label>`;
}

function toggle(key: keyof Einstellungen, label: string, v: boolean, hint = ''): string {
  return `<button type="button" class="ob-set ob-toggle ${v ? 'on' : ''}" data-act="settoggle" data-key="${key}" data-focus="set-${key}" aria-pressed="${v}"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><b>${v ? 'An' : 'Aus'}</b></button>`;
}

export function einstellungenHtml(e: Einstellungen, info: string): string {
  const q = (['auto', 'hoch', 'mittel', 'niedrig'] as const).map((k) =>
    `<button type="button" class="ob-tab ${e.qualitaet === k ? 'on' : ''}" data-act="setq" data-q="${k}" data-focus="setq-${k}">${k === 'auto' ? 'Automatisch' : k[0].toUpperCase() + k.slice(1)}</button>`).join('');
  return `
    <div class="ob-panel ob-wide ob-settings">
      <div class="ob-shop-head">
        <h2 class="ob-h">Einstellungen</h2>
        <button type="button" class="ob-go" data-act="setzu" data-focus="setzu">Fertig</button>
      </div>
      <h3 class="ob-h3">Ton</h3>
      <div class="ob-setgrid">
        ${slider('gesamt', 'Lautstärke', e.gesamt, 0, 1, 0.05)}
        ${slider('effekte', 'Effekte', e.effekte, 0, 1, 0.05)}
        ${slider('musik', 'Musik', e.musik, 0, 1, 0.05)}
      </div>
      <h3 class="ob-h3">Grafik <small>${info}</small></h3>
      <div class="ob-tabs">${q}</div>
      <h3 class="ob-h3">Barrierefreiheit</h3>
      <div class="ob-setgrid">
        ${slider('shake', 'Bildschirm-Wackeln', e.shake, 0, 2, 0.1)}
        ${slider('blitze', 'Lichtblitze', e.blitze, 0, 1, 0.05)}
        ${slider('partikel', 'Partikel', e.partikel, 0.25, 1, 0.05)}
        ${toggle('zahlen', 'Schadenszahlen', e.zahlen)}
        ${toggle('vibration', 'Vibration', e.vibration)}
        ${toggle('farbenblind', 'Farbenblind-Modus', e.farbenblind, 'Gefahren mit Mustern statt nur Farben')}
      </div>
    </div>`;
}
