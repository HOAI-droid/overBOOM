import {
  canMerge, fusionPreview, inselFrei, neuesProfil, rerollPrice, sellPrice, weaponDamage, weaponRange, weaponRate,
  type Command, type Profil, type Player, type World, type WeaponSlot
} from '@overboom/core';
import {
  A, AMBOSS, EVOLUTION, G, GEGNER_BY_ID, INSEL_BY_ID, MOD_BY_ID, MOD_SLOTS, STERNE, SYNERGIEN, evoName, HELDEN, HELD_BY_ID, INSELN, ITEM_BY_ID, L, REZEPTE, SELTENHEIT, waffeById, type Gruppe, type Waffe, SPIELER, STAT_INFO, STAT_KEYS, TIER_ZAHL, UPGRADE_BY_ID, W,
  elemente, t, type StatKey, INSEL_LORE, WELT, SIEG_TEXT, SPRUECHE_TOD, PLAETZE, SETS, SET_BY_ID, setBoni, schrottwert, BEUTE, type Ausruestung, zahl, ausruestungsName } from '@overboom/data';
import { gefahrWahl } from './gefahr.ts';
import { STANDARD, einstellungenHtml, type Einstellungen } from './settings.ts';
import { RAUMCODE_LAENGE, codeHinweis, leseRaumcode, lobbyHtml, titelHtml, type CoopAktion, type CoopAnsicht } from './lobby.ts';
import { ALBUM_TABS, albumGrid, albumZaehler, erfolgeHtml, karteGross, kartenListe, type AlbumTab, type KartenKunst } from './album.ts';
import { PAD_HINWEIS } from './glyphs.ts';
import { koopHinweisHtml, rechtlichesHtml } from './rechtliches.ts';
import { TIPPS, GEFAHREN, MAX_GEFAHR, HELD_FREI, KARTEN, KARTE_BY_ID, WELT as WELT_INFO, type Karte } from '@overboom/data';

const GEM = '<i class="ob-gem" aria-hidden="true"></i>';
const LOCK_ON = '<svg viewBox="0 0 8 9" width="16" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 0h4v1h1v3h1v5h-8v-5h1v-3h1zM2 1v3h4v-3zM3 5v2h2v-2z"/></svg>';
const LOCK_OFF = '<svg viewBox="0 0 8 9" width="16" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 0h3v1h1v2h-1v-2h-3v3h4v6h-8v-5h3v-4zM3 5v2h2v-2z"/></svg>';

function heldHinweis(id: string): string {
  return HELD_FREI[id] ? t('Freischalten: {text}', { text: HELD_FREI[id].text }) : '';
}

const fmt = (v: number) => zahl(Math.round(v * 10) / 10);
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v));

function statLine(k: StatKey, v: number): string {
  const info = STAT_INFO[k];
  const good = v >= 0;
  return `<li class="${good ? 'up' : 'down'}">${signed(v)}${info.einheit ? ' %' : ''} ${info.name}</li>`;
}

function seltenheitsFarbe(stufe: number): string {
  return SELTENHEIT[Math.max(0, Math.min(4, stufe - 1))].farbe;
}

/** Rahmen in Seltenheitsfarbe (Items, Ausrüstung, Mods, Verbesserungen) */
function rarity(tier: number): string {
  return `style="--rc:${seltenheitsFarbe(tier)}"`;
}

/** Rahmenfarben der Waffengruppen (Schlüssel = Logik-Wert `gruppe`, Anzeige mit t()) */
const GRUPPEN_FARBE: Record<Gruppe, string> = {
  'Feuerwaffen': '#ff7a1a',
  'Explosiv': '#ff4b5c',
  'Elementar': '#3de8ff',
  'Nahkampf': '#ffd23f',
  'Energie': '#ff3df0',
  'Drohnen & Türme': '#7dff5a',
  'Beschwörung': '#a77bff',
  'Werfer': '#d39a62',
  'Exotisch': '#2fe0a8',
  'Support': '#6f9bff'
};

function gruppenListe(w: Waffe): Gruppe[] {
  return w.fusion?.gruppen.length ? w.fusion.gruppen : [w.gruppe];
}
function gruppenFarbe(g: Gruppe): string {
  return GRUPPEN_FARBE[g] ?? '#9a94b0';
}
/** Gruppenname(n) einer Waffe für die Anzeige */
function gruppenText(w: Waffe, trenner = ' · '): string {
  return gruppenListe(w).map((g) => t(g)).join(trenner);
}

/**
 * Waffen: Rahmen = Waffengruppe (Fusionen: mehrfarbig), Stufe I–V steckt in
 * `--tc` (Plakette und Name in Seltenheitsfarbe).
 */
function waffenStil(w: Waffe, tier: number): string {
  const gs = gruppenListe(w);
  let s = `--rc:${gruppenFarbe(gs[0])};--tc:${seltenheitsFarbe(tier)}`;
  if (gs.length > 1) {
    const stops = gs.map((g, i) => `${gruppenFarbe(g)} ${Math.round((i / gs.length) * 100)}% ${Math.round(((i + 1) / gs.length) * 100)}%`).join(',');
    s += `;border-image:linear-gradient(135deg,${stops}) 1`;
  }
  return `style="${s}"`;
}

/** Stufen-Plakette (römische Zahl auf Seltenheitsfarbe) */
function plakette(tier: number): string {
  return `<b class="ob-plak" title="${t('Stufe {n}', { n: TIER_ZAHL[tier - 1] })}">${TIER_ZAHL[tier - 1]}</b>`;
}

interface KartenInhalt {
  /** 'button' für wählbare Karten (Level-Up, Held, Evolution) */
  tag?: 'div' | 'button';
  cls?: string;
  /** style-Attribut mit `--rc` (Rahmen) bzw. `--tc` */
  stil: string;
  attrs?: string;
  kind: string;
  name: string;
  /** Stufe für die Plakette (nur Waffen) */
  stufe?: number;
  body: string;
  /** Knöpfe am unteren Rand (bleiben immer sichtbar) */
  fuss?: string;
}

/**
 * Einheitliche Karte mit fester Größe: Kopf (Art, Name) oben, Inhalt dazwischen
 * (scrollt bei Überlänge innen), Knöpfe unten. Größe kommt aus `--kw`/`--kh`.
 */
function karte(k: KartenInhalt): string {
  const tag = k.tag ?? 'div';
  return `<${tag} ${tag === 'button' ? 'type="button" ' : ''}class="ob-card ob-k ${k.stufe ? 'ob-kw' : ''} ${k.cls ?? ''}" ${k.stil} ${k.attrs ?? ''}>
    ${k.stufe ? plakette(k.stufe) : ''}
    <span class="ob-kind">${k.kind}</span>
    <span class="ob-name">${k.name}</span>
    <span class="ob-kbody">${k.body}</span>
    ${k.fuss ? `<span class="ob-kfuss">${k.fuss}</span>` : ''}
  </${tag}>`;
}

/** Werte einer Waffe so, wie sie mit den aktuellen Spielerwerten feuern würde */
function weaponLines(p: Player, w: Waffe, tier: number, real?: WeaponSlot): string {
  const slot = real ?? ({ waffe: w, tier, stars: 0, kills: 0, mods: [], modMask: 0, mask: 0 } as unknown as WeaponSlot);
  const el = w.fusion ? w.fusion.elemente : elemente(w);
  const fu = w.fusion ? `<li class="ob-part"><b>${t('Geschoss:')}</b> ${G[w.geschoss].name}</li>` : '';
  return `<ul class="ob-lines">
    <li>${t('Schaden')} <b>${fmt(weaponDamage(p, slot))}</b></li>
    <li>${t('Feuerrate')} <b>${fmt(weaponRate(p, slot))}/s</b></li>
    <li>${t('Reichweite')} <b>${fmt(weaponRange(p, slot))} m</b></li>
    ${fu}<li class="ob-part"><b>${A[w.antrieb].name}:</b> ${A[w.antrieb].text}</li>
    <li class="ob-part"><b>${L[w.ladung].name}:</b> ${L[w.ladung].text}</li>
  </ul>${w.fusion ? instabilBar(w.fusion.instabil) : ''}${el.length ? `<span class="ob-tags">${el.map((e) => `<span>${t(e)}</span>`).join('')}</span>` : ''}`;
}

/** Anzeigename der Ausrüstungsart (t() erst zur Laufzeit, weil die Sprache beim Import noch nicht steht) */
function artName(a: Ausruestung): string {
  switch (a.art) {
    case 'helm': return t('Helm');
    case 'ruestung': return t('Rüstung');
    case 'stiefel': return t('Stiefel');
    case 'handschuhe': return t('Handschuhe');
    case 'amulett': return t('Amulett');
    case 'ring': return t('Ring');
    case 'rucksack': return t('Rucksack');
    default: return a.art;
  }
}
function gearLines(a: Ausruestung): string {
  return `<ul class="ob-lines">${(Object.keys(a.werte) as StatKey[]).map((k) => statLine(k, a.werte[k]!)).join('')}</ul>`;
}

function instabilBar(v: number): string {
  return `<span class="ob-instabil" title="${t('Bei Krit kann es spontan Kawumm machen')}"><span>${t('Instabil {n} %', { n: v })}</span><i style="width:${v}%"></i></span>`;
}

/** Name des Bauteils, das eine Waffe beisteuert */
function partName(w: Waffe, part: 'geschoss' | 'antrieb' | 'ladung'): string {
  return part === 'geschoss' ? G[w.geschoss].name : part === 'antrieb' ? A[w.antrieb].name : L[w.ladung].name;
}

export interface EndStats {
  gefahr: number;
  victory: boolean;
  wave: number;
  level: number;
  kills: number;
  damage: number;
  maxChain: number;
  crystals: number;
  mvp: string;
  mvpDamage: number;
}


/**
 * Alle Menü-Overlays. Liest den Weltzustand, ändert ihn aber nie selbst –
 * jede Aktion wird als Befehl (`send`) an die Simulation geschickt.
 */
export class Menus {
  readonly root: HTMLDivElement;
  private mode: 'none' | 'start' | 'shop' | 'end' | 'pause' | 'album' | 'titel' | 'lobby' | 'einst' | 'recht' | 'koophinweis' | 'abbruch' = 'none';
  /** wohin „Weiterspielen“ im Beenden-Dialog zurückführt */
  private abbruchZurueck: 'shop' | 'pause' = 'shop';
  /** Run abbrechen (solo) bzw. Raum verlassen (Koop) – setzt die App */
  onZumTitel: () => void = () => {};
  /** Sprache gewechselt (die App speichert und lädt neu) */
  onSprache: (sprache: string) => void = () => {};
  /** Koop-Hinweis: was nach „Verstanden“ passiert; von wo „Datenschutz & Lizenzen“ geöffnet wurde */
  private koopWeiter: (() => void) | null = null;
  private rechtZurueck: 'einst' | 'koophinweis' = 'einst';
  /** Einstellungen (setzt die App) und Rückmeldung bei Änderung */
  einstellungen: Einstellungen = { ...STANDARD };
  onEinstellungen: (e: Einstellungen) => void = () => {};
  qualiInfo: () => string = () => '';
  /** Ton bei Klicks (setzt die App) */
  klick: (art: 'klick' | 'kauf' | 'nein') => void = () => {};
  private einstBack: 'titel' | 'pause' = 'titel';
  /** Bildschirm außerhalb des Runs: Titel, Solo-Startwahl, Koop-Lobby oder im Spiel */
  screen: 'titel' | 'solo' | 'lobby' | 'spiel' = 'titel';
  /** Koop: Lobby-Inhalt und Aktionen (setzt die App) */
  coop: CoopAnsicht | null = null;
  onCoop: (a: CoopAktion | { t: 'lobby' }) => void = () => {};
  /** läuft gerade ein Koop-Run? (Pause/Ende sehen anders aus) */
  koop: 'host' | 'client' | null = null;
  /** eigener Spieler-Index */
  me = 0;
  name = '';
  codeVorgabe = '';
  /** freigeschaltete Helden (Meta-Progression) */
  heldenFrei: () => string[] = () => HELDEN.map((h) => h.id);
  /** gewählte Gefahrenstufe (solo) */
  gefahr = 0;
  private detail = -1;
  private showStats = false;
  private tab: 'shop' | 'amboss' | 'ausruestung' = 'shop';
  /** Amboss: gewählte Waffenplätze und wer welches Bauteil liefert (Index in anvilSel) */
  private anvilSel: number[] = [];
  private parts = { geschoss: 0, antrieb: 1, ladung: 2 };
  private book = false;
  private shopWave = -1;
  /** Startauswahl: erst Held, dann Insel */
  private startHeld = '';
  /** auf der Weltkarte gewählte Insel */
  private mapSel = '';
  private lastKey = '';
  /** Meta-Profil (Freischaltungen) – setzt die App */
  profil: () => Profil = () => neuesProfil();
  /** Kartenalbum: Artworks, Callbacks für „gesehen", Bild-Export, Kopieren, Import */
  kunst: KartenKunst | null = null;
  gesehen: (id: string) => void = () => {};
  exportBild: (k: Karte, glanz: boolean) => void = () => {};
  kopieren: (text: string) => void = () => {};
  profilCode: () => string = () => '';
  importCode: (code: string) => boolean = () => false;
  private albumTab: AlbumTab = 'alle';
  private albumKarte = '';
  private albumBack: 'start' | 'pause' | 'end' | 'shop' = 'start';
  /** Fokus nach dem nächsten show() (z. B. Reiter nach Wechsel Album ↔ Shop) */
  private fokusWunsch = '';
  private albumScroll = 0;
  private importFehler = false;
  private lastEnd: [EndStats, number] | null = null;
  onRestart: () => void = () => {};
  onResume: () => void = () => {};
  /** nur Controller (Xbox): Controller-Symbole statt Tastatur-Hinweisen */
  controller = false;
  /** App beenden (nur auf Plattformen, die das erlauben – sonst null) */
  onBeenden: (() => void) | null = null;
  /** gespeicherter Solo-Run: Beschreibung für den Knopf „Fortsetzen" (leer = keiner) */
  private fortsetzenText = '';
  onFortsetzen: (() => void) | null = null;
  set fortsetzen(text: string) {
    if (text === this.fortsetzenText) return;
    this.fortsetzenText = text;
    if (this.mode === 'titel') this.mode = 'none';
  }

  world: World;

  constructor(parent: HTMLElement, world: World, private send: (cmd: Command) => boolean, private touch: boolean, private recipes: () => ReadonlySet<string> = () => new Set()) {
    this.world = world;
    this.root = document.createElement('div');
    this.root.className = 'ob-menu hidden';
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.matches?.('input.ob-codein')) { this.codeLive(el, false); return; }
      const key = el.dataset?.set as keyof Einstellungen | undefined;
      if (!key) return;
      const v = Number(el.value);
      this.einstellungen = { ...this.einstellungen, [key]: v };
      const label = el.parentElement?.querySelector('b');
      if (label) label.textContent = `${Math.round(v * 100)} %`;
      this.onEinstellungen(this.einstellungen);
    });
    // Enter im Raumcode-Feld = Beitreten
    this.root.addEventListener('keydown', (e) => {
      const el = e.target as HTMLInputElement;
      if (e.key === 'Enter' && el.matches?.('input.ob-codein') && !el.readOnly) { e.preventDefault(); this.klick('klick'); this.beitreten(); }
    });
    // Glanzkarten kippen mit dem Zeiger (holografischer Schimmer)
    this.root.addEventListener('pointermove', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.ob-bigcard');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width).toFixed(3));
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height).toFixed(3));
    });
    // Gamepad/Tastatur: Fokus auf eine Insel wählt sie gleich aus
    this.root.addEventListener('focusin', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.ob-isle');
      if (el && el.dataset.id && el.dataset.id !== this.mapSel) { this.mapSel = el.dataset.id; this.renderMap(); }
    });
  }

  get open(): boolean { return this.mode !== 'none'; }
  get current(): string { return this.mode; }

  private get p(): Player { return this.world.players[this.me] ?? this.world.players[0]; }

  hide(): void {
    this.mode = 'none';
    this.root.classList.add('hidden');
    this.root.classList.remove('ob-mapmode');
    this.root.innerHTML = '';
    this.lastKey = '';
  }

  private show(mode: typeof this.mode, html: string, focusSel?: string): void {
    const keep = this.mode === mode || this.mode === 'none' ? (document.activeElement as HTMLElement | null)?.dataset?.focus : undefined;
    this.mode = mode;
    this.root.classList.remove('ob-mapmode');
    this.root.classList.remove('hidden');
    this.root.innerHTML = html;
    // Fokus erhalten bzw. sinnvoll setzen (Gamepad/Tastatur)
    const wunsch = this.fokusWunsch;
    this.fokusWunsch = '';
    const el = (wunsch && this.root.querySelector<HTMLElement>(`[data-focus="${wunsch}"]:not([disabled])`))
      || (keep && this.root.querySelector<HTMLElement>(`[data-focus="${keep}"]:not([disabled])`))
      || (focusSel ? this.root.querySelector<HTMLElement>(focusSel) : null)
      || this.root.querySelector<HTMLElement>('button:not([disabled])');
    el?.focus({ preventScroll: true });
  }

  /** Wird jedes Frame aufgerufen; baut nur neu, wenn sich der Zustand geändert hat. */
  sync(): void {
    const w = this.world, p = this.p;
    // Album als Shop-Reiter: endet mit der Shop-Phase (z. B. Koop-Host startet) oder bei Level-Up
    if (this.mode === 'album' && this.albumBack === 'shop' && (w.phase !== 'shop' || p.pendingLevels > 0 || this.screen === 'titel' || this.screen === 'lobby')) {
      this.albumKarte = '';
      this.hide();
    }
    if (this.mode === 'pause' || this.mode === 'end' || this.mode === 'album' || this.mode === 'einst' || this.mode === 'recht' || this.mode === 'koophinweis' || this.mode === 'abbruch') return;
    if (this.screen === 'titel') {
      if (this.mode !== 'titel') this.show('titel', titelHtml(this.name, this.codeVorgabe, this.albumButton(),
        '<button type="button" class="ob-btn2" data-act="einst" data-focus="einst">' + t('Einstellungen') + '</button>'
        + (this.onBeenden ? '<button type="button" class="ob-btn2" data-act="tbeenden" data-focus="tbeenden">' + t('Beenden') + '</button>' : ''),
        TIPPS[Math.floor(Date.now() / 1000) % TIPPS.length], this.controller ? PAD_HINWEIS.menue : '', this.fortsetzenText), this.fortsetzenText ? '[data-act="tweiter"]' : '[data-act="tsolo"]');
      return;
    }
    if (this.screen === 'lobby' && this.coop) {
      const key = JSON.stringify(this.coop);
      if (this.mode !== 'lobby' || key !== this.lastKey) { this.lastKey = key; this.show('lobby', lobbyHtml(this.coop)); }
      return;
    }
    if (w.phase === 'wahl') {
      if (this.mode !== 'start') this.renderStart();
      return;
    }
    if (w.phase === 'shop') {
      if (this.shopWave !== w.wave) { this.shopWave = w.wave; this.tab = 'shop'; this.resetAnvil(); }
      const key = JSON.stringify([w.wave, p.crystals, p.pendingLevels, p.upgradeOffers, p.offers, p.loadout, p.weapons.map((s) => s.tier + ':' + s.stars + ':' + s.mods.join('/') + s.waffe.id), p.modInv, this.detail, this.showStats, p.ready,
        this.tab, p.beute.map((a) => a.uid), Object.values(p.ausruestung).map((a) => a?.uid ?? 0), this.anvilSel, this.parts, this.book, this.recipes().size]);
      if (this.mode !== 'shop' || key !== this.lastKey) { this.lastKey = key; this.renderShop(); }
      return;
    }
    if (this.mode === 'start' || this.mode === 'shop') this.hide();
  }

  /** Zustand der Weltkarte, solange sie angezeigt wird (sonst null) */
  mapState(): { inseln: { id: string; frei: boolean; befreit: boolean; erobert: boolean }[]; auswahl: string } | null {
    if (this.mode !== 'start' || !this.startHeld) return null;
    const pr = this.profil();
    return {
      inseln: INSELN.map((i) => ({ id: i.id, frei: inselFrei(pr, i.id), befreit: pr.befreit.includes(i.id), erobert: pr.erobert.includes(i.id) })),
      auswahl: this.mapSel
    };
  }

  /** Insel-Beschriftungen auf der Karte nachführen (jedes Frame) */
  updateMapLabels(anchor: (id: string, out: { x: number; y: number }) => boolean): void {
    if (this.mode !== 'start' || !this.startHeld) return;
    const pt = { x: 0, y: 0 };
    for (const el of this.root.querySelectorAll<HTMLElement>('.ob-isle')) {
      if (!anchor(el.dataset.id!, pt)) continue;
      el.style.transform = `translate(${Math.round(pt.x)}px, ${Math.round(pt.y)}px) translate(-50%, 0)`;
    }
  }

  /* ---------------- Startwahl ---------------- */

  private renderStart(): void {
    if (!this.startHeld) {
      const cards = HELDEN.map((h, i) => {
        const wf = h.startWaffe === 'zufall' ? null : W[h.startWaffe];
        if (!this.heldenFrei().includes(h.id)) return karte({ tag: 'button', cls: 'ob-hero ob-locked', stil: '', attrs: `disabled data-focus="held${i}"`, kind: t('Gesperrt'), name: '???', body: `<span class="ob-part">${heldHinweis(h.id)}</span>` });
        const waffe = wf ? `<b style="color:${gruppenFarbe(wf.gruppe)}">${wf.name}</b> <small class="ob-gr">${t(wf.gruppe)}</small>` : `<b>${t('zufällig')}</b>`;
        return karte({
          tag: 'button', cls: 'ob-hero', stil: `style="--rc:${h.farbe}"`, attrs: `data-act="held" data-id="${h.id}" data-focus="held${i}"`,
          kind: h.titel, name: h.name,
          body: `<ul class="ob-lines">
            <li>${t('Startwaffe')} ${waffe}</li>
            ${(Object.keys(h.werte) as StatKey[]).map((k) => statLine(k, h.werte[k]!)).join('')}
          </ul>
          <span class="ob-part">${h.text}</span>
          <span class="ob-flavor">${h.spruch}</span>`
        });
      }).join('');
      this.show('start', `
        <div class="ob-panel ob-wide">
          <div class="ob-shop-head"><h2 class="ob-h">${t('Wähle deinen Kawumm-Jäger')}</h2>${this.albumButton()}</div>
          <p class="ob-sub">${t('Jeder Held hat eine Startwaffe und eine Macke. Waffen feuern von selbst – du läufst, weichst aus und kaufst nach jeder Welle nach.')}</p>
          <div class="ob-cards">${cards}</div>
          <div class="ob-row ob-center">${this.beendenKnopf()}</div>
        </div>`, '[data-act="held"]');
      return;
    }
    this.renderMap();
  }

  private renderMap(): void {
    const h = HELD_BY_ID[this.startHeld];
    const pr = this.profil();
    if (!this.mapSel || !INSEL_BY_ID[this.mapSel]) {
      // zuletzt freigeschaltete Insel vorwählen
      const frei = INSELN.filter((i) => inselFrei(pr, i.id));
      this.mapSel = (frei.find((i) => !pr.befreit.includes(i.id)) ?? frei[frei.length - 1] ?? INSELN[0]).id;
    }
    const labels = INSELN.map((i, k) => {
      const frei = inselFrei(pr, i.id), bef = pr.befreit.includes(i.id), ero = pr.erobert.includes(i.id);
      return `<button type="button" class="ob-isle ${frei ? '' : 'locked'} ${i.id === this.mapSel ? 'sel' : ''}" style="--rc:${i.farben.spezial[0]}" data-act="insel" data-id="${i.id}" data-focus="insel${k}">
        ${frei ? '' : '🔒︎ '}${i.name}${ero ? ' ♛' : bef ? ' ⚑' : ''}</button>`;
    }).join('');
    const i = INSEL_BY_ID[this.mapSel];
    const frei = inselFrei(pr, i.id), bef = pr.befreit.includes(i.id), ero = pr.erobert.includes(i.id);
    const lore = INSEL_LORE[i.id];
    const status = !frei ? `<span class="ob-warn">${lore?.gesperrt ?? t('Noch gesperrt.')}</span>`
      : ero ? `<span class="ob-hint2">${t('Erobert ♛ – hier wurde der Baron besiegt.')}</span>`
      : bef ? `<span class="ob-hint2">${t('Befreit ⚑ – {text}', { text: lore?.befreit ?? '' })}</span>` : `<span class="ob-hint2">${t('Noch nicht befreit: Besiege den Boss auf Welle 10.')}</span>`;
    this.show('start', `
      <div class="ob-map">
        <div class="ob-map-head">
          <button type="button" class="ob-btn2" data-act="heldzurueck" data-focus="back">◀ ${h.name}</button>
          <div><h2 class="ob-h">${WELT.name}</h2><small>${WELT.untertitel} · ${t('{n}/{max} befreit', { n: pr.befreit.length, max: INSELN.length })}</small></div>
          ${this.albumButton()}
        </div>
        <div class="ob-map-labels">${labels}</div>
        <div class="ob-map-info" style="--rc:${i.farben.spezial[0]}">
          <span class="ob-kind">${i.fraktion}</span>
          <span class="ob-name">${i.name}</span>
          <p class="ob-part">${i.text}</p>
          <p class="ob-part"><b>${t('Gefahr:')}</b> ${i.gefahrText} · <b>${t('Boss:')}</b> ${GEGNER_BY_ID[i.boss].name} · ${t('Welle 20: Baron von Bumm')}</p>
          ${status}
          ${gefahrWahl(this.gefahr, pr.gefahrFrei, true)}
          <div class="ob-row"><button type="button" class="ob-go" data-act="go" data-focus="go" ${frei ? '' : 'disabled'}>${t('Los geht’s')} ▶</button></div>
        </div>
      </div>`, '[data-act="go"]:not([disabled])');
    this.root.classList.add('ob-mapmode');
  }

  /* ---------------- Shop & Level-Up ---------------- */

  private renderShop(): void {
    const w = this.world, p = this.p;
    if (p.pendingLevels > 0) {
      const cards = p.upgradeOffers.map((o, i) => {
        const u = UPGRADE_BY_ID[o.id];
        return karte({
          tag: 'button', cls: 'ob-up', stil: rarity(o.tier), attrs: `data-act="upgrade" data-i="${i}" data-focus="up${i}"`,
          kind: SELTENHEIT[o.tier - 1].name, name: u.name,
          body: `<ul class="ob-lines">${statLine(u.stat, u.werte[o.tier - 1])}</ul><span class="ob-flavor">${STAT_INFO[u.stat].text}</span>`
        });
      }).join('');
      this.show('shop', `
        <div class="ob-panel ob-wide">
          <h2 class="ob-h ob-gold">${t('Level {n}!', { n: p.level - p.pendingLevels + 1 })}</h2>
          <p class="ob-sub">${t('Wähle eine Verbesserung')}${p.pendingLevels > 1 ? ` · ${t('noch {n}', { n: p.pendingLevels })}` : ''}</p>
          <div class="ob-cards">${cards}</div>
          <div class="ob-row ob-center">
            <button type="button" class="ob-btn2" data-act="upskip" data-focus="upskip">${t('Überspringen (zufällig)')}</button>
            ${this.beendenKnopf()}
          </div>
        </div>`, '[data-act="upgrade"]');
      return;
    }

    const offers = p.offers.map((o, i) => {
      if (o.sold) return `<div class="ob-card ob-k ob-sold" ${rarity(o.tier)}><span class="ob-name">${t('Verkauft')}</span></div>`;
      const afford = p.crystals >= o.price;
      let body: string, kind: string, title: string, stil = rarity(o.tier), stufe = 0;
      if (o.kind === 'waffe') {
        const wf = W[o.id];
        kind = `${t('Waffe')} · ${gruppenText(wf)}`;
        title = wf.name;
        stil = waffenStil(wf, o.tier);
        stufe = o.tier;
        body = weaponLines(p, wf, o.tier);
        if (p.weapons.length >= SPIELER.maxWaffen && !p.weapons.some((s) => s.waffe.id === o.id && s.tier === o.tier && s.tier < 5)) body += `<span class="ob-warn">${t('Kein Platz mehr')}</span>`;
        else if (p.weapons.some((s) => s.waffe.id === o.id && s.tier === o.tier)) body += `<span class="ob-hint2">${t('Gleiche Waffe da – verschmelzbar!')}</span>`;
      } else if (o.kind === 'mod') {
        const m = MOD_BY_ID[o.id];
        kind = `${t('Mod')} · ${SELTENHEIT[m.seltenheit - 1].name}`;
        title = m.name;
        body = `<ul class="ob-lines"><li class="ob-part">${m.text}</li></ul><span class="ob-flavor">${t('Einbau in Waffen ab Stufe II (Waffe antippen).')}</span>`;
      } else if (o.kind === 'ausruestung' && o.equip) {
        const a = o.equip;
        kind = `${artName(a)} · ${SELTENHEIT[a.seltenheit - 1].name}`;
        title = ausruestungsName(a);
        body = gearLines(a);
        if (p.beute.length >= BEUTE.maxBeute) body += `<span class="ob-warn">${t('Beutel voll')}</span>`;
      } else {
        const it = ITEM_BY_ID[o.id];
        kind = `${t('Item')} · ${SELTENHEIT[it.seltenheit - 1].name}${p.items[o.id] ? ` · ${t('hast {n}', { n: p.items[o.id] })}` : ''}`;
        title = it.name;
        body = `<ul class="ob-lines">${(Object.keys(it.werte) as StatKey[]).map((k) => statLine(k, it.werte[k]!)).join('')}${it.spezial ? `<li class="ob-part">${t('Explodiert, wenn du getroffen wirst')}</li>` : ''}</ul><span class="ob-flavor">${it.text}</span>`;
      }
      return karte({
        cls: o.locked ? 'locked' : '', stil, stufe, kind, name: title, body,
        fuss: `<button type="button" class="ob-price" data-act="buy" data-i="${i}" data-focus="buy${i}" ${afford ? '' : 'disabled'}>${GEM}${o.price}</button>
          <button type="button" class="ob-lock ${o.locked ? 'on' : ''}" data-act="lock" data-i="${i}" data-focus="lock${i}" aria-label="${o.locked ? t('Entsperren') : t('Sperren')}" title="${t('Sperren: bleibt beim Reroll und in der nächsten Runde')}">${o.locked ? LOCK_ON : LOCK_OFF}</button>`
      });
    }).join('');

    const inhalt = this.tab === 'shop' ? `<div class="ob-cards">${offers}</div>`
      : this.tab === 'amboss' ? this.renderAnvil() : this.renderGear();
    // unterer Bereich: nur im Shop-Reiter (Amboss und Ausrüstung zeigen ihre Sachen schon selbst)
    const unten = this.tab === 'shop' ? this.shopUnten() : '';
    this.show('shop', `
      <div class="ob-panel ob-wide ob-shop">
        ${this.shopKopf(this.tab)}
        ${inhalt}
        ${this.shopAktionen(this.tab)}
        ${unten}
        ${this.werteListe()}
      </div>`, this.detail >= 0 ? '[data-act="merge"]:not([disabled]), [data-act="sell"]:not([disabled])' : '[data-act="buy"]:not([disabled]), [data-act="ready"]');
  }

  /** Reiterleiste des Shops (auch über dem Kartenalbum) */
  private shopKopf(on: 'shop' | 'amboss' | 'ausruestung' | 'album'): string {
    const w = this.world, p = this.p;
    const neu = this.profil().neu.filter((id) => KARTE_BY_ID[id]).length;
    const tab = (id: string, focus: string, label: string) =>
      `<button type="button" class="ob-tab ${on === id ? 'on' : ''}" data-act="tab" data-tab="${id}" data-focus="${focus}">${label}</button>`;
    const reise = w.reise.length > 1 ? ` · ${w.insel.name} · ${t('Insel {i}/{n}', { i: w.reiseIndex + 1, n: w.reise.length })}` : ` · ${w.insel.name}`;
    return `<div class="ob-shop-head">
      <div class="ob-tabs">
        ${tab('shop', 'tabshop', t('Shop'))}
        ${tab('amboss', 'tabamboss', `⚒ ${t('Amboss')}`)}
        ${tab('ausruestung', 'tabgear', `${t('Ausrüstung')}${p.beute.length ? ` <em class="ob-badge">${p.beute.length}</em>` : ''}`)}
        ${tab('album', 'tabalbum', `${t('Kartenalbum')}${neu ? ` <em class="ob-badge">${neu}</em>` : ''}`)}
        <small>${t('Welle {n} geschafft', { n: w.wave })}${reise}</small>
      </div>
      <div class="ob-wallet">${GEM}<b>${p.crystals}</b></div>
    </div>`;
  }

  /** Aktionsleiste: Neu würfeln (nur Shop), Werte, Beenden, nächste Welle – in allen Reitern */
  private shopAktionen(on: 'shop' | 'amboss' | 'ausruestung' | 'album'): string {
    const w = this.world, p = this.p;
    const reroll = rerollPrice(w, p);
    const naechste = w.reisePos(w.wave + 1);
    let los: string;
    if (naechste.index !== w.reiseIndex && w.reise[naechste.index]) {
      los = t('Auf nach {insel}!', { insel: INSEL_BY_ID[w.reise[naechste.index]]?.name ?? '' });
    } else {
      los = t('Welle {n}', { n: w.wave + 1 });
      if (naechste.art === 'boss') los += ` · ${t('Inselboss!')}`;
      else if (naechste.art === 'finale') los += ` · ${t('Finale!')}`;
      else if (naechste.art === 'baron') {
        const name = GEGNER_BY_ID[w.insel.baron]?.name ?? '';
        los += ` · ${name && name.length <= 18 ? name : t('Baron!')}`;
      }
    }
    return `<div class="ob-row ob-actions">
      ${on === 'shop' ? `<button type="button" class="ob-btn2" data-act="reroll" data-focus="reroll" ${p.crystals >= reroll ? '' : 'disabled'}>${t('Neu würfeln')} ${GEM}${reroll}</button>` : ''}
      <button type="button" class="ob-btn2" data-act="stats" data-focus="stats">${this.showStats ? t('Werte ausblenden') : t('Werte')}</button>
      ${this.beendenKnopf()}
      <button type="button" class="ob-go" data-act="ready" data-focus="ready">${los} ▶</button>
    </div>`;
  }

  /** Werte-Übersicht (Knopf „Werte“) */
  private werteListe(): string {
    if (!this.showStats) return '';
    const p = this.p;
    return `<ul class="ob-stats">${STAT_KEYS.map((k) => {
      const v = k === 'maxHp' ? p.maxHp : p.stats[k];
      const cls = k === 'maxHp' ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '';
      return `<li class="${cls}"><span>${STAT_INFO[k].name}</span><b>${fmt(v)}${STAT_INFO[k].einheit ? ' %' : ''}</b></li>`;
    }).join('')}</ul>`;
  }

  /** Waffenplatz als Kachel: Rahmen = Gruppe, Plakette = Stufe */
  private waffenKachel(s: WeaponSlot, i: number, act: 'slot' | 'pick', extra: string, cls: string, attrs = ''): string {
    return `<button type="button" class="ob-slot ${cls}" ${waffenStil(s.waffe, s.tier)} data-act="${act}" data-i="${i}" data-focus="${act}${i}" ${attrs}>
      ${plakette(s.tier)}
      <span class="ob-sname">${s.waffe.name}</span>
      <small class="ob-sgr">${gruppenText(s.waffe, ' + ')}</small>
      ${extra}
    </button>`;
  }

  /** Shop-Reiter unten: Waffenplätze mit Detail, Synergien, Items */
  private shopUnten(): string {
    const w = this.world, p = this.p;
    const slots = Array.from({ length: SPIELER.maxWaffen }, (_, i) => {
      const s = p.weapons[i];
      if (!s) return `<div class="ob-slot empty"></div>`;
      const m = canMerge(p, i);
      return this.waffenKachel(s, i, 'slot',
        `${m ? '<em class="ob-merge">⇧</em>' : ''}${s.waffe.fusion ? '<i class="ob-fz">⚒</i>' : ''}
        <small class="ob-stars ${s.stars >= 5 && !s.waffe.evo ? 'ready' : ''}">${'★'.repeat(s.stars)}${'☆'.repeat(5 - s.stars)}${s.mods.length ? ` · ${t('{n} Mod', { n: s.mods.length })}` : ''}</small>`,
        this.detail === i ? 'sel' : '');
    }).join('');

    let detail = '';
    const ds = p.weapons[this.detail];
    if (ds) {
      const dmg = w.stats.waffen[ds.waffe.id] ?? 0;
      detail = `<div class="ob-detail ob-kw" ${waffenStil(ds.waffe, ds.tier)}>
        <div class="ob-dkopf">
          <span class="ob-name">${ds.waffe.name}</span>
          <span class="ob-kind">${t('Waffe')} · ${gruppenText(ds.waffe)}</span>
          ${plakette(ds.tier)}
        </div>
        <div class="ob-dbody">
          <div class="ob-dspalte">
            ${weaponLines(p, ds.waffe, ds.tier, ds)}
            <p class="ob-flavor">${ds.waffe.text}${dmg ? ` · ${t('bisher {n} Schaden', { n: fmt(dmg) })}` : ''}</p>
          </div>
          <div class="ob-dspalte">${this.detailExtras(ds)}</div>
        </div>
        <div class="ob-row ob-dfuss">
          <button type="button" class="ob-btn2" data-act="merge" data-i="${this.detail}" data-focus="merge" ${canMerge(p, this.detail) ? '' : 'disabled'}>${t('Verschmelzen')} ⇧</button>
          <button type="button" class="ob-btn2" data-act="sell" data-i="${this.detail}" data-focus="sell" ${p.weapons.length > 1 ? '' : 'disabled'}>${t('Verkaufen +{preis}', { preis: sellPrice(ds, w.wave + 1) })}</button>
          <button type="button" class="ob-btn2" data-act="close" data-focus="close">${t('Schließen')}</button>
        </div>
      </div>`;
    }

    const items = Object.entries(p.items).map(([id, n]) => `<span class="ob-chip" ${rarity(ITEM_BY_ID[id].seltenheit)} title="${ITEM_BY_ID[id].text}">${ITEM_BY_ID[id].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('') || `<span class="ob-none">${t('noch keine')}</span>`;

    return `
      <h3 class="ob-h3">${t('Waffen {n}/{max}', { n: p.weapons.length, max: SPIELER.maxWaffen })} <small>${t('antippen: verschmelzen / verkaufen / Mods / Evolution')}${p.modInv.length ? ` · ${t('{n} Mod(s) im Rucksack', { n: p.modInv.length })}` : ''}</small></h3>
      <div class="ob-slots">${slots}</div>
      ${detail}
      <h3 class="ob-h3">${t('Synergien')} <small>${t('Elemente deiner Waffen – Boni ab 2 / 4 / 6')}</small></h3>
      <ul class="ob-synlist">${SYNERGIEN.map((sy) => {
        const n = p.synCount[sy.element] ?? 0;
        return `<li style="--c:${sy.farbe}"><b>${t(sy.element)} ${n}</b>${sy.stufen.map((st) => `<div class="${n >= st.ab ? 'on' : ''}">${st.ab}: ${st.text}</div>`).join('')}</li>`;
      }).join('')}</ul>
      <h3 class="ob-h3">${t('Items')}</h3>
      <div class="ob-items">${items}</div>`;
  }

  /** Sterne, Evolution und Mods im Waffendetail */
  private detailExtras(s: WeaponSlot): string {
    const p = this.p, i = this.detail;
    const next = s.stars < 5 ? STERNE.kills[s.stars] : 0;
    let html = `<p class="ob-part"><b>${t('Sterne')} ${'★'.repeat(s.stars)}${'☆'.repeat(5 - s.stars)}</b> ${s.stars < 5 ? t('{n}/{max} Kills bis zum nächsten Stern', { n: s.kills, max: next }) : s.waffe.evo ? t('evolviert') : t('bereit zur Evolution!')} · ${t('je Stern +{n} % Schaden', { n: Math.round(STERNE.schadenProStern * 100) })}</p>`;
    if (s.stars >= 5 && !s.waffe.evo) {
      html += `<div class="ob-evo">${(['a', 'b'] as const).map((v) => `
        <button type="button" class="ob-card" ${rarity(5)} data-act="evolve" data-i="${i}" data-v="${v}" data-focus="evo${v}">
          <span class="ob-kind">${v === 'a' ? t('Evolution A · Mehr') : t('Evolution B · Größer')}</span>
          <span class="ob-name">${evoName(s.waffe, v)}</span>
          <span class="ob-part">${EVOLUTION[v].text}</span>
        </button>`).join('')}</div>`;
    }
    const slots = MOD_SLOTS[s.tier - 1];
    html += `<p class="ob-part"><b>${t('Mods {n}/{max}', { n: s.mods.length, max: slots })}</b> ${s.mods.map((m) => MOD_BY_ID[m].name).join(', ') || (slots ? t('noch keine') : t('erst ab Stufe II'))}</p>`;
    if (p.modInv.length && s.mods.length < slots) {
      html += `<div class="ob-row">${p.modInv.map((m, k) => `<button type="button" class="ob-btn2" data-act="install" data-i="${i}" data-k="${k}" data-focus="mod${k}" ${s.mods.includes(m) ? 'disabled' : ''}>${t('Einbauen: {name}', { name: MOD_BY_ID[m].name })}</button>`).join('')}</div>`;
    }
    return html;
  }

  /* ---------------- Ausrüstung ---------------- */

  private renderGear(): string {
    const w = this.world, p = this.p;
    const slots = PLAETZE.map((pl) => {
      const a = p.ausruestung[pl.id];
      if (!a) return `<div class="ob-card ob-k ob-leer"><span class="ob-kind">${pl.name}</span><span class="ob-name">${t('leer')}</span></div>`;
      return karte({
        stil: rarity(a.seltenheit),
        kind: `${pl.name} · ${SELTENHEIT[a.seltenheit - 1].name}${a.set ? ` · ${SET_BY_ID[a.set].name}` : ''}`,
        name: ausruestungsName(a), body: gearLines(a),
        fuss: `<button type="button" class="ob-btn2" data-act="unequip" data-platz="${pl.id}" data-focus="un${pl.id}" ${p.beute.length < BEUTE.maxBeute ? '' : 'disabled'}>${t('Ablegen')}</button>`
      });
    }).join('');
    const aktiv = setBoni(Object.values(p.ausruestung));
    const sets = SETS.map((set) => {
      const n = aktiv.find((x) => x.set.id === set.id)?.anzahl ?? 0;
      return `<li class="${n ? 'some' : ''}"><b>${set.name} ${n}/${set.teile.length}</b>
        <span class="ob-setparts">${set.teile.map((x) => x.name).join(' · ')}</span>
        ${set.boni.map((b) => `<div class="${n >= b.ab ? 'on' : ''}">${b.ab}: ${b.text}</div>`).join('')}</li>`;
    }).join('');
    const beute = p.beute.map((a, k) => {
      const plaetze = PLAETZE.filter((x) => x.art === a.art);
      const anlegen = plaetze.length > 1
        ? plaetze.map((pl, j) => `<button type="button" class="ob-btn2" data-act="equip" data-i="${k}" data-platz="${pl.id}" data-focus="eq${k}${j}">→ ${pl.name} ${j + 1}</button>`).join('')
        : `<button type="button" class="ob-btn2" data-act="equip" data-i="${k}" data-focus="eq${k}">${t('Anlegen')}</button>`;
      const alt = plaetze.map((pl) => p.ausruestung[pl.id]).find((x) => x);
      return karte({
        stil: rarity(a.seltenheit),
        kind: `${artName(a)} · ${SELTENHEIT[a.seltenheit - 1].name}${a.set ? ` · ${SET_BY_ID[a.set].name}` : ''}`,
        name: ausruestungsName(a),
        body: `${gearLines(a)}${alt ? `<span class="ob-flavor">${t('Statt: {name}', { name: ausruestungsName(alt) })}</span>` : ''}`,
        fuss: `${anlegen}<button type="button" class="ob-btn2" data-act="scrap" data-i="${k}" data-focus="sc${k}">${t('Schrott +{n}', { n: schrottwert(a, w.wave) })}</button>`
      });
    }).join('');
    return `<div class="ob-gearview">
      <h3 class="ob-h3">${t('Angelegt')} <small>${t('8 Plätze – Werte zählen sofort')}</small></h3>
      <div class="ob-cards">${slots}</div>
      <h3 class="ob-h3">${t('Beutel {n}/{max}', { n: p.beute.length, max: BEUTE.maxBeute })} <small>${t('Beute von Elite-Gegnern und Bossen, oder aus dem Shop')}</small></h3>
      ${beute ? `<div class="ob-cards">${beute}</div>` : `<p class="ob-none">${t('Noch nichts gefunden. Elite-Gegner und Bosse lassen Ausrüstung fallen.')}</p>`}
      <h3 class="ob-h3">${t('Sets')}</h3>
      <ul class="ob-synlist ob-sets">${sets}</ul>
    </div>`;
  }

  /* ---------------- Fusions-Amboss ---------------- */

  private resetAnvil(): void {
    this.anvilSel = [];
    this.parts = { geschoss: 0, antrieb: 1, ladung: 2 };
  }

  /** Bauteil-Zuordnung an die Auswahl anpassen (2 Waffen: die erste liefert 2 Bauteile) */
  private defaultParts(): void {
    const n = this.anvilSel.length;
    this.parts = { geschoss: 0, antrieb: n > 1 ? 1 : 0, ladung: n > 2 ? 2 : 0 };
  }

  private fuseCmd() {
    return { type: 'fuse' as const, slots: this.anvilSel, geschoss: this.parts.geschoss, antrieb: this.parts.antrieb, ladung: this.parts.ladung };
  }

  private renderAnvil(): string {
    const w = this.world, p = this.p;
    const known = this.recipes();
    const price = AMBOSS.preis(w.wave);
    // Gruppen der schon gewählten Waffen: eine zweite Waffe derselben Gruppe passt nicht
    const gewaehlt = new Set(this.anvilSel.map((i) => p.weapons[i]?.waffe.gruppe));
    const picks = Array.from({ length: SPIELER.maxWaffen }, (_, i) => {
      const s = p.weapons[i];
      if (!s) return `<div class="ob-slot empty"></div>`;
      const k = this.anvilSel.indexOf(i);
      const dis = !!s.waffe.fusion;
      const gleich = k < 0 && !dis && gewaehlt.has(s.waffe.gruppe);
      return this.waffenKachel(s, i, 'pick', k >= 0 ? `<em class="ob-nr">${k + 1}</em>` : gleich ? `<small class="ob-warn">${t('Gruppe schon gewählt')}</small>` : '',
        `${k >= 0 ? 'sel' : ''} ${gleich ? 'ob-gleich' : ''}`, dis ? `disabled title="${t('Fusionen lassen sich nur mergen')}"` : '');
    }).join('');

    let parts = '', preview = '';
    if (this.anvilSel.length >= 2) {
      const ws = this.anvilSel.map((i) => p.weapons[i].waffe);
      const row = (part: 'geschoss' | 'antrieb' | 'ladung', label: string) => `
        <div class="ob-partrow"><span class="ob-partlabel">${label}</span>
          ${ws.map((wf, k) => `<button type="button" class="ob-part-btn ${this.parts[part] === k ? 'on' : ''}" data-act="part" data-part="${part}" data-i="${k}" data-focus="${part}${k}">
            ${partName(wf, part)}<small>${wf.name}</small></button>`).join('')}
        </div>`;
      parts = `<h3 class="ob-h3">2 · ${t('Bauteile zuordnen')} <small>${t('jede Waffe liefert mindestens eins')}</small></h3>
        <div class="ob-parts">${row('geschoss', t('Geschoss – was fliegt'))}${row('antrieb', t('Antrieb – wie es fliegt'))}${row('ladung', t('Ladung – was passiert'))}</div>`;
      const v = fusionPreview(w, p, this.fuseCmd());
      let card = '';
      if (v.waffe) {
        const rz = v.waffe.fusion?.rezept;
        const secret = rz && !known.has(rz);
        card = karte({
          cls: `ob-preview ${rz ? 'recipe' : ''}`,
          stil: waffenStil(v.waffe, rz ? 5 : v.tier), stufe: rz ? 5 : v.tier,
          kind: `${rz ? t('Geheimes Rezept') : t('Fusionswaffe')} · ${gruppenText(v.waffe)}`,
          name: secret ? `??? <small>${t('Was passiert da wohl …')}</small>` : v.waffe.name,
          body: secret ? `<span class="ob-flavor">${t('Diese Zutaten kennt der Amboss. Verschmelze sie, um das Rezept zu entdecken!')}</span>` : `${weaponLines(p, v.waffe, v.tier)}<span class="ob-flavor">${v.waffe.text}</span>`
        });
      }
      const err = v.error ? `<p class="ob-warn">${t(v.error)}</p>` : '';
      preview = `<div class="ob-fuserow">${card}<div class="ob-fuseside">${err}<button type="button" class="ob-go" data-act="fuse" data-focus="fuse" ${v.error ? 'disabled' : ''}>${t('Verschmelzen!')} ${GEM}${price}</button></div></div>`;
    } else {
      parts = `<p class="ob-sub">${t('Wähle 2 oder 3 Waffen aus <b>verschiedenen Gruppen</b>. Jede liefert ein Bauteil – Geschoss, Antrieb oder Ladung – und es entsteht eine ganz neue Waffe. Je verschiedener die Gruppen, desto instabiler … und stärker.')}</p>`;
    }

    const book = this.book ? `<ul class="ob-book">${REZEPTE.map((r) => known.has(r.id)
      ? `<li class="found"><b>${r.name}</b><span>${r.zutaten.map((z) => W[z].name).join(' + ')}</span></li>`
      : `<li><b>???</b><span>${r.hinweis}</span></li>`).join('')}</ul>` : '';

    return `<div class="ob-anvil">
      <h3 class="ob-h3">1 · ${t('Waffen wählen')} <small>${t('Schmiedelohn')} ${GEM}${price}</small></h3>
      <div class="ob-slots">${picks}</div>
      ${parts}
      ${preview}
      <div class="ob-row"><button type="button" class="ob-btn2" data-act="book" data-focus="book">${t('Rezeptbuch {n}/{max}', { n: known.size, max: REZEPTE.length })}</button></div>
      ${book}
    </div>`;
  }

  /* ---------------- Ende & Pause ---------------- */

  showEnd(s: EndStats, seed: number): void {
    this.lastEnd = [s, seed];
    const rows: [string, string | number][] = [
      [t('Welle'), s.wave],
      [t('Level'), s.level],
      [t('Besiegt'), s.kills],
      [t('Gesamtschaden'), fmt(Math.round(s.damage))],
      [t('Größte Kette'), s.maxChain ? `×${s.maxChain}` : '–'],
      [t('Kristalle'), s.crystals],
      [t('MVP-Waffe'), s.mvp ? `${waffeById(s.mvp)?.name ?? s.mvp}` : '–'],
      [t('Gefahr'), `${s.gefahr} · ${GEFAHREN[s.gefahr]?.name ?? ''}`]
    ];
    this.show('end', `
      <div class="ob-panel ob-end ${s.victory ? 'win' : ''}">
        <h2>${s.victory ? t('Sieg!') : t('Kawumm!')}</h2>
        <p class="ob-sub">${s.victory ? SIEG_TEXT : SPRUECHE_TOD[seed % SPRUECHE_TOD.length]}</p>
        <dl class="ob-end-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <div class="ob-row ob-center">
          ${this.koop === 'client' ? `<p class="ob-hint2">${t('Der Host entscheidet, wie es weitergeht …')}</p><button type="button" class="ob-btn2" data-act="lverlassen">${t('Raum verlassen')}</button>`
            : this.koop === 'host' ? `${s.victory ? `<button type="button" class="ob-btn2" data-act="endless">${t('Endlos weiter')}</button>` : ''}<button type="button" class="ob-go" data-act="lzurueck">${t('Zurück in die Lobby')}</button>`
            : `${s.victory ? `<button type="button" class="ob-btn2" data-act="endless">${t('Endlos weiter')}</button>` : ''}<button type="button" class="ob-go" data-act="restart">${t('Nochmal!')}</button>`}
          ${this.albumButton()}
        </div>
        ${this.tastenHinweis(t('Pfeiltasten + Enter · Gamepad: Steuerkreuz + A'), PAD_HINWEIS.menue)}
      </div>`, '[data-act="restart"], [data-act="lzurueck"]');
  }

  showPause(): void {
    this.show('pause', `
      <div class="ob-panel ob-end">
        <h2>${t('Pause')}</h2>
        <p class="ob-sub">${this.koop ? t('Achtung: Im Koop läuft das Spiel weiter!') : t('Kurz durchatmen. Die Grummelbolde warten (grummelnd).')}</p>
        <p class="ob-tipp">${t('Tipp:')} ${TIPPS[Math.floor(Date.now() / 1000) % TIPPS.length]}</p>
        <div class="ob-row ob-center">
          <button type="button" class="ob-go" data-act="resume">${t('Weiter')}</button>
          ${this.koop ? '' : `<button type="button" class="ob-btn2" data-act="restart">${t('Neu starten')}</button>`}
          ${this.beendenKnopf()}
          <button type="button" class="ob-btn2" data-act="einst">${t('Einstellungen')}</button>
          ${this.albumButton()}
        </div>
        ${this.tastenHinweis(t('Esc / P: Pause · WASD: laufen · Leertaste: Dash'), PAD_HINWEIS.spiel)}
      </div>`);
  }

  /** Hinweiszeile passend zur Eingabe (Tastatur, Controller, Touch = keine) */
  private tastenHinweis(tastatur: string, controller: string): string {
    if (this.controller) return `<p class="ob-keys ob-padkeys">${controller}</p>`;
    return this.touch ? '' : `<p class="ob-keys">${tastatur}</p>`;
  }

  /** „Beenden“: solo zurück zum Titel, im Koop Raum verlassen (immer mit Rückfrage) */
  private beendenKnopf(): string {
    return `<button type="button" class="ob-btn2 ob-beenden" data-act="beenden" data-focus="beenden">${this.koop ? t('Raum verlassen') : t('Beenden')}</button>`;
  }

  private zeigeAbbruch(): void {
    this.abbruchZurueck = this.mode === 'pause' ? 'pause' : 'shop';
    const text = this.koop === 'host' ? t('Du bist Host – wenn du gehst, endet das Spiel für alle Mitspieler.')
      : this.koop === 'client' ? t('Deine Mitspieler spielen ohne dich weiter.')
      : t('Der laufende Run endet. Freigeschaltete Karten, Helden und Erfolge bleiben erhalten.');
    this.show('abbruch', `
      <div class="ob-panel ob-end">
        <h2>${this.koop ? t('Raum verlassen?') : t('Run beenden?')}</h2>
        <p class="ob-sub">${text}</p>
        <div class="ob-row ob-center">
          <button type="button" class="ob-btn2" data-act="abbruchja" data-focus="abbruchja">${this.koop ? t('Ja, verlassen') : t('Ja, zum Titel')}</button>
          <button type="button" class="ob-go" data-act="abbruchnein" data-focus="abbruchnein">${t('Weiterspielen')}</button>
        </div>
      </div>`, '[data-act="abbruchnein"]');
  }

  private abbruchZurueckGehen(): void {
    if (this.abbruchZurueck === 'pause') this.showPause();
    else { this.mode = 'none'; this.lastKey = ''; this.sync(); }
  }

  /** Raumcode-Hinweis unter dem Feld aktualisieren (nur das Hinweis-Element – kein Neu-Rendern, Cursor bleibt) */
  private codeLive(feld: HTMLInputElement, fehler: boolean): ReturnType<typeof leseRaumcode> {
    const e = leseRaumcode(feld.value);
    // eingefügter Einladungslink → nur den Code im Feld lassen
    if (e.link && !fehler) feld.value = e.code;
    const h = codeHinweis(e, feld.value, fehler);
    const el = this.root.querySelector<HTMLElement>('[data-codehint]');
    if (el) { el.className = `ob-codehint ${h.klasse}`; el.innerHTML = h.html; }
    feld.classList.toggle('ob-fehler', fehler);
    return e;
  }

  /** „Beitreten“: Code erst selbst prüfen, sonst sichtbarer Hinweis direkt unter dem Feld */
  private beitreten(): void {
    this.name = this.readName();
    const feld = this.root.querySelector<HTMLInputElement>('input.ob-codein');
    if (!feld) return;
    const e = leseRaumcode(feld.value);
    if (e.code.length !== RAUMCODE_LAENGE || e.zuLang) {
      this.klick('nein');
      this.codeLive(feld, true);
      // Konsole: Feld schreibgeschützt anspringen (A öffnet die Bildschirmtastatur), wie MenuNav
      if (this.controller) { feld.dataset.navLock = '1'; feld.readOnly = true; }
      feld.focus({ preventScroll: true });
      feld.scrollIntoView({ block: 'nearest' });
      return;
    }
    feld.value = e.code;
    this.codeVorgabe = e.code;
    this.onCoop({ t: 'beitreten', code: e.code, name: this.name });
  }

  private readName(): string {
    return (this.root.querySelector<HTMLInputElement>('[data-name]')?.value ?? '').trim().slice(0, 16);
  }

  /* ---------------- Kartenalbum ---------------- */

  private albumButton(): string {
    const z = albumZaehler(this.profil());
    const neu = this.profil().neu.filter((id) => KARTE_BY_ID[id]).length;
    return `<button type="button" class="ob-btn2 ob-albumbtn" data-act="album" data-focus="album">${t('Kartenalbum {n}/{max}', { n: z.gefunden, max: KARTEN.length })}${neu ? ` <em class="ob-badge">${neu}</em>` : ''}</button>`;
  }

  private openAlbum(): void {
    this.albumBack = this.mode === 'pause' ? 'pause' : this.mode === 'end' ? 'end' : this.mode === 'shop' ? 'shop' : 'start';
    if (this.albumBack === 'shop') { this.detail = -1; this.fokusWunsch = 'tabalbum'; }
    this.albumKarte = '';
    this.albumScroll = 0;
    this.renderAlbum();
  }

  private closeAlbum(): void {
    this.albumKarte = '';
    if (this.albumBack === 'pause') this.showPause();
    else if (this.albumBack === 'end' && this.lastEnd) this.showEnd(this.lastEnd[0], this.lastEnd[1]);
    else { if (this.albumBack === 'shop') this.fokusWunsch = 'tabalbum'; this.mode = 'none'; this.lastKey = ''; this.sync(); }
  }

  private renderAlbum(): void {
    const pr = this.profil();
    const z = albumZaehler(pr);
    const k = this.albumKarte ? KARTE_BY_ID[this.albumKarte] : null;
    if (k) {
      this.show('album', `<div class="ob-panel ob-wide ob-album">${karteGross(pr, k)}</div>`, '[data-act="knext"]');
      const locked = !pr.karten[k.id];
      if (this.kunst) {
        this.root.querySelector('.ob-bc-art')?.appendChild(this.kunst.canvas);
        this.kunst.live(k, locked);
      }
      if (pr.neu.includes(k.id)) this.gesehen(k.id);
      return;
    }
    const tabs = ALBUM_TABS.map((tb) => `<button type="button" class="ob-tab ${this.albumTab === tb.id ? 'on' : ''}" data-act="atab" data-tab="${tb.id}" data-focus="atab${tb.id}">${tb.name}</button>`).join('');
    const body = this.albumTab === 'erfolge'
      ? erfolgeHtml(pr, this.profilCode(), this.importFehler)
      : `${this.albumTab === 'rezept' ? `<p class="ob-sub">${t('Das Rezeptbuch: Unentdeckte Rezepte zeigen nur ihren Hinweis – antippen!')}</p>` : ''}<div class="ob-kgrid">${albumGrid(pr, this.albumTab)}</div>`;
    const zaehler = t('Set „{set}" · {n}/{max} gefunden · ✦ {glanz} Glanz', { set: WELT_INFO.kartenSet, n: z.gefunden, max: KARTEN.length, glanz: z.glanz });
    if (this.albumBack === 'shop') {
      // als vierter Shop-Reiter: Reiterleiste und Aktionsleiste bleiben
      this.show('album', `
        <div class="ob-panel ob-wide ob-shop ob-album">
          ${this.shopKopf('album')}
          <small class="ob-sub">${zaehler}</small>
          <div class="ob-tabs ob-subtabs">${tabs}</div>
          ${this.shopAktionen('album')}
          ${this.werteListe()}
          ${body}
        </div>`, `[data-focus="atab${this.albumTab}"]`);
    } else {
      this.show('album', `
        <div class="ob-panel ob-wide ob-album">
          <div class="ob-shop-head">
            <div><h2 class="ob-h">${t('Kartenalbum')}</h2><small class="ob-sub">${zaehler}</small></div>
            <button type="button" class="ob-go" data-act="albumzu" data-focus="albumzu">${t('Zurück')}</button>
          </div>
          <div class="ob-tabs ob-subtabs">${tabs}</div>
          ${body}
        </div>`, `[data-focus="atab${this.albumTab}"]`);
    }
    this.root.scrollTop = this.albumScroll;
  }

  /** jedes Frame: Vorschaubilder nach und nach erzeugen, Live-Artwork drehen */
  frame(time: number): void {
    if (this.mode !== 'album' || !this.kunst) return;
    if (this.albumKarte) { this.kunst.update(time); return; }
    let n = 0;
    for (const img of this.root.querySelectorAll<HTMLImageElement>('img[data-thumb]:not([src])')) {
      const k = KARTE_BY_ID[img.dataset.thumb!];
      if (!k) continue;
      const locked = img.dataset.locked === '1';
      const cached = this.kunst.hasThumb(k, locked);
      img.src = this.kunst.thumb(k, locked);
      if (!cached && ++n >= 6) break;
    }
  }

  private albumSchritt(d: number): void {
    const list = kartenListe(this.albumTab);
    const i = list.findIndex((k) => k.id === this.albumKarte);
    this.albumKarte = list[(i + d + list.length) % list.length].id;
    this.renderAlbum();
  }

  private openEinstellungen(): void {
    this.einstBack = this.mode === 'pause' ? 'pause' : 'titel';
    this.renderEinstellungen();
  }

  private renderEinstellungen(): void {
    this.show('einst', einstellungenHtml(this.einstellungen, this.qualiInfo()), '[data-act="setzu"]');
  }

  private closeEinstellungen(): void {
    if (this.einstBack === 'pause') this.showPause();
    else { this.mode = 'none'; this.sync(); }
  }

  /** Einmaliger Datenschutz-Hinweis vor dem ersten Koop-Raum; `weiter` läuft nach „Verstanden“ */
  zeigeKoopHinweis(weiter: () => void): void {
    this.koopWeiter = weiter;
    this.show('koophinweis', koopHinweisHtml(), '[data-act="khok"]');
  }

  private zeigeRechtliches(von: 'einst' | 'koophinweis'): void {
    this.rechtZurueck = von;
    this.show('recht', rechtlichesHtml(), '[data-act="rechtzu"]');
  }

  private schliesseRechtliches(): void {
    if (this.rechtZurueck === 'koophinweis') this.show('koophinweis', koopHinweisHtml(), '[data-act="khok"]');
    else this.renderEinstellungen();
  }

  private koopAbbrechen(): void {
    this.koopWeiter = null;
    this.mode = 'none';
    this.sync();
  }

  /** Zurück-Taste (Esc / Gamepad B) */
  back(): boolean {
    if (this.mode === 'abbruch') { this.abbruchZurueckGehen(); return true; }
    if (this.mode === 'recht') { this.schliesseRechtliches(); return true; }
    if (this.mode === 'koophinweis') { this.koopAbbrechen(); return true; }
    if (this.mode === 'einst') { this.closeEinstellungen(); return true; }
    if (this.mode === 'start' && !this.startHeld && this.screen === 'solo') { this.screen = 'titel'; this.mode = 'none'; this.sync(); return true; }
    if (this.mode === 'lobby') { this.onCoop({ t: 'verlassen' }); return true; }
    if (this.mode === 'album') {
      if (this.albumKarte) { this.albumKarte = ''; this.renderAlbum(); } else this.closeAlbum();
      return true;
    }
    if (this.mode === 'shop' && this.detail >= 0) { this.detail = -1; this.sync(); return true; }
    if (this.mode === 'start' && this.startHeld) { this.startHeld = ''; this.mode = 'none'; this.sync(); return true; }
    if (this.mode === 'pause') { this.hide(); this.onResume(); return true; }
    return false;
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    this.klick(el.dataset.act === 'buy' ? 'kauf' : 'klick');
    const i = Number(el.dataset.i ?? -1);
    switch (el.dataset.act) {
      case 'held': this.startHeld = el.dataset.id!; this.mode = 'none'; break;
      case 'heldzurueck': this.startHeld = ''; this.mode = 'none'; break;
      case 'insel': this.mapSel = el.dataset.id!; this.mode = 'none'; break;
      case 'go': if (inselFrei(this.profil(), this.mapSel)) { this.send({ type: 'start', held: this.startHeld, insel: this.mapSel, gefahr: Math.min(this.gefahr, this.profil().gefahrFrei) }); this.startHeld = ''; this.hide(); } return;
      case 'gefahr': {
        const n = Math.max(0, Math.min(this.profil().gefahrFrei, this.gefahr + Number(el.dataset.d)));
        if (this.mode === 'lobby') { this.onCoop({ t: 'gefahr', n: Math.max(0, Math.min(this.coop?.gefahrFrei ?? 0, (this.coop?.gefahr ?? 0) + Number(el.dataset.d))) }); return; }
        this.gefahr = n;
        this.renderMap();
        return;
      }
      case 'upgrade': this.send({ type: 'upgrade', index: i }); break;
      // Notausgang, falls die Wahl einmal hängt: normaler Befehl mit zufälligem Index
      case 'upskip': this.send({ type: 'upgrade', index: Math.floor(Math.random() * Math.max(1, this.p.upgradeOffers.length)) }); break;
      case 'buy': this.send({ type: 'buy', index: i }); break;
      case 'lock': this.send({ type: 'lock', index: i }); break;
      case 'reroll': this.send({ type: 'reroll' }); break;
      case 'slot': this.detail = this.detail === i ? -1 : i; break;
      case 'close': this.detail = -1; break;
      case 'merge': this.send({ type: 'merge', slot: i }); this.detail = -1; break;
      case 'evolve': this.send({ type: 'evolve', slot: i, variant: el.dataset.v === 'b' ? 'b' : 'a' }); break;
      case 'install': this.send({ type: 'installMod', slot: i, index: Number(el.dataset.k) }); break;
      case 'sell': this.send({ type: 'sell', slot: i }); this.detail = -1; break;
      case 'stats': this.showStats = !this.showStats; if (this.mode === 'album') { this.renderAlbum(); return; } break;
      case 'album': this.openAlbum(); return;
      case 'einst': this.openEinstellungen(); return;
      case 'recht': this.zeigeRechtliches('einst'); return;
      case 'beenden': this.zeigeAbbruch(); return;
      case 'abbruchnein': this.abbruchZurueckGehen(); return;
      case 'abbruchja': this.mode = 'none'; this.hide(); if (this.koop) this.onCoop({ t: 'verlassen' }); else this.onZumTitel(); return;
      case 'rechtzu': this.schliesseRechtliches(); return;
      case 'khok': { const f = this.koopWeiter; this.koopWeiter = null; this.mode = 'none'; this.sync(); f?.(); return; }
      case 'khmehr': this.zeigeRechtliches('koophinweis'); return;
      case 'khab': this.koopAbbrechen(); return;
      case 'setzu': this.closeEinstellungen(); return;
      case 'setsprache': if (el.dataset.l) this.onSprache(el.dataset.l); return;
      case 'setmusik': this.einstellungen = { ...this.einstellungen, musikStil: el.dataset.m as Einstellungen['musikStil'] }; this.onEinstellungen(this.einstellungen); this.renderEinstellungen(); return;
      case 'setq': this.einstellungen = { ...this.einstellungen, qualitaet: el.dataset.q as Einstellungen['qualitaet'] }; this.onEinstellungen(this.einstellungen); this.renderEinstellungen(); return;
      case 'settoggle': {
        const k = el.dataset.key as 'zahlen' | 'vibration' | 'farbenblind';
        this.einstellungen = { ...this.einstellungen, [k]: !this.einstellungen[k] };
        this.onEinstellungen(this.einstellungen);
        this.renderEinstellungen();
        return;
      }
      case 'tsolo': this.screen = 'solo'; this.mode = 'none'; break;
      case 'tbeenden': this.onBeenden?.(); return;
      case 'tweiter': this.onFortsetzen?.(); return;
      case 'terstellen': this.name = this.readName(); this.onCoop({ t: 'erstellen', name: this.name }); return;
      case 'tbeitreten': this.beitreten(); return;
      case 'lheld': this.onCoop({ t: 'held', id: el.dataset.id! }); return;
      case 'linsel': this.onCoop({ t: 'insel', id: el.dataset.id! }); return;
      case 'lbereit': { const ich = this.coop?.spieler.find((x) => x.slot === this.coop?.slot); this.onCoop({ t: 'bereit', on: !ich?.bereit }); return; }
      case 'lstart': this.onCoop({ t: 'start' }); return;
      case 'lteilen': this.onCoop({ t: 'teilen' }); return;
      case 'lverlassen': this.onCoop({ t: 'verlassen' }); return;
      case 'lzurueck': this.onCoop({ t: 'lobby' }); return;
      case 'albumzu': this.closeAlbum(); return;
      case 'atab': this.albumTab = el.dataset.tab as AlbumTab; this.albumScroll = 0; this.importFehler = false; this.renderAlbum(); return;
      case 'karte': this.albumScroll = this.root.scrollTop; this.albumKarte = el.dataset.id!; this.renderAlbum(); return;
      case 'kprev': this.albumSchritt(-1); return;
      case 'knext': this.albumSchritt(1); return;
      case 'kzu': this.albumKarte = ''; this.renderAlbum(); return;
      case 'kbild': {
        const k = KARTE_BY_ID[this.albumKarte];
        if (k) this.exportBild(k, this.profil().karten[k.id] === 2);
        return;
      }
      case 'kcopy': this.kopieren(this.profilCode()); return;
      case 'kimport': {
        const code = this.root.querySelector<HTMLTextAreaElement>('[data-import]')?.value ?? '';
        this.importFehler = !this.importCode(code);
        this.renderAlbum();
        return;
      }
      case 'tab': {
        if (el.dataset.tab === 'album') { if (this.mode !== 'album') this.openAlbum(); return; }
        this.tab = el.dataset.tab === 'amboss' ? 'amboss' : el.dataset.tab === 'ausruestung' ? 'ausruestung' : 'shop';
        this.detail = -1;
        // vom Album-Reiter zurück in den Shop
        if (this.mode === 'album') { this.albumKarte = ''; this.mode = 'none'; this.fokusWunsch = el.dataset.focus ?? ''; }
        break;
      }
      case 'equip': this.send({ type: 'equip', index: i, platz: (el.dataset.platz || undefined) as never }); break;
      case 'unequip': this.send({ type: 'unequip', platz: el.dataset.platz as never }); break;
      case 'scrap': this.send({ type: 'scrap', index: i }); break;
      case 'pick': {
        const k = this.anvilSel.indexOf(i);
        if (k >= 0) this.anvilSel = this.anvilSel.filter((x) => x !== i);
        else if (this.anvilSel.length < 3) this.anvilSel = [...this.anvilSel, i];
        this.defaultParts();
        break;
      }
      case 'part': this.parts = { ...this.parts, [el.dataset.part as 'geschoss']: i }; break;
      case 'fuse': if (this.send(this.fuseCmd())) this.resetAnvil(); break;
      case 'book': this.book = !this.book; break;
      case 'ready': this.detail = -1; if (this.send({ type: 'ready' })) { this.albumKarte = ''; this.hide(); } break;
      case 'restart': this.hide(); this.onRestart(); return;
      case 'resume': this.hide(); this.onResume(); return;
      case 'endless': if (this.send({ type: 'endless' })) { this.mode = 'none'; this.sync(); } return;
    }
    this.sync();
  }
}

/** alles, was die Menü-Navigation anspringen darf */
const NAV_ZIELE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])';
const istText = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range'));
const istRegler = (el: Element | null): el is HTMLInputElement => !!el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range';

/**
 * Menü-Steuerung mit Gamepad und Pfeiltasten: Fokus springt räumlich zum nächsten Element
 * in der gedrückten Richtung, A/Enter löst aus, B/Esc geht zurück.
 * Regler: links/rechts verstellt den Wert. Textfelder: Navigation springt nur hin
 * (schreibgeschützt, damit keine Bildschirmtastatur aufpoppt), A öffnet die Eingabe.
 */
export class MenuNav {
  private repeat = 0;
  private held = '';
  private aWas = true;
  private bWas = true;
  onBack: () => void = () => {};
  /** Textfelder erst mit A öffnen (Konsole: sonst poppt beim Durchblättern die Bildschirmtastatur auf) */
  textSperre = false;

  constructor(private root: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (this.root.classList.contains('hidden')) return;
      // Pfeiltasten und (bei manchen Konsolen-Browsern) Gamepad-Tasten als Tastendruck
      const dir = ({ ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' } as Record<string, string>)[e.code]
        ?? ({ GamepadDPadUp: 'u', GamepadDPadDown: 'd', GamepadDPadLeft: 'l', GamepadDPadRight: 'r' } as Record<string, string>)[e.key];
      const cur = document.activeElement;
      // im offenen Textfeld bewegen links/rechts den Cursor
      if (dir && istText(cur) && !cur.readOnly && (dir === 'l' || dir === 'r')) return;
      if (dir) { this.move(dir); e.preventDefault(); return; }
      if ((e.code === 'Enter' || e.key === 'GamepadA') && istText(cur) && cur.readOnly) { this.bearbeiten(cur); e.preventDefault(); }
    });
    // Textfeld verlassen → wieder schreibgeschützt (bis zum nächsten A)
    this.root.addEventListener('focusout', (e) => {
      const el = e.target as Element;
      if (istText(el) && el.dataset.navLock === '1') el.readOnly = true;
    });
  }

  update(dt: number): void {
    if (this.root.classList.contains('hidden')) { this.aWas = this.bWas = true; return; }
    const pads = navigator.getGamepads?.() ?? [];
    let dir = '', a = false, b = false;
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
      if (p.buttons[12]?.pressed || ay < -0.6) dir = 'u';
      else if (p.buttons[13]?.pressed || ay > 0.6) dir = 'd';
      else if (p.buttons[14]?.pressed || ax < -0.6) dir = 'l';
      else if (p.buttons[15]?.pressed || ax > 0.6) dir = 'r';
      a = !!p.buttons[0]?.pressed;
      b = !!p.buttons[1]?.pressed;
      break;
    }
    if (dir) {
      if (dir !== this.held) { this.held = dir; this.repeat = 0.35; this.move(dir); }
      else if ((this.repeat -= dt) <= 0) { this.repeat = istRegler(document.activeElement) ? 0.06 : 0.12; this.move(dir); }
    } else this.held = '';
    if (a && !this.aWas) this.druecken();
    if (b && !this.bWas) this.onBack();
    this.aWas = a; this.bWas = b;
  }

  /** A gedrückt: Knopf auslösen bzw. Textfeld zur Eingabe öffnen */
  private druecken(): void {
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !this.root.contains(cur)) return;
    if (istText(cur)) { this.bearbeiten(cur); return; }
    if (cur.tagName === 'BUTTON') cur.click();
  }

  private bearbeiten(el: HTMLInputElement | HTMLTextAreaElement): void {
    delete el.dataset.navLock;
    el.readOnly = false;
    // neu fokussieren, damit die Bildschirmtastatur erscheint
    el.blur();
    el.focus();
    const n = el.value.length;
    try { el.setSelectionRange(n, n); } catch { /* nicht jedes Feld kann das */ }
  }

  private fokus(el: HTMLElement): void {
    if (istText(el) && this.textSperre) { el.dataset.navLock = '1'; el.readOnly = true; }
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }

  private move(dir: string): void {
    const list = [...this.root.querySelectorAll<HTMLElement>(NAV_ZIELE)].filter((el) => el.offsetParent !== null);
    if (!list.length) return;
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !list.includes(cur)) { this.fokus(list[0]); return; }
    // Regler: links/rechts verstellt den Wert
    if (istRegler(cur) && (dir === 'l' || dir === 'r')) {
      const step = Number(cur.step) || 1, min = Number(cur.min || 0), max = Number(cur.max || 100);
      const v = Math.max(min, Math.min(max, Math.round((Number(cur.value) + (dir === 'r' ? step : -step)) / step) * step));
      if (v !== Number(cur.value)) { cur.value = String(+v.toFixed(4)); cur.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null, bs = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect();
      const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      const main = dir === 'u' ? -dy : dir === 'd' ? dy : dir === 'l' ? -dx : dx;
      const side = dir === 'u' || dir === 'd' ? Math.abs(dx) : Math.abs(dy);
      if (main <= 4) continue;
      const score = main + side * 2;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) this.fokus(best);
  }
}
