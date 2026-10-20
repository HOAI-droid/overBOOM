import type { Profil } from '@overboom/core';
import {
  ART_INFO, ELEMENT_INFO, ERFOLGE, KARTEN, KARTE_BY_ID, KARTEN_SET, SELTENHEIT, kartenNummer, t,
  type Element, type Karte, type KartenArt, type MetaStat, zahl } from '@overboom/data';

/** Liefert die Voxel-Artworks (kommt aus dem Renderer, die UI kennt nur dieses Interface) */
export interface KartenKunst {
  readonly canvas: HTMLCanvasElement;
  thumb(k: Karte, locked: boolean): string;
  hasThumb(k: Karte, locked: boolean): boolean;
  live(k: Karte, locked: boolean): void;
  update(time: number): void;
}

export type AlbumTab = 'alle' | KartenArt | 'erfolge';

/** Tabs des Albums; `name` als Getter, damit der Text erst beim Anzeigen übersetzt wird */
export const ALBUM_TABS: { id: AlbumTab; readonly name: string }[] = [
  { id: 'alle', get name() { return t('Alle'); } },
  { id: 'held', get name() { return t('Helden'); } },
  { id: 'waffe', get name() { return t('Waffen'); } },
  { id: 'rezept', get name() { return t('Rezepte'); } },
  { id: 'gegner', get name() { return t('Gegner'); } },
  { id: 'boss', get name() { return t('Bosse'); } },
  { id: 'item', get name() { return t('Items'); } },
  { id: 'erfolge', get name() { return t('Erfolge'); } }
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Element-Symbol als Pixel-SVG */
export function elementIcon(e: Element, px = 14): string {
  const info = ELEMENT_INFO[e];
  let path = '';
  info.symbol.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '#') path += `M${x} ${y}h1v1h-1z`; });
  return `<svg class="ob-el" viewBox="-0.5 -0.5 6 6" width="${px}" height="${px}" shape-rendering="crispEdges" aria-label="${t(e)}" role="img"><title>${t(e)}</title><rect x="-0.5" y="-0.5" width="6" height="6" fill="#140e24"/><path fill="${info.farbe}" d="${path}"/></svg>`;
}

export function kartenFarbe(k: Karte): string {
  return k.elemente[0] ? ELEMENT_INFO[k.elemente[0]].farbe : '#9a94b0';
}

export function kartenListe(tab: AlbumTab): Karte[] {
  if (tab === 'alle' || tab === 'erfolge') return KARTEN;
  return KARTEN.filter((k) => k.art === tab);
}

export function albumZaehler(p: Profil): { gefunden: number; glanz: number } {
  let gefunden = 0, glanz = 0;
  for (const id in p.karten) if (KARTE_BY_ID[id]) { gefunden++; if (p.karten[id] === 2) glanz++; }
  return { gefunden, glanz };
}

/** Raster der kleinen Karten (Bilder kommen nach und nach) */
export function albumGrid(p: Profil, tab: AlbumTab): string {
  return kartenListe(tab).map((k) => {
    const st: number = p.karten[k.id] ?? 0, locked = st === 0;
    const neu = p.neu.includes(k.id);
    return `<button type="button" class="ob-kc ${locked ? 'locked' : ''} ${st === 2 ? 'glanz' : ''}" style="--rc:${SELTENHEIT[k.seltenheit - 1].farbe}; --ec:${kartenFarbe(k)}" data-act="karte" data-id="${k.id}" data-focus="k${k.nr}">
      <img class="ob-kc-art" alt="" data-thumb="${k.id}" data-locked="${locked ? 1 : 0}">
      <span class="ob-kc-nr">${String(k.nr).padStart(3, '0')}</span>
      <span class="ob-kc-name">${locked ? '???' : esc(k.name)}</span>
      ${neu ? `<em class="ob-kc-neu">${t('neu')}</em>` : ''}
    </button>`;
  }).join('');
}

/** Großansicht einer Karte; das Artwork-Canvas wird danach in `.ob-bc-art` eingehängt */
export function karteGross(p: Profil, k: Karte): string {
  const st: number = p.karten[k.id] ?? 0, locked = st === 0;
  const rar = SELTENHEIT[k.seltenheit - 1];
  const zeilen = locked
    ? `<p class="ob-bc-lock">${t('Noch nicht gefunden.')}</p>`
    : k.faehigkeiten.map((f) => `<p><b>${esc(f.name)}</b> ${esc(f.text)}</p>`).join('')
      + `<p class="ob-bc-flavor">${esc(k.flavor)}</p>${k.zitat ? `<p class="ob-bc-zitat">${esc(k.zitat)}</p>` : ''}`;
  const status = st === 2 ? `<span class="ob-hint2">✦ ${t('Glanzkarte')}</span>` : st === 1 ? `<span class="ob-hint2">${t('Gefunden')}</span>` : `<span class="ob-warn">${t('Gesperrt')}</span>`;
  return `<div class="ob-bigwrap">
    <div class="ob-bigcard ${st === 2 ? 'glanz' : ''} ${locked ? 'locked' : ''}" style="--ec:${kartenFarbe(k)}; --rc:${rar.farbe}">
      <div class="ob-bc-head">
        <span class="ob-bc-name">${locked ? '???' : esc(k.name)}</span>
        <span class="ob-bc-wert">${k.wert.name} <b>${locked ? '?' : k.wert.zahl}</b></span>
      </div>
      <div class="ob-bc-art"></div>
      <div class="ob-bc-type"><span>${locked ? ART_INFO[k.art].name : esc(k.typzeile)}</span><span class="ob-bc-els">${k.elemente.map((e) => elementIcon(e)).join('')}</span></div>
      <div class="ob-bc-text">${zeilen}</div>
      <div class="ob-bc-foot"><span>${KARTEN_SET.kurz} · ${kartenNummer(k)}</span><span style="color:${rar.farbe}">${rar.name}</span></div>
      <div class="ob-holo"></div>
    </div>
    <div class="ob-bc-side">
      ${status}
      <p class="ob-part"><b>${t('Fundort:')}</b> ${esc(k.bedingung)}</p>
      <p class="ob-part"><b>${t('Glanz:')}</b> ${esc(k.glanzBedingung)}</p>
      <div class="ob-row">
        <button type="button" class="ob-btn2" data-act="kprev" data-focus="kprev">◀</button>
        <button type="button" class="ob-btn2" data-act="knext" data-focus="knext">▶</button>
        <button type="button" class="ob-btn2" data-act="kbild" data-focus="kbild" ${locked ? 'disabled' : ''}>${t('Als Bild')}</button>
        <button type="button" class="ob-go" data-act="kzu" data-focus="kzu">${t('Zurück')}</button>
      </div>
    </div>
  </div>`;
}

/** Namen der Statistikwerte (Funktion, damit erst zur Laufzeit übersetzt wird) */
const statNamen = (): Record<MetaStat, string> => ({
  runs: t('Runs'), siege: t('Siege'), kills: t('Besiegte Gegner'), maxKette: t('Längste Kette'), fusionen: t('Fusionen'), rezepte: t('Rezepte'),
  reaktionen: t('Reaktionen'), befreit: t('Befreite Inseln'), evolutionen: t('Evolutionen'), kristalle: t('Kristalle'), sets: t('Komplette Sets'),
  bestWelle: t('Beste Welle'), bosse: t('Besiegte Bosse'), gefahr: t('Höchste Gefahr (Sieg)')
});

/** Erfolge mit Fortschritt, Statistik und Profil-Export */
export function erfolgeHtml(p: Profil, code: string, importFehler: boolean): string {
  const list = ERFOLGE.map((e) => {
    const done = p.erfolge.includes(e.id);
    const v = Math.min(e.ziel, p.stats[e.stat] ?? 0);
    const k = KARTE_BY_ID[e.karte];
    return `<li class="${done ? 'done' : ''}">
      <b>${done ? '✦ ' : ''}${esc(e.name)}</b><span>${esc(e.text)}</span>
      <div class="ob-erf-bar"><i style="width:${Math.round((v / e.ziel) * 100)}%"></i><small>${zahl(v)} / ${zahl(e.ziel)}</small></div>
      <small class="ob-erf-karte">${t('Glanzkarte: {karte}', { karte: k ? esc(k.name) : '–' })}</small>
    </li>`;
  }).join('');
  const namen = statNamen();
  const stats = (Object.keys(namen) as MetaStat[]).map((s) => `<li><span>${namen[s]}</span><b>${zahl((p.stats[s] ?? 0))}</b></li>`).join('');
  return `<ul class="ob-erfolge">${list}</ul>
    <h3 class="ob-h3">${t('Statistik')}</h3>
    <ul class="ob-stats">${stats}</ul>
    <h3 class="ob-h3">${t('Spielstand')} <small>${t('als Code sichern oder auf ein anderes Gerät mitnehmen')}</small></h3>
    <textarea class="ob-code" readonly rows="3" data-code>${esc(code)}</textarea>
    <div class="ob-row">
      <button type="button" class="ob-btn2" data-act="kcopy" data-focus="kcopy">${t('Code kopieren')}</button>
    </div>
    <textarea class="ob-code" rows="2" placeholder="${t('Code hier einfügen …')}" data-import></textarea>
    ${importFehler ? `<p class="ob-warn">${t('Der Code ist ungültig.')}</p>` : ''}
    <div class="ob-row"><button type="button" class="ob-btn2" data-act="kimport" data-focus="kimport">${t('Code laden (ersetzt deinen Spielstand)')}</button></div>`;
}
