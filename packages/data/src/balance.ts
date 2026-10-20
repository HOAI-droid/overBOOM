/**
 * OVERBOOM – zentrale Balancing-Werte. Logik liest nur von hier,
 * damit sich das Spielgefühl ohne Code-Änderung justieren lässt.
 */

export const SPIELER = {
  maxHp: 60,
  /** Unverwundbarkeit nach einem Treffer in s */
  schutzzeit: 0.75,
  /** ab dieser Distanz fliegen Kristalle zum Spieler */
  magnetRadius: 2.4,
  sammelRadius: 0.5,
  /** Startwaffen für Phase 2 (später: Heldenwahl) */
  startWaffen: ['pistole', 'raketenwerfer', 'teslastab'] as readonly string[],
  /** Abstand der schwebenden Waffen zur Figur */
  waffenAbstand: 0.75
};

export const WELLEN = {
  /** Wellendauer in s (20 → 60) */
  dauer: (w: number) => Math.min(60, 20 + (w - 1) * 5),
  /** neue Gegner pro Sekunde */
  spawnRate: (w: number) => 2.4 + 0.55 * (w - 1),
  /** HP-Multiplikator der Gegner */
  hpFaktor: (w: number) => 1 + 0.22 * (w - 1),
  maxGegner: 140,
  /** Pause zwischen den Wellen (Phase 3: Shop) */
  pause: 5,
  /** Vorwarnzeit (rotes Kreuz) vor dem Spawn */
  warnung: 1,
  /** Mindestabstand eines Spawns zum Spieler */
  mindestAbstand: 4.5,
  /** Grummelbolde kommen manchmal im Rudel */
  rudelChance: 0.35
};

export const KAMPF = {
  kritChance: 0.1,
  kritFaktor: 2,
  /** Explosionsschaden am Rand relativ zur Mitte */
  randSchaden: 0.45,
  /** Verzögerung je Kettenglied – macht Ketten sichtbar */
  kettenVerzoegerung: 0.11,
  explosionsRadius: 2,
  fassRadius: 2.6,
  fassSchaden: 40,
  blitzSpruenge: 4,
  blitzReichweite: 3.4,
  blitzAbfall: 0.8,
  rueckstoss: 7,
  /** Geschosstempo je Antrieb in m/s */
  tempo: { gerade: 16, faecher: 13, zielsuchend: 9, zielbogen: 9 } as Record<string, number>,
  /** Ab dieser Kettenlänge gibt es ein „CHAIN ×N!" */
  kettenAnzeige: 3
};
