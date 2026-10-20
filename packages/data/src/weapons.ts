import { fusionsGrammatik } from './i18n.ts';
/**
 * OVERBOOM – Waffen-Datenbasis (Set 1 „Das Große Kawumm")
 *
 * Jede Waffe besteht aus drei Bauteilen:
 *   Geschoss  – WAS fliegt
 *   Antrieb   – WIE es fliegt
 *   Ladung    – WAS beim Treffer passiert
 *
 * Bei der Fusion liefert jede Eingangswaffe genau ein Bauteil.
 * Dadurch funktionieren alle Kombinationen systemisch, ohne Handarbeit.
 */

export type Element =
  | 'Feuer' | 'Blitz' | 'Gift' | 'Eis' | 'Explosiv' | 'Tech' | 'Natur' | 'Gacker' | 'Chaos';

export type Gruppe =
  | 'Feuerwaffen' | 'Explosiv' | 'Elementar' | 'Nahkampf' | 'Energie'
  | 'Drohnen & Türme' | 'Beschwörung' | 'Werfer' | 'Exotisch' | 'Support';

export interface Geschoss {
  id: string;
  name: string;
  /** Adjektiv für den Fusionsnamen in der weiblichen Form, z. B. „Gackernde" (Endung wird angepasst) */
  adj: string;
  text: string;
  tags: Element[];
}

export interface Antrieb {
  id: string;
  name: string;
  /** Nomen-Endung für den Fusionsnamen, z. B. „rakete" */
  nomen: string;
  /** grammatisches Geschlecht des Nomens, steuert die Adjektivendung */
  genus: 'm' | 'f' | 'n';
  text: string;
}

export interface Ladung {
  id: string;
  name: string;
  /** Wortstamm für den Fusionsnamen, z. B. „Blitz" */
  wort: string;
  text: string;
  tags: Element[];
}

export interface Waffe {
  id: string;
  name: string;
  gruppe: Gruppe;
  geschoss: string;
  antrieb: string;
  ladung: string;
  /** Grundwerte auf Tier I */
  schaden: number;
  feuerrate: number; // Schüsse pro Sekunde
  reichweite: number; // Meter
  text: string;
  /** nur bei Fusionswaffen gesetzt */
  fusion?: FusionsInfo;
  /** Sonderwirkungen geheimer Rezepte (siehe fusion.ts) und Evolutionen */
  spezial?: string[];
  /** evolvierte Waffe: Variante a oder b (siehe mods.ts) */
  evo?: 'a' | 'b';
}

export interface FusionsInfo {
  /** Waffen-IDs, die die drei Bauteile geliefert haben */
  teile: { geschoss: string; antrieb: string; ladung: string };
  quellen: string[];
  gruppen: Gruppe[];
  elemente: Element[];
  /** 0–100 */
  instabil: number;
  /** ID des geheimen Rezepts, falls eines getroffen wurde */
  rezept?: string;
}

/* ------------------------------------------------------------------ */
/* Bauteil-Bibliotheken                                                 */
/* ------------------------------------------------------------------ */

export const GESCHOSSE: Geschoss[] = [
  { id: 'kugel', name: 'Kugel', adj: 'Flinke', text: 'Klein, schnell, zuverlässig.', tags: [] },
  { id: 'nagel', name: 'Nagel', adj: 'Spitze', text: 'Bleibt stecken. In allem.', tags: ['Tech'] },
  { id: 'kartoffel', name: 'Kartoffel', adj: 'Mehlige', text: 'Hart wie eine Kartoffel. Weil es eine ist.', tags: ['Natur'] },
  { id: 'rakete', name: 'Rakete', adj: 'Zischende', text: 'Mit Rauchfahne und guter Laune.', tags: ['Explosiv'] },
  { id: 'granate', name: 'Granate', adj: 'Kullernde', text: 'Rollt ein Stück, bevor sie Ernst macht.', tags: ['Explosiv'] },
  { id: 'dynamit', name: 'Dynamitstange', adj: 'Zündelnde', text: 'Die Lunte ist immer zu kurz.', tags: ['Explosiv'] },
  { id: 'mine', name: 'Mine', adj: 'Lauernde', text: 'Wartet geduldig. Sehr geduldig.', tags: ['Explosiv', 'Tech'] },
  { id: 'schleim', name: 'Schleimbatzen', adj: 'Glibbernde', text: 'Klebt am Gegner wie Kaugummi am Schuh.', tags: ['Natur'] },
  { id: 'meteor', name: 'Meteor', adj: 'Himmlische', text: 'Ein kleiner Stein mit großem Auftritt.', tags: ['Feuer'] },
  { id: 'blitzkugel', name: 'Plasmakugel', adj: 'Knisternde', text: 'Summt leise und macht die Haare hochstehen.', tags: ['Blitz'] },
  { id: 'flamme', name: 'Flammenschwall', adj: 'Lodernde', text: 'Heiß. Sehr heiß.', tags: ['Feuer'] },
  { id: 'eiszapfen', name: 'Eiszapfen', adj: 'Frostige', text: 'Spitz, kalt und schlecht gelaunt.', tags: ['Eis'] },
  { id: 'blase', name: 'Seifenblase', adj: 'Schillernde', text: 'Platzt im ungünstigsten Moment – für den Gegner.', tags: [] },
  { id: 'wasser', name: 'Wasserstrahl', adj: 'Plätschernde', text: 'Macht nass. Nass leitet Blitze.', tags: ['Natur'] },
  { id: 'schlaeger', name: 'Baseballschläger', adj: 'Krachende', text: 'Home-Run-Garantie.', tags: [] },
  { id: 'saege', name: 'Kreissäge', adj: 'Sägende', text: 'Brrrrrrrrrr.', tags: ['Tech'] },
  { id: 'faust', name: 'Boxhandschuh', adj: 'Boxende', text: 'An einer Sprungfeder. Natürlich.', tags: [] },
  { id: 'hammer', name: 'Riesenhammer', adj: 'Wuchtige', text: 'Für Nägel zu groß. Für Gegner genau richtig.', tags: [] },
  { id: 'pfanne', name: 'Bratpfanne', adj: 'Scheppernde', text: 'BOINNNG.', tags: [] },
  { id: 'axt', name: 'Wurfaxt', adj: 'Wirbelnde', text: 'Dreht sich schneller als die Gerüchteküche.', tags: [] },
  { id: 'laser', name: 'Laserstrahl', adj: 'Strahlende', text: 'Pew. Pew pew.', tags: ['Tech'] },
  { id: 'note', name: 'Schallwelle', adj: 'Tröötende', text: 'Musik ist eine Waffe. Diese hier besonders.', tags: [] },
  { id: 'schwarzloch', name: 'Mini-Singularität', adj: 'Schluckende', text: 'Bitte nicht in die Tasche stecken.', tags: ['Chaos'] },
  { id: 'drohne', name: 'Mini-Drohne', adj: 'Surrende', text: 'Klein, wendig, nervig.', tags: ['Tech'] },
  { id: 'toast', name: 'Glühtoast', adj: 'Knusprige', text: 'Frisch aus dem Toastomaten.', tags: ['Feuer'] },
  { id: 'biene', name: 'Biene', adj: 'Summende', text: 'Fleißig im Stechen.', tags: ['Natur'] },
  { id: 'ei', name: 'Ei', adj: 'Eiernde', text: 'Was war zuerst da? Der Schaden.', tags: ['Gacker'] },
  { id: 'spore', name: 'Sporenwolke', adj: 'Stinkende', text: 'Riecht nach Pilzmoor am Montagmorgen.', tags: ['Gift', 'Natur'] },
  { id: 'gummiente', name: 'Quietscheente', adj: 'Quietschende', text: 'Quietsch. QUIETSCH.', tags: ['Chaos'] },
  { id: 'grummel', name: 'Bestochener Grummelbold', adj: 'Grummelnde', text: 'Arbeitet für Kristalle. Grummelt trotzdem.', tags: ['Chaos'] },
  { id: 'schneeball', name: 'Schneeball', adj: 'Pappige', text: 'Mit Überraschungskern.', tags: ['Eis'] },
  { id: 'bowling', name: 'Bowlingkugel', adj: 'Rollende', text: 'Strike!', tags: [] },
  { id: 'banane', name: 'Banane', adj: 'Krumme', text: 'Krumm genug, um zurückzukommen.', tags: ['Natur'] },
  { id: 'stern', name: 'Wurfstern', adj: 'Funkelnde', text: 'Glitzert kurz, bevor er trifft.', tags: [] },
  { id: 'huhn', name: 'Huhn', adj: 'Gackernde', text: 'Springt 3× und ist darüber sehr empört.', tags: ['Gacker'] },
  { id: 'luftballon', name: 'Luftballon', adj: 'Schwebende', text: 'Party! Für alle außer die Gegner.', tags: ['Chaos'] },
  { id: 'kuckuck', name: 'Kuckuck', adj: 'Pünktliche', text: 'Kommt immer zur vollen Stunde. Oder jetzt.', tags: ['Gacker'] },
  { id: 'pflaster', name: 'Pflaster', adj: 'Heilende', text: 'Klebt auf Mitspieler. Und auf Gegner – die mögen das nicht.', tags: ['Natur'] },
  { id: 'muenze', name: 'Glücksmünze', adj: 'Klimpernde', text: 'Kopf: Schaden. Zahl: mehr Schaden.', tags: [] },
  { id: 'keks', name: 'Omas Keks', adj: 'Krümelige', text: 'Mit Liebe gebacken. Und mit Rosinen.', tags: [] }
];

export const ANTRIEBE: Antrieb[] = [
  { id: 'gerade', name: 'Gerade', nomen: 'kanone', genus: 'f', text: 'Fliegt geradeaus zum nächsten Gegner.' },
  { id: 'faecher', name: 'Fächer', nomen: 'flinte', genus: 'f', text: '5 Geschosse im Fächer, kurze Reichweite.' },
  { id: 'bogen', name: 'Bogenwurf', nomen: 'mörser', genus: 'm', text: 'Fliegt im hohen Bogen über Hindernisse.' },
  { id: 'zielsuchend', name: 'Zielsuchend', nomen: 'jäger', genus: 'm', text: 'Verfolgt sein Ziel, bis es trifft.' },
  { id: 'zielbogen', name: 'Zielsuchend im Bogen', nomen: 'rakete', genus: 'f', text: 'Steigt auf und stürzt sich auf das Ziel.' },
  { id: 'orbit', name: 'Umlaufbahn', nomen: 'kreisel', genus: 'm', text: 'Kreist dauerhaft um den Spieler.' },
  { id: 'abprall', name: 'Querschläger', nomen: 'flipper', genus: 'm', text: 'Prallt 4× von Wänden und Gegnern ab.' },
  { id: 'bumerang', name: 'Bumerang', nomen: 'bumerang', genus: 'm', text: 'Fliegt raus und kommt zurück – trifft doppelt.' },
  { id: 'spirale', name: 'Spirale', nomen: 'spirale', genus: 'f', text: 'Dreht sich spiralförmig nach außen.' },
  { id: 'strahl', name: 'Dauerstrahl', nomen: 'strahler', genus: 'm', text: 'Sofortiger Strahl, trifft alles in einer Linie.' },
  { id: 'kegel', name: 'Kegel', nomen: 'werfer', genus: 'm', text: 'Breiter Kegel direkt vor dem Spieler.' },
  { id: 'regen', name: 'Himmelsregen', nomen: 'regen', genus: 'm', text: 'Fällt an zufälligen Stellen vom Himmel.' },
  { id: 'huepfend', name: 'Hüpfend', nomen: 'hüpfer', genus: 'm', text: 'Springt 3× über den Boden, trifft bei jedem Aufprall.' },
  { id: 'ablegen', name: 'Ablegen', nomen: 'falle', genus: 'f', text: 'Wird am Boden abgelegt und löst bei Kontakt aus.' },
  { id: 'turm', name: 'Turm', nomen: 'turm', genus: 'm', text: 'Baut einen kleinen Turm, der 8 s selbstständig feuert.' },
  { id: 'schwarm', name: 'Schwarm', nomen: 'schwarm', genus: 'm', text: 'Begleiter umschwirren den Spieler und greifen an.' },
  { id: 'rollen', name: 'Rollen', nomen: 'walze', genus: 'f', text: 'Rollt über den Boden und überfährt alles.' },
  { id: 'teleport', name: 'Teleport', nomen: 'blinzler', genus: 'm', text: 'Erscheint direkt im Ziel. Kein Ausweichen möglich.' },
  { id: 'nahkampf', name: 'Rundumschlag', nomen: 'keule', genus: 'f', text: 'Schwingt im Halbkreis um den Spieler.' }
];

export const LADUNGEN: Ladung[] = [
  { id: 'explosion', name: 'Explosion', wort: 'Kawumm', text: 'Explodiert im Radius 2 m.', tags: ['Explosiv'] },
  { id: 'kettenblitz', name: 'Kettenblitz', wort: 'Blitz', text: 'Blitz springt auf bis zu 4 weitere Gegner.', tags: ['Blitz'] },
  { id: 'brand', name: 'Brand', wort: 'Feuer', text: 'Setzt Gegner 3 s in Brand.', tags: ['Feuer'] },
  { id: 'gift', name: 'Gift', wort: 'Gift', text: 'Vergiftet; Gift stapelt sich bis 10×.', tags: ['Gift'] },
  { id: 'frost', name: 'Frost', wort: 'Frost', text: 'Verlangsamt; nach 3 Treffern gefroren.', tags: ['Eis'] },
  { id: 'wasser', name: 'Nässe', wort: 'Wasser', text: 'Macht nass – Blitze springen doppelt so weit.', tags: ['Natur'] },
  { id: 'schwerkraft', name: 'Schwerkraft', wort: 'Schwerkraft', text: 'Zieht Gegner 2 s lang in einen Punkt.', tags: ['Chaos'] },
  { id: 'splitter', name: 'Splitter', wort: 'Splitter', text: 'Zerfällt beim Treffer in 4 kleine Geschosse.', tags: [] },
  { id: 'konfetti', name: 'Konfetti', wort: 'Konfetti', text: 'Gegner tanzen 1,5 s verwirrt herum.', tags: ['Chaos'] },
  { id: 'rueckstoss', name: 'Rückstoß', wort: 'Wumms', text: 'Schleudert Gegner weit zurück.', tags: [] },
  { id: 'saeure', name: 'Säure', wort: 'Säure', text: 'Senkt Rüstung um 1 pro Treffer.', tags: ['Gift'] },
  { id: 'kueken', name: 'Küken', wort: 'Küken', text: 'Lässt ein Küken schlüpfen, das 5 s mitkämpft.', tags: ['Gacker'] },
  { id: 'ranken', name: 'Ranken', wort: 'Ranken', text: 'Fesselt Gegner 1 s am Boden.', tags: ['Natur'] },
  { id: 'magnet', name: 'Magnet', wort: 'Magnet', text: 'Zieht Gegner und Kristalle zusammen.', tags: ['Tech'] },
  { id: 'schall', name: 'Schall', wort: 'Schall', text: 'Betäubt 0,5 s – mit Cartoon-Sternchen.', tags: [] },
  { id: 'verhuehnern', name: 'Verhühnerung', wort: 'Hühner', text: 'Verwandelt Gegner 3 s in harmlose Hühner.', tags: ['Gacker', 'Chaos'] },
  { id: 'glueck', name: 'Glück', wort: 'Glücks', text: 'Getroffene Gegner lassen doppelt Kristalle fallen.', tags: [] },
  { id: 'lava', name: 'Lava', wort: 'Lava', text: 'Hinterlässt eine Lavapfütze für 4 s.', tags: ['Feuer'] },
  { id: 'kleister', name: 'Kleister', wort: 'Kleister', text: 'Gegner kleben fest und rutschen aus.', tags: ['Natur'] },
  { id: 'lebensraub', name: 'Lebensraub', wort: 'Lebens', text: 'Heilt dich um 2 % des Schadens.', tags: [] },
  { id: 'plasma', name: 'Plasma', wort: 'Plasma', text: 'Durchschlägt Gegner; +10 % Schaden pro Durchschlag.', tags: ['Tech'] },
  { id: 'heilung', name: 'Heilung', wort: 'Heil', text: 'Heilt Mitspieler im Umkreis, kitzelt Gegner.', tags: ['Natur'] }
];

/* ------------------------------------------------------------------ */
/* Die 60 Waffen (6 pro Gruppe)                                         */
/* ------------------------------------------------------------------ */

export const WAFFEN: Waffe[] = [
  // Feuerwaffen
  { id: 'pistole', name: 'Pistole', gruppe: 'Feuerwaffen', geschoss: 'kugel', antrieb: 'gerade', ladung: 'rueckstoss', schaden: 10, feuerrate: 2.0, reichweite: 8, text: 'Der Klassiker. Langweilig – bis man sie fusioniert.' },
  { id: 'schrotflinte', name: 'Schrotflinte', gruppe: 'Feuerwaffen', geschoss: 'kugel', antrieb: 'faecher', ladung: 'rueckstoss', schaden: 6, feuerrate: 0.9, reichweite: 5, text: 'Fünf Kugeln, ein Problem weniger.' },
  { id: 'minigun', name: 'Minigun', gruppe: 'Feuerwaffen', geschoss: 'kugel', antrieb: 'gerade', ladung: 'saeure', schaden: 4, feuerrate: 8.0, reichweite: 7, text: 'Braucht 1 s zum Anlaufen. Dann gibt es kein Halten mehr.' },
  { id: 'nagelpistole', name: 'Nagelpistole', gruppe: 'Feuerwaffen', geschoss: 'nagel', antrieb: 'abprall', ladung: 'ranken', schaden: 7, feuerrate: 2.5, reichweite: 7, text: 'Nagelt Gegner wortwörtlich fest.' },
  { id: 'kartoffelkanone', name: 'Kartoffelkanone', gruppe: 'Feuerwaffen', geschoss: 'kartoffel', antrieb: 'bogen', ladung: 'rueckstoss', schaden: 18, feuerrate: 0.8, reichweite: 9, text: 'Mehlig kochend, hart treffend.' },
  { id: 'praezisionsgewehr', name: 'Präzisionsgewehr', gruppe: 'Feuerwaffen', geschoss: 'kugel', antrieb: 'gerade', ladung: 'plasma', schaden: 40, feuerrate: 0.5, reichweite: 14, text: 'Ein Schuss, drei Gegner, null Reue.' },

  // Explosiv
  { id: 'raketenwerfer', name: 'Raketenwerfer', gruppe: 'Explosiv', geschoss: 'rakete', antrieb: 'zielbogen', ladung: 'explosion', schaden: 30, feuerrate: 0.9, reichweite: 11, text: 'Raketen fliegen im Bogen über Wände.' },
  { id: 'granatwerfer', name: 'Granatwerfer', gruppe: 'Explosiv', geschoss: 'granate', antrieb: 'huepfend', ladung: 'splitter', schaden: 14, feuerrate: 1.2, reichweite: 8, text: 'Hüpft, platzt, verteilt Splitter. Wiederholt sich.' },
  { id: 'dynamitbuendel', name: 'Dynamitbündel', gruppe: 'Explosiv', geschoss: 'dynamit', antrieb: 'bogen', ladung: 'explosion', schaden: 38, feuerrate: 0.6, reichweite: 7, text: 'Großer Knall, kleine Lunte.' },
  { id: 'minenleger', name: 'Minenleger', gruppe: 'Explosiv', geschoss: 'mine', antrieb: 'ablegen', ladung: 'explosion', schaden: 45, feuerrate: 0.7, reichweite: 2, text: 'Legt Minen hinter dir ab. Lauf im Kreis!' },
  { id: 'bombenhagel', name: 'Bombenhagel', gruppe: 'Explosiv', geschoss: 'granate', antrieb: 'regen', ladung: 'explosion', schaden: 22, feuerrate: 1.0, reichweite: 10, text: 'Die Wettervorhersage: bewölkt mit Bomben.' },
  { id: 'klebebombe', name: 'Klebebombe', gruppe: 'Explosiv', geschoss: 'schleim', antrieb: 'gerade', ladung: 'explosion', schaden: 26, feuerrate: 0.9, reichweite: 7, text: 'Klebt erst, knallt dann.' },

  // Elementar
  { id: 'teslastab', name: 'Tesla-Stab', gruppe: 'Elementar', geschoss: 'blitzkugel', antrieb: 'zielsuchend', ladung: 'kettenblitz', schaden: 12, feuerrate: 1.1, reichweite: 9, text: 'Nass + Blitz = Kettenschock.' },
  { id: 'flammenwerfer', name: 'Flammenwerfer', gruppe: 'Elementar', geschoss: 'flamme', antrieb: 'kegel', ladung: 'brand', schaden: 3, feuerrate: 10.0, reichweite: 4, text: 'Grillabend für alle in Reichweite.' },
  { id: 'eiszapfenwerfer', name: 'Eiszapfenwerfer', gruppe: 'Elementar', geschoss: 'eiszapfen', antrieb: 'gerade', ladung: 'frost', schaden: 11, feuerrate: 1.6, reichweite: 9, text: 'Cool bleiben. Gegner auch.' },
  { id: 'giftblaeser', name: 'Giftbläser', gruppe: 'Elementar', geschoss: 'blase', antrieb: 'spirale', ladung: 'gift', schaden: 5, feuerrate: 2.0, reichweite: 6, text: 'Hübsche Blasen. Hässliche Wirkung.' },
  { id: 'wasserwerfer', name: 'Wasserwerfer', gruppe: 'Elementar', geschoss: 'wasser', antrieb: 'kegel', ladung: 'wasser', schaden: 2, feuerrate: 8.0, reichweite: 5, text: 'Macht nass. Wartet auf einen Blitz.' },
  { id: 'lavaschleuder', name: 'Lavaschleuder', gruppe: 'Elementar', geschoss: 'meteor', antrieb: 'bogen', ladung: 'lava', schaden: 20, feuerrate: 0.7, reichweite: 9, text: 'Bitte nicht barfuß hinterherlaufen.' },

  // Nahkampf
  { id: 'baseballschlaeger', name: 'Baseballschläger', gruppe: 'Nahkampf', geschoss: 'schlaeger', antrieb: 'nahkampf', ladung: 'rueckstoss', schaden: 24, feuerrate: 1.0, reichweite: 2, text: 'Gegner fliegen weit. Sehr weit.' },
  { id: 'kettensaege', name: 'Kettensäge', gruppe: 'Nahkampf', geschoss: 'saege', antrieb: 'nahkampf', ladung: 'lebensraub', schaden: 6, feuerrate: 6.0, reichweite: 2, text: 'Brrrrr – und ein bisschen Heilung.' },
  { id: 'federfaust', name: 'Federfaust', gruppe: 'Nahkampf', geschoss: 'faust', antrieb: 'gerade', ladung: 'schall', schaden: 20, feuerrate: 1.2, reichweite: 4, text: 'BOING! Mit Sternchen.' },
  { id: 'kawummhammer', name: 'Kawumm-Hammer', gruppe: 'Nahkampf', geschoss: 'hammer', antrieb: 'nahkampf', ladung: 'explosion', schaden: 42, feuerrate: 0.6, reichweite: 2, text: 'Jeder Schlag ist ein Erdbeben mit Knall.' },
  { id: 'bratpfanne', name: 'Bratpfanne', gruppe: 'Nahkampf', geschoss: 'pfanne', antrieb: 'nahkampf', ladung: 'schall', schaden: 18, feuerrate: 1.3, reichweite: 2, text: 'Omas Lieblingswaffe. BOINNNG.' },
  { id: 'wurfaxt', name: 'Wurfaxt', gruppe: 'Nahkampf', geschoss: 'axt', antrieb: 'bumerang', ladung: 'splitter', schaden: 16, feuerrate: 1.0, reichweite: 6, text: 'Kommt immer zurück. Wie ein treuer Hund.' },

  // Energie
  { id: 'laserpistole', name: 'Laserpistole', gruppe: 'Energie', geschoss: 'laser', antrieb: 'strahl', ladung: 'plasma', schaden: 9, feuerrate: 2.2, reichweite: 10, text: 'Pew pew. Durch alles durch.' },
  { id: 'plasmaspirale', name: 'Plasmaspirale', gruppe: 'Energie', geschoss: 'blitzkugel', antrieb: 'spirale', ladung: 'plasma', schaden: 8, feuerrate: 2.5, reichweite: 7, text: 'Hübsch anzusehen, schlimm getroffen zu werden.' },
  { id: 'stirnlaser', name: 'Stirnlaser', gruppe: 'Energie', geschoss: 'laser', antrieb: 'strahl', ladung: 'brand', schaden: 4, feuerrate: 6.0, reichweite: 8, text: 'Eine Stirnlampe mit Ambitionen.' },
  { id: 'kampfkazoo', name: 'Kampf-Kazoo', gruppe: 'Energie', geschoss: 'note', antrieb: 'faecher', ladung: 'schall', schaden: 7, feuerrate: 1.5, reichweite: 5, text: 'Klingt furchtbar. Wirkt furchtbar gut.' },
  { id: 'schwarzlochwerfer', name: 'Schwarzes-Loch-Werfer', gruppe: 'Energie', geschoss: 'schwarzloch', antrieb: 'gerade', ladung: 'schwerkraft', schaden: 15, feuerrate: 0.4, reichweite: 9, text: 'Saugt alles ein. Außer Langeweile.' },
  { id: 'magnetkanone', name: 'Magnetkanone', gruppe: 'Energie', geschoss: 'kugel', antrieb: 'zielsuchend', ladung: 'magnet', schaden: 10, feuerrate: 1.4, reichweite: 9, text: 'Bringt Gegner zusammen. Für Gruppenfotos und Explosionen.' },

  // Drohnen & Türme
  { id: 'kampfdrohne', name: 'Kampfdrohne', gruppe: 'Drohnen & Türme', geschoss: 'drohne', antrieb: 'schwarm', ladung: 'splitter', schaden: 8, feuerrate: 1.5, reichweite: 6, text: 'Surrt um dich herum und hält dir den Rücken frei.' },
  { id: 'geschuetzturm', name: 'Geschützturm', gruppe: 'Drohnen & Türme', geschoss: 'kugel', antrieb: 'turm', ladung: 'rueckstoss', schaden: 9, feuerrate: 3.0, reichweite: 8, text: 'Steht rum und schießt. Wie ein Grummelbold, nur nützlich.' },
  { id: 'teslaturm', name: 'Tesla-Turm', gruppe: 'Drohnen & Türme', geschoss: 'blitzkugel', antrieb: 'turm', ladung: 'kettenblitz', schaden: 10, feuerrate: 1.2, reichweite: 7, text: 'Ein Turm voller schlechter Nachrichten.' },
  { id: 'toasterturm', name: 'Toaster-Turm', gruppe: 'Drohnen & Türme', geschoss: 'toast', antrieb: 'turm', ladung: 'brand', schaden: 12, feuerrate: 1.0, reichweite: 7, text: 'Ein umprogrammierter Toastomat. Er ist noch etwas beleidigt.' },
  { id: 'orbitalschlag', name: 'Orbitalschlag', gruppe: 'Drohnen & Türme', geschoss: 'laser', antrieb: 'regen', ladung: 'brand', schaden: 28, feuerrate: 0.5, reichweite: 12, text: 'Ein Satellit, der dich mag. Gegner weniger.' },
  { id: 'rasenmaeherbot', name: 'Rasenmäher-Bot', gruppe: 'Drohnen & Türme', geschoss: 'saege', antrieb: 'rollen', ladung: 'splitter', schaden: 12, feuerrate: 1.0, reichweite: 6, text: 'Mäht alles. Auch Dinge, die kein Rasen sind.' },

  // Beschwörung
  { id: 'bienenstock', name: 'Bienenstock', gruppe: 'Beschwörung', geschoss: 'biene', antrieb: 'schwarm', ladung: 'gift', schaden: 4, feuerrate: 3.0, reichweite: 7, text: 'Summ summ, aua aua.' },
  { id: 'kuekenkorb', name: 'Kükenkorb', gruppe: 'Beschwörung', geschoss: 'ei', antrieb: 'huepfend', ladung: 'kueken', schaden: 6, feuerrate: 1.0, reichweite: 6, text: 'Eier hüpfen, Küken schlüpfen, Gegner flüchten.' },
  { id: 'pilzbeutel', name: 'Pilzbeutel', gruppe: 'Beschwörung', geschoss: 'spore', antrieb: 'bogen', ladung: 'ranken', schaden: 5, feuerrate: 1.0, reichweite: 8, text: 'Lässt überall Pilze sprießen. Die halten Gegner fest.' },
  { id: 'entenarmee', name: 'Entenarmee', gruppe: 'Beschwörung', geschoss: 'gummiente', antrieb: 'schwarm', ladung: 'schall', schaden: 5, feuerrate: 2.0, reichweite: 6, text: 'Quietsch. Quietsch. QUIETSCH.' },
  { id: 'grummelpfeife', name: 'Grummel-Pfeife', gruppe: 'Beschwörung', geschoss: 'grummel', antrieb: 'schwarm', ladung: 'glueck', schaden: 7, feuerrate: 1.0, reichweite: 5, text: 'Ruft einen bestochenen Grummelbold, der für DICH Kristalle klaut.' },
  { id: 'schleimzucht', name: 'Schleimzucht', gruppe: 'Beschwörung', geschoss: 'schleim', antrieb: 'huepfend', ladung: 'kleister', schaden: 6, feuerrate: 1.2, reichweite: 5, text: 'Dein eigener Glibber. Er hat dich lieb.' },

  // Werfer
  { id: 'schneeballschleuder', name: 'Schneeballschleuder', gruppe: 'Werfer', geschoss: 'schneeball', antrieb: 'bogen', ladung: 'frost', schaden: 9, feuerrate: 1.5, reichweite: 8, text: 'Winter is coming. Jetzt.' },
  { id: 'bowlingkugel', name: 'Bowlingkugel', gruppe: 'Werfer', geschoss: 'bowling', antrieb: 'rollen', ladung: 'rueckstoss', schaden: 22, feuerrate: 0.7, reichweite: 9, text: 'Gegner sind die Kegel.' },
  { id: 'bananarang', name: 'Bananarang', gruppe: 'Werfer', geschoss: 'banane', antrieb: 'bumerang', ladung: 'kleister', schaden: 10, feuerrate: 1.2, reichweite: 7, text: 'Kommt zurück. Gegner rutschen aus.' },
  { id: 'wurfsterne', name: 'Wurfsterne', gruppe: 'Werfer', geschoss: 'stern', antrieb: 'faecher', ladung: 'saeure', schaden: 6, feuerrate: 1.8, reichweite: 6, text: 'Funkeln. Stechen. Ätzen.' },
  { id: 'fauleeier', name: 'Faule Eier', gruppe: 'Werfer', geschoss: 'ei', antrieb: 'bogen', ladung: 'gift', schaden: 6, feuerrate: 1.4, reichweite: 7, text: 'Schon drei Wochen alt. Die Wirkung ist enorm.' },
  { id: 'wasserbombe', name: 'Wasserbombe', gruppe: 'Werfer', geschoss: 'blase', antrieb: 'bogen', ladung: 'wasser', schaden: 8, feuerrate: 1.2, reichweite: 7, text: 'Sommer, Sonne, Kettenblitz.' },

  // Exotisch
  { id: 'huehnerkanone', name: 'Hühnerkanone', gruppe: 'Exotisch', geschoss: 'huhn', antrieb: 'huepfend', ladung: 'explosion', schaden: 16, feuerrate: 1.4, reichweite: 8, text: 'Hühner hüpfen 3× und explodieren bei jedem Aufprall.' },
  { id: 'partykanone', name: 'Partykanone', gruppe: 'Exotisch', geschoss: 'luftballon', antrieb: 'faecher', ladung: 'konfetti', schaden: 5, feuerrate: 1.5, reichweite: 6, text: 'Überraschungsparty! Niemand ist überrascht, alle sind verwirrt.' },
  { id: 'sternschnuppenstab', name: 'Sternschnuppenstab', gruppe: 'Exotisch', geschoss: 'meteor', antrieb: 'regen', ladung: 'brand', schaden: 24, feuerrate: 0.6, reichweite: 11, text: 'Wünsch dir was. Zum Beispiel: weniger Gegner.' },
  { id: 'huhnifizierer', name: 'Huhnifizierer', gruppe: 'Exotisch', geschoss: 'laser', antrieb: 'strahl', ladung: 'verhuehnern', schaden: 3, feuerrate: 0.5, reichweite: 9, text: 'Verwandelt Gegner in Hühner. Die Hühnerkanone freut sich.' },
  { id: 'dudelsack', name: 'Dudelsack des Grauens', gruppe: 'Exotisch', geschoss: 'note', antrieb: 'kegel', ladung: 'gift', schaden: 3, feuerrate: 4.0, reichweite: 5, text: 'Klingt wie ein Pilzling, der in eine Tröte niest.' },
  { id: 'teleporttoaster', name: 'Teleport-Toaster', gruppe: 'Exotisch', geschoss: 'toast', antrieb: 'teleport', ladung: 'brand', schaden: 14, feuerrate: 1.0, reichweite: 10, text: 'Der Toast erscheint direkt im Gegner. Frühstück ist serviert.' },

  // Support
  { id: 'pflasterkanone', name: 'Pflasterkanone', gruppe: 'Support', geschoss: 'pflaster', antrieb: 'zielsuchend', ladung: 'heilung', schaden: 4, feuerrate: 1.0, reichweite: 9, text: 'Heilt Mitspieler. Gegner bekommen ein schlechtes Gewissen.' },
  { id: 'schildblasen', name: 'Schildblasen', gruppe: 'Support', geschoss: 'blase', antrieb: 'orbit', ladung: 'rueckstoss', schaden: 5, feuerrate: 1.0, reichweite: 2, text: 'Blasen kreisen um dich und schubsen Gegner weg.' },
  { id: 'gluecksmuenzen', name: 'Glücksmünzen', gruppe: 'Support', geschoss: 'muenze', antrieb: 'orbit', ladung: 'glueck', schaden: 6, feuerrate: 1.0, reichweite: 2, text: 'Klimpern im Kreis. Mehr Kristalle für alle.' },
  { id: 'kriegstrommel', name: 'Kriegstrommel', gruppe: 'Support', geschoss: 'note', antrieb: 'orbit', ladung: 'schall', schaden: 4, feuerrate: 1.0, reichweite: 3, text: 'BUMM-BUMM-BUMM. Mitspieler in der Nähe feuern 15 % schneller.' },
  { id: 'kuckucksuhr', name: 'Kuckucksuhr', gruppe: 'Support', geschoss: 'kuckuck', antrieb: 'teleport', ladung: 'frost', schaden: 8, feuerrate: 0.5, reichweite: 9, text: 'KUCKUCK! Die Zeit friert für Gegner 1 s ein.' },
  { id: 'keksdose', name: 'Omas Keksdose', gruppe: 'Support', geschoss: 'keks', antrieb: 'regen', ladung: 'heilung', schaden: 3, feuerrate: 0.8, reichweite: 8, text: 'Kekse regnen vom Himmel und heilen alle in der Nähe.' }
];

/* ------------------------------------------------------------------ */
/* Fusion                                                               */
/* ------------------------------------------------------------------ */

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x])) as Record<string, T>;
export const G = byId(GESCHOSSE);
export const A = byId(ANTRIEBE);
export const L = byId(LADUNGEN);
export const W = byId(WAFFEN);

/** Alle Elemente einer Waffe (aus ihren Bauteilen) */
export function elemente(w: Pick<Waffe, 'geschoss' | 'ladung'>): Element[] {
  return [...new Set([...G[w.geschoss].tags, ...L[w.ladung].tags])];
}

/** Fusionsname: Adjektiv (Geschoss) + Element (Ladung) + Nomen (Antrieb) */
export function fusionsName(geschoss: string, antrieb: string, ladung: string): string {
  const gr = fusionsGrammatik();
  if (gr) {
    // andere Sprachen: Wortbausteine und Reihenfolge aus dem Wörterbuch
    const n = gr.nomen[antrieb], adj = gr.adj[geschoss], el = gr.element[ladung];
    if (n && adj && el !== undefined) {
      const s = gr.muster.replace('{adj}', adj[n.genus]).replace('{element}', el).replace('{nomen}', n.wort).replace(/\s+/g, ' ').trim();
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
  const a = A[antrieb];
  const endung = { m: 'er', f: 'e', n: 'es' }[a.genus];
  const adj = G[geschoss].adj.replace(/e$/, '') + endung;
  return `${adj} ${L[ladung].wort}${a.nomen}`;
}

export interface Fusion {
  name: string;
  geschoss: string; antrieb: string; ladung: string;
  quellen: string[];
  gruppen: Gruppe[];
  elemente: Element[];
  /** 0–100: je verschiedener die Gruppen, desto instabiler */
  instabil: number;
}

/**
 * Verschmilzt 2–3 Waffen. `wahl` legt fest, welche Waffe welches Bauteil liefert.
 * Bei 2 Waffen liefert die erste Waffe zwei Bauteile.
 */
export function fusioniere(wahl: { geschoss: string; antrieb: string; ladung: string }): Fusion {
  const g = W[wahl.geschoss], a = W[wahl.antrieb], l = W[wahl.ladung];
  const quellen = [...new Set([g.id, a.id, l.id])];
  const gruppen = [...new Set(quellen.map((id) => W[id].gruppe))];
  const teile = { geschoss: g.geschoss, antrieb: a.antrieb, ladung: l.ladung };
  return {
    name: fusionsName(teile.geschoss, teile.antrieb, teile.ladung),
    ...teile,
    quellen,
    gruppen,
    elemente: elemente(teile),
    instabil: Math.min(100, (gruppen.length - 1) * 26 + (quellen.length - 1) * 10)
  };
}

// Beispiel aus dem Konzept:
// fusioniere({ geschoss: 'huehnerkanone', antrieb: 'raketenwerfer', ladung: 'teslastab' }).name
// → "Gackernde Blitzrakete"
