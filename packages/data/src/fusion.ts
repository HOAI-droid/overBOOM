import { t, tx } from './i18n.ts';
/**
 * OVERBOOM – Waffen-Fusion (Kern-Feature)
 *
 * Am Fusions-Amboss werden 2–3 Waffen aus verschiedenen Gruppen verschmolzen.
 * Jede Eingangswaffe liefert mindestens ein Bauteil (Geschoss, Antrieb, Ladung).
 * Die neue Waffe entsteht systemisch aus den Bauteilen – jede Kombination funktioniert.
 * Ausnahme: geheime Rezepte (feste Zutaten) mit eigenem Namen, Effekt und Modell.
 */
import { A, G, L, W, elemente, fusionsName, type Gruppe, type Waffe } from './weapons.ts';
import { evolve } from './mods.ts';

export interface Rezept {
  id: string;
  name: string;
  /** Waffen-IDs (Reihenfolge egal, Mehrfachnennung = mehrfach nötig) */
  zutaten: string[];
  geschoss: string;
  antrieb: string;
  ladung: string;
  /** Multiplikatoren auf die systemisch berechneten Werte */
  schaden: number;
  feuerrate: number;
  reichweite: number;
  spezial: string[];
  text: string;
  /** Hinweis im Rezeptbuch, solange es unentdeckt ist */
  hinweis: string;
}

/**
 * Sonderwirkungen, die die Simulation kennt:
 *   salve3       – 3 Geschosse pro Schuss
 *   cluster      – Explosionen zerfallen in 3 Mini-Explosionen
 *   doppelblitz  – Kettenblitz springt doppelt so oft
 *   implosion    – Schwerkraft-Sog explodiert am Ende
 *   heilkeks     – jeder Treffer kann den Schützen heilen
 *   schwarm6     – 6 statt 3 Begleiter
 *   konfettifrost– Frost verwirrt zusätzlich
 *   orbit6       – 6 Kreisel auf größerem Radius
 *   giftwolke    – vergiftete Gegner hinterlassen Giftpfützen
 *   kueken       – Treffer lassen Küken schlüpfen
 *   minibumm     – Treffer lösen manchmal eine Mini-Explosion aus
 *   feuerspur    – Treffer hinterlassen manchmal Lavapfützen
 *   frostnova    – Treffer frieren manchmal alle Gegner ringsum ein
 *   goldregen    – Treffer lassen manchmal einen Kristall fallen
 *   donner       – Treffer rufen manchmal einen Blitzschlag
 */
export const REZEPTE: Rezept[] = [
  {
    id: 'huhnageddon', name: 'HUHNAGEDDON', zutaten: ['huehnerkanone', 'huehnerkanone', 'huehnerkanone'],
    geschoss: 'ei', antrieb: 'regen', ladung: 'explosion', schaden: 1.4, feuerrate: 1, reichweite: 1.2, spezial: ['salve3'],
    text: 'Ein Riesenhuhn schwebt über dir und legt explodierende Eier. Es ist sehr stolz.',
    hinweis: 'Dreimal dasselbe Federvieh …'
  },
  {
    id: 'kawummageddon', name: 'Kawummageddon', zutaten: ['raketenwerfer', 'dynamitbuendel', 'bombenhagel'],
    geschoss: 'rakete', antrieb: 'zielbogen', ladung: 'explosion', schaden: 1.2, feuerrate: 1, reichweite: 1.1, spezial: ['cluster'],
    text: 'Jede Explosion zerfällt in drei weitere. Nachbarn ziehen weg.',
    hinweis: 'Alles, was im Explosiv-Regal knallt.'
  },
  {
    id: 'donnertoaster', name: 'Donnertoaster', zutaten: ['teleporttoaster', 'teslastab', 'toasterturm'],
    geschoss: 'toast', antrieb: 'turm', ladung: 'kettenblitz', schaden: 1.3, feuerrate: 1.2, reichweite: 1.2, spezial: ['doppelblitz'],
    text: 'Ein Toaster-Turm, der elektrischen Toast verschießt. Frühstück mit Spannung.',
    hinweis: 'Drei Toaster-Sachen und ein bisschen Strom.'
  },
  {
    id: 'schwarzesbuffet', name: 'Schwarzes Buffet', zutaten: ['schwarzlochwerfer', 'magnetkanone', 'bowlingkugel'],
    geschoss: 'schwarzloch', antrieb: 'gerade', ladung: 'schwerkraft', schaden: 1.6, feuerrate: 1, reichweite: 1, spezial: ['implosion'],
    text: 'Saugt alles zusammen – und lässt es dann sehr laut wieder los.',
    hinweis: 'Was anzieht, was zieht und was rollt.'
  },
  {
    id: 'omasgeheimrezept', name: 'Omas Geheimrezept', zutaten: ['keksdose', 'bratpfanne', 'pflasterkanone'],
    geschoss: 'keks', antrieb: 'regen', ladung: 'schall', schaden: 1.5, feuerrate: 1.3, reichweite: 1.1, spezial: ['heilkeks'],
    text: 'Kekse fallen vom Himmel, betäuben Gegner mit einem BOINNNG und heilen dich.',
    hinweis: 'Was Oma in der Küche hat – und im Erste-Hilfe-Kasten.'
  },
  {
    id: 'entensturm', name: 'Quietschendes Inferno', zutaten: ['entenarmee', 'flammenwerfer', 'kampfkazoo'],
    geschoss: 'gummiente', antrieb: 'schwarm', ladung: 'brand', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['schwarm6'],
    text: 'Sechs brennende Quietscheenten. Niemand hat danach gefragt.',
    hinweis: 'Enten, Feuer und Musik.'
  },
  {
    id: 'frostfeuerwerk', name: 'Frostfeuerwerk', zutaten: ['eiszapfenwerfer', 'partykanone', 'sternschnuppenstab'],
    geschoss: 'stern', antrieb: 'regen', ladung: 'frost', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['konfettifrost', 'salve3'],
    text: 'Eiskalte Sternschnuppen mit Konfetti. Gegner frieren – und tanzen dabei.',
    hinweis: 'Eis, Party und ein Wunsch an die Sterne.'
  },
  {
    id: 'saegenkarussell', name: 'Kettensägen-Karussell', zutaten: ['kettensaege', 'schildblasen', 'rasenmaeherbot'],
    geschoss: 'saege', antrieb: 'orbit', ladung: 'lebensraub', schaden: 1.5, feuerrate: 1.5, reichweite: 1, spezial: ['orbit6'],
    text: 'Sechs Kreissägen kreisen um dich. Kuscheln ist gerade schwierig.',
    hinweis: 'Was sägt, was kreist und was mäht.'
  },
  {
    id: 'bienenkoenigin', name: 'Bienenkönigin', zutaten: ['bienenstock', 'giftblaeser', 'pilzbeutel'],
    geschoss: 'biene', antrieb: 'schwarm', ladung: 'gift', schaden: 1.5, feuerrate: 1.3, reichweite: 1.2, spezial: ['giftwolke', 'schwarm6'],
    text: 'Die Königin schickt ihren Hofstaat. Vergiftete Gegner hinterlassen Giftwolken.',
    hinweis: 'Summen, Blubbern und Sporen.'
  },
  {
    id: 'gackerchaos', name: 'Gackerndes Chaos', zutaten: ['huhnifizierer', 'huehnerkanone', 'kuekenkorb'],
    geschoss: 'laser', antrieb: 'strahl', ladung: 'verhuehnern', schaden: 2.5, feuerrate: 2, reichweite: 1.1, spezial: ['kueken'],
    text: 'Ein Strahl, der Gegner in Hühner verwandelt – und Küken schlüpfen lässt.',
    hinweis: 'Alles, was gackert, piepst oder Hühner macht.'
  },
  {
    id: 'pommesbude', name: 'Pommesbude', zutaten: ['kartoffelkanone', 'flammenwerfer', 'bratpfanne'],
    geschoss: 'kartoffel', antrieb: 'bogen', ladung: 'brand', schaden: 1.5, feuerrate: 1.1, reichweite: 1.1, spezial: ['feuerspur'],
    text: 'Frittierte Kartoffeln fliegen im Bogen und hinterlassen brennendes Fett.',
    hinweis: 'Kartoffeln, Feuer und eine Pfanne.'
  },
  {
    id: 'gewitterkapelle', name: 'Gewitterkapelle', zutaten: ['kriegstrommel', 'teslastab', 'dudelsack'],
    geschoss: 'note', antrieb: 'orbit', ladung: 'kettenblitz', schaden: 1.4, feuerrate: 1.2, reichweite: 1.1, spezial: ['orbit6', 'donner'],
    text: 'Sechs Noten kreisen um dich und schlagen Blitze in den Takt.',
    hinweis: 'Trommel, Dudelsack – und ein Stab unter Strom.'
  },
  {
    id: 'schneeballschlacht', name: 'Eiszeit-Schneeballschlacht', zutaten: ['schneeballschleuder', 'wasserbombe', 'eiszapfenwerfer'],
    geschoss: 'schneeball', antrieb: 'regen', ladung: 'frost', schaden: 1.3, feuerrate: 1.1, reichweite: 1.2, spezial: ['salve3', 'frostnova'],
    text: 'Schneebälle hageln vom Himmel. Manchmal friert gleich die ganze Nachbarschaft ein.',
    hinweis: 'Schnee, Wasser und Eis – alles, was kalt ist und fliegt.'
  },
  {
    id: 'goldesel', name: 'Goldesel', zutaten: ['gluecksmuenzen', 'kartoffelkanone', 'grummelpfeife'],
    geschoss: 'muenze', antrieb: 'zielsuchend', ladung: 'glueck', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['goldregen'],
    text: 'Zielsuchende Goldmünzen. Getroffene Gegner spucken manchmal Kristalle aus.',
    hinweis: 'Münzen, Kartoffeln und eine Grummel-Pfeife.'
  },
  {
    id: 'bowlingapokalypse', name: 'Bowling-Apokalypse', zutaten: ['bowlingkugel', 'partykanone', 'dynamitbuendel'],
    geschoss: 'bowling', antrieb: 'rollen', ladung: 'explosion', schaden: 1.5, feuerrate: 1, reichweite: 1.1, spezial: ['minibumm', 'cluster'],
    text: 'Explodierende Bowlingkugeln. Jeder Treffer ein Strike – und noch einer.',
    hinweis: 'Kugel, Party und Dynamit.'
  },
  {
    id: 'fruehstuecksapokalypse', name: 'Frühstücksapokalypse', zutaten: ['toasterturm', 'sternschnuppenstab', 'teleporttoaster'],
    geschoss: 'toast', antrieb: 'regen', ladung: 'brand', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['salve3', 'feuerspur'],
    text: 'Glühende Toastscheiben regnen vom Himmel und hinterlassen Brandflecken.',
    hinweis: 'Zwei Toaster und eine Sternschnuppe.'
  },
  {
    id: 'drohnenstaffel', name: 'Drohnenstaffel Bumm', zutaten: ['kampfdrohne', 'geschuetzturm', 'minigun'],
    geschoss: 'drohne', antrieb: 'schwarm', ladung: 'splitter', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['schwarm6', 'minibumm'],
    text: 'Sechs Kampfdrohnen, deren Treffer kleine Explosionen auslösen.',
    hinweis: 'Drohne, Turm und eine Menge Munition.'
  },
  {
    id: 'laserdisco', name: 'Laser-Disco', zutaten: ['laserpistole', 'partykanone', 'kampfkazoo'],
    geschoss: 'laser', antrieb: 'strahl', ladung: 'konfetti', schaden: 2.2, feuerrate: 1.6, reichweite: 1.1, spezial: ['minibumm'],
    text: 'Ein Party-Laser, der Gegner verwirrt tanzen lässt – und manchmal platzen.',
    hinweis: 'Laser, Party und ein Kazoo.'
  },
  {
    id: 'schleimlawine', name: 'Schleimlawine', zutaten: ['schleimzucht', 'klebebombe', 'bananarang'],
    geschoss: 'schleim', antrieb: 'rollen', ladung: 'kleister', schaden: 1.5, feuerrate: 1.1, reichweite: 1.1, spezial: ['minibumm'],
    text: 'Rollende Schleimkugeln kleben Gegner fest und blubbern explosiv.',
    hinweis: 'Alles, was klebt und schleimt.'
  },
  {
    id: 'vulkanausbruch', name: 'Vulkanausbruch', zutaten: ['lavaschleuder', 'bombenhagel', 'flammenwerfer'],
    geschoss: 'meteor', antrieb: 'regen', ladung: 'lava', schaden: 1.4, feuerrate: 1.1, reichweite: 1.2, spezial: ['salve3', 'feuerspur'],
    text: 'Glühende Brocken regnen herab und lassen Lava zurück.',
    hinweis: 'Lava, Bomben und Flammen – der Lavakessel zum Mitnehmen.'
  },
  {
    id: 'stinkendebrut', name: 'Stinkende Brut', zutaten: ['fauleeier', 'kuekenkorb', 'giftblaeser'],
    geschoss: 'ei', antrieb: 'bogen', ladung: 'gift', schaden: 1.4, feuerrate: 1.2, reichweite: 1.1, spezial: ['giftwolke', 'kueken'],
    text: 'Faule Eier, aus denen giftige Küken schlüpfen.',
    hinweis: 'Eier, Küken und ein Giftbläser.'
  },
  {
    id: 'zeitgewitter', name: 'Zeitgewitter', zutaten: ['kuckucksuhr', 'orbitalschlag', 'teslaturm'],
    geschoss: 'kuckuck', antrieb: 'teleport', ladung: 'kettenblitz', schaden: 1.5, feuerrate: 1.2, reichweite: 1.2, spezial: ['donner', 'doppelblitz'],
    text: 'Ein teleportierender Kuckuck, der zur vollen Stunde Blitze ruft.',
    hinweis: 'Eine Uhr, ein Satellit und ein Turm unter Strom.'
  },
  {
    id: 'mahlstrom', name: 'Magnetischer Mahlstrom', zutaten: ['magnetkanone', 'plasmaspirale', 'minenleger'],
    geschoss: 'kugel', antrieb: 'spirale', ladung: 'magnet', schaden: 1.5, feuerrate: 1.2, reichweite: 1.1, spezial: ['minibumm'],
    text: 'Spiralige Magnetkugeln ziehen Gegner zusammen und knallen.',
    hinweis: 'Magnet, Spirale und Minen.'
  },
  {
    id: 'holzfaellerhurrikan', name: 'Holzfäller-Hurrikan', zutaten: ['wurfaxt', 'kettensaege', 'baseballschlaeger'],
    geschoss: 'axt', antrieb: 'bumerang', ladung: 'splitter', schaden: 1.5, feuerrate: 1.2, reichweite: 1.1, spezial: ['minibumm'],
    text: 'Bumerang-Äxte, die beim Treffer in Splitter und Funken zerfallen.',
    hinweis: 'Axt, Säge und Schläger.'
  },
  {
    id: 'lazarettluftbruecke', name: 'Lazarett-Luftbrücke', zutaten: ['pflasterkanone', 'keksdose', 'schildblasen'],
    geschoss: 'pflaster', antrieb: 'regen', ladung: 'heilung', schaden: 1.3, feuerrate: 1.3, reichweite: 1.2, spezial: ['heilkeks', 'salve3'],
    text: 'Pflaster und Kekse regnen auf dich und deine Freunde – Gegner bekommen trotzdem eins drauf.',
    hinweis: 'Pflaster, Kekse und Blasen.'
  },
  {
    id: 'tiefkuehltruhe', name: 'Tiefkühltruhe', zutaten: ['kuckucksuhr', 'schneeballschleuder', 'wasserwerfer'],
    geschoss: 'wasser', antrieb: 'kegel', ladung: 'frost', schaden: 1.4, feuerrate: 1.2, reichweite: 1.1, spezial: ['frostnova'],
    text: 'Ein eiskalter Wasserstrahl, der ganze Gruppen schockgefriert.',
    hinweis: 'Kuckuck, Schnee und Wasser.'
  },
  {
    id: 'sternenhimmel', name: 'Sternenhimmel', zutaten: ['wurfsterne', 'sternschnuppenstab', 'praezisionsgewehr'],
    geschoss: 'stern', antrieb: 'zielsuchend', ladung: 'plasma', schaden: 1.4, feuerrate: 1.1, reichweite: 1.3, spezial: ['salve3'],
    text: 'Drei Plasma-Sterne pro Schuss, die sich ihr Ziel selbst suchen.',
    hinweis: 'Sterne, Sternschnuppen und ein sehr genaues Gewehr.'
  },
  {
    id: 'pilzrave', name: 'Pilz-Rave', zutaten: ['pilzbeutel', 'partykanone', 'dudelsack'],
    geschoss: 'spore', antrieb: 'kegel', ladung: 'konfetti', schaden: 1.4, feuerrate: 1.2, reichweite: 1.1, spezial: ['giftwolke'],
    text: 'Ein Kegel aus Sporen und Konfetti. Die Gegner tanzen, bis ihnen schlecht wird.',
    hinweis: 'Pilze, Party und Dudelsack.'
  },
  {
    id: 'nagelbombe', name: 'Nagelbombe deluxe', zutaten: ['nagelpistole', 'granatwerfer', 'klebebombe'],
    geschoss: 'nagel', antrieb: 'huepfend', ladung: 'splitter', schaden: 1.5, feuerrate: 1.1, reichweite: 1.1, spezial: ['cluster', 'minibumm'],
    text: 'Hüpfende Nagelbündel, die in alle Richtungen zerplatzen.',
    hinweis: 'Nägel, Granaten und Kleber.'
  },
  {
    id: 'ententsunami', name: 'Ententeich-Tsunami', zutaten: ['entenarmee', 'wasserbombe', 'wasserwerfer'],
    geschoss: 'gummiente', antrieb: 'schwarm', ladung: 'wasser', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['schwarm6', 'donner'],
    text: 'Sechs nasse Gummienten – und nasse Gegner leiten Blitze besonders gut.',
    hinweis: 'Enten und ganz viel Wasser.'
  },
  {
    id: 'grummelaufstand', name: 'Grummel-Aufstand', zutaten: ['grummelpfeife', 'kawummhammer', 'federfaust'],
    geschoss: 'grummel', antrieb: 'schwarm', ladung: 'explosion', schaden: 1.5, feuerrate: 1.1, reichweite: 1.1, spezial: ['schwarm6', 'minibumm'],
    text: 'Sechs bekehrte Grummelbolde stürmen mit Sprengstoff los.',
    hinweis: 'Pfeife, Hammer und Faust.'
  },
  {
    id: 'todesblick', name: 'Todesblick', zutaten: ['stirnlaser', 'laserpistole', 'praezisionsgewehr'],
    geschoss: 'laser', antrieb: 'strahl', ladung: 'plasma', schaden: 2.6, feuerrate: 1.4, reichweite: 1.3, spezial: ['donner'],
    text: 'Ein Plasmastrahl, der gelegentlich einen Blitz hinterherschickt.',
    hinweis: 'Drei Arten, sehr genau zu zielen.'
  },
  {
    id: 'honigfalle', name: 'Honigfalle', zutaten: ['bienenstock', 'schleimzucht', 'keksdose'],
    geschoss: 'biene', antrieb: 'schwarm', ladung: 'kleister', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['schwarm6', 'heilkeks'],
    text: 'Sechs Bienen kleben Gegner mit Honig fest. Süß für dich, klebrig für sie.',
    hinweis: 'Bienen, Schleim und Kekse.'
  },
  {
    id: 'teppichbombardement', name: 'Teppichbombardement', zutaten: ['orbitalschlag', 'bombenhagel', 'raketenwerfer'],
    geschoss: 'rakete', antrieb: 'regen', ladung: 'explosion', schaden: 1.3, feuerrate: 1.1, reichweite: 1.2, spezial: ['salve3', 'cluster'],
    text: 'Raketen regnen in Dreiergruppen herab und zerfallen in Mini-Explosionen.',
    hinweis: 'Vom Himmel, aus dem Himmel, in den Himmel.'
  },
  {
    id: 'minenrasen', name: 'Minenfeld-Rasenmäher', zutaten: ['minenleger', 'rasenmaeherbot', 'geschuetzturm'],
    geschoss: 'mine', antrieb: 'ablegen', ladung: 'explosion', schaden: 1.5, feuerrate: 1.2, reichweite: 1.1, spezial: ['minibumm', 'cluster'],
    text: 'Legt Minen, die in Kettenexplosionen hochgehen.',
    hinweis: 'Minen, Mäher und Turm.'
  },
  {
    id: 'kopfoderkawumm', name: 'Kopf oder Kawumm', zutaten: ['gluecksmuenzen', 'wurfsterne', 'schrotflinte'],
    geschoss: 'muenze', antrieb: 'faecher', ladung: 'glueck', schaden: 1.4, feuerrate: 1.2, reichweite: 1.1, spezial: ['goldregen'],
    text: 'Ein Fächer aus Glücksmünzen. Kopf: Kristalle. Zahl: auch Kristalle.',
    hinweis: 'Münzen, Sterne und Schrot.'
  },
  {
    id: 'lawine', name: 'Lawine', zutaten: ['eiszapfenwerfer', 'baseballschlaeger', 'bowlingkugel'],
    geschoss: 'schneeball', antrieb: 'rollen', ladung: 'frost', schaden: 1.5, feuerrate: 1.1, reichweite: 1.1, spezial: ['frostnova'],
    text: 'Riesige rollende Schneebälle, die alles einfrieren, was im Weg steht.',
    hinweis: 'Eis, Schläger und Kugel.'
  },
  {
    id: 'trommelfeuer', name: 'Trommelfeuer', zutaten: ['kriegstrommel', 'minigun', 'kampfkazoo'],
    geschoss: 'note', antrieb: 'gerade', ladung: 'schall', schaden: 1.3, feuerrate: 1.2, reichweite: 1.2, spezial: ['salve3'],
    text: 'Drei Schallnoten pro Schlag. Taub wird hier jeder.',
    hinweis: 'Trommel, Minigun und Kazoo.'
  },
  {
    id: 'teslaspule', name: 'Tesla-Spule', zutaten: ['teslaturm', 'magnetkanone', 'plasmaspirale'],
    geschoss: 'blitzkugel', antrieb: 'orbit', ladung: 'kettenblitz', schaden: 1.4, feuerrate: 1.2, reichweite: 1.2, spezial: ['orbit6', 'doppelblitz'],
    text: 'Sechs Blitzkugeln kreisen um dich und springen doppelt so oft weiter.',
    hinweis: 'Turm, Magnet und Spirale – alles unter Strom.'
  },
  {
    id: 'huehnerstallrevolte', name: 'Hühnerstall-Revolte', zutaten: ['kuekenkorb', 'huehnerkanone', 'grummelpfeife'],
    geschoss: 'huhn', antrieb: 'schwarm', ladung: 'kueken', schaden: 1.5, feuerrate: 1.2, reichweite: 1.2, spezial: ['schwarm6', 'kueken'],
    text: 'Ein Schwarm Kampfhühner, aus deren Treffern Küken schlüpfen.',
    hinweis: 'Küken, Hühner und ein Grummel-Pfiff.'
  }
];

export const REZEPT_BY_ID: Record<string, Rezept> = Object.fromEntries(REZEPTE.map((r) => [r.id, r]));

/** Passt die Zutatenliste (Multimenge) zu einem Rezept? */
export function findeRezept(quellen: readonly string[]): Rezept | null {
  const key = [...quellen].sort().join('|');
  for (const r of REZEPTE) if ([...r.zutaten].sort().join('|') === key) return r;
  return null;
}

/** Wie viele Geschosse pro Schuss (Fächer = 5) – für die Schadensverteilung */
const shots = (antrieb: string, spezial: readonly string[] = []) => (antrieb === 'faecher' ? 5 : 1) * (spezial.includes('salve3') ? 3 : 1);

/** Schaden pro Sekunde einer Waffe (grob, ohne Ladungseffekte) */
const dps = (w: Waffe) => w.schaden * w.feuerrate * shots(w.antrieb);

export function instabilitaet(quellen: readonly string[]): number {
  const gruppen = new Set(quellen.map((id) => W[id].gruppe));
  const n = new Set(quellen).size;
  return Math.min(100, (gruppen.size - 1) * 26 + (n - 1) * 10);
}

export interface FusionsWahl {
  /** Waffen-IDs, die das jeweilige Bauteil liefern */
  geschoss: string;
  antrieb: string;
  ladung: string;
}

export function fusionsId(wahl: FusionsWahl): string {
  return `fusion:${wahl.geschoss}+${wahl.antrieb}+${wahl.ladung}`;
}

const cache = new Map<string, Waffe>();

/**
 * Baut die Fusionswaffe. Werte systemisch:
 * Feuerrate und Reichweite vom Antriebs-Spender (passt zur Flugart),
 * Schaden so, dass der DPS dem Mittel der Eingangswaffen entspricht – plus Instabilitäts-Bonus.
 */
export function fusionsWaffe(wahl: FusionsWahl, quellen: readonly string[] = [wahl.geschoss, wahl.antrieb, wahl.ladung]): Waffe {
  const rezept = findeRezept(quellen);
  const id = rezept ? `rezept:${rezept.id}` : fusionsId(wahl);
  const hit = cache.get(id);
  if (hit) return hit;

  const inputs = quellen.map((q) => W[q]);
  const uniq = [...new Set(quellen)];
  const instabil = instabilitaet(quellen);
  const avgDps = inputs.reduce((s, w) => s + dps(w), 0) / inputs.length;
  const gruppen = [...new Set(uniq.map((q) => W[q].gruppe))] as Gruppe[];

  let teile = { geschoss: W[wahl.geschoss].geschoss, antrieb: W[wahl.antrieb].antrieb, ladung: W[wahl.ladung].ladung };
  const rateSrc = W[wahl.antrieb];
  let feuerrate = rateSrc.feuerrate, reichweite = rateSrc.reichweite;
  let spezial: string[] = [];
  let mult = 1 + instabil / 100 * 0.6;
  let name = fusionsName(teile.geschoss, teile.antrieb, teile.ladung);
  let text = `${t('{geschoss}, {antrieb}, mit {ladung}.', { geschoss: G[teile.geschoss].name, antrieb: A[teile.antrieb].name.toLowerCase(), ladung: L[teile.ladung].name.toLowerCase() })} ${A[teile.antrieb].text} ${L[teile.ladung].text}`;
  if (rezept) {
    teile = { geschoss: rezept.geschoss, antrieb: rezept.antrieb, ladung: rezept.ladung };
    const avg = (f: (w: Waffe) => number) => inputs.reduce((sum, w) => sum + f(w), 0) / inputs.length;
    feuerrate = avg((w) => w.feuerrate) * rezept.feuerrate;
    reichweite = avg((w) => w.reichweite) * rezept.reichweite;
    spezial = rezept.spezial;
    mult *= rezept.schaden;
    name = rezept.name;
    text = rezept.text;
  }
  const schaden = (avgDps * mult) / (feuerrate * shots(teile.antrieb, spezial));
  const w: Waffe = {
    id,
    name,
    gruppe: W[wahl.antrieb].gruppe,
    ...teile,
    schaden: Math.round(schaden * 10) / 10,
    feuerrate: Math.round(feuerrate * 100) / 100,
    reichweite: Math.round(reichweite * 10) / 10,
    text,
    spezial,
    fusion: { teile: { ...wahl }, quellen: uniq, gruppen, elemente: elemente(teile), instabil, rezept: rezept?.id }
  };
  cache.set(id, w);
  return w;
}

/** Waffe nach ID – normale Waffen, Fusionen und Rezepte. */
export function waffeById(id: string): Waffe | undefined {
  if (W[id]) return W[id];
  if (cache.has(id)) return cache.get(id);
  if (id.startsWith('evo:')) {
    const v = id[4] as 'a' | 'b', base = waffeById(id.slice(6));
    if (!base || base.evo || (v !== 'a' && v !== 'b')) return undefined;
    const w = evolve(base, v);
    cache.set(id, w);
    return w;
  }
  if (id.startsWith('fusion:')) {
    const [g, a, l] = id.slice(7).split('+');
    if (W[g] && W[a] && W[l]) return fusionsWaffe({ geschoss: g, antrieb: a, ladung: l }, [g, a, l]);
  }
  if (id.startsWith('rezept:')) {
    const r = REZEPT_BY_ID[id.slice(7)];
    if (r) return fusionsWaffe({ geschoss: r.zutaten[0], antrieb: r.zutaten[1], ladung: r.zutaten[2] }, r.zutaten);
  }
  return undefined;
}

/**
 * Prüft eine Fusion. `quellen` = die ausgewählten Waffen (2–3), `wahl` = wer welches Bauteil liefert.
 * Regeln: keine Fusion von Fusionen, verschiedene Gruppen (außer bei geheimen Rezepten),
 * jede Waffe liefert mindestens ein Bauteil.
 */
export function pruefeFusion(quellen: readonly string[], wahl: FusionsWahl): string | null {
  if (quellen.length < 2 || quellen.length > 3) return tx('Wähle 2 oder 3 Waffen.');
  if (quellen.some((q) => !W[q])) return tx('Fusionen lassen sich nicht weiter verschmelzen – aber mergen!');
  if (findeRezept(quellen)) return null;
  const gruppen = quellen.map((q) => W[q].gruppe);
  if (new Set(gruppen).size !== gruppen.length) return tx('Die Waffen müssen aus verschiedenen Gruppen kommen.');
  const used = [wahl.geschoss, wahl.antrieb, wahl.ladung];
  if (used.some((u) => !quellen.includes(u))) return tx('Jedes Bauteil muss von einer gewählten Waffe kommen.');
  if (quellen.some((q) => !used.includes(q))) return tx('Jede Waffe muss mindestens ein Bauteil liefern.');
  return null;
}

export const AMBOSS = {
  /** Schmiedelohn in Kristallen */
  preis: (welle: number) => 5 + welle * 3,
  /** Bonus-Explosion bei Krit: Chance = Instabilität × Faktor */
  kawummChance: 0.5,
  kawummRadius: 1.6,
  kawummSchaden: 0.8
};
