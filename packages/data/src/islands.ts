/**
 * OVERBOOM – Die Inseln von Krawummia.
 * Seit dem Großen Kawumm schwebt die Welt in Brocken durch den Himmel;
 * auf jedem Brocken hat sich eine andere Bande breitgemacht.
 * Jede Insel = eigene Arena: Look, Gegner-Fraktion, Inselboss, Inselbaron(in) und Arena-Gefahr.
 * Ein Run ist eine Reise von der Startinsel bis Bummburg; danach wartet das Große Kawumm.
 */

export type Gefahr = 'heu' | 'strom' | 'schrott' | 'gift' | 'lava' | 'eis' | 'festung';

export interface InselGegner {
  id: string;
  abWelle: number;
  gewicht: number;
}

export interface Insel {
  id: string;
  name: string;
  fraktion: string;
  text: string;
  /** Inselboss (Solo Welle 10, Koop Welle 5) */
  boss: string;
  /** Inselbaron(in) auf der letzten Inselwelle (Solo 15, Koop 8) */
  baron: string;
  gefahr: Gefahr;
  gefahrText: string;
  gegner: InselGegner[];
  /** Farbpalette (Renderer) */
  farben: {
    boden: string[];
    fleck: string[];
    wand: string[];
    klippe: string[];
    spezial: string[];
    himmel: string;
    sonne: string;
    nebel: string;
  };
}

export const INSELN: Insel[] = [
  {
    id: 'gackerfeld', name: 'Gackerfeld', fraktion: 'Hühner-Kult',
    text: 'Bauernhof-Insel mit Heuballen und Scheunen. Hier verehrt ein Hühner-Kult seinen König Gockel. Perfekt zum Einsteigen.',
    boss: 'koenig_gockel', baron: 'baronin_gackerella', gefahr: 'heu', gefahrText: 'Heuballen brennen lichterloh, wenn man sie anschießt.',
    gegner: [
      { id: 'grummelbold', abWelle: 1, gewicht: 5 },
      { id: 'kampfhuhn', abWelle: 1, gewicht: 3 },
      { id: 'bombenkroete', abWelle: 2, gewicht: 1.8 },
      { id: 'vogelscheuche', abWelle: 4, gewicht: 0.8 },
      { id: 'toastomat', abWelle: 6, gewicht: 1 }
    ],
    farben: {
      boden: ['#4a5a2e', '#526432', '#5a6c36', '#4e5e30', '#566834'], fleck: ['#8a7a3a', '#9a8a42', '#a89648'],
      wand: ['#6b4b2e', '#7a5634', '#5e4228', '#86603a'], klippe: ['#3b2a1e', '#2e2016', '#4a3424', '#241810'],
      spezial: ['#e8c860', '#d8b048', '#f0d878', '#c89a38'], himmel: '#cfe8ff', sonne: '#fff2d0', nebel: '#1e2a18'
    }
  },
  {
    id: 'funkenschlund', name: 'Funkenschlund', fraktion: 'Funkenbande',
    text: 'Eine zerklüftete Schlucht voller Tesla-Türme. Die Funkenbande lädt sich hier täglich auf.',
    boss: 'megatoaster', baron: 'baron_blitzbirne', gefahr: 'strom', gefahrText: 'Tesla-Platten laden sich auf (Leuchten!) und entladen sich – nicht draufstehen!',
    gegner: [
      { id: 'funkenkobold', abWelle: 1, gewicht: 4 },
      { id: 'grummelbold', abWelle: 1, gewicht: 3 },
      { id: 'teslaritter', abWelle: 3, gewicht: 1.4 },
      { id: 'toastomat', abWelle: 2, gewicht: 1.2 },
      { id: 'minenbot', abWelle: 5, gewicht: 0.9 }
    ],
    farben: {
      boden: ['#2a2f4a', '#30365a', '#353c62', '#2c3250', '#383f66'], fleck: ['#1a5a6a', '#1e6878', '#227888'],
      wand: ['#3a4060', '#444a70', '#363c58', '#4c5478'], klippe: ['#1a1d30', '#141626', '#20243a', '#10121e'],
      spezial: ['#3de8ff', '#a8f6ff', '#1aa8d8', '#e8fdff'], himmel: '#a8b8ff', sonne: '#d8f0ff', nebel: '#0c1020'
    }
  },
  {
    id: 'rostgrat', name: 'Rostgrat', fraktion: 'Blechbrut',
    text: 'Schrottberge und rauchende Fabriken. Die Blechbrut baut hier Toaster, die Toaster bauen.',
    boss: 'megatoaster', baron: 'baronin_schraubella', gefahr: 'schrott', gefahrText: 'Schrotthaufen versperren den Weg – und explosive Ölfässer stehen überall.',
    gegner: [
      { id: 'toastomat', abWelle: 1, gewicht: 2.5 },
      { id: 'grummelbold', abWelle: 1, gewicht: 3 },
      { id: 'minenbot', abWelle: 2, gewicht: 1.5 },
      { id: 'schrottgolem', abWelle: 3, gewicht: 1 },
      { id: 'funkenkobold', abWelle: 4, gewicht: 2 }
    ],
    farben: {
      boden: ['#4a3a32', '#54423a', '#5c4840', '#4e3e36', '#604c42'], fleck: ['#7a4a2a', '#8a5430', '#9a5e36'],
      wand: ['#6b707a', '#7d8597', '#5a5f68', '#8d93a3'], klippe: ['#2a2420', '#221c18', '#302a26', '#1a1612'],
      spezial: ['#7a5a3a', '#8a6a48', '#5a4028', '#9a7a58'], himmel: '#e8c8a8', sonne: '#ffd8a8', nebel: '#1a1410'
    }
  },
  {
    id: 'pilzmoor', name: 'Pilzmoor', fraktion: 'Sumpfbande',
    text: 'Riesenpilze, Nebel und blubbernde Tümpel. Hier herrscht Pilzkönigin Morchella über die Sumpfbande.',
    boss: 'morchella', baron: 'baronin_sporella', gefahr: 'gift', gefahrText: 'Gifttümpel verlangsamen und kratzen langsam am Leben.',
    gegner: [
      { id: 'pilzling', abWelle: 1, gewicht: 3 },
      { id: 'bombenkroete', abWelle: 1, gewicht: 2.5 },
      { id: 'grummelbold', abWelle: 1, gewicht: 2.5 },
      { id: 'schleimi', abWelle: 2, gewicht: 1.8 },
      { id: 'vogelscheuche', abWelle: 6, gewicht: 0.6 }
    ],
    farben: {
      boden: ['#2e2a42', '#34304a', '#3a3452', '#302c46', '#3e3858'], fleck: ['#3a5a2a', '#447032', '#4e7a38'],
      wand: ['#5a3a6a', '#6a4478', '#4e3260', '#764e86'], klippe: ['#1e1828', '#18121e', '#241c30', '#120e18'],
      spezial: ['#5dbb3a', '#7dff5a', '#3d8a2a', '#a8ff7a'], himmel: '#b8a8d8', sonne: '#e8d8ff', nebel: '#140e1a'
    }
  },
  {
    id: 'lavakessel', name: 'Lavakessel', fraktion: 'Glutgesindel',
    text: 'Ein brodelnder Vulkan. Das Glutgesindel tanzt um Lavaströme und betet das Große Kawumm an.',
    boss: 'morchella', baron: 'baron_glutbauch', gefahr: 'lava', gefahrText: 'Lava verbrennt alles, was hineintritt – dich auch.',
    gegner: [
      { id: 'lavaklops', abWelle: 1, gewicht: 2.5 },
      { id: 'bombenkroete', abWelle: 1, gewicht: 2 },
      { id: 'grummelbold', abWelle: 1, gewicht: 3 },
      { id: 'kultist', abWelle: 3, gewicht: 1 },
      { id: 'funkenkobold', abWelle: 4, gewicht: 1.5 }
    ],
    farben: {
      boden: ['#3a2a2a', '#42302e', '#4a3634', '#3e2c2a', '#503a36'], fleck: ['#2a1a1a', '#221414', '#321e1e'],
      wand: ['#4a2e2e', '#563634', '#3e2626', '#5e3c38'], klippe: ['#1e1212', '#160c0c', '#241616', '#100808'],
      spezial: ['#ff5a0a', '#ff7a1a', '#ffb02e', '#c2300a'], himmel: '#ffb898', sonne: '#ffd0a0', nebel: '#1a0808'
    }
  },
  {
    id: 'frostfass', name: 'Frostfass', fraktion: 'Frostfrieder',
    text: 'Eiskristalle, Schneestürme und glatter Boden. Die Frostfrieder sind kühl – aber nicht freundlich.',
    boss: 'koenig_gockel', baron: 'baronin_frostine', gefahr: 'eis', gefahrText: 'Eisflächen sind spiegelglatt: Bremsen dauert.',
    gegner: [
      { id: 'schneemann', abWelle: 1, gewicht: 2 },
      { id: 'bombenpinguin', abWelle: 1, gewicht: 2.5 },
      { id: 'grummelbold', abWelle: 1, gewicht: 3 },
      { id: 'schleimi', abWelle: 3, gewicht: 1.2 },
      { id: 'teslaritter', abWelle: 5, gewicht: 1 }
    ],
    farben: {
      boden: ['#4a5a7a', '#506284', '#58698c', '#4c5c7e', '#5e7094'], fleck: ['#c8e0f0', '#d8eef8', '#b8d0e8'],
      wand: ['#7a8aa8', '#8898b4', '#6c7c9a', '#96a6c0'], klippe: ['#2a3448', '#222a3c', '#323e54', '#1a2030'],
      spezial: ['#a8e8ff', '#d8f8ff', '#88c8e8', '#ffffff'], himmel: '#e0f0ff', sonne: '#ffffff', nebel: '#0e1420'
    }
  },
  {
    id: 'bummburg', name: 'Bummburg', fraktion: 'Bumm-Garde',
    text: 'Die Festung im Zentrum, Sitz von Baron von Bumm. Hier kämpfen alle Banden gemeinsam gegen dich.',
    boss: 'megatoaster', baron: 'baron', gefahr: 'festung', gefahrText: 'Lavagräben und Pulverfässer – die Festung ist ein Pulverfass.',
    gegner: [
      { id: 'grummelbold', abWelle: 1, gewicht: 3 },
      { id: 'kampfhuhn', abWelle: 1, gewicht: 1.5 },
      { id: 'bombenkroete', abWelle: 1, gewicht: 1.5 },
      { id: 'toastomat', abWelle: 2, gewicht: 1.2 },
      { id: 'teslaritter', abWelle: 3, gewicht: 0.9 },
      { id: 'kultist', abWelle: 4, gewicht: 0.8 },
      { id: 'schrottgolem', abWelle: 5, gewicht: 0.7 },
      { id: 'pilzling', abWelle: 2, gewicht: 1 }
    ],
    farben: {
      boden: ['#3a2f5c', '#40345f', '#463a68', '#3d3160', '#4b3f6e'], fleck: ['#1c4a4c', '#1f5a58', '#23645e'],
      wand: ['#4b3f6e', '#544777', '#463a66', '#5d4f86'], klippe: ['#241b38', '#1f1730', '#2a2142', '#181226'],
      spezial: ['#c2300a', '#ff5a0a', '#ff7a1a', '#ffb02e'], himmel: '#b0a2f0', sonne: '#ffe6c8', nebel: '#0b0814'
    }
  }
];

export const INSEL_BY_ID: Record<string, Insel> = Object.fromEntries(INSELN.map((i) => [i.id, i]));

/** Baron von Bumm erscheint auf Welle 20 jeder Insel */
/** Endgegner nach der letzten Insel */
export const FINALBOSS = 'kawumm';
