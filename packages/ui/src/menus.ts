import {
  canMerge, fusionPreview, rerollPrice, sellPrice, weaponDamage, weaponRange, weaponRate,
  type Command, type Player, type World, type WeaponSlot
} from '@overboom/core';
import {
  A, AMBOSS, G, ITEM_BY_ID, L, REZEPTE, SELTENHEIT, waffeById, type Waffe, SPIELER, STAT_INFO, STAT_KEYS, TIER_ZAHL, UPGRADE_BY_ID, W, WELLEN,
  elemente, type StatKey
} from '@overboom/data';

const GEM = '<i class="ob-gem" aria-hidden="true"></i>';
const LOCK_ON = '<svg viewBox="0 0 8 9" width="16" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 0h4v1h1v3h1v5h-8v-5h1v-3h1zM2 1v3h4v-3zM3 5v2h2v-2z"/></svg>';
const LOCK_OFF = '<svg viewBox="0 0 8 9" width="16" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 0h3v1h1v2h-1v-2h-3v3h4v6h-8v-5h3v-4zM3 5v2h2v-2z"/></svg>';

const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('de-DE');
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v));

function statLine(k: StatKey, v: number): string {
  const info = STAT_INFO[k];
  const good = v >= 0;
  return `<li class="${good ? 'up' : 'down'}">${signed(v)}${info.einheit ? ' %' : ''} ${info.name}</li>`;
}

function rarity(tier: number): string {
  return `style="--rc:${SELTENHEIT[Math.max(0, Math.min(4, tier - 1))].farbe}"`;
}

/** Werte einer Waffe so, wie sie mit den aktuellen Spielerwerten feuern würde */
function weaponLines(p: Player, w: Waffe, tier: number): string {
  const slot = { waffe: w, tier } as WeaponSlot;
  const el = w.fusion ? w.fusion.elemente : elemente(w);
  const fu = w.fusion ? `<li class="ob-part"><b>Geschoss:</b> ${G[w.geschoss].name}</li>` : '';
  return `<ul class="ob-lines">
    <li>Schaden <b>${fmt(weaponDamage(p, slot))}</b></li>
    <li>Feuerrate <b>${fmt(weaponRate(p, slot))}/s</b></li>
    <li>Reichweite <b>${fmt(weaponRange(p, slot))} m</b></li>
    ${fu}<li class="ob-part"><b>${A[w.antrieb].name}:</b> ${A[w.antrieb].text}</li>
    <li class="ob-part"><b>${L[w.ladung].name}:</b> ${L[w.ladung].text}</li>
  </ul>${w.fusion ? instabilBar(w.fusion.instabil) : ''}${el.length ? `<div class="ob-tags">${el.map((e) => `<span>${e}</span>`).join('')}</div>` : ''}`;
}

function instabilBar(v: number): string {
  return `<div class="ob-instabil" title="Bei Krit kann es spontan Kawumm machen"><span>Instabil ${v} %</span><i style="width:${v}%"></i></div>`;
}

function weaponTitle(w: Waffe, tier: number): string {
  return `${w.name} <span class="ob-tier">${TIER_ZAHL[tier - 1]}</span>`;
}

/** Name des Bauteils, das eine Waffe beisteuert */
function partName(w: Waffe, part: 'geschoss' | 'antrieb' | 'ladung'): string {
  return part === 'geschoss' ? G[w.geschoss].name : part === 'antrieb' ? A[w.antrieb].name : L[w.ladung].name;
}

export interface EndStats {
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

const SPRUECHE_TOD = [
  'Kawumm! Das war wohl zu viel Kawumm.',
  'Die Grummelbolde grummeln zufrieden.',
  'Die Bomben-Kröten quaken ein Siegeslied.',
  'Der Toastomat toastet auf deinen Untergang.',
  'Baron von Bumm zwirbelt zufrieden den Schnurrbart.'
];

/**
 * Alle Menü-Overlays. Liest den Weltzustand, ändert ihn aber nie selbst –
 * jede Aktion wird als Befehl (`send`) an die Simulation geschickt.
 */
export class Menus {
  readonly root: HTMLDivElement;
  private mode: 'none' | 'start' | 'shop' | 'end' | 'pause' = 'none';
  private detail = -1;
  private showStats = false;
  private tab: 'shop' | 'amboss' = 'shop';
  /** Amboss: gewählte Waffenplätze und wer welches Bauteil liefert (Index in anvilSel) */
  private anvilSel: number[] = [];
  private parts = { geschoss: 0, antrieb: 1, ladung: 2 };
  private book = false;
  private shopWave = -1;
  private lastKey = '';
  onRestart: () => void = () => {};
  onResume: () => void = () => {};

  constructor(parent: HTMLElement, private world: World, private send: (cmd: Command) => boolean, private touch: boolean, private recipes: () => ReadonlySet<string> = () => new Set()) {
    this.root = document.createElement('div');
    this.root.className = 'ob-menu hidden';
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  get open(): boolean { return this.mode !== 'none'; }
  get current(): string { return this.mode; }

  private get p(): Player { return this.world.players[0]; }

  hide(): void {
    this.mode = 'none';
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
    this.lastKey = '';
  }

  private show(mode: typeof this.mode, html: string, focusSel?: string): void {
    const keep = this.mode === mode ? (document.activeElement as HTMLElement | null)?.dataset?.focus : undefined;
    this.mode = mode;
    this.root.classList.remove('hidden');
    this.root.innerHTML = html;
    // Fokus erhalten bzw. sinnvoll setzen (Gamepad/Tastatur)
    const el = (keep && this.root.querySelector<HTMLElement>(`[data-focus="${keep}"]:not([disabled])`))
      || (focusSel ? this.root.querySelector<HTMLElement>(focusSel) : null)
      || this.root.querySelector<HTMLElement>('button:not([disabled])');
    el?.focus({ preventScroll: true });
  }

  /** Wird jedes Frame aufgerufen; baut nur neu, wenn sich der Zustand geändert hat. */
  sync(): void {
    const w = this.world, p = this.p;
    if (this.mode === 'pause' || this.mode === 'end') return;
    if (w.phase === 'wahl') {
      if (this.mode !== 'start') this.renderStart();
      return;
    }
    if (w.phase === 'shop') {
      if (this.shopWave !== w.wave) { this.shopWave = w.wave; this.tab = 'shop'; this.resetAnvil(); }
      const key = JSON.stringify([w.wave, p.crystals, p.pendingLevels, p.upgradeOffers, p.offers, p.loadout, p.weapons.map((s) => s.tier), this.detail, this.showStats, p.ready,
        this.tab, this.anvilSel, this.parts, this.book, this.recipes().size]);
      if (this.mode !== 'shop' || key !== this.lastKey) { this.lastKey = key; this.renderShop(); }
      return;
    }
    if (this.mode === 'start' || this.mode === 'shop') this.hide();
  }

  /* ---------------- Startwahl ---------------- */

  private renderStart(): void {
    const p = this.p;
    const cards = SPIELER.startAuswahl.map((id, i) => `
      <button type="button" class="ob-card" ${rarity(1)} data-act="start" data-id="${id}" data-focus="start${i}">
        <span class="ob-kind">Startwaffe · ${W[id].gruppe}</span>
        <span class="ob-name">${W[id].name}</span>
        ${weaponLines(p, W[id], 1)}
        <span class="ob-flavor">${W[id].text}</span>
      </button>`).join('');
    this.show('start', `
      <div class="ob-panel ob-wide">
        <h2 class="ob-h">Wähle deine Startwaffe</h2>
        <p class="ob-sub">Alle Waffen feuern von selbst. Du läufst, weichst aus – und kaufst nach jeder Welle nach.</p>
        <div class="ob-cards">${cards}</div>
      </div>`);
  }

  /* ---------------- Shop & Level-Up ---------------- */

  private renderShop(): void {
    const w = this.world, p = this.p;
    if (p.pendingLevels > 0) {
      const cards = p.upgradeOffers.map((o, i) => {
        const u = UPGRADE_BY_ID[o.id];
        return `<button type="button" class="ob-card ob-up" ${rarity(o.tier)} data-act="upgrade" data-i="${i}" data-focus="up${i}">
          <span class="ob-kind">${SELTENHEIT[o.tier - 1].name}</span>
          <span class="ob-name">${u.name}</span>
          <ul class="ob-lines">${statLine(u.stat, u.werte[o.tier - 1])}</ul>
          <span class="ob-flavor">${STAT_INFO[u.stat].text}</span>
        </button>`;
      }).join('');
      this.show('shop', `
        <div class="ob-panel ob-wide">
          <h2 class="ob-h ob-gold">Level ${p.level - p.pendingLevels + 1}!</h2>
          <p class="ob-sub">Wähle eine Verbesserung${p.pendingLevels > 1 ? ` · noch ${p.pendingLevels}` : ''}</p>
          <div class="ob-cards">${cards}</div>
        </div>`);
      return;
    }

    const offers = p.offers.map((o, i) => {
      if (o.sold) return `<div class="ob-card ob-sold" ${rarity(o.tier)}><span class="ob-name">Verkauft</span></div>`;
      const afford = p.crystals >= o.price;
      let body: string, kind: string, title: string;
      if (o.kind === 'waffe') {
        kind = `Waffe · ${W[o.id].gruppe}`;
        title = weaponTitle(W[o.id], o.tier);
        body = weaponLines(p, W[o.id], o.tier);
        if (p.weapons.length >= SPIELER.maxWaffen && !p.weapons.some((s) => s.waffe.id === o.id && s.tier === o.tier && s.tier < 5)) body += '<span class="ob-warn">Kein Platz mehr</span>';
        else if (p.weapons.some((s) => s.waffe.id === o.id && s.tier === o.tier)) body += '<span class="ob-hint2">Gleiche Waffe da – verschmelzbar!</span>';
      } else {
        const it = ITEM_BY_ID[o.id];
        kind = `Item · ${SELTENHEIT[it.seltenheit - 1].name}${p.items[o.id] ? ` · hast ${p.items[o.id]}` : ''}`;
        title = it.name;
        body = `<ul class="ob-lines">${(Object.keys(it.werte) as StatKey[]).map((k) => statLine(k, it.werte[k]!)).join('')}${it.spezial ? '<li class="ob-part">Explodiert, wenn du getroffen wirst</li>' : ''}</ul><span class="ob-flavor">${it.text}</span>`;
      }
      return `<div class="ob-card ${o.locked ? 'locked' : ''}" ${rarity(o.tier)}>
        <span class="ob-kind">${kind}</span>
        <span class="ob-name">${title}</span>
        ${body}
        <div class="ob-buy">
          <button type="button" class="ob-price" data-act="buy" data-i="${i}" data-focus="buy${i}" ${afford ? '' : 'disabled'}>${GEM}${o.price}</button>
          <button type="button" class="ob-lock ${o.locked ? 'on' : ''}" data-act="lock" data-i="${i}" data-focus="lock${i}" aria-label="${o.locked ? 'Entsperren' : 'Sperren'}" title="Sperren: bleibt beim Reroll und in der nächsten Runde">${o.locked ? LOCK_ON : LOCK_OFF}</button>
        </div>
      </div>`;
    }).join('');

    const slots = Array.from({ length: SPIELER.maxWaffen }, (_, i) => {
      const s = p.weapons[i];
      if (!s) return `<div class="ob-slot empty"></div>`;
      const m = canMerge(p, i);
      return `<button type="button" class="ob-slot ${this.detail === i ? 'sel' : ''}" ${rarity(s.tier)} data-act="slot" data-i="${i}" data-focus="slot${i}">
        <span>${s.waffe.name}</span><b>${TIER_ZAHL[s.tier - 1]}</b>${m ? '<em>⇧</em>' : ''}${s.waffe.fusion ? '<i class="ob-fz">⚒</i>' : ''}
      </button>`;
    }).join('');

    let detail = '';
    const ds = p.weapons[this.detail];
    if (ds) {
      const dmg = w.stats.waffen[ds.waffe.id] ?? 0;
      detail = `<div class="ob-detail" ${rarity(ds.tier)}>
        <div class="ob-name">${weaponTitle(ds.waffe, ds.tier)}</div>
        ${weaponLines(p, ds.waffe, ds.tier)}
        <p class="ob-flavor">${ds.waffe.text}${dmg ? ` · bisher ${fmt(dmg)} Schaden` : ''}</p>
        <div class="ob-row">
          <button type="button" class="ob-btn2" data-act="merge" data-i="${this.detail}" data-focus="merge" ${canMerge(p, this.detail) ? '' : 'disabled'}>Verschmelzen ⇧</button>
          <button type="button" class="ob-btn2" data-act="sell" data-i="${this.detail}" data-focus="sell" ${p.weapons.length > 1 ? '' : 'disabled'}>Verkaufen +${sellPrice(ds, w.wave + 1)}</button>
          <button type="button" class="ob-btn2" data-act="close" data-focus="close">Schließen</button>
        </div>
      </div>`;
    }

    const items = Object.entries(p.items).map(([id, n]) => `<span class="ob-chip" ${rarity(ITEM_BY_ID[id].seltenheit)} title="${ITEM_BY_ID[id].text}">${ITEM_BY_ID[id].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('') || '<span class="ob-none">noch keine</span>';

    const stats = this.showStats ? `<ul class="ob-stats">${STAT_KEYS.map((k) => {
      const v = k === 'maxHp' ? p.maxHp : p.stats[k];
      const cls = k === 'maxHp' ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '';
      return `<li class="${cls}"><span>${STAT_INFO[k].name}</span><b>${fmt(v)}${STAT_INFO[k].einheit ? ' %' : ''}</b></li>`;
    }).join('')}</ul>` : '';

    const reroll = rerollPrice(w, p);
    this.show('shop', `
      <div class="ob-panel ob-wide ob-shop">
        <div class="ob-shop-head">
          <div class="ob-tabs">
            <button type="button" class="ob-tab ${this.tab === 'shop' ? 'on' : ''}" data-act="tab" data-tab="shop" data-focus="tabshop">Shop</button>
            <button type="button" class="ob-tab ${this.tab === 'amboss' ? 'on' : ''}" data-act="tab" data-tab="amboss" data-focus="tabamboss">⚒ Amboss</button>
            <small>Welle ${w.wave} geschafft</small>
          </div>
          <div class="ob-wallet">${GEM}<b>${p.crystals}</b></div>
        </div>
        ${this.tab === 'shop' ? `<div class="ob-cards">${offers}</div>` : this.renderAnvil()}
        <div class="ob-row ob-actions">
          ${this.tab === 'shop' ? `<button type="button" class="ob-btn2" data-act="reroll" data-focus="reroll" ${p.crystals >= reroll ? '' : 'disabled'}>Neu würfeln ${GEM}${reroll}</button>` : ''}
          <button type="button" class="ob-btn2" data-act="stats" data-focus="stats">${this.showStats ? 'Werte ausblenden' : 'Werte'}</button>
          <button type="button" class="ob-go" data-act="ready" data-focus="ready">Welle ${w.wave + 1}${WELLEN.bossWellen.includes(w.wave + 1) ? ' · Boss!' : ''} ▶</button>
        </div>
        <h3 class="ob-h3">Waffen ${p.weapons.length}/${SPIELER.maxWaffen} <small>antippen: verschmelzen / verkaufen</small></h3>
        <div class="ob-slots">${slots}</div>
        ${detail}
        <h3 class="ob-h3">Items</h3>
        <div class="ob-items">${items}</div>
        ${stats}
      </div>`, this.detail >= 0 ? '[data-act="merge"]:not([disabled]), [data-act="sell"]:not([disabled])' : '[data-act="buy"]:not([disabled]), [data-act="ready"]');
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
    const picks = Array.from({ length: SPIELER.maxWaffen }, (_, i) => {
      const s = p.weapons[i];
      if (!s) return `<div class="ob-slot empty"></div>`;
      const k = this.anvilSel.indexOf(i);
      const dis = !!s.waffe.fusion;
      return `<button type="button" class="ob-slot ${k >= 0 ? 'sel' : ''}" ${rarity(s.tier)} data-act="pick" data-i="${i}" data-focus="pick${i}" ${dis ? 'disabled title="Fusionen lassen sich nur mergen"' : ''}>
        <span>${s.waffe.name}</span><b>${s.waffe.gruppe}</b>${k >= 0 ? `<em>${k + 1}</em>` : ''}
      </button>`;
    }).join('');

    let parts = '', preview = '';
    if (this.anvilSel.length >= 2) {
      const ws = this.anvilSel.map((i) => p.weapons[i].waffe);
      const row = (part: 'geschoss' | 'antrieb' | 'ladung', label: string) => `
        <div class="ob-partrow"><span class="ob-partlabel">${label}</span>
          ${ws.map((wf, k) => `<button type="button" class="ob-part-btn ${this.parts[part] === k ? 'on' : ''}" data-act="part" data-part="${part}" data-i="${k}" data-focus="${part}${k}">
            ${partName(wf, part)}<small>${wf.name}</small></button>`).join('')}
        </div>`;
      parts = `<h3 class="ob-h3">2 · Bauteile zuordnen <small>jede Waffe liefert mindestens eins</small></h3>
        <div class="ob-parts">${row('geschoss', 'Geschoss – was fliegt')}${row('antrieb', 'Antrieb – wie es fliegt')}${row('ladung', 'Ladung – was passiert')}</div>`;
      const v = fusionPreview(w, p, this.fuseCmd());
      if (v.waffe) {
        const rz = v.waffe.fusion?.rezept;
        const secret = rz && !known.has(rz);
        preview = `<div class="ob-card ob-preview ${rz ? 'recipe' : ''}" ${rarity(rz ? 5 : v.tier)}>
          <span class="ob-kind">${rz ? 'Geheimes Rezept' : 'Fusionswaffe'} · ${v.waffe.fusion!.gruppen.join(' · ')}</span>
          <span class="ob-name">${secret ? '??? <small>Was passiert da wohl …</small>' : weaponTitle(v.waffe, v.tier)}</span>
          ${secret ? '<p class="ob-flavor">Diese Zutaten kennt der Amboss. Verschmelze sie, um das Rezept zu entdecken!</p>' : `${weaponLines(p, v.waffe, v.tier)}<span class="ob-flavor">${v.waffe.text}</span>`}
        </div>`;
      }
      const err = v.error ? `<p class="ob-warn">${v.error}</p>` : '';
      preview += `${err}<div class="ob-row"><button type="button" class="ob-go" data-act="fuse" data-focus="fuse" ${v.error ? 'disabled' : ''}>Verschmelzen! ${GEM}${price}</button></div>`;
    } else {
      parts = `<p class="ob-sub">Wähle 2 oder 3 Waffen aus <b>verschiedenen Gruppen</b>. Jede liefert ein Bauteil – Geschoss, Antrieb oder Ladung – und es entsteht eine ganz neue Waffe. Je verschiedener die Gruppen, desto instabiler … und stärker.</p>`;
    }

    const book = this.book ? `<ul class="ob-book">${REZEPTE.map((r) => known.has(r.id)
      ? `<li class="found"><b>${r.name}</b><span>${r.zutaten.map((z) => W[z].name).join(' + ')}</span></li>`
      : `<li><b>???</b><span>${r.hinweis}</span></li>`).join('')}</ul>` : '';

    return `<div class="ob-anvil">
      <h3 class="ob-h3">1 · Waffen wählen <small>Schmiedelohn ${GEM}${price}</small></h3>
      <div class="ob-slots">${picks}</div>
      ${parts}
      ${preview}
      <div class="ob-row"><button type="button" class="ob-btn2" data-act="book" data-focus="book">Rezeptbuch ${known.size}/${REZEPTE.length}</button></div>
      ${book}
    </div>`;
  }

  /* ---------------- Ende & Pause ---------------- */

  showEnd(s: EndStats, seed: number): void {
    const rows: [string, string | number][] = [
      ['Welle', s.wave],
      ['Level', s.level],
      ['Besiegt', s.kills],
      ['Gesamtschaden', fmt(Math.round(s.damage))],
      ['Größte Kette', s.maxChain ? `×${s.maxChain}` : '–'],
      ['Kristalle', s.crystals],
      ['MVP-Waffe', s.mvp ? `${waffeById(s.mvp)?.name ?? s.mvp}` : '–']
    ];
    this.show('end', `
      <div class="ob-panel ob-end ${s.victory ? 'win' : ''}">
        <h2>${s.victory ? 'Sieg!' : 'Kawumm!'}</h2>
        <p class="ob-sub">${s.victory ? 'Baron von Bumm ist geschlagen. Gackerfeld ist frei – vorerst.' : SPRUECHE_TOD[seed % SPRUECHE_TOD.length]}</p>
        <dl class="ob-end-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <div class="ob-row ob-center">
          ${s.victory ? '<button type="button" class="ob-btn2" data-act="endless">Endlos weiter</button>' : ''}
          <button type="button" class="ob-go" data-act="restart">Nochmal!</button>
        </div>
        ${this.touch ? '' : '<p class="ob-keys">Pfeiltasten + Enter · Gamepad: Steuerkreuz + A</p>'}
      </div>`, '[data-act="restart"]');
  }

  showPause(): void {
    this.show('pause', `
      <div class="ob-panel ob-end">
        <h2>Pause</h2>
        <p class="ob-sub">Kurz durchatmen. Die Grummelbolde warten (grummelnd).</p>
        <div class="ob-row ob-center">
          <button type="button" class="ob-go" data-act="resume">Weiter</button>
          <button type="button" class="ob-btn2" data-act="restart">Neu starten</button>
        </div>
        ${this.touch ? '' : '<p class="ob-keys">Esc / P: Pause · WASD: laufen · Leertaste: Dash</p>'}
      </div>`);
  }

  /** Zurück-Taste (Esc / Gamepad B) */
  back(): boolean {
    if (this.mode === 'shop' && this.detail >= 0) { this.detail = -1; this.sync(); return true; }
    if (this.mode === 'pause') { this.hide(); this.onResume(); return true; }
    return false;
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const i = Number(el.dataset.i ?? -1);
    switch (el.dataset.act) {
      case 'start': this.send({ type: 'start', weapon: el.dataset.id! }); this.hide(); break;
      case 'upgrade': this.send({ type: 'upgrade', index: i }); break;
      case 'buy': this.send({ type: 'buy', index: i }); break;
      case 'lock': this.send({ type: 'lock', index: i }); break;
      case 'reroll': this.send({ type: 'reroll' }); break;
      case 'slot': this.detail = this.detail === i ? -1 : i; break;
      case 'close': this.detail = -1; break;
      case 'merge': this.send({ type: 'merge', slot: i }); this.detail = -1; break;
      case 'sell': this.send({ type: 'sell', slot: i }); this.detail = -1; break;
      case 'stats': this.showStats = !this.showStats; break;
      case 'tab': this.tab = el.dataset.tab === 'amboss' ? 'amboss' : 'shop'; this.detail = -1; break;
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
      case 'ready': this.detail = -1; if (this.send({ type: 'ready' })) this.hide(); break;
      case 'restart': this.hide(); this.onRestart(); return;
      case 'resume': this.hide(); this.onResume(); return;
      case 'endless': if (this.send({ type: 'endless' })) { this.mode = 'none'; this.sync(); } return;
    }
    this.sync();
  }
}

/**
 * Menü-Steuerung mit Gamepad und Pfeiltasten: Fokus springt räumlich zum nächsten Knopf
 * in der gedrückten Richtung, A/Enter löst aus, B/Esc geht zurück.
 */
export class MenuNav {
  private repeat = 0;
  private held = '';
  private aWas = true;
  private bWas = true;
  onBack: () => void = () => {};

  constructor(private root: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (this.root.classList.contains('hidden')) return;
      const dir = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' }[e.code];
      if (dir) { this.move(dir); e.preventDefault(); }
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
      else if ((this.repeat -= dt) <= 0) { this.repeat = 0.12; this.move(dir); }
    } else this.held = '';
    if (a && !this.aWas) (document.activeElement as HTMLElement | null)?.closest?.('.ob-menu') && (document.activeElement as HTMLElement).click();
    if (b && !this.bWas) this.onBack();
    this.aWas = a; this.bWas = b;
  }

  private move(dir: string): void {
    const list = [...this.root.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (!list.length) return;
    const cur = document.activeElement as HTMLElement | null;
    if (!cur || !list.includes(cur)) { list[0].focus(); return; }
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
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
  }
}


