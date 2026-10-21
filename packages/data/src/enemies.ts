/**
 * OVERBOOM – Gegner: 16 Typen in 7 Fraktionen + 4 Inselbosse, 7 Inselbarone/-baroninnen und das Große Kawumm
 *
 * „Grimmig, aber knuffig": große Köpfe, schräge Wut-Brauen, nie gruselig.
 * Werte sind Grundwerte auf Welle 1; die Wellen skalieren HP (siehe balance.ts).
 */

export type Verhalten =
  | 'jagen' | 'kamikaze' | 'fernkampf' | 'boss'
  | 'sprinter' | 'heiler' | 'schild' | 'minenleger' | 'spurleger' | 'beschwoerer' | 'rutscher';

/** Boss-Angriffe (werden der Reihe nach gespielt) */
export type BossAngriff =
  | 'bomben' | 'ansturm' | 'ring' | 'sporen' | 'beschwoeren'
  /** Kugelspirale: mehrere gedrehte Salven nacheinander */
  | 'spirale'
  /** gezielter Fächer auf den Spieler */
  | 'faecher'
  /** Bodenflächen leuchten auf und explodieren kurz danach (Ausweichen!) */
  | 'flaechen'
  /** Sprung auf den Spieler, Druckwelle bei der Landung */
  | 'sprung'
  /** sich drehendes Kreuzfeuer */
  | 'kreuz'
  /** Minen rund um den Boss verteilen */
  | 'minen';

/** Art der Bodenflächen beim Angriff 'flaechen' */
export type FlaechenArt = 'explosion' | 'lava' | 'gift' | 'blitz' | 'eis';

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
  /** Aussehen des Geschosses (Geschoss-ID) und Zusatzwirkung beim Spieler */
  schussGeschoss?: string;
  schussEffekt?: 'langsam';

  /** Rudel: so viele Begleiter erscheinen zusätzlich (0–n) */
  rudel?: number;

  // Sprinter / Rutscher: Ansturm
  ansturmTempo?: number;
  ansturmDauer?: number;
  ansturmAbstand?: number;

  // Heiler
  heilRadius?: number;
  /** Anteil der Max-HP, der geheilt wird */
  heilMenge?: number;
  heilIntervall?: number;

  /** Schildträger: Schaden von vorne × Faktor */
  schildFaktor?: number;

  // Minenleger / Spurleger
  minenIntervall?: number;
  minenSchaden?: number;
  spur?: 'gift' | 'lava';
  spurIntervall?: number;
  spurSchaden?: number;

  /** Splitter: beim Tod in kleinere Gegner zerfallen */
  teiltSich?: { in: string; anzahl: number };

  // Beschwörer und Bosse
  beschwoert?: string;
  beschwoerAnzahl?: number;
  beschwoerIntervall?: number;

  /** Bosse: Angriffe in Phase 1 und 2 (unter 50 % Leben); Finalboss mit Phase 3 (Drittel-Schwellen) */
  angriffe1?: BossAngriff[];
  angriffe2?: BossAngriff[];
  angriffe3?: BossAngriff[];
  /** Rang: Inselboss (Welle 10), Baron (letzte Inselwelle), Finale */
  rang?: 'boss' | 'baron' | 'finale';
  /** Bodenflächen-Art und Geschoss-Aussehen für Spirale/Fächer/Kreuz */
  flaechenArt?: FlaechenArt;
  schussGeschossBoss?: string;
  /** Geschoss für Ring-Angriffe */
  ringGeschoss?: string;
  /** Größe des Modells (Bosse) */
  groesse?: number;
  /** Taktik beim Laufen: umzingeln (schneidet den Weg ab), lauern (wartet in Deckung, stürmt dann los) */
  taktik?: 'umzingeln' | 'lauern';
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
    abWelle: 1, gewicht: 6, masse: 1, rudel: 3, taktik: 'umzingeln'
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
  },
  // ---------------- Hühner-Kult (Gackerfeld) ----------------
  {
    id: 'kampfhuhn', name: 'Kampfhuhn', fraktion: 'Hühner-Kult',
    spruch: '„BAGAWK!"',
    text: 'Ein Huhn mit Stirnband und sehr viel Wut. Scharrt kurz – und stürmt dann los wie ein gefiederter Torpedo.',
    verhalten: 'sprinter',
    hp: 12, tempo: 2.4, radius: 0.3, beruehrSchaden: 9, kristalle: 1,
    abWelle: 1, gewicht: 3, masse: 0.8,
    ansturmTempo: 9, ansturmDauer: 0.55, ansturmAbstand: 5
  },
  {
    id: 'vogelscheuche', name: 'Vogelscheuche Stroh-Udo', fraktion: 'Hühner-Kult',
    spruch: '„Ich hab ein Herz aus Stroh – und das schlägt für meine Truppe!"',
    text: 'Hält Abstand und heilt mit wedelnden Armen alle Gegner in der Nähe. Zuerst ausschalten!',
    verhalten: 'heiler',
    hp: 30, tempo: 1.6, radius: 0.34, beruehrSchaden: 5, kristalle: 3,
    abWelle: 4, gewicht: 0.8, masse: 1.4,
    wunschAbstand: 5.5, heilRadius: 3.2, heilMenge: 0.25, heilIntervall: 3.2
  },
  // ---------------- Funkenbande (Funkenschlund) ----------------
  {
    id: 'funkenkobold', name: 'Funkenkobold', fraktion: 'Funkenbande',
    spruch: '„Bzzzt! Hihi!"',
    text: 'Winzig, flink, statisch aufgeladen. Kommt immer im Schwarm und schießt kleine Funken.',
    verhalten: 'fernkampf',
    hp: 8, tempo: 3.2, radius: 0.24, beruehrSchaden: 5, kristalle: 1,
    abWelle: 1, gewicht: 3, masse: 0.6, rudel: 3,
    wunschAbstand: 3.5, schussIntervall: 2.8, schussSchaden: 5, schussTempo: 9, schussGeschoss: 'funke'
  },
  {
    id: 'teslaritter', name: 'Tesla-Ritter', fraktion: 'Funkenbande',
    spruch: '„Mein Schild ist geladen – im wahrsten Sinne!"',
    text: 'Trägt einen Spulenschild. Treffer von vorne prallen fast wirkungslos ab – also: von der Seite oder mit Explosionen!',
    verhalten: 'schild',
    hp: 40, tempo: 1.7, radius: 0.38, beruehrSchaden: 12, kristalle: 4,
    abWelle: 3, gewicht: 1.2, masse: 2.5, schildFaktor: 0.2
  },
  // ---------------- Blechbrut (Rostgrat) ----------------
  {
    id: 'schrottgolem', name: 'Schrottgolem', fraktion: 'Blechbrut',
    spruch: '„KLONK. KLONK. KLONK."',
    text: 'Ein wandelnder Schrotthaufen mit Kühlschranktür als Brust. Langsam, aber zäh wie Omas Schnitzel.',
    verhalten: 'jagen',
    hp: 110, tempo: 1.25, radius: 0.55, beruehrSchaden: 16, kristalle: 8,
    abWelle: 3, gewicht: 0.9, masse: 6
  },
  {
    id: 'minenbot', name: 'Minenbot', fraktion: 'Blechbrut',
    spruch: '„Piep. Hier liegt was. Piep."',
    text: 'Rollt herum und verteilt blinkende Minen. Nicht drauftreten – oder vorher abschießen.',
    verhalten: 'minenleger',
    hp: 22, tempo: 1.9, radius: 0.32, beruehrSchaden: 6, kristalle: 3,
    abWelle: 2, gewicht: 1.2, masse: 1.5,
    wunschAbstand: 4, minenIntervall: 3, minenSchaden: 14
  },
  // ---------------- Sumpfbande (Pilzmoor) ----------------
  {
    id: 'pilzling', name: 'Pilzling', fraktion: 'Sumpfbande',
    spruch: '„Pfff. Riechst du das? Das bin ich."',
    text: 'Kleiner Stinkepilz mit roter Kappe und Schmollmund. Hinterlässt Giftwolken, wo er langläuft.',
    verhalten: 'spurleger',
    hp: 18, tempo: 1.9, radius: 0.3, beruehrSchaden: 6, kristalle: 2,
    abWelle: 1, gewicht: 2.5, masse: 1, spur: 'gift', spurIntervall: 1.4, spurSchaden: 6
  },
  {
    id: 'schleimi', name: 'Schleimi', fraktion: 'Sumpfbande',
    spruch: '„Blubb. Blubb blubb."',
    text: 'Ein grimmiger Glibberklops. Platzt man ihn, werden es zwei kleine. Die sind noch grimmiger.',
    verhalten: 'jagen',
    hp: 30, tempo: 1.7, radius: 0.4, beruehrSchaden: 8, kristalle: 2,
    abWelle: 2, gewicht: 1.6, masse: 1.3, teiltSich: { in: 'schleimchen', anzahl: 2 }, taktik: 'lauern'
  },
  {
    id: 'schleimchen', name: 'Schleimchen', fraktion: 'Sumpfbande',
    spruch: '„Blubb!"',
    text: 'Halber Schleimi, doppelte Laune.',
    verhalten: 'jagen',
    hp: 10, tempo: 2.6, radius: 0.24, beruehrSchaden: 5, kristalle: 1,
    abWelle: 999, gewicht: 0, masse: 0.7
  },
  // ---------------- Glutgesindel (Lavakessel) ----------------
  {
    id: 'lavaklops', name: 'Lavaklops', fraktion: 'Glutgesindel',
    spruch: '„Heiß, heißer, ich!"',
    text: 'Ein brodelnder Klumpen mit Grummelgesicht. Hinterlässt eine glühende Spur – nicht reintreten!',
    verhalten: 'spurleger',
    hp: 34, tempo: 1.6, radius: 0.38, beruehrSchaden: 10, kristalle: 3,
    abWelle: 1, gewicht: 2, masse: 2, spur: 'lava', spurIntervall: 0.9, spurSchaden: 8
  },
  {
    id: 'kultist', name: 'Kawumm-Kultist', fraktion: 'Glutgesindel',
    spruch: '„Oh großes Kawumm, schick uns Verstärkung!"',
    text: 'Verehrt das Große Kawumm. Hält Abstand und öffnet Portale, aus denen Grummelbolde purzeln.',
    verhalten: 'beschwoerer',
    hp: 26, tempo: 1.6, radius: 0.32, beruehrSchaden: 6, kristalle: 4,
    abWelle: 3, gewicht: 0.9, masse: 1.2,
    wunschAbstand: 6, beschwoert: 'grummelbold', beschwoerAnzahl: 3, beschwoerIntervall: 6
  },
  // ---------------- Frostfrieder (Frostfass) ----------------
  {
    id: 'schneemann', name: 'Schneemann Fritz', fraktion: 'Frostfrieder',
    spruch: '„Ich bin cool. Eiskalt sogar."',
    text: 'Wirft pappige Schneebälle, die dich verlangsamen. Möhrennase gerümpft, Kohleaugen zusammengekniffen.',
    verhalten: 'fernkampf',
    hp: 28, tempo: 1.5, radius: 0.36, beruehrSchaden: 7, kristalle: 3,
    abWelle: 1, gewicht: 1.6, masse: 1.6,
    wunschAbstand: 5.5, schussIntervall: 2.2, schussSchaden: 7, schussTempo: 7.5, schussGeschoss: 'schneeball', schussEffekt: 'langsam'
  },
  {
    id: 'bombenpinguin', name: 'Bombenpinguin', fraktion: 'Frostfrieder',
    spruch: '„Wiiieeee – KAWUMM!"',
    text: 'Rutscht auf dem Bauch heran und explodiert beim Aufprall. Nimmt Anlauf: kurz Zeit zum Ausweichen!',
    verhalten: 'rutscher',
    hp: 14, tempo: 1.9, radius: 0.32, beruehrSchaden: 5, kristalle: 2,
    abWelle: 2, gewicht: 2, masse: 1,
    ansturmTempo: 8.5, ansturmDauer: 0.9, ansturmAbstand: 6, explosionsRadius: 1.7, explosionsSchaden: 15
  },
  // ---------------- Bosse ----------------
  {
    id: 'koenig_gockel', name: 'König Gockel der Laute', fraktion: 'Hühner-Kult',
    spruch: '„KIKERIKIIIII! Auf die Knie, Federlose!"',
    text: 'Riesiger Hahn mit Goldkrone und Umhang. Stürmt los, schleudert Federn im Kreis und ruft seine Kampfhühner.',
    verhalten: 'boss',
    hp: 2300, tempo: 1.5, radius: 0.85, beruehrSchaden: 18, kristalle: 60,
    abWelle: 999, gewicht: 0, masse: 25, groesse: 1,
    ansturmTempo: 10, ansturmDauer: 0.8,
    angriffe1: ['ansturm', 'ring'], angriffe2: ['ansturm', 'ring', 'beschwoeren', 'ring'], ringGeschoss: 'feder',
    beschwoert: 'kampfhuhn', beschwoerAnzahl: 4
  },
  {
    id: 'megatoaster', name: 'Toastomat 3000', fraktion: 'Blechbrut',
    spruch: '„FRÜHSTÜCK. FÜR. ALLE."',
    text: 'Der große Bruder aller Toastomaten. Feuert Toast-Salven im Kreis, wirft Brotbomben und ruft Minenbots.',
    verhalten: 'boss',
    hp: 2600, tempo: 1.1, radius: 0.9, beruehrSchaden: 18, kristalle: 60,
    abWelle: 999, gewicht: 0, masse: 25, groesse: 1,
    angriffe1: ['ring', 'bomben'], angriffe2: ['ring', 'bomben', 'beschwoeren', 'ring'], ringGeschoss: 'toast',
    beschwoert: 'minenbot', beschwoerAnzahl: 3
  },
  {
    id: 'morchella', name: 'Pilzkönigin Morchella', fraktion: 'Sumpfbande',
    spruch: '„Ihr seid nur Dünger für mein Reich!"',
    text: 'Gewaltiger Pilz mit Spitzenkragen und Schmollmund. Lässt Giftsporen regnen und ruft Schleimis.',
    verhalten: 'boss',
    hp: 2500, tempo: 1.0, radius: 0.85, beruehrSchaden: 16, kristalle: 60,
    abWelle: 999, gewicht: 0, masse: 25, groesse: 1,
    angriffe1: ['sporen', 'ring'], angriffe2: ['sporen', 'ring', 'beschwoeren', 'sporen'], ringGeschoss: 'spore',
    beschwoert: 'schleimi', beschwoerAnzahl: 3
  },
  {
    id: 'baron',
    name: 'Baron von Bumm',
    fraktion: 'Bummburg',
    spruch: '„Ich bin nicht dick, ich bin explosiv gebaut!"',
    text: 'Runder Bösewicht mit Zylinder, Monokel und Schnurrbart. Auf dem Hut brennt eine Bombe. Hat das Große Kawumm gezündet und ist sehr stolz darauf.',
    verhalten: 'boss', groesse: 1.1,
    hp: 2600, tempo: 1.25, radius: 0.85, beruehrSchaden: 18, kristalle: 60,
    abWelle: 999, gewicht: 0, masse: 25,
    explosionsRadius: 1.9, explosionsSchaden: 16,
    angriffe1: ['bomben', 'flaechen', 'faecher'], angriffe2: ['bomben', 'flaechen', 'beschwoeren', 'spirale', 'bomben'],
    beschwoert: 'bombenkroete', beschwoerAnzahl: 3,
    rang: 'baron', flaechenArt: 'explosion', schussGeschossBoss: 'bombe'
  },
  // ---------------- Inselbarone und -baroninnen (letzte Welle jeder Insel) ----------------
  {
    id: 'baronin_gackerella', name: 'Baronin Gackerella von Federstein', fraktion: 'Hühner-Kult',
    spruch: '„Gack! Man verneigt sich vor einer Dame, Federloser!"',
    text: 'Hochnäsige Riesenhenne mit Federhut und Lorgnette. Lässt Eier vom Himmel regnen, rauscht quer übers Feld und ruft ihre Kampfhühner.',
    verhalten: 'boss', rang: 'baron',
    hp: 3000, tempo: 1.6, radius: 0.9, beruehrSchaden: 18, kristalle: 80,
    abWelle: 999, gewicht: 0, masse: 30, groesse: 1.1,
    ansturmTempo: 11, ansturmDauer: 0.8, flaechenArt: 'explosion', ringGeschoss: 'feder', schussGeschossBoss: 'feder',
    angriffe1: ['flaechen', 'ansturm', 'faecher'], angriffe2: ['flaechen', 'ansturm', 'ring', 'beschwoeren', 'faecher'],
    beschwoert: 'kampfhuhn', beschwoerAnzahl: 5
  },
  {
    id: 'baron_blitzbirne', name: 'Baron Blitzbirne', fraktion: 'Funkenbande',
    spruch: '„Mir geht ein Licht auf – und dir gleich die Puste aus!"',
    text: 'Eitler Edelmann mit einer riesigen Glühbirne als Kopf und Frack voller Kabel. Lässt Blitze einschlagen und dreht sich im Kreuzfeuer.',
    verhalten: 'boss', rang: 'baron',
    hp: 3200, tempo: 1.3, radius: 0.85, beruehrSchaden: 18, kristalle: 80,
    abWelle: 999, gewicht: 0, masse: 30, groesse: 1.1,
    flaechenArt: 'blitz', ringGeschoss: 'blitzkugel', schussGeschossBoss: 'blitzkugel',
    angriffe1: ['flaechen', 'kreuz'], angriffe2: ['flaechen', 'kreuz', 'beschwoeren', 'flaechen', 'ring'],
    beschwoert: 'funkenkobold', beschwoerAnzahl: 5
  },
  {
    id: 'baronin_schraubella', name: 'Baronin Schraubella', fraktion: 'Blechbrut',
    spruch: '„Ich ziehe dir die Schrauben an. Alle. Gleichzeitig."',
    text: 'Elegante Blechdame mit Zahnrad-Krone und Schrauben-Monokel. Feuert Bolzenspiralen, streut Minen und ruft Minenbots.',
    verhalten: 'boss', rang: 'baron',
    hp: 3400, tempo: 1.1, radius: 0.9, beruehrSchaden: 18, kristalle: 80,
    abWelle: 999, gewicht: 0, masse: 32, groesse: 1.1,
    flaechenArt: 'explosion', ringGeschoss: 'toast', schussGeschossBoss: 'toast',
    angriffe1: ['spirale', 'minen'], angriffe2: ['spirale', 'minen', 'faecher', 'beschwoeren', 'spirale'],
    beschwoert: 'minenbot', beschwoerAnzahl: 4
  },
  {
    id: 'baronin_sporella', name: 'Baronin Sporella', fraktion: 'Sumpfbande',
    spruch: '„Atme tief ein, Schätzchen. Ganz tief."',
    text: 'Pilzbaronin mit Schleier aus Moos und einem Hut so groß wie ein Gartenteich. Verwandelt den Boden in Gifttümpel und pustet Sporenspiralen.',
    verhalten: 'boss', rang: 'baron',
    hp: 3300, tempo: 1.0, radius: 0.9, beruehrSchaden: 16, kristalle: 80,
    abWelle: 999, gewicht: 0, masse: 30, groesse: 1.1,
    flaechenArt: 'gift', ringGeschoss: 'spore', schussGeschossBoss: 'spore',
    angriffe1: ['flaechen', 'spirale'], angriffe2: ['flaechen', 'spirale', 'sporen', 'beschwoeren', 'ring'],
    beschwoert: 'schleimi', beschwoerAnzahl: 4
  },
  {
    id: 'baron_glutbauch', name: 'Baron Glutbauch', fraktion: 'Glutgesindel',
    spruch: '„Heiß? Ich? Ich bin glühend vor Wut!"',
    text: 'Kugelrunder Magma-Fürst mit glühendem Bauch und Schnauzbart aus Rauch. Springt mitten ins Getümmel und lässt Lava aus dem Boden schießen.',
    verhalten: 'boss', rang: 'baron',
    hp: 3600, tempo: 1.0, radius: 0.95, beruehrSchaden: 20, kristalle: 80,
    abWelle: 999, gewicht: 0, masse: 36, groesse: 1.15,
    flaechenArt: 'lava', ringGeschoss: 'meteor', schussGeschossBoss: 'meteor',
    angriffe1: ['sprung', 'flaechen', 'ring'], angriffe2: ['sprung', 'flaechen', 'sprung', 'beschwoeren', 'ring'],
    beschwoert: 'lavaklops', beschwoerAnzahl: 3
  },
  {
    id: 'baronin_frostine', name: 'Baronin Frostine von Bibberstein', fraktion: 'Frostfrieder',
    spruch: '„Wie unhöflich, mir so warm zu kommen."',
    text: 'Kühle Adlige im Eiskristall-Kleid mit Pelzkragen und Schneeflocken-Diadem. Wirft Eiszapfen-Fächer, die bremsen, und schlittert in hohem Tempo heran.',
    verhalten: 'boss', rang: 'baron',
    hp: 3500, tempo: 1.4, radius: 0.85, beruehrSchaden: 18, kristalle: 80,
    abWelle: 999, gewicht: 0, masse: 30, groesse: 1.1,
    ansturmTempo: 12, ansturmDauer: 0.9, flaechenArt: 'eis', ringGeschoss: 'eiszapfen', schussGeschossBoss: 'eiszapfen',
    angriffe1: ['faecher', 'ansturm', 'spirale'], angriffe2: ['faecher', 'ansturm', 'flaechen', 'beschwoeren', 'spirale'],
    beschwoert: 'bombenpinguin', beschwoerAnzahl: 3
  },
  // ---------------- Finale ----------------
  {
    id: 'kawumm', name: 'Das Große Kawumm', fraktion: 'Urknall',
    spruch: '„KA… WUMM… KAAAAWUMMMM!!!"',
    text: 'Die Explosion, die Krawummia zerrissen hat – aufgewacht, wütend und so groß wie eine Scheune. Ein brodelnder Feuerball mit grimmigen Brauen und einer Lunte als Haarschopf. Die Arena zerbricht unter ihm.',
    verhalten: 'boss', rang: 'finale',
    hp: 9000, tempo: 0.9, radius: 1.3, beruehrSchaden: 24, kristalle: 200,
    abWelle: 999, gewicht: 0, masse: 80, groesse: 1.6,
    ansturmTempo: 9, ansturmDauer: 1.0, flaechenArt: 'explosion', ringGeschoss: 'meteor', schussGeschossBoss: 'bombe',
    angriffe1: ['flaechen', 'ring', 'faecher', 'bomben'],
    angriffe2: ['spirale', 'flaechen', 'sprung', 'beschwoeren', 'kreuz'],
    angriffe3: ['flaechen', 'spirale', 'sprung', 'kreuz', 'bomben', 'ring'],
    beschwoert: 'bombenkroete', beschwoerAnzahl: 4
  }
];

export const GEGNER_BY_ID: Record<string, GegnerDef> = Object.fromEntries(GEGNER.map((g) => [g.id, g]));

export const GEGNER_INDEX: Record<string, number> = Object.fromEntries(GEGNER.map((g, i) => [g.id, i]));
