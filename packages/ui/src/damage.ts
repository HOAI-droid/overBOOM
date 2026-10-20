/**
 * Pixelige, poppende Schadenszahlen. Treffer auf denselben Gegner kurz hintereinander
 * werden zusammengezählt, statt den Bildschirm zu fluten. Feste Anzahl DOM-Elemente.
 */
export class DamageNumbers {
  private els: HTMLSpanElement[] = [];
  private id: Int32Array;
  private x: Float32Array;
  private y: Float32Array;
  private z: Float32Array;
  private value: Float32Array;
  private t: Float32Array;
  private crit: Uint8Array;
  /** statt Zahl ein Text (z. B. „Ausgewichen!") */
  private label: (string | null)[] = [];
  private cls: string[] = [];
  private next = 0;
  private pt = { x: 0, y: 0 };
  enabled = true;

  constructor(parent: HTMLElement, private cap = 48) {
    const layer = document.createElement('div');
    layer.className = 'ob-dmg-layer';
    parent.appendChild(layer);
    for (let i = 0; i < cap; i++) {
      const s = document.createElement('span');
      s.className = 'ob-dmg';
      s.style.display = 'none';
      layer.appendChild(s);
      this.els.push(s);
    }
    this.id = new Int32Array(cap).fill(-1);
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.z = new Float32Array(cap);
    this.value = new Float32Array(cap);
    this.t = new Float32Array(cap).fill(99);
    this.crit = new Uint8Array(cap);
  }

  /** Kurzer Text über der Figur (Level up, Heilung, Ausgewichen) – unabhängig von „Zahlen aus". */
  text(id: number, x: number, y: number, z: number, str: string, cls: string): void {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.id[i] = id;
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.t[i] = 0;
    this.label[i] = str;
    this.cls[i] = cls;
    this.paint(i);
  }

  add(id: number, x: number, y: number, z: number, dmg: number, crit: boolean): void {
    if (!this.enabled || dmg <= 0) return;
    for (let i = 0; i < this.cap; i++) {
      if (this.id[i] === id && this.t[i] < 0.35 && !this.label[i]) {
        this.value[i] += dmg;
        this.t[i] = 0;
        this.x[i] = x; this.y[i] = y; this.z[i] = z;
        if (crit) this.crit[i] = 1;
        this.paint(i);
        return;
      }
    }
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.id[i] = id;
    this.x[i] = x + (((id * 37) % 7) - 3) * 0.05; this.y[i] = y; this.z[i] = z;
    this.value[i] = dmg;
    this.t[i] = 0;
    this.crit[i] = crit ? 1 : 0;
    this.label[i] = null;
    this.paint(i);
  }

  private paint(i: number): void {
    const el = this.els[i];
    const label = this.label[i];
    if (label) {
      el.textContent = label;
      el.className = 'ob-dmg ' + this.cls[i];
    } else {
      el.textContent = String(Math.round(this.value[i]));
      el.className = this.crit[i] ? 'ob-dmg crit' : this.value[i] >= 40 ? 'ob-dmg big' : 'ob-dmg';
    }
    el.style.display = '';
  }

  clear(): void {
    for (let i = 0; i < this.cap; i++) { this.t[i] = 99; this.id[i] = -1; this.els[i].style.display = 'none'; }
  }

  update(dt: number, project: (x: number, y: number, z: number, out: { x: number; y: number }) => { x: number; y: number }): void {
    for (let i = 0; i < this.cap; i++) {
      const LIFE = this.label[i] ? 1.1 : 0.75;
      if (this.t[i] >= LIFE) continue;
      this.t[i] += dt;
      const el = this.els[i];
      if (this.t[i] >= LIFE) { el.style.display = 'none'; this.id[i] = -1; continue; }
      const k = this.t[i] / LIFE;
      const p = project(this.x[i], this.y[i] + k * 0.9, this.z[i], this.pt);
      const pop = k < 0.12 ? 1.8 - (k / 0.12) * 0.8 : 1;
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%) scale(${pop.toFixed(2)})`;
      el.style.opacity = k > 0.7 ? String(1 - (k - 0.7) / 0.3) : '1';
    }
  }
}
