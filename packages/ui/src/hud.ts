import type { Platform } from '@overboom/platform';

/** Minimales HUD für Phase 1: Titel, FPS, Steuerungshinweis, Dash-Button mit Abklingzeit. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly dashButton: HTMLButtonElement;
  private fps: HTMLSpanElement;
  private hint: HTMLDivElement;
  private hintTimer = -1;
  private frames = 0;
  private acc = 0;

  constructor(parent: HTMLElement, private platform: Platform, info: () => string) {
    const touch = platform.isTouchDevice();
    this.root = document.createElement('div');
    this.root.className = 'ob-hud';
    this.root.innerHTML = `
      <div class="ob-title"><b>OVER</b><b class="boom">BOOM</b><span>Prototyp · Phase 1</span></div>
      <div class="ob-top-right">
        <span class="ob-fps" aria-live="off">–– FPS</span>
        <button type="button" class="ob-btn ob-full" aria-label="Vollbild">⛶</button>
      </div>
      <div class="ob-hint">${touch ? 'Linker Daumen: laufen · Rechts: <b>Dash</b>' : '<b>WASD</b> / Pfeile: laufen · <b>Leertaste</b>: Dash · Gamepad geht auch'}</div>
      <button type="button" class="ob-dash" aria-label="Dash">
        <svg viewBox="0 0 8 8" width="30" height="30" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 0h3v1h-1v1h-1v1h3v1h-1v1h-1v1h-1v1h-1v1h-2v-1h1v-1h1v-1h-3v-1h1v-1h1v-1h1z"></path></svg>
        <span>Dash</span>
      </button>`;
    parent.appendChild(this.root);
    this.fps = this.root.querySelector('.ob-fps')!;
    this.hint = this.root.querySelector('.ob-hint')!;
    this.dashButton = this.root.querySelector('.ob-dash')!;
    if (!touch) this.dashButton.classList.add('desktop');
    this.root.querySelector('.ob-full')!.addEventListener('click', () => this.platform.toggleFullscreen());
    this.fps.title = info();
  }

  /** Nach der ersten Bewegung den Hinweis ausblenden. */
  moved(): void {
    if (this.hintTimer === -1) this.hintTimer = 4;
  }

  update(dt: number, dashReady: number, extra: string): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps.textContent = `${Math.round(this.frames / this.acc)} FPS · ${extra}`;
      this.frames = 0; this.acc = 0;
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.classList.add('gone');
    }
    this.dashButton.style.setProperty('--cd', String(Math.round(dashReady * 100)));
    this.dashButton.classList.toggle('ready', dashReady >= 1);
  }
}
