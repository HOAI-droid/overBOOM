import { ELEMENT_INFO, KARTEN_SET, SELTENHEIT, kartenNummer, type Karte } from '@overboom/data';
import { kartenFarbe } from './album.ts';

const B = 300, H = 420, S = 2; // Kartengröße in CSS-Pixeln, Skalierung fürs Bild

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Zeichnet eine Sammelkarte mit Rahmen als PNG (zum Teilen) */
export async function karteAlsBild(k: Karte, artUrl: string, glanz: boolean): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = B * S; c.height = H * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);
  ctx.imageSmoothingEnabled = false;
  const ec = kartenFarbe(k), rar = SELTENHEIT[k.seltenheit - 1];
  const font = (px: number, bold = false) => `${bold ? '700 ' : ''}${px}px Silkscreen, monospace`;

  // Rahmen
  ctx.fillStyle = '#0b0814'; ctx.fillRect(0, 0, B, H);
  ctx.fillStyle = ec; ctx.fillRect(6, 6, B - 12, H - 12);
  ctx.fillStyle = '#1c1434'; ctx.fillRect(14, 14, B - 28, H - 28);
  ctx.fillStyle = rar.farbe; ctx.fillRect(14, 14, B - 28, 3);

  // Kopf: Name und Hauptwert
  ctx.fillStyle = '#f4ecff'; ctx.font = font(15, true); ctx.textBaseline = 'top';
  ctx.fillText(k.name.toUpperCase().slice(0, 22), 22, 24);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd23f'; ctx.font = font(15, true);
  ctx.fillText(String(k.wert.zahl), B - 22, 24);
  ctx.font = font(7); ctx.fillStyle = '#c9bfe8'; ctx.fillText(k.wert.name.toUpperCase(), B - 22, 42);
  ctx.textAlign = 'left';

  // Artwork
  const ax = 22, ay = 54, aw = B - 44, ah = 168;
  const g = ctx.createLinearGradient(0, ay, 0, ay + ah);
  g.addColorStop(0, '#3a2a6a'); g.addColorStop(1, '#140e24');
  ctx.fillStyle = g; ctx.fillRect(ax, ay, aw, ah);
  ctx.strokeStyle = ec; ctx.lineWidth = 2; ctx.strokeRect(ax + 1, ay + 1, aw - 2, ah - 2);
  try {
    const img = await loadImage(artUrl);
    const sz = Math.min(aw, ah) - 8;
    ctx.drawImage(img, ax + (aw - sz) / 2, ay + (ah - sz) / 2, sz, sz);
  } catch { /* ohne Bild */ }

  // Typzeile + Elemente
  let y = ay + ah + 8;
  ctx.fillStyle = '#2a1f45'; ctx.fillRect(22, y, B - 44, 18);
  ctx.fillStyle = '#f4ecff'; ctx.font = font(8);
  ctx.fillText(k.typzeile.slice(0, 40), 26, y + 5);
  k.elemente.forEach((e, i) => {
    const info = ELEMENT_INFO[e], x0 = B - 26 - (i + 1) * 16;
    ctx.fillStyle = '#140e24'; ctx.fillRect(x0, y + 2, 14, 14);
    ctx.fillStyle = info.farbe;
    info.symbol.forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') ctx.fillRect(x0 + 2 + rx * 2, y + 4 + ry * 2, 2, 2); });
  });
  y += 26;

  // Fähigkeiten, Flavor, Zitat
  ctx.font = font(8);
  for (const f of k.faehigkeiten) {
    ctx.fillStyle = '#ffd23f'; ctx.font = font(8, true);
    ctx.fillText(f.name.toUpperCase(), 22, y);
    y += 11;
    ctx.fillStyle = '#e8e2f0'; ctx.font = font(8);
    for (const l of wrap(ctx, f.text, B - 44).slice(0, 2)) { ctx.fillText(l, 22, y); y += 10; }
    y += 3;
    if (y > H - 70) break;
  }
  ctx.fillStyle = '#9a94b0';
  for (const l of wrap(ctx, k.zitat || k.flavor, B - 44).slice(0, 3)) { if (y > H - 44) break; ctx.fillText(l, 22, y); y += 10; }

  // Fuß
  ctx.fillStyle = '#c9bfe8'; ctx.font = font(7);
  ctx.fillText(`${KARTEN_SET.name.toUpperCase()} · ${kartenNummer(k)}`, 22, H - 38);
  ctx.textAlign = 'right'; ctx.fillStyle = rar.farbe;
  ctx.fillText(rar.name.toUpperCase(), B - 22, H - 38);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff7a1a'; ctx.font = font(7, true);
  ctx.fillText('OVERBOOM', 22, H - 27);

  // Glanz: Regenbogen-Schimmer
  if (glanz) {
    const h = ctx.createLinearGradient(0, 0, B, H);
    h.addColorStop(0.2, 'rgba(255,61,240,0)'); h.addColorStop(0.35, 'rgba(255,61,240,0.22)');
    h.addColorStop(0.5, 'rgba(61,232,255,0.22)'); h.addColorStop(0.65, 'rgba(255,210,63,0.22)'); h.addColorStop(0.8, 'rgba(255,210,63,0)');
    ctx.fillStyle = h; ctx.fillRect(6, 6, B - 12, H - 12);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG fehlgeschlagen'))), 'image/png'));
}
