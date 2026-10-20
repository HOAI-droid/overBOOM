/** Bildschirm-Eingabe: x nach rechts, y nach unten (Betrag ≤ 1). */
export interface ScreenInput {
  x: number;
  y: number;
  /** wurde seit dem letzten Abfragen ein Dash ausgelöst? */
  dash: boolean;
  source: 'keyboard' | 'touch' | 'gamepad' | 'none';
}

/**
 * Vereint Tastatur, Touch-Joystick und Gamepad zu einer Eingabe.
 * Der Joystick erscheint dort, wo der Daumen aufsetzt (linke Bildschirmhälfte).
 */
export class Controls {
  private keys = new Set<string>();
  private dashQueued = false;
  private stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private padDashWas = false;
  private lastSource: ScreenInput['source'] = 'none';
  private readonly radius = 56;

  constructor(private surface: HTMLElement, dashButton: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'ob-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'ob-knob';
    this.base.appendChild(this.knob);
    surface.appendChild(this.base);

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { this.dashQueued = true; e.preventDefault(); }
      this.lastSource = 'keyboard';
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (this.stick.id !== -1 || e.clientX > innerWidth * 0.6) return;
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.base.classList.add('on');
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.lastSource = 'touch';
      e.preventDefault();
    });
    surface.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy);
      // Basis wandert mit, wenn der Daumen weit hinauszieht
      if (d > this.radius * 1.4) {
        const k = (d - this.radius * 1.4) / d;
        this.stick.ox += dx * k; this.stick.oy += dy * k;
        this.base.style.transform = `translate(${this.stick.ox}px, ${this.stick.oy}px)`;
        dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
      }
      const m = Math.min(1, Math.hypot(dx, dy) / this.radius);
      const a = Math.atan2(dy, dx);
      this.stick.x = m < 0.12 ? 0 : Math.cos(a) * m;
      this.stick.y = m < 0.12 ? 0 : Math.sin(a) * m;
      this.knob.style.transform = `translate(calc(-50% + ${this.stick.x * this.radius}px), calc(-50% + ${this.stick.y * this.radius}px))`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
      this.base.classList.remove('on');
    };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    dashButton.addEventListener('pointerdown', (e) => {
      this.dashQueued = true;
      this.lastSource = e.pointerType === 'mouse' ? 'keyboard' : 'touch';
      dashButton.classList.add('down');
      e.preventDefault();
      e.stopPropagation();
    });
    const up = () => dashButton.classList.remove('down');
    dashButton.addEventListener('pointerup', up);
    dashButton.addEventListener('pointerleave', up);
  }

  poll(): ScreenInput {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }

    if (this.stick.id !== -1) { x = this.stick.x; y = this.stick.y; }

    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0, m = Math.hypot(ax, ay);
      if (m > 0.2) { x = ax; y = ay; this.lastSource = 'gamepad'; }
      const pressed = !!(p.buttons[0]?.pressed || p.buttons[5]?.pressed || p.buttons[7]?.pressed);
      if (pressed && !this.padDashWas) { this.dashQueued = true; this.lastSource = 'gamepad'; }
      this.padDashWas = pressed;
      break;
    }

    const dash = this.dashQueued;
    this.dashQueued = false;
    return { x, y, dash, source: this.lastSource };
  }
}

/** Bildschirmrichtung → Weltrichtung für die isometrische Kamera (45°). */
export function screenToWorld(x: number, y: number): { mx: number; mz: number } {
  const s = Math.SQRT1_2;
  return { mx: (x + y) * s, mz: (y - x) * s };
}
