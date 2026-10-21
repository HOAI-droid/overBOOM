import { shade, type HeroParts } from '../models.ts';
import { HdBau, stufe, gesicht, TINTE } from './gegnerA.ts';

/** Voxelgröße des HD-Helden */
export const HERO_VOXEL_HD = 0.05;

/**
 * HD-Held (Kawumm-Jäger) in Heldenfarbe, Blickrichtung +z. Gleicher Aufbau wie `heroParts`
 * (Teile + Drehpunkte), aber halbe Voxelgröße: 36 Voxel hoch à 0,05 m.
 * Helm, Anzug und Schulterpolster tragen die Heldenfarbe – daran unterscheiden sich die Helden.
 */
export function heroPartsHd(color: string): HeroParts {
  const dunkel = shade(color, 0.62), hell = shade(color, 1.18);
  const haut = '#f2c08a', hose = '#2b2140', stiefel = '#1d1530', leder = '#6b4b2e', gurt = '#5a3a1a';

  // Bein: Hose, Knieschoner, Stiefel mit Kappe (Drehpunkt an der Hüfte)
  const bein = (x0: number) => new HdBau()
    .box(x0, x0 + 3, 3, 7, -2, 1, hose).box(x0, x0 + 3, 7, 7, -2, 1, '#241b36')
    .box(x0, x0 + 3, 4, 5, 1, 1, dunkel)
    .box(x0, x0 + 3, 0, 2, -2, 3, stiefel).box(x0, x0 + 3, 0, 0, -2, 3, '#120c20').box(x0, x0 + 3, 1, 2, 3, 3, '#2a2040')
    .box(x0, x0 + 3, 2, 2, -2, 1, '#3b2d55')
    .list();

  const b = new HdBau();
  // Gürtel mit Schnalle und Taschen
  b.box(-4, 3, 8, 9, -2, 2, gurt).box(-1, 0, 8, 9, 3, 3, '#ffd23f').v(-1, 8, 3, '#c89a20');
  b.box(-4, -3, 8, 9, 3, 3, '#4a2e14').box(2, 3, 8, 9, 3, 3, '#4a2e14');
  // Rumpf im Anzug, oben dunkler Brustpanzer, leuchtender Kern
  b.rbox(-4, 3, 10, 17, -2, 2, 1, (x, y, z) => {
    if (z === 2 && y >= 15) return dunkel;
    return stufe(color, (y - 10) / 7, 0.86, 1.06);
  });
  b.box(-4, 3, 17, 17, -2, 2, dunkel);
  b.box(-3, -3, 10, 16, 3, 3, leder).box(2, 2, 10, 16, 3, 3, leder);
  b.box(-1, 0, 12, 13, 3, 3, '#3de8ff', 1).box(-2, 1, 12, 13, 3, 3, '#3de8ff', 1).box(-1, 0, 12, 13, 4, 4, '#a8f6ff', 1);
  // Rucksack mit Treibstofftank und Warnlicht
  b.box(-4, 3, 10, 17, -4, -3, leder).box(-4, 3, 13, 13, -4, -4, '#5a3a22').box(-3, 2, 11, 12, -5, -5, '#5a3a22');
  b.box(-2, 1, 12, 19, -6, -5, '#7d8597').box(-2, 1, 19, 19, -6, -5, '#9aa3b5').box(-2, 1, 14, 14, -6, -5, '#ff7a1a').box(-2, 1, 16, 16, -6, -5, '#5a5f68');
  b.box(-1, 0, 20, 20, -7, -6, '#ff7a1a', 1).v(-1, 21, -7, '#ffd23f', 1);
  // Kopf
  b.rbox(-6, 5, 18, 27, -6, 5, 1.6, (x, y) => stufe(haut, (y - 18) / 9, 0.9, 1.04));
  b.box(-7, -7, 21, 22, -1, 0, '#e0a870').box(6, 6, 21, 22, -1, 0, '#e0a870');
  gesicht(b, 21, { w: 3, h: 3, gap: 1, pupil: '#2a1a3a', brow: '#4a2a1a', browDick: 1, neigung: 1, mouth: null });
  // entschlossenes Grinsen, Wangen
  for (let x = -2; x <= 1; x++) b.vorn(x, 19, '#a8505a');
  b.vorn(-3, 20, '#a8505a').vorn(2, 20, '#a8505a').vorn(-1, 19, '#fff6d8').vorn(0, 19, '#fff6d8');
  b.vorn(-5, 20, '#f0a090').vorn(-4, 20, '#f0a090').vorn(3, 20, '#f0a090').vorn(4, 20, '#f0a090');
  // Haarsträhnen unter dem Helm
  b.box(-6, -3, 25, 25, 5, 5, '#5a3418').box(-6, -6, 21, 25, 2, 4, '#5a3418').box(5, 5, 21, 25, 2, 4, '#5a3418').box(2, 5, 25, 25, 5, 5, '#5a3418').v(-2, 25, 5, '#6a4020');
  // Helm in Heldenfarbe mit Schirm und Nackenschutz
  b.rbox(-7, 6, 26, 30, -7, 5, 1.6, (x, y) => stufe(color, (y - 26) / 4, 0.9, 1.1));
  b.box(-7, 6, 26, 26, -7, 5, dunkel);
  b.box(-6, 5, 26, 26, 6, 6, dunkel).box(-4, 3, 26, 26, 7, 7, dunkel);
  b.box(-7, 6, 22, 25, -7, -6, color).box(-7, 6, 22, 22, -7, -6, dunkel);
  // Blitz-Abzeichen vorne am Helm
  b.v(0, 30, 5, '#ffd23f').v(0, 29, 6, '#ffd23f').v(-1, 29, 6, '#ffd23f').v(-1, 28, 6, '#ffd23f').v(-1, 27, 6, '#ffe680');
  // Federbusch
  b.box(-1, 0, 31, 32, -2, 1, '#ffd23f').box(-1, 0, 31, 31, -3, 2, '#e8b830');
  b.box(-1, 0, 33, 34, -4, 0, '#ff7a1a').box(-1, 0, 35, 35, -3, -1, '#ff9a3a').box(-1, 0, 33, 33, -6, -5, '#ff5a14').v(-1, 32, -6, '#ff5a14').v(0, 32, -6, '#ff5a14');
  b.box(-1, 0, 33, 33, 1, 1, '#ffd23f');

  // Arme: Ärmel in Heldenfarbe, Schulterpolster, Handschuh
  const arm = (x0: number) => new HdBau()
    .box(x0, x0 + 1, 12, 17, -2, 1, color).box(x0, x0 + 1, 12, 12, -2, 1, dunkel)
    .box(x0 - (x0 < 0 ? 1 : 0), x0 + 1 + (x0 < 0 ? 0 : 1), 16, 17, -2, 1, hell)
    .box(x0, x0 + 1, 10, 11, -2, 1, haut).box(x0, x0 + 1, 10, 10, -1, 1, '#e0a870');
  const armL = arm(-6).list();
  // Blaster in der rechten Hand
  const armR = arm(4)
    .box(4, 7, 10, 13, 2, 7, '#7d8597').box(4, 7, 13, 13, 2, 7, '#9aa3b5').box(5, 6, 9, 9, 2, 3, '#2a2e38')
    .box(5, 6, 11, 12, 8, 9, '#2a2e38').box(5, 6, 11, 12, 10, 10, '#3de8ff', 1)
    .box(5, 6, 14, 14, 3, 5, '#2a2e38').box(5, 6, 14, 15, 4, 5, '#3de8ff', 1).v(6, 15, 5, '#e8fdff', 1)
    .box(8, 8, 11, 12, 3, 6, '#ff7a1a')
    .list();
  return {
    body: b.list(),
    legL: bein(-4),
    legR: bein(0),
    armL,
    armR,
    pivots: { legL: [-2, 8, 0], legR: [2, 8, 0], armL: [-5, 18, 0], armR: [5, 18, 0] }
  };
}
