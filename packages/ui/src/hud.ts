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
  phase: 'welle' | 'pause' | 'ende';
}

export interface RunStats {
  wave: number;
  kills: number;
  maxChain: number;
  crystals: number;
  explosions: number;
}

const GEM_SVG = '<svg viewBox="0 0 6 8" width="12" height="16" shape-rendering="crispEdges" aria-hidden="true"><path fill="#1aa8d8" d="M1 2h4v4h-1v1h-2v-1h-1z"/><path fill="#3de8ff" d="M2 0h2v1h1v1h-4v-1h1zM2 2h2v3h-2z"/><path fill="#e8fdff" d="M2 1h1v1h-1z"/></svg>';

const SPRUECHE = [
  'Kawumm! Das war wohl zu viel Kawumm.',
  'Die Grummelbolde grummeln zufrieden.',
  'Die Bomben-Kröten quaken ein Siegeslied.',
  'Der Toastomat toastet auf deinen Untergang.',
  'Nicht verzagen – nochmal knallen lassen!'
];

/** HUD: Leben, Kristalle, Welle + Timer, Banner, Ketten-Anzeige, Dash-Button, Run-Ende. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly dashButton: HTMLButtonElement;
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
  private over: HTMLDivElement;
  private hintTimer = -1;
  private frames = 0;
  private acc = 0;
  private last = { hp: -1, maxHp: -1, crystals: -1, wave: -1, sec: -1, phase: '' };
  private chainShown = 0;
  private chainTimer = 0;
  onRestart: () => void = () => {};

  constructor(parent: HTMLElement, private platform: Platform, info: () => string) {
    const touch = platform.isTouchDevice();
    this.root = document.createElement('div');
    this.root.className = 'ob-hud';
    this.root.innerHTML = `
      <div class="ob-hurt"></div>
      <div class="ob-left">
        <div class="ob-title"><b>OVER</b><b class="boom">BOOM</b><span>Prototyp · Phase 2</span></div>
        <div class="ob-hp" role="meter" aria-label="Leben"><div class="ob-hp-fill"></div><span class="ob-hp-txt">60 / 60</span></div>
        <div class="ob-gems">${GEM_SVG}<span>0</span></div>
      </div>
      <div class="ob-wave"><div class="ob-wave-n">Welle 1</div><div class="ob-wave-t">0:20</div></div>
      <div class="ob-top-right">
        <span class="ob-fps" aria-live="off">–– FPS</span>
        <button type="button" class="ob-btn ob-full" aria-label="Vollbild">⛶</button>
      </div>
      <div class="ob-banner" aria-live="polite"></div>
      <div class="ob-chain"></div>
      <div class="ob-hint">${touch ? 'Linker Daumen: laufen · Waffen feuern von selbst · Rechts: <b>Dash</b>' : '<b>WASD</b>: laufen · Waffen feuern von selbst · <b>Leertaste</b>: Dash'}</div>
      <button type="button" class="ob-dash" aria-label="Dash">
        <svg viewBox="0 0 8 8" width="30" height="30" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 0h3v1h-1v1h-1v1h3v1h-1v1h-1v1h-1v1h-1v1h-2v-1h1v-1h1v-1h-3v-1h1v-1h1v-1h1z"></path></svg>
        <span>Dash</span>
      </button>
      <div class="ob-over hidden">
        <div class="ob-over-panel">
          <h2>KAWUMM!</h2>
          <p class="ob-over-quote"></p>
          <dl class="ob-over-stats"></dl>
          <button type="button" class="ob-again">Nochmal!</button>
          <p class="ob-over-keys">${touch ? '' : 'oder Enter / Leertaste'}</p>
        </div>
      </div>`;
    parent.appendChild(this.root);
    const q = <T extends Element>(s: string) => this.root.querySelector(s) as T;
    this.fps = q('.ob-fps');
    this.hint = q('.ob-hint');
    this.dashButton = q('.ob-dash');
    this.hpFill = q('.ob-hp-fill');
    this.hpText = q('.ob-hp-txt');
    this.gems = q('.ob-gems span');
    this.waveNum = q('.ob-wave-n');
    this.waveTimer = q('.ob-wave-t');
    this.bannerEl = q('.ob-banner');
    this.chainEl = q('.ob-chain');
    this.hurtEl = q('.ob-hurt');
    this.over = q('.ob-over');
    if (!touch) this.dashButton.classList.add('desktop');
    q('.ob-full').addEventListener('click', () => this.platform.toggleFullscreen());
    q('.ob-again').addEventListener('click', () => this.onRestart());
    this.fps.title = info();
  }

  /** Nach der ersten Bewegung den Hinweis ausblenden. */
  moved(): void {
    if (this.hintTimer === -1) this.hintTimer = 6;
  }

  get gameOverVisible(): boolean {
    return !this.over.classList.contains('hidden');
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

  hurt(): void {
    this.hurtEl.getAnimations().forEach((a) => a.cancel());
    this.hurtEl.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
  }

  showGameOver(s: RunStats, seed: number): void {
    const q = (sel: string) => this.over.querySelector(sel) as HTMLElement;
    q('.ob-over-quote').textContent = SPRUECHE[seed % SPRUECHE.length];
    q('.ob-over-stats').innerHTML = [
      ['Welle', s.wave],
      ['Besiegt', s.kills],
      ['Größte Kette', s.maxChain ? `×${s.maxChain}` : '–'],
      ['Explosionen', s.explosions],
      ['Kristalle', s.crystals]
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    this.over.classList.remove('hidden');
    (q('.ob-again') as HTMLButtonElement).focus({ preventScroll: true });
  }

  hideGameOver(): void {
    this.over.classList.add('hidden');
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
    if (s.wave !== L.wave) { L.wave = s.wave; this.waveNum.textContent = `Welle ${s.wave}`; }
    const sec = s.phase === 'welle' ? Math.max(0, Math.ceil(s.waveTime)) : -1;
    if (sec !== L.sec || s.phase !== L.phase) {
      L.sec = sec; L.phase = s.phase;
      this.waveTimer.textContent = s.phase === 'welle' ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : s.phase === 'pause' ? 'Pause' : '–';
      this.waveTimer.classList.toggle('urgent', s.phase === 'welle' && sec <= 5);
    }
    this.dashButton.style.setProperty('--cd', String(Math.round(s.dashReady * 100)));
    this.dashButton.classList.toggle('ready', s.dashReady >= 1);
  }
}
