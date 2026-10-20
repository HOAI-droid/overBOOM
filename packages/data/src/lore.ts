/**
 * OVERBOOM – Lore von Krawummia: Geschichte, Insel-Texte, Boss-Sprüche,
 * Wellen-Sprüche, Todes-Sprüche und Karten-Zitate.
 * Namen und Kurzbeschreibungen von Waffen, Gegnern, Helden und Items stehen
 * bei ihren Daten; alles Erzählerische liegt hier, damit die Welt leicht wächst.
 */

export const WELT = {
  name: 'Krawummia',
  untertitel: 'Eine Welt in Brocken',
  intro: [
    'Es war einmal eine ganz normale, runde Welt. Dann kam Baron von Bumm.',
    'Er baute die größte Bombe aller Zeiten und nannte sie „Das Große Kawumm". Er wollte nur mal gucken, was passiert.',
    'Seitdem schwebt Krawummia in Brocken durch den Himmel – und auf jedem Brocken hat sich eine andere Bande breitgemacht.',
    'Du bist ein Kawumm-Jäger. Befreie Insel für Insel und stell den Baron in seiner Bummburg. Mit noch mehr Kawumm.'
  ],
  kartenSet: 'Das Große Kawumm',
  kartenSetKurz: 'GK'
};

export interface InselLore {
  /** Text auf der Weltkarte, solange die Insel gesperrt ist */
  gesperrt: string;
  /** Banner-Untertitel beim Betreten */
  ankunft: string;
  /** nach dem Sieg über den Insel-Boss */
  befreit: string;
}

export const INSEL_LORE: Record<string, InselLore> = {
  gackerfeld: {
    gesperrt: '',
    ankunft: 'Es riecht nach Heu und Verschwörung.',
    befreit: 'König Gockel ist gestürzt. Die Hühner legen wieder ganz normale Eier. Meistens.'
  },
  funkenschlund: {
    gesperrt: 'Befreie Gackerfeld, um hierher zu fliegen.',
    ankunft: 'Die Haare stehen dir zu Berge. Allen.',
    befreit: 'Die Tesla-Türme summen jetzt friedlich. Man kann hier sogar Toast machen.'
  },
  rostgrat: {
    gesperrt: 'Befreie Funkenschlund, um hierher zu fliegen.',
    ankunft: 'Hier quietscht alles. Auch die Gegner.',
    befreit: 'Der Megatoaster ist nur noch ein Mega-Brotkrümel. Die Blechbrut sucht sich ein Hobby.'
  },
  pilzmoor: {
    gesperrt: 'Befreie Rostgrat, um hierher zu fliegen.',
    ankunft: 'Nicht anfassen. Nicht einatmen. Nicht essen.',
    befreit: 'Morchella ist verwelkt. Der Sumpf riecht nur noch halb so schlimm.'
  },
  lavakessel: {
    gesperrt: 'Befreie Pilzmoor, um hierher zu fliegen.',
    ankunft: 'Der Boden ist Lava. Diesmal wirklich.',
    befreit: 'Der Vulkan blubbert jetzt gemütlich vor sich hin. Wie ein Fondue.'
  },
  frostfass: {
    gesperrt: 'Befreie Lavakessel, um hierher zu fliegen.',
    ankunft: 'Rutschig. Kalt. Pinguine mit Bomben. Viel Glück.',
    befreit: 'Das Eis taut. Die Schneemänner nehmen es sportlich.'
  },
  bummburg: {
    gesperrt: 'Befreie Frostfass, um die Bummburg zu stürmen.',
    ankunft: 'Hier wohnt der Baron. Klingeln zwecklos.',
    befreit: 'Die Bummburg wackelt. Nur noch der Baron selbst steht im Weg.'
  }
};

/** Sprüche der Bosse: Auftritt (Banner) und Wut-Phase */
export const BOSS_LORE: Record<string, { auftritt: string; wut: string; sieg: string }> = {
  koenig_gockel: {
    auftritt: '„KIKERIKIII! Auf die Knie, Federlose!"',
    wut: 'Der König plustert sich auf!',
    sieg: 'Die Krone kullert davon. Ein Huhn hebt sie auf und guckt verlegen.'
  },
  megatoaster: {
    auftritt: '„BROT. WIRD. GETOASTET."',
    wut: 'Alle Schlitze glühen!',
    sieg: 'Es riecht nach verbranntem Toast. Und nach Sieg.'
  },
  morchella: {
    auftritt: '„Sporen, meine Kinder! Wachset!"',
    wut: 'Morchella verstreut ihre Sporen!',
    sieg: 'Morchella zerfällt zu einem sehr, sehr großen Pilzgericht.'
  },
  baron: {
    auftritt: '„Ich bin nicht dick, ich bin explosiv gebaut!"',
    wut: 'Der Baron ruft Verstärkung',
    sieg: 'Baron von Bumm fliegt im hohen Bogen davon. „Das war noch nicht das letzte KAWUMM!"'
  }
};

export const WELLEN_SPRUECHE = [
  'Sie kommen wieder!',
  'Mehr! Es kommen mehr!',
  'Nicht blinzeln.',
  'Hörst du das Grummeln?',
  'Die Bande holt Verstärkung.',
  'Jetzt wird’s ernst. Ein bisschen.',
  'Hinter dir! Nein, Scherz. Doch!',
  'Tief durchatmen. Und dann Kawumm.',
  'Die haben Freunde mitgebracht.',
  'Noch eine Runde Chaos, bitte.'
];

export const SPRUECHE_TOD = [
  'Kawumm! Das war wohl zu viel Kawumm.',
  'Die Grummelbolde grummeln zufrieden.',
  'Die Bomben-Kröten quaken ein Siegeslied.',
  'Der Toastomat toastet auf deinen Untergang.',
  'Baron von Bumm zwirbelt zufrieden den Schnurrbart.',
  'Ein Kampfhuhn gackert hämisch.',
  'Der Schleimi teilt sich vor Freude.',
  'Irgendwo lacht ein Pilzling. Leise. Sporig.',
  'Die Kawumm-Jäger-Akademie schickt einen Beileids-Keks.'
];

/** Tipps und Sprüche (Titel, Pause) */
export const TIPPS = [
  'Bomben-Kröten explodieren auch, wenn man sie erwischt. Stell dich nicht daneben. Oder doch – wenn du Ketten liebst.',
  'Drei gleiche Waffen gleicher Stufe? Verschmelzen! Zwei verschiedene Gruppen? Ab zum Amboss!',
  'Die Overkill-Leiste füllt sich durch Kills und Ketten. Voll? OVERBOOM drücken und genießen.',
  'Feuer + Wasser = Dampfexplosion. Die Natur ist ein großer Chemiebaukasten.',
  'Im Koop rechnet das Gerät des Hosts für alle. Ein PC ist ein guter Host.',
  'Niedergeschlagen? Ein Mitspieler muss nur kurz neben dir stehen.',
  'Elite-Gegner tragen eine Krone – und manchmal Ausrüstung.',
  'Sterne bekommt eine Waffe durch Kills. Bei fünf Sternen wartet eine Evolution.',
  'Gesperrte Karten im Album verraten, wie man sie bekommt.',
  'Auf Gefahr 10 explodiert alles. Wirklich alles. Viel Glück!',
  'Glückspilz-Tipp: Neu würfeln ist manchmal gratis.',
  'Fässer sind Freunde. Explosive Freunde.',
  'Oma Granate verteilt Kekse. Gegen Kekse hat noch niemand gewonnen.',
  'Prof. Fusionski schmiedet gratis. Er nennt das „Forschung".',
  'Schadenszahlen, Wackeln und Lichtblitze kannst du in den Einstellungen anpassen.',
  'Ein Kampfhuhn scharrt, bevor es stürmt. Hör auf das Scharren!',
  'Die Pilzkönigin mag keine Feuerwaffen. Und auch sonst nichts.',
  'Spielstand sichern: Album → Erfolge → Code kopieren.',
  'Der Baron hat das Große Kawumm gezündet. Zeit, das Kawumm zurückzugeben.',
  'Kein Huhn wurde bei der Entwicklung verletzt. Sie sind alle nur sehr wütend.'
];

export let SIEG_TEXT = 'Baron von Bumm ist geschlagen. Krawummia atmet auf – vorerst.';
/** nur für die Übersetzung (lokalisierung.ts) */
export function setzeSiegText(s: string): void { SIEG_TEXT = s; }

/** Namen und Texte der Helden-Macken (für Karten und Tooltips) */
export const PERK_INFO: Record<string, { name: string; text: string }> = {
  nurExplosiv: { name: 'Nur echtes Kawumm', text: 'Im Shop gibt es nur Waffen mit Explosiv- oder Feuer-Element.' },
  turmprofi: { name: 'Turmbau zu Bummel', text: 'Zwei Türme gleichzeitig, Türme treffen 50 % härter.' },
  zufall: { name: 'Schwein gehabt', text: 'Zufällige Startwaffe, der erste Reroll pro Shop ist gratis.' },
  kekse: { name: 'Keksdose', text: 'Alle 8 Sekunden ein Keks: +2 Leben.' },
  huehnerfreund: { name: 'Hühnerflüsterer', text: 'Gacker-Waffen +40 % Schaden, alle 6 Sekunden schlüpft ein Küken.' },
  blitzprofi: { name: 'Hochspannung', text: 'Kettenblitze springen doppelt so weit.' },
  frostprofi: { name: 'Kalte Schulter', text: 'Gegner frieren schon nach 2 Frost-Treffern ein.' },
  giftprofi: { name: 'Hexenküche', text: 'Gift wirkt 60 % stärker.' },
  nahkampfprofi: { name: 'Handfest', text: 'Nahkampf-Waffen +50 % Schaden.' },
  dashprofi: { name: 'Windhose', text: 'Dash lädt 40 % schneller und schubst Gegner weg.' },
  fusionsprofi: { name: 'Amboss-Abo', text: 'Schmiedelohn gratis, Fusionen +25 % Schaden.' },
  grummelfreund: { name: 'Alte Kumpels', text: 'Gegner lassen öfter einen Extra-Kristall fallen.' }
};

/** Verhalten der Gegner als Karten-Fähigkeit */
export const VERHALTEN_INFO: Record<string, { name: string; text: string }> = {
  jagen: { name: 'Hinterher!', text: 'Läuft stur auf dich zu.' },
  kamikaze: { name: 'Letzter Hüpfer', text: 'Springt dich an und explodiert – auch, wenn man sie erwischt.' },
  fernkampf: { name: 'Aus der Ferne', text: 'Hält Abstand und schießt.' },
  sprinter: { name: 'Anlauf', text: 'Nimmt Anlauf und stürmt geradeaus los.' },
  heiler: { name: 'Pflaster drauf', text: 'Heilt Gegner in der Nähe.' },
  schild: { name: 'Schildwall', text: 'Blockt Treffer von vorn größtenteils ab.' },
  minenleger: { name: 'Vorsicht, Stufe', text: 'Legt Minen auf den Boden.' },
  spurleger: { name: 'Schleimspur', text: 'Hinterlässt eine gefährliche Spur.' },
  beschwoerer: { name: 'Herbeirufen', text: 'Ruft weitere Gegner herbei.' },
  rutscher: { name: 'Bauchrutscher', text: 'Rutscht in hohem Tempo auf dich zu.' },
  boss: { name: 'Endgegner', text: 'Wechselt zwischen mehreren Angriffen. Wird ab halber Energie wütend.' }
};

export const BOSS_ANGRIFF_INFO: Record<string, string> = {
  bomben: 'Bombenhagel mit roten Einschlag-Markierungen',
  ansturm: 'Ansturm quer durch die Arena',
  ring: 'Geschossring in alle Richtungen',
  sporen: 'Giftsporen-Wolken',
  beschwoeren: 'Ruft seine Bande zu Hilfe'
};

/** Zitate auf Waffenkarten: eigene für einige Waffen, sonst je Gruppe */
export const WAFFEN_ZITATE: Record<string, string> = {
  pistole: '„Klein, aber oho. Vor allem oho." – Kawumm-Kid',
  raketenwerfer: '„Warum zielen, wenn man die Rakete fragen kann?" – Der Pyromane',
  teslastab: '„Bitte nicht anfassen. Ehrlich." – Blitz-Bettina',
  huehnerkanone: '„Kein Huhn wurde verletzt. Nur sehr viele Gegner." – Bauer Bruno',
  bratpfanne: '„In meiner Küche wird nicht gegrummelt!" – Oma Granate',
  keksdose: '„Ein Keks gegen jeden Kummer." – Oma Granate',
  kampfkazoo: '„TÖÖÖÖRÖÖÖ!" – unbekannter Musiker',
  schwarzlochwerfer: '„Ups. Wo ist der Shop hin?" – Prof. Fusionski',
  kettensaege: '„Holz? Nein. Gegner? Ja." – Panzer-Paule',
  dudelsack: '„Musik, die Gegner in die Flucht schlägt. Und Freunde." – Grubert',
  geschuetzturm: '„Ich baue, also bin ich." – Die Ingenieurin',
  bananarang: '„Kommt immer zurück. Wie schlechte Witze." – Sprintina Flitz',
  giftblaeser: '„Nur eine Prise. Oder zwanzig." – Giftmischerin Gerda',
  eiszapfenwerfer: '„Bleib cool." – Frost-Fritz',
  grummelpfeife: '„Die hören auf mich. Meistens." – Grubert der Bekehrte',
  partykanone: '„Konfetti ist auch eine Waffe." – Der Glückspilz',
  orbitalschlag: '„Bitte zurücktreten. Weiter. NOCH weiter."',
  kuckucksuhr: '„Kuckuck! … KAWUMM!"'
};

export const GRUPPEN_ZITATE: Record<string, string[]> = {
  Feuerwaffen: ['„Abzug ziehen, nicht nachdenken." – Akademie-Leitfaden, Seite 1', '„Peng ist das kleine Kawumm."'],
  Explosiv: ['„Ohne Kawumm ist alles doof." – Der Pyromane', '„Ohrenschützer? Wozu?"'],
  Elementar: ['„Die Natur ist wunderschön. Und wütend."', '„Element ist, was knallt, brennt oder blitzt."'],
  Nahkampf: ['„Nähe schafft Vertrauen. Und Beulen." – Panzer-Paule', '„Reichweite wird überschätzt."'],
  Energie: ['„Strom kostet nichts, wenn man ihn klaut." – Prof. Fusionski', '„Pew pew. Aber in laut."'],
  'Drohnen & Türme': ['„Lass die Maschinen arbeiten." – Die Ingenieurin', '„Mein Turm, meine Regeln."'],
  Beschwörung: ['„Viele kleine Helfer sind auch eine Armee."', '„Wer hat die alle eingeladen?"'],
  Werfer: ['„Ausholen, zielen, lachen."', '„Was fliegt, das trifft. Irgendwann."'],
  Exotisch: ['„Fragen Sie nicht, wie es funktioniert. Es funktioniert." – Prof. Fusionski', '„Das war so nicht im Handbuch."'],
  Support: ['„Auch Helfer helfen beim Kawumm."', '„Erst heilen, dann knallen."']
};

/** Zitate auf Rezept-Karten */
export const REZEPT_ZITATE: Record<string, string> = {
  huhnageddon: '„Ich hab doch nur drei Hühner zusammengesteckt!" – Bauer Bruno',
  kawummageddon: '„Endlich. ENDLICH!" – Der Pyromane',
  donnertoaster: '„Frühstück ist die wichtigste Mahlzeit des Tages." – Megatoaster',
  schwarzesbuffet: '„Alles muss raus. Vor allem rein." – Prof. Fusionski',
  omasgeheimrezept: '„Das Rezept nehme ich mit ins Grab." – Oma Granate',
  entensturm: '„Quiek!" – eine Gummiente, kurz vor dem Ende',
  frostfeuerwerk: '„Schön kalt, schön bunt." – Frost-Fritz',
  saegenkarussell: '„Einmal rundherum, bitte." – Panzer-Paule',
  bienenkoenigin: '„Bsssss." – Ihre Majestät',
  gackerchaos: '„Gack? GACK!" – ehemaliger Grummelbold',
  pommesbude: '„Mit Mayo oder mit Kawumm?" – Oma Granate',
  gewitterkapelle: '„Das ist kein Lärm, das ist Hochspannungsmusik." – Blitz-Bettina',
  schneeballschlacht: '„Wer zuerst friert, hat verloren." – Frost-Fritz',
  goldesel: '„Geld stinkt nicht. Grummelbolde schon." – Grubert',
  bowlingapokalypse: '„STRIIIKE! Und … weg." – Panzer-Paule',
  fruehstuecksapokalypse: '„Ich wollte doch nur Frühstück." – Megatoaster',
  drohnenstaffel: '„Staffel, Formation Kawumm!" – Die Ingenieurin',
  laserdisco: '„Und jetzt alle: TÖÖÖRÖÖÖ!" – Der Glückspilz',
  schleimlawine: '„Blubb." – ein Schleimi, sehr beeindruckt',
  vulkanausbruch: '„Das ist kein Ausbruch, das ist ein Gruß." – Der Pyromane',
  stinkendebrut: '„Riecht wie Bauer Brunos Socken." – Giftmischerin Gerda',
  zeitgewitter: '„Kuckuck! Es ist … Gewitterzeit."',
  mahlstrom: '„Alles hängt zusammen. Vor allem die Gegner." – Prof. Fusionski',
  holzfaellerhurrikan: '„Holz vor der Hütte? Nicht mehr lange." – Panzer-Paule',
  lazarettluftbruecke: '„Erst verarzten, dann verkloppen." – Oma Granate',
  tiefkuehltruhe: '„Bitte nicht auftauen." – Frost-Fritz',
  sternenhimmel: '„Wünsch dir was. Zum Beispiel weniger Gegner."',
  pilzrave: '„Untz untz untz … hust." – ein Pilzling',
  nagelbombe: '„Do it yourself!" – Die Ingenieurin',
  ententsunami: '„Quietsch!" – die Flotte',
  grummelaufstand: '„Grmpf! Für Grubert!" – die Grummel-Garde',
  todesblick: '„Nicht blinzeln." – Prof. Fusionski',
  honigfalle: '„Bsss … klebt." – eine sehr zufriedene Biene',
  teppichbombardement: '„Ich nenne es: Kunst." – Der Pyromane',
  minenrasen: '„Bitte den Rasen nicht betreten." – Schild am Gartenzaun',
  kopfoderkawumm: '„Ich gewinne immer." – Der Glückspilz',
  lawine: '„Vorsicht, rutschig!" – Schneemann Fritz',
  trommelfeuer: '„BUMM-TSCHAK-BUMM!" – die Kapelle',
  teslaspule: '„Nicht anfassen. Nein, wirklich." – Blitz-Bettina',
  huehnerstallrevolte: '„Gack-gack-GACKERN!" – König Gockel (unfreiwillig)'
};

/** Text für Fusions-Sonderwirkungen (Rezept-Karten) */
export const SPEZIAL_INFO: Record<string, { name: string; text: string }> = {
  salve3: { name: 'Dreifach', text: '3 Geschosse pro Schuss.' },
  cluster: { name: 'Cluster', text: 'Explosionen zerfallen in 3 Mini-Explosionen.' },
  doppelblitz: { name: 'Doppelblitz', text: 'Kettenblitze springen doppelt so oft.' },
  implosion: { name: 'Implosion', text: 'Der Sog explodiert am Ende.' },
  heilkeks: { name: 'Heilkeks', text: 'Treffer können dich heilen.' },
  schwarm6: { name: 'Großer Schwarm', text: '6 statt 3 Begleiter.' },
  konfettifrost: { name: 'Konfettifrost', text: 'Frost verwirrt zusätzlich.' },
  orbit6: { name: 'Großer Orbit', text: '6 Kreisel auf größerem Radius.' },
  giftwolke: { name: 'Giftwolke', text: 'Vergiftete Gegner hinterlassen Giftpfützen.' },
  kueken: { name: 'Kükenschlupf', text: 'Treffer lassen Küken schlüpfen.' },
  gross: { name: 'Riesig', text: 'Größer, langsamer, verheerend.' },
  minibumm: { name: 'Mini-Bumm', text: 'Treffer lösen manchmal eine Mini-Explosion aus.' },
  feuerspur: { name: 'Feuerspur', text: 'Treffer hinterlassen manchmal Lavapfützen.' },
  frostnova: { name: 'Frostnova', text: 'Treffer frieren manchmal alles ringsum ein.' },
  goldregen: { name: 'Goldregen', text: 'Getroffene Gegner spucken manchmal einen Kristall aus.' },
  donner: { name: 'Donnerschlag', text: 'Treffer rufen manchmal einen Blitzschlag.' }
};

/** deterministisch ein Element aus einer Liste nach Text-Hash */
export function waehle<T>(liste: readonly T[], schluessel: string): T {
  let h = 7;
  for (let i = 0; i < schluessel.length; i++) h = (h * 31 + schluessel.charCodeAt(i)) | 0;
  return liste[Math.abs(h) % liste.length];
}
