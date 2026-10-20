/**
 * OVERBOOM – Gegner (Phase 2: die ersten drei Typen)
 *
 * „Grimmig, aber knuffig": große Köpfe, schräge Wut-Brauen, nie gruselig.
 * Werte sind Grundwerte auf Welle 1; die Wellen skalieren HP (siehe balance.ts).
 */

export type Verhalten = 'jagen' | 'kamikaze' | 'fernkampf';

export interface GegnerDef {
  id: string;
  name: string;
  fraktion: string;
  spruch: string;
  text: string;
  verhalten: Verhalten;
  hp: number;
  /** Lauftempo in m/s */
  tempo: number;
  /** Kollisionsradius in m */
  radius: number;
  /** Schaden bei Berührung */
  beruehrSchaden: number;
  /** Anzahl Kristalle beim Tod */
  kristalle: number;
  /** taucht ab dieser Welle auf */
  abWelle: number;
  /** relative Spawn-Häufigkeit */
  gewicht: number;
  /** Rückstoß wird durch die Masse geteilt */
  masse: number;

  // Kamikaze
  sprungDistanz?: number;
  explosionsRadius?: number;
  explosionsSchaden?: number;

  // Fernkampf
  wunschAbstand?: number;
  schussIntervall?: number;
  schussSchaden?: number;
  schussTempo?: number;
}

export const GEGNER: GegnerDef[] = [
  {
    id: 'grummelbold',
    name: 'Grummelbold',
    fraktion: 'Grummel-Fraktion',
    spruch: '„Grmpf. Meins!"',
    text: 'Grüner Kobold mit verbeultem Kochtopf als Helm. Grummelt beim Laufen und kommt nie allein.',
    verhalten: 'jagen',
    hp: 16, tempo: 2.6, radius: 0.32, beruehrSchaden: 8, kristalle: 1,
    abWelle: 1, gewicht: 6, masse: 1
  },
  {
    id: 'bombenkroete',
    name: 'Bomben-Kröte',
    fraktion: 'Sumpfbande',
    spruch: '„Quaaak … KAWUMM!"',
    text: 'Dicke lila Kröte mit Glupschaugen und Bombe auf dem Rücken. Springt dir vor die Füße – und explodiert auch, wenn man sie erwischt.',
    verhalten: 'kamikaze',
    hp: 12, tempo: 2.1, radius: 0.36, beruehrSchaden: 5, kristalle: 2,
    abWelle: 1, gewicht: 2.2, masse: 1.3,
    sprungDistanz: 2.8, explosionsRadius: 1.9, explosionsSchaden: 16
  },
  {
    id: 'toastomat',
    name: 'Toastomat',
    fraktion: 'Blechbrut',
    spruch: '„Frühstück ist serviert!"',
    text: 'Wütender Toaster auf Stelzenbeinen mit roten LED-Augenbrauen. Hält Abstand und schießt glühenden Toast.',
    verhalten: 'fernkampf',
    hp: 24, tempo: 1.8, radius: 0.34, beruehrSchaden: 6, kristalle: 3,
    abWelle: 2, gewicht: 1.6, masse: 1.6,
    wunschAbstand: 5, schussIntervall: 2.4, schussSchaden: 9, schussTempo: 6.5
  }
];

export const GEGNER_BY_ID: Record<string, GegnerDef> = Object.fromEntries(GEGNER.map((g) => [g.id, g]));
