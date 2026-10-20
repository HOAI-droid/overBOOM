import { HELDEN, HELD_BY_ID, INSELN, INSEL_BY_ID, KOOP, W, t } from '@overboom/data';
import type { LobbySpieler } from '@overboom/net';
import qrcode from 'qrcode-generator';
import { gefahrWahl } from './gefahr.ts';

/** Was die Lobby anzeigt – die App füllt das aus der Host-/Client-Sitzung */
export interface CoopAnsicht {
  rolle: 'host' | 'client';
  code: string;
  link: string;
  spieler: LobbySpieler[];
  /** eigener Platz (−1 = noch nicht verbunden) */
  slot: number;
  insel: string;
  /** Status- oder Fehlermeldung */
  status: string;
  fehler: boolean;
  /** freigeschaltete Inseln (Host) */
  inselnFrei: string[];
  /** freigeschaltete Helden */
  heldenFrei: string[];
  gefahr: number;
  /** höchste wählbare Stufe (Host) */
  gefahrFrei: number;
}

export type CoopAktion =
  | { t: 'solo' }
  | { t: 'erstellen'; name: string }
  | { t: 'beitreten'; code: string; name: string }
  | { t: 'held'; id: string }
  | { t: 'bereit'; on: boolean }
  | { t: 'insel'; id: string }
  | { t: 'gefahr'; n: number }
  | { t: 'start' }
  | { t: 'teilen' }
  | { t: 'verlassen' };

const FARBEN = ['#3de8ff', '#ff3df0', '#ffd23f', '#7dff5a'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function qrSvg(text: string): string {
  try {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
  } catch { return ''; }
}

/** Titelbildschirm */
export function titelHtml(name: string, code: string, albumBtn: string, extra = '', tipp = '', hinweis = ''): string {
  return `
    <div class="ob-panel ob-titel">
      <h1 class="ob-logo"><b>OVER</b><b class="boom">BOOM</b></h1>
      <p class="ob-sub">${t('Arena-Chaos mit Waffen-Fusion · 1–4 Spieler')}</p>
      <div class="ob-titel-row">
        <button type="button" class="ob-go ob-big" data-act="tsolo" data-focus="tsolo">${t('Solo spielen')}</button>
      </div>
      <h3 class="ob-h3">${t('Koop')} <small>${t('bis zu 4 Spieler, jeder am eigenen Gerät')}</small></h3>
      <label class="ob-field"><span>${t('Dein Name')}</span><input type="text" maxlength="16" data-name value="${esc(name)}" autocomplete="nickname"></label>
      <div class="ob-titel-row">
        <button type="button" class="ob-btn2" data-act="terstellen" data-focus="terstellen">${t('Raum erstellen')}</button>
        <input class="ob-codein" type="text" maxlength="7" placeholder="${t('CODE')}" data-code value="${esc(code)}" autocapitalize="characters" autocomplete="off" aria-label="${t('Raumcode')}">
        <button type="button" class="ob-btn2" data-act="tbeitreten" data-focus="tbeitreten">${t('Beitreten')}</button>
      </div>
      <div class="ob-titel-row">${albumBtn}${extra}</div>
      ${tipp ? `<p class="ob-tipp">${t('Tipp: {tipp}', { tipp: esc(tipp) })}</p>` : ''}
      ${hinweis ? `<p class="ob-keys ob-padkeys">${hinweis}</p>` : ''}
    </div>`;
}

/** Lobby: Raumcode, QR, Spieler mit Verbindung, Heldenwahl, Insel (Host), Start */
export function lobbyHtml(c: CoopAnsicht): string {
  const ich = c.spieler.find((s) => s.slot === c.slot);
  const host = c.rolle === 'host';
  const rows = Array.from({ length: KOOP.maxSpieler }, (_, i) => {
    const s = c.spieler[i];
    if (!s) return `<li class="leer"><i style="--c:${FARBEN[i]}"></i><span>${t('frei')}</span></li>`;
    const route = s.slot === 0 ? t('Host') : !s.verbunden ? t('getrennt …') : s.route === 'relay' ? t('über Relay · {ms} ms', { ms: s.ping }) : s.route === 'direct' ? t('direkt · {ms} ms', { ms: s.ping }) : s.route === 'local' ? t('lokal') : t('verbinde …');
    const held = HELD_BY_ID[s.held];
    return `<li class="${s.slot === c.slot ? 'ich' : ''}"><i style="--c:${FARBEN[i]}"></i>
      <b>${esc(s.name)}</b><span>${held ? held.name : '–'}</span>
      <small class="${s.route === 'relay' ? 'relay' : ''}">${route}</small>
      <em class="${s.bereit ? 'ok' : ''}">${s.bereit ? t('bereit') : t('wählt …')}</em></li>`;
  }).join('');
  const helden = HELDEN.map((h, i) => {
    const frei = c.heldenFrei.includes(h.id);
    const wf = h.startWaffe === 'zufall' ? null : W[h.startWaffe];
    return `<button type="button" class="ob-lheld ${ich?.held === h.id ? 'on' : ''}" style="--rc:${h.farbe}" data-act="lheld" data-id="${h.id}" data-focus="lheld${i}" ${frei ? '' : `disabled title="${t('Noch nicht freigeschaltet')}"`}>
      <b>${frei ? h.name : '???'}</b><small>${frei ? (wf ? wf.name : t('Zufallswaffe')) : t('gesperrt')}</small></button>`;
  }).join('');
  const inseln = INSELN.map((i, k) => {
    const frei = c.inselnFrei.includes(i.id);
    return `<button type="button" class="ob-lheld ${c.insel === i.id ? 'on' : ''}" style="--rc:${i.farben.spezial[0]}" data-act="linsel" data-id="${i.id}" data-focus="linsel${k}" ${host && frei ? '' : 'disabled'}>
      <b>${frei || !host ? i.name : '🔒︎ ' + i.name}</b><small>${i.fraktion}</small></button>`;
  }).join('');
  const alleBereit = c.spieler.length > 1 && c.spieler.every((s) => s.bereit && s.verbunden);
  const insel = INSEL_BY_ID[c.insel];
  return `
    <div class="ob-panel ob-wide ob-lobby">
      <div class="ob-shop-head">
        <div><h2 class="ob-h">${t('Koop-Lobby')}</h2><small class="ob-sub">${host ? t('Du bist Host – dein Gerät rechnet für alle.') : t('Der Host startet, sobald alle bereit sind.')}</small></div>
        <button type="button" class="ob-btn2" data-act="lverlassen" data-focus="lverlassen">${t('Verlassen')}</button>
      </div>
      <div class="ob-lobby-top">
        <div class="ob-raum">
          <small>${t('Raumcode')}</small>
          <div class="ob-code-big">${esc(c.code)}</div>
          <button type="button" class="ob-btn2" data-act="lteilen" data-focus="lteilen">${t('Link teilen')}</button>
        </div>
        <div class="ob-qr" aria-label="${t('QR-Code zum Beitreten')}">${c.link ? qrSvg(c.link) : ''}</div>
        <ul class="ob-lspieler">${rows}</ul>
      </div>
      ${c.status ? `<p class="${c.fehler ? 'ob-warn' : 'ob-hint2'}">${esc(c.status)}</p>` : ''}
      ${c.slot >= 0 ? `
      <h3 class="ob-h3">${t('Dein Held')}</h3>
      <div class="ob-lhelden">${helden}</div>
      <h3 class="ob-h3">${t('Insel')} <small>${host ? t('wählt der Host') : insel ? insel.name : ''}</small></h3>
      <div class="ob-lhelden">${inseln}</div>
      ${gefahrWahl(c.gefahr, c.gefahrFrei, host)}
      <div class="ob-row ob-actions">
        ${host
          ? `<button type="button" class="ob-go" data-act="lstart" data-focus="lstart" ${alleBereit ? '' : 'disabled'}>${c.spieler.length < 2 ? t('Warte auf Mitspieler …') : alleBereit ? t('Los geht’s') + ' ▶' : t('Warte, bis alle bereit sind …')}</button>`
          : `<button type="button" class="ob-go" data-act="lbereit" data-focus="lbereit">${ich?.bereit ? t('Doch nicht bereit') : t('Bereit!')}</button>`}
      </div>` : ''}
    </div>`;
}
