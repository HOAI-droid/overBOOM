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
  /** zur Wahl beim Run-Start (je 1 Waffe) */
  startAuswahl: ['pistole', 'raketenwerfer', 'teslastab', 'schrotflinte'] as readonly string[],
  maxWaffen: 6,
  /** Unverwundbarkeit, Rüstung: Schaden × 15 / (15 + Rüstung) */
  ruestungsKonstante: 15,
  maxAusweichen: 60,
  /** Abstand der schwebenden Waffen zur Figur */
  waffenAbstand: 0.75
};

export const WELLEN = {
  /** Wellendauer in s (20 → 60) */
  dauer: (w: number) => Math.min(60, 20 + (w - 1) * 5),
  /** neue Gegner pro Sekunde */
  spawnRate: (w: number) => 1.1 + 0.42 * (w - 1),
  /** HP-Multiplikator der Gegner */
  hpFaktor: (w: number) => 1 + 0.25 * (w - 1) + 0.03 * (w - 1) * (w - 1),
  /** Schadens-Multiplikator der Gegner */
  schadenFaktor: (w: number) => 1 + 0.12 * (w - 1),
  /** Wellen pro Run; danach Sieg (optional Endlos) */
  anzahl: 20,
  bossWellen: [10, 20] as readonly number[],
  maxGegner: 140,
  /** kurze Pause nach der Welle (alles explodiert, Kristalle fliegen ein), dann Shop */
  pause: 2.5,
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
  tempo: { gerade: 16, faecher: 13, zielsuchend: 9, zielbogen: 9, bogen: 9, abprall: 13, bumerang: 11, spirale: 6, rollen: 7, huepfend: 8, schwarm: 9 } as Record<string, number>,
  /** Ab dieser Kettenlänge gibt es ein „CHAIN ×N!" */
  kettenAnzeige: 3
};

/** Waffen-Stufen I–V: Merge von 2 gleichen Waffen gleicher Stufe → nächste Stufe */
export const STUFEN = {
  schaden: [1, 1.5, 2.2, 3.2, 4.6],
  feuerrate: [1, 1.1, 1.2, 1.32, 1.45],
  preis: [1, 2, 3.8, 7, 12]
};

export const LEVEL = {
  /** XP für den nächsten Level (wie Brotato: (Level + 3)²) */
  xpBedarf: (level: number) => (level + 3) * (level + 3),
  /** +Max-Leben pro Level */
  hpProLevel: 1,
  angebote: 4
};

export const SHOP = {
  angebote: 4,
  /** Anteil Waffen an den Angeboten */
  waffenAnteil: 0.4,
  waffenGrundpreis: 20,
  /** Preise steigen mit der Welle */
  inflation: (w: number) => 1 + 0.1 * (w - 1),
  rerollPreis: (w: number, rerolls: number) => 2 + Math.floor(w * 0.6) + rerolls * Math.max(1, Math.floor(w / 3)),
  verkaufsAnteil: 0.4,
  /** Antriebe, die die Simulation kann – seit Phase 4 alle 19, also sind alle 60 Waffen im Shop */
  antriebe: ['gerade', 'faecher', 'bogen', 'zielsuchend', 'zielbogen', 'orbit', 'abprall', 'bumerang', 'spirale', 'strahl',
    'kegel', 'regen', 'huepfend', 'ablegen', 'turm', 'schwarm', 'rollen', 'teleport', 'nahkampf'] as readonly string[]
};

/**
 * Wahrscheinlichkeit für Seltenheit/Stufe 2–4 abhängig von Welle und Glück.
 * Gibt eine Stufe 1–4 zurück; r ist eine Zufallszahl in [0, 1).
 */
export function rollSeltenheit(welle: number, glueck: number, r: number): 1 | 2 | 3 | 4 {
  const g = 1 + Math.max(-0.9, glueck / 100);
  const p4 = Math.min(0.12, Math.max(0, (welle - 8) * 0.012) * g);
  const p3 = Math.min(0.28, Math.max(0, (welle - 3) * 0.025) * g);
  const p2 = Math.min(0.55, Math.max(0, (welle - 1) * 0.06 + 0.05) * g);
  if (r < p4) return 4;
  if (r < p4 + p3) return 3;
  if (r < p4 + p3 + p2) return 2;
  return 1;
}

export const ELITE = {
  /** Chance pro Spawn, dass ein Elite-Gegner kommt */
  chance: (w: number) => (w < 5 ? 0 : Math.min(0.08, 0.025 + 0.004 * (w - 5))),
  hp: 5,
  schaden: 1.5,
  groesse: 1.4,
  kristalle: 6
};

export const BOSS = {
  hpFaktor: (w: number) => (w >= 20 ? 2.6 : 1) * (1 + Math.max(0, w - 20) * 0.3),
  /** Spawnrate normaler Gegner in Boss-Wellen */
  spawnAnteil: 0.4,
  bombenSchaden: 16,
  bombenRadius: 1.8,
  flugzeit: 1.1,
  phase1: { intervall: 2.3, salve: 3 },
  phase2: { intervall: 1.7, salve: 6, kroetenIntervall: 6.5, kroeten: 3 }
};

/** Koop (2–4 Spieler): Gegner zäher und zahlreicher, Wiederbeleben über den Revive-Ring */
export const KOOP = {
  maxSpieler: 4,
  /** Gegner-Leben +35 % je weiterem Spieler */
  hpProSpieler: 0.35,
  /** Spawnrate +30 % je weiterem Spieler */
  spawnProSpieler: 0.3,
  /** Boss-Leben +60 % je weiterem Spieler */
  bossProSpieler: 0.6,
  /** so lange muss ein Mitspieler im Ring stehen (s) */
  reviveZeit: 2.5,
  reviveRadius: 1.5,
  /** Leben nach dem Wiederbeleben (Anteil) */
  reviveLeben: 0.4,
  /** Fortschritt verfällt, wenn niemand im Ring steht (pro s) */
  reviveVerfall: 0.6
};
