import { GEGNER, WAFFEN, t } from '@overboom/data';

export type DebugAktion =
  | { t: 'kristalle' }
  | { t: 'welle' }
  | { t: 'gott' }
  | { t: 'overkill' }
  | { t: 'waffe'; id: string }
  | { t: 'gegner'; id: string; n: number }
  | { t: 'heilen' };

/**
 * Debug-Menü (F1 oder 5-Finger-Tipp): Waffen/Gegner spawnen, Kristalle, Wellen-Skip,
 * Gott-Modus. Nur solo bzw. für den Host – ändert die Welt über die App.
 */
export class DebugMenu {
  readonly root: HTMLDivElement;
  onAktion: (a: DebugAktion) => void = () => {};
  /** darf gerade geöffnet werden? (setzt die App) */
  erlaubt: () => boolean = () => true;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ob-debug hidden';
    this.root.innerHTML = `
      <b>${t('Debug')}</b>
      <button type="button" data-d="kristalle">${t('+{n} Kristalle', { n: 500 })}</button>
      <button type="button" data-d="welle">${t('Welle überspringen')}</button>
      <button type="button" data-d="gott">${t('Gott-Modus an/aus')}</button>
      <button type="button" data-d="overkill">${t('Overkill voll')}</button>
      <button type="button" data-d="heilen">${t('Volle Leben')}</button>
      <label>${t('Waffe')} <select data-sel="waffe">${WAFFEN.map((w) => `<option value="${w.id}">${w.name}</option>`).join('')}</select></label>
      <button type="button" data-d="waffe">${t('Waffe geben')}</button>
      <label>${t('Gegner')} <select data-sel="gegner">${GEGNER.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></label>
      <button type="button" data-d="gegner">${t('{n} spawnen', { n: 5 })}</button>
      <small>${t('F1 schließt')}</small>`;
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-d]');
      if (!el) return;
      const d = el.dataset.d!;
      const sel = (n: string) => this.root.querySelector<HTMLSelectElement>(`[data-sel="${n}"]`)!.value;
      if (d === 'waffe') this.onAktion({ t: 'waffe', id: sel('waffe') });
      else if (d === 'gegner') this.onAktion({ t: 'gegner', id: sel('gegner'), n: 5 });
      else this.onAktion({ t: d } as DebugAktion);
    });
    addEventListener('keydown', (e) => { if (e.code === 'F1') { e.preventDefault(); this.toggle(); } });
    // 5 Finger gleichzeitig auf dem Bildschirm
    addEventListener('touchstart', (e) => { if (e.touches.length >= 5) this.toggle(); }, { passive: true });
  }

  get offen(): boolean { return !this.root.classList.contains('hidden'); }

  toggle(): void {
    if (!this.offen && !this.erlaubt()) return;
    this.root.classList.toggle('hidden');
  }
}
