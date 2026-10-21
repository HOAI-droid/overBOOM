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
  /** Lebensraub heilt höchstens so viel pro Sekunde */
  lebensraubProSek: 3,
  maxAusweichen: 60,
  /** Abstand der schwebenden Waffen zur Figur */
  waffenAbstand: 0.75
};

/** Wellen über einer Schwelle (0 davor) – für Zuschläge nur im späten Spiel */
const spaet = (w: number, ab: number) => Math.max(0, w - ab);
/**
 * Kurven der ersten 15 Wellen (wie v0.11); danach Potenzgesetz – gemessen mit dem Balancing-Bot,
 * wie schnell Schaden (≈ Welle^2,0–2,4) und Leben (≈ Welle^1,9) des Spielers über die Reise wachsen.
 */
const frueh = {
  spawn: (w: number) => 1.1 + 0.42 * (w - 1) + 0.025 * spaet(w, 10) ** 2,
  hp: (w: number) => 1 + 0.25 * (w - 1) + 0.03 * (w - 1) * (w - 1) + 0.13 * spaet(w, 8) ** 2,
  schaden: (w: number) => 1 + 0.12 * (w - 1) + 0.055 * spaet(w, 8) ** 2
};

export const WELLEN = {
  /** Wellendauer in s (20 → 60) */
  dauer: (w: number) => Math.min(60, 20 + (w - 1) * 5),
  /** neue Gegner pro Sekunde (die Obergrenze maxGegner bremst später ohnehin) */
  spawnRate: (w: number) => w <= 15 ? frueh.spawn(w) : frueh.spawn(15) * (w / 15) ** 1.2,
  /** HP-Multiplikator der Gegner: bis Welle 25 wie gehabt, danach wie die Spielerstärke (Messung des Bots) */
  hpFaktor: (w: number) => w <= 15 ? frueh.hp(w) : frueh.hp(15) * (w / 15) ** 2.15,
  /** Schadens-Multiplikator der Gegner: danach etwas langsamer als bisher, damit das Leben mithält */
  schadenFaktor: (w: number) => w <= 15 ? frueh.schaden(w) : frueh.schaden(15) * (w / 15) ** 2.05,
  /**
   * Masse-Faktor (ab v0.14): später weniger, aber härtere Gegner. Spawnrate × masse,
   * Leben und Kristalle ÷ masse (gleiche Gesamtmenge), Schaden ÷ √masse.
   */
  masse: (w: number) => (w <= 6 ? 1 : Math.max(0.45, 1 - 0.045 * (w - 6))),
  maxGegner: 60,
  /** kurze Pause nach der Welle (alles explodiert, Kristalle fliegen ein), dann Shop */
  pause: 2.5,
  /** Vorwarnzeit (rotes Kreuz) vor dem Spawn */
  warnung: 1,
  /** Mindestabstand eines Spawns zum Spieler */
  mindestAbstand: 4.5,
  /** Grummelbolde kommen manchmal im Rudel */
  rudelChance: 0.35
};

/**
 * Reise über die Inseln: Ein Run führt von der Startinsel bis Bummburg.
 * Pro Insel: Inselboss in Welle `boss`, Baron(in) in der letzten Inselwelle; danach geht es weiter.
 * Nach der letzten Insel folgt das Finale gegen das Große Kawumm.
 */
export const REISE = {
  solo: { wellen: 15, boss: 10 },
  /** Koop ist kürzer (ohne Speichern) */
  koop: { wellen: 8, boss: 5 },
  /** Wellendauer in s: erste Insel wie gehabt (20 → 60), danach kürzer – die Reise ist lang */
  dauer: (inselWelle: number, inselIndex: number) =>
    inselIndex === 0 ? Math.min(60, 20 + (inselWelle - 1) * 5) : Math.min(45, 28 + (inselWelle - 1) * 2),
  /** Endlos nach dem Finale: alle so vielen Wellen ein Boss */
  endlosBoss: 5
};

/**
 * Explosionsgröße: wächst mit „Explosion %" und Großkaliber, aber immer langsamer
 * (bis ×1,6 voll, darüber halb, höchstens ×2,2). Was darüber hinausgeht, wird zu
 * Überdruck: mehr Explosionsschaden statt noch größerer Explosionen.
 */
export const EXPLOSION = {
  voll: 1.6,
  rest: 0.5,
  max: 2.2,
  /** Schaden je überzähligem Radius-Faktor */
  ueberdruck: 0.6,
  /** roher Faktor → begrenzter Radius-Faktor */
  radius: (roh: number) => Math.max(0.3, roh <= 1.6 ? roh : Math.min(2.2, 1.6 + (roh - 1.6) * 0.5)),
  /** roher Faktor → Schadensfaktor aus Überdruck */
  schaden: (roh: number) => 1 + Math.max(0, roh - EXPLOSION.radius(roh)) * 0.6
};

export const KAMPF = {
  /** Grundschaden aller Waffen (Stellschraube fürs Balancing) */
  waffenSchaden: 1,
  kritChance: 0.1,
  kritFaktor: 2,
  /** Explosionsschaden am Rand relativ zur Mitte */
  randSchaden: 0.35,
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
  schaden: [1, 1.5, 2.15, 3.05, 4.2],
  feuerrate: [1, 1.1, 1.2, 1.32, 1.45],
  preis: [1, 2, 3.8, 7, 12]
};

export const LEVEL = {
  /** XP für den nächsten Level ((Level + 3)²) */
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
  /** Fusionswaffen im Angebot: ab dieser Insel (0-basiert), Anteil an Waffenangeboten, Preisfaktor 5–8× */
  fusionAbInsel: 2,
  fusionAnteil: 0.22,
  fusionPreis: [5, 8] as const,
  /** Chance, dass eine angebotene Fusion einer eigenen gleicht (zum Mergen) */
  fusionEigene: 0.5,
  /** Antriebe, die die Simulation kann – seit Phase 4 alle 19, also sind alle 60 Waffen im Shop */
  antriebe: ['gerade', 'faecher', 'bogen', 'zielsuchend', 'zielbogen', 'orbit', 'abprall', 'bumerang', 'spirale', 'strahl',
    'kegel', 'regen', 'huepfend', 'ablegen', 'turm', 'schwarm', 'rollen', 'teleport', 'nahkampf'] as readonly string[]
};

/**
 * Höchste Seltenheit nach Fortschritt (Insel-Nummer 0–6 in der Reihenfolge der Reise):
 * Inseln 1–2 nur die ersten zwei Klassen, 3–4 bis zur dritten, ab Insel 5 alles.
 */
export function seltenheitsDeckel(inselNr: number): 2 | 3 | 4 {
  return inselNr <= 1 ? 2 : inselNr <= 3 ? 3 : 4;
}

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
  chance: (w: number) => (w < 5 ? 0 : Math.min(0.18, 0.025 + 0.008 * (w - 5))),
  hp: 5,
  schaden: 1.5,
  groesse: 1.4,
  kristalle: 6
};

/** Ab Welle 7 kommen öfter Fernkämpfer und Stürmer (aus dem Inselpool) – man muss ausweichen */
export const VERSTAERKUNG = {
  chance: (w: number) => (w < 7 ? 0 : Math.min(0.35, 0.06 + 0.025 * (w - 7))),
  verhalten: ['fernkampf', 'sprinter', 'rutscher', 'kamikaze'] as readonly string[]
};

/** Gepanzerte Gegner: halber Explosionsschaden – wer nur Explosionen kauft, kommt ins Schwitzen */
export const PANZER = {
  abWelle: 12,
  chance: (w: number) => (w < 12 ? 0 : Math.min(0.3, 0.08 + 0.01 * (w - 12))),
  explosionsFaktor: 0.5
};

/** Elite-Gegner ab Welle 7: Sonderangriff (angekündigter Kugelring) */
export const ELITE_ANGRIFF = {
  abWelle: 7,
  intervall: 4.5,
  /** Vorwarnung (Aufleuchten) */
  warnung: 0.6,
  kugeln: 8,
  tempo: 4.2,
  schaden: 7
};

export const BOSS = {
  /**
   * Boss-Leben wächst wie das der normalen Gegner (vorher fest – Bosse lagen nach Sekunden).
   * Ziel: Inselboss ~30–60 s, Baron etwas länger, Finale ein langer Kampf in drei Phasen.
   */
  hpFaktor: (w: number, rang: 'boss' | 'baron' | 'finale' = 'boss') => WELLEN.hpFaktor(w) * BOSS.rangLeben[rang] * (w < 10 ? 0.6 + 0.04 * w : 1),
  rangLeben: { boss: 2.2, baron: 2.6, finale: 3 } as Record<'boss' | 'baron' | 'finale', number>,
  /** Spawnrate normaler Gegner in Boss-Wellen */
  spawnAnteil: 0.4,
  bombenSchaden: 16,
  bombenRadius: 1.8,
  flugzeit: 1.1,
  phase1: { intervall: 2.3, salve: 3 },
  phase2: { intervall: 1.7, salve: 6, kroetenIntervall: 6.5, kroeten: 3 },
  /** Pausen zwischen den Angriffen je Rang (Faktor) */
  rangTempo: { boss: 1, baron: 0.85, finale: 0.75 } as Record<'boss' | 'baron' | 'finale', number>,
  /** Grundschaden eines Boss-Geschosses */
  schuss: 9,
  /** Anzahl Bodenflächen je Phase */
  flaechen: [4, 6, 8] as readonly number[],
  flaechenRadius: 1.5,
  flaechenSchaden: 18,
  sprungRadius: 2.4,
  sprungSchaden: 22,
  minenSchaden: 14
};

/** Koop (2–4 Spieler): Gegner zäher und zahlreicher, Wiederbeleben über den Revive-Ring */
export const KOOP = {
  maxSpieler: 4,
  /** Gegner-Leben +35 % je weiterem Spieler */
  hpProSpieler: 0.35,
  /** Spawnrate +30 % je weiterem Spieler */
  spawnProSpieler: 0.3,
  /** Boss-Leben +45 % je weiterem Spieler */
  bossProSpieler: 0.45,
  /** so lange muss ein Mitspieler im Ring stehen (s) */
  reviveZeit: 2.5,
  reviveRadius: 1.5,
  /** Leben nach dem Wiederbeleben (Anteil) */
  reviveLeben: 0.4,
  /** Fortschritt verfällt, wenn niemand im Ring steht (pro s) */
  reviveVerfall: 0.6
};

/** Overkill-Leiste: füllt sich durch Kills und Ketten; voll → OVERBOOM-Modus */
export const OVERKILL = {
  proKill: 0.012,
  proKettenglied: 0.012,
  /** Dauer des OVERBOOM-Modus (s) */
  dauer: 5,
  /** Feuerrate × im Modus */
  feuerrate: 2,
  /** Mini-Explosion bei jedem Treffer: Radius, Schadensanteil */
  bummRadius: 1.2,
  bummSchaden: 0.5
};
