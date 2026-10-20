import type { Platform } from '@overboom/platform';

export interface HudState {
  /** 0–1 */
  dashReady: number;
  info: string;
  hp: number;
  maxHp: number;
  crystals: number;
  wave: number;
  waveTime: number;
  phase: string;
  level: number;
  /** 0–1 Fortschritt zum nächsten Level */
  xp: number;
  /** Boss-Leben 0–1 oder -1 (kein Boss) */
  boss: number;
  /** Overkill-Leiste 0–1 und verbleibende OVERBOOM-Zeit */
  overkill: number;
  boomT: number;
}

const GEM_SVG = '<svg viewBox="0 0 6 8" width="12" height="16" shape-rendering="crispEdges" aria-hidden="true"><path fill="#1aa8d8" d="M1 2h4v4h-1v1h-2v-1h-1z"/><path fill="#3de8ff" d="M2 0h2v1h1v1h-4v-1h1zM2 2h2v3h-2z"/><path fill="#e8fdff" d="M2 1h1v1h-1z"/></svg>';

/** HUD: Leben, Level/XP, Kristalle, Welle + Timer, Boss-Leiste, Banner, Ketten-Anzeige, Dash-Button. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly dashButton: HTMLButtonElement;
  readonly boomButton: HTMLButtonElement;
  private okFill!: HTMLDivElement;
  private okWas = -1;
  private fps: HTMLSpanElement;
  private hint: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpText: HTMLSpanElement;
  private gems: HTMLSpanElement;
  private waveNum: HTMLDivElement;
  private waveTimer: HTMLDivElement;
  private bannerEl: HTMLDivElement;
  private chainEl: HTMLDivElement;
  private hurtEl: HTMLDivElement;
  private lvl: HTMLSpanElement;
  private xpFill: HTMLDivElement;
  private bossEl: HTMLDivElement;
  private bossFill: HTMLDivElement;
  readonly pauseButton: HTMLButtonElement;
  private synEl: HTMLDivElement;
  private synKey = '';
  private hintTimer = -1;
  private frames = 0;
  private acc = 0;
  private last = { hp: -1, maxHp: -1, crystals: -1, wave: -1, sec: -1, phase: '', level: -1, xp: -1, boss: -2 };
  private chainShown = 0;
  private chainTimer = 0;

  constructor(parent: HTMLElement, private platform: Platform, info: () => string) {
    const touch = platform.isTouchDevice();
    this.root = document.createElement('div');
    this.root.className = 'ob-hud';
    this.root.innerHTML = `
      <div class="ob-hurt"></div>
      <div class="ob-left">
        <div class="ob-title"><b>OVER</b><b class="boom">BOOM</b><span>v0.8 · Koop</span></div>
        <div class="ob-hp" role="meter" aria-label="Leben"><div class="ob-hp-fill"></div><span class="ob-hp-txt">60 / 60</span></div>
        <div class="ob-xp"><span class="ob-lvl">Lv 1</span><div class="ob-xp-bar"><div class="ob-xp-fill"></div></div></div>
        <div class="ob-ok" role="meter" aria-label="Overkill"><span>Overkill</span><div class="ob-ok-bar"><div class="ob-ok-fill"></div></div></div>
        <div class="ob-gems">${GEM_SVG}<span>0</span></div>
        <div class="ob-syn"></div>
      </div>
      <div class="ob-wave"><div class="ob-wave-n">Welle 1</div><div class="ob-wave-t">0:20</div>
        <div class="ob-boss hidden"><span>Baron von Bumm</span><div class="ob-boss-bar"><div class="ob-boss-fill"></div></div></div>
      </div>
      <div class="ob-top-right">
        <span class="ob-fps" aria-live="off">–– FPS</span>
        <button type="button" class="ob-btn ob-pause" aria-label="Pause">❚❚</button>
        <button type="button" class="ob-btn ob-full" aria-label="Vollbild">⛶</button>
      </div>
      <div class="ob-banner" aria-live="polite"></div>
      <div class="ob-chain"></div>
      <div class="ob-hint">${touch ? 'Linker Daumen: laufen · Waffen feuern von selbst · Rechts: <b>Dash</b>' : '<b>WASD</b>: laufen · Waffen feuern von selbst · <b>Leertaste</b>: Dash'}</div>
      <div class="ob-boomtint"></div>
      <button type="button" class="ob-boombtn" aria-label="OVERBOOM auslösen">OVER<b>BOOM</b><small>${touch ? 'antippen' : 'E / Q'}</small></button>
      <button type="button" class="ob-dash" aria-label="Dash">
        <svg viewBox="0 0 8 8" width="30" height="30" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 0h3v1h-1v1h-1v1h3v1h-1v1h-1v1h-1v1h-1v1h-2v-1h1v-1h1v-1h-3v-1h1v-1h1v-1h1z"></path></svg>
        <span>Dash</span>
      </button>
`;
    parent.appendChild(this.root);
    const q = <T extends Element>(s: string) => this.root.querySelector(s) as T;
    this.fps = q('.ob-fps');
    this.hint = q('.ob-hint');
    this.dashButton = q('.ob-dash');
    this.boomButton = q('.ob-boombtn');
    this.okFill = q('.ob-ok-fill');
    this.hpFill = q('.ob-hp-fill');
    this.hpText = q('.ob-hp-txt');
    this.gems = q('.ob-gems span');
    this.waveNum = q('.ob-wave-n');
    this.waveTimer = q('.ob-wave-t');
    this.bannerEl = q('.ob-banner');
    this.chainEl = q('.ob-chain');
    this.hurtEl = q('.ob-hurt');
    this.lvl = q('.ob-lvl');
    this.xpFill = q('.ob-xp-fill');
    this.bossEl = q('.ob-boss');
    this.bossFill = q('.ob-boss-fill');
    this.pauseButton = q('.ob-pause');
    this.synEl = q('.ob-syn');
    if (!touch) this.dashButton.classList.add('desktop');
    q('.ob-full').addEventListener('click', () => this.platform.toggleFullscreen());
    this.fps.title = info();
  }

  /** Nach der ersten Bewegung den Hinweis ausblenden. */
  moved(): void {
    if (this.hintTimer === -1) this.hintTimer = 6;
  }

  banner(title: string, sub = '', tone: 'gelb' | 'cyan' | 'rot' = 'gelb'): void {
    this.bannerEl.innerHTML = `<b class="${tone}">${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this.bannerEl.getAnimations().forEach((a) => a.cancel());
    this.bannerEl.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(2.2) rotate(-6deg)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(0.92) rotate(-3deg)', offset: 0.12 },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(-3deg)', offset: 0.2 },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(-3deg)', offset: 0.85 },
        { opacity: 0, transform: 'translate(-50%, -60%) scale(1) rotate(-3deg)' }
      ],
      { duration: 2000, easing: 'ease-out', fill: 'forwards' }
    );
  }

  /** Kleine Meldung oben rechts (neue Karte, Erfolg …), stapelt sich */
  toast(title: string, sub: string, color = '#ffd23f', glanz = false): void {
    let box = this.root.querySelector<HTMLDivElement>('.ob-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'ob-toasts'; this.root.appendChild(box); }
    while (box.children.length >= 4) box.firstElementChild!.remove();
    const el = document.createElement('div');
    el.className = `ob-toast${glanz ? ' glanz' : ''}`;
    el.style.setProperty('--c', color);
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector('b')!.textContent = title;
    el.querySelector('span')!.textContent = sub;
    box.appendChild(el);
    el.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none', offset: 0.08 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 3600, easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => el.remove(), () => el.remove());
  }


  /** „CHAIN ×N!" – wird bei jeder neuen Kettenlänge größer und poppt erneut. */
  chain(count: number): void {
    if (count <= this.chainShown && this.chainTimer > 0) return;
    this.chainShown = count;
    this.chainTimer = 1.4;
    const size = Math.min(2.2, 1 + (count - 3) * 0.06);
    this.chainEl.textContent = `CHAIN ×${count}!`;
    this.chainEl.style.setProperty('--s', String(size));
    this.chainEl.getAnimations().forEach((a) => a.cancel());
    this.chainEl.animate(
      [
        { opacity: 1, transform: `translateX(-50%) scale(${size * 1.6}) rotate(4deg)` },
        { opacity: 1, transform: `translateX(-50%) scale(${size}) rotate(4deg)`, offset: 0.12 },
        { opacity: 1, transform: `translateX(-50%) scale(${size}) rotate(4deg)`, offset: 0.75 },
        { opacity: 0, transform: `translateX(-50%) scale(${size * 0.9}) rotate(4deg)` }
      ],
      { duration: 1400, easing: 'ease-out', fill: 'forwards' }
    );
  }

  /** Intensität von Bildschirm-Blitzen (Einstellung „Lichtblitze") */
  blitze = 1;

  hurt(): void {
    this.hurtEl.getAnimations().forEach((a) => a.cancel());
    this.hurtEl.animate([{ opacity: 0.25 + 0.6 * this.blitze }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
  }

  /** Aktive Synergien als kleine Chips (nur neu bauen, wenn sich etwas geändert hat) */
  synergies(list: readonly { element: string; count: number; level: number; farbe: string }[]): void {
    const key = list.map((x) => x.element + x.count).join();
    if (key === this.synKey) return;
    this.synKey = key;
    this.synEl.innerHTML = list.filter((x) => x.level > 0).map((x) => `<span style="--c:${x.farbe}" title="${x.element}: ${x.count} Waffen">${x.element} ${'I'.repeat(x.level)}</span>`).join('');
  }

  update(dt: number, s: HudState): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps.textContent = `${Math.round(this.frames / this.acc)} FPS · ${s.info}`;
      this.frames = 0; this.acc = 0;
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.classList.add('gone');
    }
    if (this.chainTimer > 0) { this.chainTimer -= dt; if (this.chainTimer <= 0) this.chainShown = 0; }

    // DOM nur anfassen, wenn sich etwas geändert hat
    const L = this.last;
    const hp = Math.ceil(s.hp);
    if (hp !== L.hp || s.maxHp !== L.maxHp) {
      L.hp = hp; L.maxHp = s.maxHp;
      this.hpFill.style.width = `${(100 * Math.max(0, hp)) / s.maxHp}%`;
      this.hpText.textContent = `${Math.max(0, hp)} / ${s.maxHp}`;
      this.hpFill.classList.toggle('low', hp / s.maxHp < 0.3);
    }
    if (s.crystals !== L.crystals) {
      if (L.crystals >= 0 && s.crystals > L.crystals) {
        this.gems.parentElement!.getAnimations().forEach((a) => a.cancel());
        this.gems.parentElement!.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 160 });
      }
      L.crystals = s.crystals;
      this.gems.textContent = String(s.crystals);
    }
    if (s.wave !== L.wave) { L.wave = s.wave; this.waveNum.textContent = s.wave ? `Welle ${s.wave} / 20` : 'Bereit?'; }
    const timed = s.phase === 'welle' && Number.isFinite(s.waveTime) && s.waveTime < 3600;
    const sec = timed ? Math.max(0, Math.ceil(s.waveTime)) : -1;
    if (sec !== L.sec || s.phase !== L.phase) {
      L.sec = sec; L.phase = s.phase;
      this.waveTimer.textContent = timed ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : s.phase === 'welle' ? 'BOSS' : s.phase === 'pause' ? 'Geschafft' : s.phase === 'shop' ? 'Shop' : '–';
      this.waveTimer.classList.toggle('urgent', (timed && sec <= 5) || (s.phase === 'welle' && !timed));
    }
    if (s.level !== L.level) { L.level = s.level; this.lvl.textContent = `Lv ${s.level}`; }
    const xp = Math.round(s.xp * 50);
    if (xp !== L.xp) { L.xp = xp; this.xpFill.style.width = `${xp * 2}%`; }
    const boss = s.boss < 0 ? -1 : Math.ceil(s.boss * 100);
    if (boss !== L.boss) {
      L.boss = boss;
      this.bossEl.classList.toggle('hidden', boss < 0);
      if (boss >= 0) this.bossFill.style.width = `${boss}%`;
    }
    // Overkill-Leiste und OVERBOOM-Modus
    const ok = s.boomT > 0 ? -2 : Math.round(s.overkill * 100);
    if (ok !== this.okWas) {
      this.okWas = ok;
      this.okFill.style.width = `${ok < 0 ? 100 : ok}%`;
      this.root.classList.toggle('ok-voll', ok >= 100);
      this.root.classList.toggle('ok-aktiv', ok === -2);
    }
    this.dashButton.style.setProperty('--cd', String(Math.round(s.dashReady * 100)));
    this.dashButton.classList.toggle('ready', s.dashReady >= 1);
  }
}
