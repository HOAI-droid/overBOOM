import { t, SPRACHEN, aktuelleSprache } from '@overboom/data';

/** Spieler-Einstellungen (werden über platform.storage gespeichert) */
export interface Einstellungen {
  gesamt: number;
  effekte: number;
  musik: number;
  /** Screen-Shake 0–2 (1 = Standard = halbe Stärke von früher, 2 = alte volle Stärke) */
  shake: number;
  /** Blitze/Lichtblitze 0–2 (Photosensitivität, 1 = Standard) */
  blitze: number;
  /** Partikeldichte 0–2 (1 = Standard) */
  partikel: number;
  /** Version der Effekt-Skala (2 ab v0.13.1; ältere Werte werden umgerechnet) */
  skala: number;
  zahlen: boolean;
  vibration: boolean;
  /** farbenblind-freundliche Gefahren-Markierungen */
  farbenblind: boolean;
  qualitaet: 'auto' | 'max' | 'ultra' | 'hoch' | 'mittel' | 'niedrig';
  /** Musikfärbung: prozedural erzeugt, oder aus */
  musikStil: 'rock' | 'pop' | 'retro' | 'chip' | 'aus';
}

export const STANDARD: Einstellungen = {
  gesamt: 0.8, effekte: 0.8, musik: 0.5, shake: 1, blitze: 1, partikel: 1, skala: 2,
  zahlen: true, vibration: true, farbenblind: false, qualitaet: 'auto', musikStil: 'rock'
};

export function ladeEinstellungen(json: string | null): Einstellungen {
  const e = { ...STANDARD };
  try {
    const d = JSON.parse(json ?? '{}') as Partial<Einstellungen>;
    for (const k of Object.keys(STANDARD) as (keyof Einstellungen)[]) {
      if (d[k] !== undefined && typeof d[k] === typeof STANDARD[k]) (e as Record<string, unknown>)[k] = d[k];
    }
    // alte Skala (bis v0.13.0): 1 war volle Stärke. Standardwerte werden zum neuen Standard,
    // eigene Werte behalten ihre Stärke (neue Skala = doppelt so groß).
    if (d.skala !== 2) {
      for (const k of ['shake', 'blitze', 'partikel'] as const) {
        if (typeof d[k] === 'number' && d[k] !== 1) e[k] = Math.min(2, Math.max(0, d[k] * 2));
        else e[k] = 1;
      }
      e.skala = 2;
    }
  } catch { /* Standard */ }
  // nur bekannte Werte übernehmen (z. B. nach Umbenennungen)
  if (!['rock', 'pop', 'retro', 'chip', 'aus'].includes(e.musikStil)) e.musikStil = STANDARD.musikStil;
  if (!['auto', 'max', 'ultra', 'hoch', 'mittel', 'niedrig'].includes(e.qualitaet)) e.qualitaet = STANDARD.qualitaet;
  return e;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

function slider(key: keyof Einstellungen, label: string, v: number, min: number, max: number, step: number, fmt = pct): string {
  return `<label class="ob-set"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-set="${key}" data-focus="set-${key}"><b>${fmt(v)}</b></label>`;
}

function toggle(key: keyof Einstellungen, label: string, v: boolean, hint = ''): string {
  return `<button type="button" class="ob-set ob-toggle ${v ? 'on' : ''}" data-act="settoggle" data-key="${key}" data-focus="set-${key}" aria-pressed="${v}"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><b>${v ? t('An') : t('Aus')}</b></button>`;
}

export function einstellungenHtml(e: Einstellungen, info: string): string {
  const q = ([['auto', t('Automatisch')], ['max', t('Max')], ['ultra', t('Ultra')], ['hoch', t('Hoch')], ['mittel', t('Mittel')], ['niedrig', t('Niedrig')]] as const).map(([k, n]) =>
    `<button type="button" class="ob-tab ${e.qualitaet === k ? 'on' : ''}" data-act="setq" data-q="${k}" data-focus="setq-${k}">${n}</button>`).join('');
  // Sprachnamen stehen immer in der eigenen Sprache (nicht übersetzen)
  const sprachen = SPRACHEN.map((s) =>
    `<button type="button" class="ob-tab ${aktuelleSprache() === s.id ? 'on' : ''}" data-act="setsprache" data-l="${s.id}" data-focus="setl-${s.id}">${s.name}</button>`).join('');
  const stile = ([['rock', t('Rock')], ['pop', t('Pop')], ['retro', t('Retro')], ['chip', t('Chiptune')], ['aus', t('Aus')]] as const).map(([k, n]) =>
    `<button type="button" class="ob-tab ${e.musikStil === k ? 'on' : ''}" data-act="setmusik" data-m="${k}" data-focus="setm-${k}">${n}</button>`).join('');
  return `
    <div class="ob-panel ob-wide ob-settings">
      <div class="ob-shop-head">
        <h2 class="ob-h">${t('Einstellungen')}</h2>
        <button type="button" class="ob-go" data-act="setzu" data-focus="setzu">${t('Fertig')}</button>
      </div>
      <h3 class="ob-h3">${t('Ton')}</h3>
      <div class="ob-setgrid">
        ${slider('gesamt', t('Lautstärke'), e.gesamt, 0, 1, 0.05)}
        ${slider('effekte', t('Effekte'), e.effekte, 0, 1, 0.05)}
        ${slider('musik', t('Musik'), e.musik, 0, 1, 0.05)}
      </div>
      <h3 class="ob-h3">${t('Sprache')} <small>Language · Idioma · Langue</small></h3>
      <div class="ob-tabs">${sprachen}</div>
      <h3 class="ob-h3">${t('Musik')} <small>${t('wird live erzeugt und passt sich dem Kampf an')}</small></h3>
      <div class="ob-tabs">${stile}</div>
      <h3 class="ob-h3">${t('Grafik')} <small>${info}</small></h3>
      <div class="ob-tabs">${q}</div>
      <h3 class="ob-h3">${t('Barrierefreiheit')}</h3>
      <div class="ob-setgrid">
        ${slider('shake', t('Bildschirm-Wackeln'), e.shake, 0, 2, 0.1)}
        ${slider('blitze', t('Lichtblitze'), e.blitze, 0, 2, 0.1)}
        ${slider('partikel', t('Partikel'), e.partikel, 0, 2, 0.1)}
        ${toggle('zahlen', t('Schadenszahlen'), e.zahlen)}
        ${toggle('vibration', t('Vibration'), e.vibration)}
        ${toggle('farbenblind', t('Farbenblind-Modus'), e.farbenblind, t('Gefahren mit Mustern statt nur Farben'))}
      </div>
      <h3 class="ob-h3">${t('Spielstand')} <small>${t('Profil und alle drei Plätze, z. B. für ein anderes Gerät')}</small></h3>
      <div class="ob-row">
        <button type="button" class="ob-btn2" data-act="sdatei" data-focus="sdatei">${t('Als Datei speichern (.boom)')}</button>
        <button type="button" class="ob-btn2" data-act="sladen" data-focus="sladen">${t('Datei laden')}</button>
      </div>
      <div class="ob-row"><button type="button" class="ob-btn2" data-act="recht" data-focus="recht">${t('Datenschutz &amp; Lizenzen')}</button></div>
    </div>`;
}
