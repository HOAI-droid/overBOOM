import { SPRACHEN, type Sprache } from '@overboom/data';

/**
 * Sprachwahl beim ersten Start – erscheint vor allem anderen, darum ohne t()
 * (jede Sprache steht in sich selbst da). Bedienbar mit Touch, Maus, Tastatur und Controller.
 */
const UEBERSCHRIFT: Record<Sprache, string> = {
  en: 'Choose your language',
  de: 'Wähle deine Sprache',
  es: 'Elige tu idioma',
  fr: 'Choisis ta langue'
};

export function sprachwahl(parent: HTMLElement, vorschlag: Sprache): Promise<Sprache> {
  return new Promise((fertig) => {
    const root = document.createElement('div');
    root.className = 'ob-menu ob-sprachwahl';
    const knoepfe = SPRACHEN.map((s) =>
      `<button type="button" class="ob-go ob-big ob-sprache ${s.id === vorschlag ? 'on' : ''}" data-sprache="${s.id}"><b>${s.flagge}</b> ${s.name}</button>`).join('');
    root.innerHTML = `
      <div class="ob-panel ob-titel">
        <h1 class="ob-logo"><b>OVER</b><b class="boom">BOOM</b></h1>
        <p class="ob-sub">${SPRACHEN.map((s) => UEBERSCHRIFT[s.id]).join(' · ')}</p>
        <div class="ob-sprachliste">${knoepfe}</div>
      </div>`;
    parent.appendChild(root);
    const liste = [...root.querySelectorAll<HTMLButtonElement>('[data-sprache]')];
    let i = Math.max(0, liste.findIndex((b) => b.dataset.sprache === vorschlag));
    // eigene Markierung: :focus greift nicht überall (Xbox-WebView ohne Fensterfokus)
    const markiere = () => { liste.forEach((b, k) => b.classList.toggle('ob-fokus', k === i)); liste[i].focus(); };
    markiere();

    let raf = 0, padWas = true, dirWas = '';
    const waehle = (b: HTMLElement) => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', taste);
      root.remove();
      fertig(b.dataset.sprache as Sprache);
    };
    const bewege = (d: number) => { i = (i + d + liste.length) % liste.length; markiere(); };
    const taste = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { bewege(1); e.preventDefault(); }
      else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { bewege(-1); e.preventDefault(); }
    };
    addEventListener('keydown', taste);
    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sprache]');
      if (b) waehle(b);
    });
    // Controller: Steuerkreuz/Stick + A
    const pad = () => {
      const p = (navigator.getGamepads?.() ?? []).find((g) => g);
      if (p) {
        const ay = p.axes[1] ?? 0;
        const dir = p.buttons[13]?.pressed || ay > 0.6 ? 'd' : p.buttons[12]?.pressed || ay < -0.6 ? 'u' : '';
        if (dir && dir !== dirWas) bewege(dir === 'd' ? 1 : -1);
        dirWas = dir;
        const a = !!p.buttons[0]?.pressed;
        if (a && !padWas) { waehle(liste[i]); return; }
        padWas = a;
      }
      raf = requestAnimationFrame(pad);
    };
    raf = requestAnimationFrame(pad);
  });
}
