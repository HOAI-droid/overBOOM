import type { Player } from '@overboom/core';
import { KOOP, t } from '@overboom/data';

const FARBEN = ['#3de8ff', '#ff3df0', '#ffd23f', '#7dff5a'];

/**
 * Koop: Namensschilder über den Mitspielern und Pfeile am Bildschirmrand,
 * wenn jemand außerhalb des Bildes ist. Niedergeschlagene zeigen den Fortschritt.
 */
export class NameTags {
  private root: HTMLDivElement;
  private tags: { el: HTMLDivElement; name: HTMLSpanElement; info: HTMLSpanElement }[] = [];
  private pt = { x: 0, y: 0 };

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ob-tags-layer';
    parent.appendChild(this.root);
  }

  private tag(i: number) {
    let tg = this.tags[i];
    if (!tg) {
      const el = document.createElement('div');
      el.className = 'ob-nametag';
      el.style.setProperty('--c', FARBEN[i % FARBEN.length]);
      el.innerHTML = '<i class="ob-pfeil"></i><span class="n"></span><span class="i"></span>';
      this.root.appendChild(el);
      tg = { el, name: el.querySelector('.n')!, info: el.querySelector('.i')! };
      this.tags[i] = tg;
    }
    return tg;
  }

  /** jedes Frame; `me` = eigener Spieler, ohne Koop alles ausblenden */
  update(players: readonly Player[], me: number, project: (x: number, y: number, z: number, out: { x: number; y: number }) => void, w: number, h: number): void {
    const koop = players.length > 1;
    this.root.style.display = koop ? '' : 'none';
    if (!koop) return;
    for (let i = 0; i < players.length; i++) {
      const p = players[i], tg = this.tag(i);
      const show = i !== me && (p.alive || p.downed);
      tg.el.style.display = show || (i === me && p.downed) ? '' : 'none';
      if (!show && !(i === me && p.downed)) continue;
      if (tg.name.textContent !== p.name) tg.name.textContent = p.name;
      const info = p.downed ? (i === me ? t('Warte auf Hilfe …') : t('Hilfe! {p} %', { p: Math.round((p.reviveT / KOOP.reviveZeit) * 100) })) : '';
      if (tg.info.textContent !== info) tg.info.textContent = info;
      project(p.x, p.downed ? 0.6 : 1.9, p.z, this.pt);
      const m = 24;
      const off = this.pt.x < m || this.pt.y < m + 40 || this.pt.x > w - m || this.pt.y > h - m;
      tg.el.classList.toggle('off', off);
      tg.el.classList.toggle('down', p.downed);
      let x = this.pt.x, y = this.pt.y;
      if (off) {
        // an den Rand klemmen, Pfeil zeigt in die Richtung
        const cx = w / 2, cy = h / 2, dx = x - cx, dy = y - cy;
        const k = Math.min((w / 2 - m) / Math.max(1, Math.abs(dx)), (h / 2 - m - 20) / Math.max(1, Math.abs(dy)));
        x = cx + dx * k; y = cy + dy * k;
        tg.el.style.setProperty('--a', `${Math.atan2(dy, dx)}rad`);
      }
      tg.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    }
    for (let i = players.length; i < this.tags.length; i++) this.tags[i].el.style.display = 'none';
  }
}
