/**
 * Prozeduraler Komponist: erzeugt aus Stil, Stimmung und Seed eine endlose,
 * abwechslungsreiche Notenfolge im 16tel-Raster. Rein rechnerisch – kein WebAudio,
 * daher in Node testbar. Den Klang erzeugt band.ts.
 *
 * Aufbau: Abschnitte zu je 4 Takten (Intro, A = Hook, B = Variation, C = Boss-Teil,
 * brk = Breakdown) in einer Form, die sich wiederholt. A bleibt pro Seed gleich
 * (Wiedererkennung), B/Breakdown werden in jedem Durchlauf neu gewürfelt.
 * Die Intensität (0–1, vom Spielgeschehen) schaltet pro Takt zwischen drei Stufen:
 * 0 = ruhig, 1 = voll, 2 = wild (zusätzliche Melodie, treibenderes Schlagzeug).
 */

export type Stimmung = 'menu' | 'kampf' | 'boss' | 'shop';
export type MusikStil = 'rock' | 'pop' | 'retro' | 'chip';
export const MUSIK_STILE: readonly MusikStil[] = ['rock', 'pop', 'retro', 'chip'];
export const STIMMUNGEN: readonly Stimmung[] = ['menu', 'kampf', 'boss', 'shop'];

export type Instrument =
  | 'kick' | 'snare' | 'ghost' | 'clap' | 'hat' | 'hatOffen' | 'shaker' | 'ride' | 'crash' | 'tomHoch' | 'tomTief'
  | 'gitarre' | 'gitarreMute' | 'bassRock' | 'bassSynth' | 'leadRock'
  | 'pad' | 'pluck' | 'leadPop'
  | 'retroLead' | 'retroHarm' | 'retroArp' | 'retroBass'
  | 'chipBass' | 'chipLead' | 'chipKick' | 'chipSnare' | 'chipHat';

export interface MusikNote {
  inst: Instrument;
  /** MIDI-Tonhöhen (Schlagzeug: leer) */
  noten: number[];
  /** Länge in 16teln */
  dauer: number;
  /** Anschlagstärke 0–1 */
  vel: number;
  /** Verschiebung in 16teln (Swing) */
  versatz: number;
  /** nur Chiptune: Wellenform */
  welle?: 'square' | 'triangle' | 'sawtooth' | 'sine';
}

type Typ = 'pow' | 'moll' | 'dur' | 'm7' | 'maj7' | 'dom7';
interface Akkord { s: number; t: Typ }
const a = (s: number, t: Typ = 'pow'): Akkord => ({ s, t });
const TOENE: Record<Typ, number[]> = {
  pow: [0, 7, 12], moll: [0, 3, 7], dur: [0, 4, 7], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dom7: [0, 4, 7, 10]
};

type Abschnitt = 'intro' | 'A' | 'B' | 'C' | 'brk';

interface StimmungDef {
  bpm: number;
  /** Grundton (MIDI) der Tonart */
  grund: number;
  folgen: Akkord[][];
  form: Abschnitt[];
  /** höchste Intensitätsstufe in dieser Stimmung */
  maxStufe: number;
  minStufe: number;
  swing: number;
}

/** Schlagzeug-Spuren, 16 Schritte. k: x Kick · s: x Snare, g Ghost, c Clap, r Rim, b Besen ·
 *  h: x zu, o offen, f Fuß, s Shaker · r: x Ride */
interface Groove { k: string; s: string; h: string; r?: string }

/* ---------------- Stil-Daten ---------------- */

const KAMPF_FORM: Abschnitt[] = ['intro', 'A', 'A', 'B', 'A', 'brk', 'B', 'A'];
const BOSS_FORM: Abschnitt[] = ['intro', 'A', 'C', 'A', 'B', 'C', 'brk', 'C'];
const RUHE_FORM: Abschnitt[] = ['A', 'B', 'A', 'B', 'brk', 'A'];

const ROCK: Record<Stimmung, StimmungDef> = {
  kampf: {
    bpm: 126, grund: 40, swing: 0, maxStufe: 2, minStufe: 0, form: KAMPF_FORM,
    folgen: [[a(0), a(0), a(8), a(10)], [a(0), a(10), a(8), a(10)], [a(0), a(3), a(10), a(8)], [a(0), a(5), a(3), a(10)], [a(8), a(10), a(0), a(0)], [a(0), a(0), a(3), a(5)]]
  },
  boss: {
    bpm: 138, grund: 40, swing: 0, maxStufe: 2, minStufe: 1, form: BOSS_FORM,
    folgen: [[a(0), a(1), a(0), a(10)], [a(0), a(0), a(1), a(3)], [a(0), a(6), a(5), a(1)], [a(0), a(3), a(1), a(0)]]
  },
  shop: {
    bpm: 104, grund: 40, swing: 0, maxStufe: 1, minStufe: 0, form: RUHE_FORM,
    folgen: [[a(0), a(9), a(5), a(7)], [a(0), a(7), a(9), a(5)], [a(5), a(7), a(0), a(0)]]
  },
  menu: {
    bpm: 96, grund: 40, swing: 0, maxStufe: 1, minStufe: 0, form: RUHE_FORM,
    folgen: [[a(0), a(8), a(3), a(10)], [a(0), a(0), a(8), a(10)], [a(5), a(3), a(0), a(0)]]
  }
};

const POP: Record<Stimmung, StimmungDef> = {
  kampf: {
    bpm: 120, grund: 45, swing: 0, maxStufe: 2, minStufe: 0, form: KAMPF_FORM,
    folgen: [[a(0, 'moll'), a(8, 'dur'), a(3, 'dur'), a(10, 'dur')], [a(3, 'dur'), a(10, 'dur'), a(0, 'moll'), a(8, 'dur')],
      [a(8, 'dur'), a(10, 'dur'), a(0, 'moll'), a(0, 'moll')], [a(0, 'moll'), a(5, 'moll'), a(8, 'dur'), a(7, 'dur')]]
  },
  boss: {
    bpm: 130, grund: 45, swing: 0, maxStufe: 2, minStufe: 1, form: BOSS_FORM,
    folgen: [[a(0, 'moll'), a(8, 'dur'), a(10, 'dur'), a(7, 'dur')], [a(0, 'moll'), a(0, 'moll'), a(5, 'moll'), a(7, 'dur')], [a(0, 'moll'), a(1, 'dur'), a(0, 'moll'), a(7, 'dur')]]
  },
  shop: {
    bpm: 100, grund: 45, swing: 0, maxStufe: 1, minStufe: 0, form: RUHE_FORM,
    folgen: [[a(3, 'maj7'), a(8, 'maj7'), a(5, 'm7'), a(10, 'dom7')], [a(8, 'maj7'), a(10, 'dom7'), a(3, 'maj7'), a(0, 'm7')]]
  },
  menu: {
    bpm: 92, grund: 45, swing: 0, maxStufe: 1, minStufe: 0, form: RUHE_FORM,
    folgen: [[a(8, 'maj7'), a(10, 'dur'), a(0, 'm7'), a(0, 'm7')], [a(3, 'maj7'), a(8, 'maj7'), a(3, 'maj7'), a(10, 'dur')]]
  }
};

// Retro (8/16-Bit-Konsolenklang): Kampf/Boss in a-Moll, Shop/Menü in C-Dur
const RETRO: Record<Stimmung, StimmungDef> = {
  kampf: {
    bpm: 150, grund: 45, swing: 0, maxStufe: 2, minStufe: 0, form: KAMPF_FORM,
    folgen: [[a(0, 'moll'), a(8, 'dur'), a(10, 'dur'), a(0, 'moll')], [a(0, 'moll'), a(5, 'moll'), a(10, 'dur'), a(3, 'dur')],
      [a(8, 'dur'), a(10, 'dur'), a(0, 'moll'), a(0, 'moll')], [a(0, 'moll'), a(10, 'dur'), a(8, 'dur'), a(10, 'dur')]]
  },
  boss: {
    bpm: 162, grund: 45, swing: 0, maxStufe: 2, minStufe: 1, form: BOSS_FORM,
    folgen: [[a(0, 'moll'), a(1, 'dur'), a(0, 'moll'), a(7, 'dur')], [a(0, 'moll'), a(0, 'moll'), a(5, 'moll'), a(7, 'dur')], [a(0, 'moll'), a(8, 'dur'), a(1, 'dur'), a(7, 'dur')]]
  },
  shop: {
    bpm: 116, grund: 48, swing: 0, maxStufe: 1, minStufe: 0, form: RUHE_FORM,
    folgen: [[a(0, 'dur'), a(9, 'moll'), a(5, 'dur'), a(7, 'dur')], [a(0, 'dur'), a(5, 'dur'), a(0, 'dur'), a(7, 'dur')], [a(5, 'dur'), a(7, 'dur'), a(4, 'moll'), a(9, 'moll')]]
  },
  menu: {
    bpm: 100, grund: 48, swing: 0, maxStufe: 1, minStufe: 0, form: RUHE_FORM,
    folgen: [[a(0, 'dur'), a(7, 'dur'), a(9, 'moll'), a(5, 'dur')], [a(5, 'dur'), a(7, 'dur'), a(0, 'dur'), a(0, 'dur')]]
  }
};

const STILE: Record<Exclude<MusikStil, 'chip'>, Record<Stimmung, StimmungDef>> = { rock: ROCK, pop: POP, retro: RETRO };

const G = (k: string, s: string, h: string, r?: string): Groove => ({ k, s, h, r });

const ROCK_GROOVES: Groove[][] = [
  [G('x.......x.x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'), G('x.....x...x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.')],
  [G('x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), G('x.x...x.x.x...x.', '....x.......x...', 'x.x.x.x.x.x.x.x.'), G('x..x..x.x..x....', '....x.......x..g', 'x.x.x.x.x.x.x.x.')],
  [G('x.x.x.x.x.x.x.x.', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.'), G('x.x.x.x.x.x.x.x.', '....x.......x...', 'o.x.o.x.o.x.o.x.')]
];
const ROCK_BOSS: Groove[] = [G('x..x..x...x..x..', '........x.......', 'x...x...x...x...'), G('xx..x.xxx...x.x.', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.')];

/** Gitarren-Rhythmen: X offener Akkord (– hält), x kurzer offener Akkord, m abgedämpft, . Pause */
const ROCK_RIFFS: string[][] = [
  ['m...m...m...m.m.', 'm.m.....m.m.....', 'm...m.m.m...m...'],
  ['X---m.m.X---m.m.', 'm.mmm.mmm.mmm.mm', 'X-----m.m.m.X---', 'm.m.m.m.X---X---', 'X--mX--mX---m.m.'],
  ['X-m.X-m.X-m.m.m.', 'mmmmX---mmmmX---', 'X---X---X-X-X---', 'm.mmX-m.m.mmX---']
];
const ROCK_BOSS_RIFFS = ['mm.mm.mm.mm.X---', 'm.mmm.mmX---X---', 'X-----mmX-----mm'];
const ROCK_RUHE_RIFFS = ['X.x.X.x.X.x.X.x.', 'X--x..x.X--x..x.', 'X-------X---x.x.'];

const POP_GROOVES: Groove[][] = [
  [G('x...x...x...x...', '................', '..x...x...x...x.')],
  [G('x...x...x...x...', '....c.......c...', '..o...o...o...o.'), G('x...x...x...x.x.', '....c.......c...', 'x.o.x.o.x.o.x.o.')],
  [G('x...x...x...x...', '....c.......c..c', 'sxosxsoxsxosxsox'), G('x...x...x..xx...', '....c.......c...', 'x.o.x.o.x.o.x.o.')]
];
const POP_BOSS: Groove[] = [G('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.'), G('x..xx...x..xx...', '....c.......c...', 'x.o.x.o.x.o.x.o.')];

const RETRO_GROOVES: Groove[][] = [
  [G('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.')],
  [G('x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), G('x..x..x.x.......', '....x.......x.x.', 'x.x.x.x.x.x.x.x.')],
  [G('x.x...x.x.x...x.', '....x.......x...', 'xxxxxxxxxxxxxxxx'), G('x...x...x...x...', '....x..x....x...', 'x.x.x.x.x.x.x.x.')]
];
const RETRO_BOSS = G('x.xx..x.x.xx..x.', '....x.......x...', 'x.x.x.x.x.x.x.x.');
const RETRO_RUHE = G('x.......x.......', '....x.......x...', '..x...x...x...x.');

/** Melodie-Rhythmen über 2 Takte: x Anschlag, – hält, . Pause */
const MOTIV_RHYTHMEN = [
  'x-x-x---x-x-x-------x-x-x---x---',
  'x---x---x-x-x-------x---x-x-x---',
  'x-xx-x--x-------x-xx-x--x-x-----',
  'x--x--x-x-------x--x--x-x---x---',
  '..x-x-x-x---x---..x-x-x-x-------'
];
/** Retro-Melodien: etwas belebter, mit Sechzehnteln */
const RETRO_RHYTHMEN = [
  'x.x.x-x-x.x.x---x.x.x-x-x-x-----',
  'x-x-x-x-x---x---x-x-x-x-x-------',
  'x--x--x-x-x-x---x--x--x-x-------',
  'x-xx-xx-x---x---x-xx-xx-x-x-x---',
  'x---x-x-x---x-x-x---x-x-x-------'
];
const PENTA_MOLL = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const DUR_SKALA = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const MOLL_SKALA = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24];
/** harmonisch Moll (mit Leitton gis) – für den Boss */
const HARM_MOLL = [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19, 20, 23, 24];

/* ---------------- Hilfen ---------------- */

function zufall(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const waehle = <T>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length) % l.length];
const mische = (x: number, y: number) => (Math.imul(x ^ 0x9e3779b9, 2654435761) ^ Math.imul(y + 0x7f4a7c15, 1597334677)) >>> 0;

interface Motiv { rhythmus: string; stufen: number[] }

interface Plan {
  nr: number;
  typ: Abschnitt;
  start: number;
  folge: Akkord[];
  /** je Stufe gewählter Index für Groove/Riff */
  wahl: number[];
  motiv: Motiv;
  arp: number;
  zyklus: number;
}

function neuesMotiv(r: () => number, skalaLaenge: number, rhythmen: readonly string[] = MOTIV_RHYTHMEN): Motiv {
  const rhythmus = waehle(r, rhythmen);
  const n = [...rhythmus].filter((c) => c === 'x').length;
  const stufen: number[] = [];
  let s = waehle(r, [2, 4, 5]);
  for (let i = 0; i < n; i++) {
    stufen.push(s);
    s = Math.max(0, Math.min(skalaLaenge - 1, s + waehle(r, [-2, -1, -1, 0, 1, 1, 2])));
  }
  stufen[n - 1] = waehle(r, [0, 2, 3]); // auflösen
  return { rhythmus, stufen };
}

/** Akkordtöne nah an einer Ziellage (für Keys/Pads) */
function voicing(grund: number, ak: Akkord, lage: number, extra: number[] = []): number[] {
  const toene = [...TOENE[ak.t], ...extra];
  const wurzel = grund + ak.s;
  return toene.map((t) => {
    let m = wurzel + t;
    while (m < lage) m += 12;
    while (m >= lage + 12) m -= 12;
    return m;
  }).sort((x, y) => x - y);
}

/** nächster Akkordton zu einer Tonhöhe */
function naechsterAkkordton(ton: number, wurzel: number, ak: Akkord): number {
  let best = ton, bd = 99;
  for (const t of TOENE[ak.t]) for (const o of [-24, -12, 0, 12, 24]) {
    const m = wurzel + t + o, d = Math.abs(m - ton);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/* ---------------- Komponist ---------------- */

export class Komponist {
  readonly stil: MusikStil;
  readonly stimmung: Stimmung;
  readonly bpm: number;
  readonly swing: number;
  private def: StimmungDef | null;
  private seed: number;
  private plan: Plan | null = null;
  private takt = -1;
  private stufe = 0;
  private hookFolge = 0;
  private human: () => number;

  constructor(stil: MusikStil, stimmung: Stimmung, seed: number) {
    this.stil = stil;
    this.stimmung = stimmung;
    this.seed = seed >>> 0;
    this.human = zufall(mische(seed, 77));
    if (stil === 'chip') {
      this.def = null;
      const t = CHIP[stimmung];
      this.bpm = t.bpm;
      this.swing = 0;
    } else {
      this.def = STILE[stil][stimmung];
      this.bpm = this.def.bpm;
      this.swing = this.def.swing;
      this.hookFolge = Math.floor(zufall(mische(seed, 1))() * this.def.folgen.length);
    }
  }

  /** aktuelle Intensitätsstufe (0–2) */
  get aktuelleStufe(): number { return this.stufe; }
  /** aktueller Abschnitt (für Anzeige/Tests) */
  get abschnitt(): string { return this.plan?.typ ?? ''; }

  /** Noten für den 16tel-Schritt `step` (ab 0) bei Intensität 0–1 in `out` schreiben */
  schritt(step: number, intensitaet: number, out: MusikNote[]): void {
    out.length = 0;
    if (this.stil === 'chip') { this.chip(step, out); return; }
    const def = this.def!;
    const takt = Math.floor(step / 16), pos = step % 16;
    if (takt !== this.takt) this.neuerTakt(takt, intensitaet);
    const p = this.plan!;
    const imAbschnitt = takt - p.start;
    const n = p.folge.length;
    const ak = p.folge[Math.floor(imAbschnitt * n / 4) % n];
    const naechster = imAbschnitt === 3 ? this.folgeVon(p.nr + 1)[0] : p.folge[Math.floor((imAbschnitt + 1) * n / 4) % n];
    const fill = imAbschnitt === 3 && (pos >= (this.stufe >= 2 ? 8 : 12));
    const swing = pos % 4 === 2 ? this.swing : 0;
    const ctx: Ctx = { def, p, ak, naechster, pos, imAbschnitt, fill, swing, stufe: this.stufe, out };
    if (this.stil === 'rock') this.rock(ctx);
    else if (this.stil === 'pop') this.pop(ctx);
    else this.retro(ctx);
  }

  private folgeVon(nr: number): Akkord[] {
    const def = this.def!;
    const typ = def.form[nr % def.form.length];
    if (typ === 'A' || typ === 'brk' || typ === 'intro') return def.folgen[this.hookFolge];
    const r = zufall(mische(this.seed, typ === 'C' ? 3 : 100 + nr));
    let i = Math.floor(r() * def.folgen.length);
    if (i === this.hookFolge && def.folgen.length > 1) i = (i + 1) % def.folgen.length;
    return def.folgen[i];
  }

  private neuerTakt(takt: number, x: number): void {
    const def = this.def!;
    this.takt = takt;
    const nr = Math.floor(takt / 4);
    if (!this.plan || this.plan.nr !== nr) {
      const zyklus = Math.floor(nr / def.form.length);
      let typ = def.form[nr % def.form.length];
      if (typ === 'intro' && zyklus > 0) typ = 'brk';
      // A und C bleiben pro Seed gleich (Wiedererkennung), alles andere variiert je Durchlauf
      const r = zufall(mische(this.seed, typ === 'A' ? 1 : typ === 'C' ? 3 : 100 + nr));
      r();
      const skala = this.stil === 'retro' ? 10 : PENTA_MOLL.length;
      this.plan = {
        nr, typ, start: nr * 4, zyklus,
        folge: this.folgeVon(nr),
        wahl: [Math.floor(r() * 997), Math.floor(r() * 997), Math.floor(r() * 997), Math.floor(r() * 997)],
        motiv: neuesMotiv(r, Math.min(skala, 8), this.stil === 'retro' ? RETRO_RHYTHMEN : MOTIV_RHYTHMEN),
        arp: Math.floor(r() * 3)
      };
    }
    // Stufe mit Hysterese (nicht bei jedem Zucken umschalten)
    let s = this.stufe;
    if (x > 0.72) s = 2;
    else if (x > 0.4) s = s === 2 && x > 0.6 ? 2 : 1;
    else if (x < 0.3) s = 0;
    else s = Math.min(s, 1);
    const typ = this.plan.typ;
    if (typ === 'brk') s = Math.min(s, 1);
    if (typ === 'intro') s = 0;
    this.stufe = Math.max(def.minStufe, Math.min(def.maxStufe, s));
  }

  private note(out: MusikNote[], inst: Instrument, noten: number[], dauer: number, vel: number, versatz = 0): void {
    const v = Math.max(0.02, Math.min(1, vel * (0.92 + this.human() * 0.16)));
    out.push({ inst, noten, dauer, vel: v, versatz });
  }

  /* ---------- Schlagzeug (gemeinsam) ---------- */

  private drums(c: Ctx, g: Groove, opt: { crash: boolean; fill: 'rock' | 'pop' | null; leise?: number }): void {
    const { pos, out, swing } = c;
    const l = opt.leise ?? 1;
    if (c.fill && opt.fill === 'rock') {
      const t = pos % 2 === 0;
      if (t) this.note(out, pos < 12 ? 'snare' : pos < 14 ? 'tomHoch' : 'tomTief', [], 1, (0.55 + (pos - 8) * 0.04) * l);
      if (pos === 15) this.note(out, 'kick', [], 1, 0.7 * l);
      return;
    }
    if (c.fill && opt.fill === 'pop' && pos >= 12) {
      this.note(out, 'snare', [], 1, (0.3 + (pos - 12) * 0.12) * l);
      if (pos === 12) this.note(out, 'kick', [], 1, 0.8 * l);
      return;
    }
    if (pos === 0 && c.imAbschnitt === 0 && opt.crash && c.stufe >= 1) this.note(out, 'crash', [], 16, 0.5 * l);
    const k = g.k[pos], s = g.s[pos], h = g.h[pos], r = g.r?.[pos];
    if (k === 'x') this.note(out, 'kick', [], 1, 0.9 * l, swing);
    if (s === 'x') this.note(out, 'snare', [], 1, 0.8 * l, swing);
    else if (s === 'g') this.note(out, 'ghost', [], 1, 0.25 * l, swing);
    else if (s === 'c') this.note(out, 'clap', [], 1, 0.7 * l, swing);
    if (h === 'x') this.note(out, 'hat', [], 1, (pos % 4 === 0 ? 0.55 : 0.4) * l, swing);
    else if (h === 'o') this.note(out, 'hatOffen', [], 2, 0.45 * l, swing);
    else if (h === 's') this.note(out, 'shaker', [], 1, (pos % 2 ? 0.25 : 0.4) * l, swing);
    if (r === 'x') this.note(out, 'ride', [], 4, (pos % 4 === 0 ? 0.55 : 0.4) * l, swing);
  }

  /* ---------- Rock ---------- */

  private rock(c: Ctx): void {
    const { def, p, ak, pos, out, stufe, imAbschnitt } = c;
    const boss = this.stimmung === 'boss', ruhe = this.stimmung === 'shop' || this.stimmung === 'menu';
    // Schlagzeug
    const g = boss ? ROCK_BOSS[p.wahl[0] % ROCK_BOSS.length] : ROCK_GROOVES[stufe][p.wahl[stufe] % ROCK_GROOVES[stufe].length];
    const intro = p.typ === 'intro' && imAbschnitt < 2;
    if (!intro || pos % 4 === 0) this.drums(c, intro ? G('x...x...x...x...', '................', '................') : g, { crash: true, fill: 'rock', leise: ruhe ? 0.7 : 1 });
    // Gitarre + Bass
    let riff: string;
    if (ruhe) riff = this.stimmung === 'menu' ? 'X-------X---x.x.' : ROCK_RUHE_RIFFS[p.wahl[1] % ROCK_RUHE_RIFFS.length];
    else if (boss && p.typ !== 'brk') riff = ROCK_BOSS_RIFFS[p.wahl[2] % ROCK_BOSS_RIFFS.length];
    else riff = ROCK_RIFFS[stufe][p.wahl[stufe + 1] % ROCK_RIFFS[stufe].length];
    if (p.typ === 'brk' && imAbschnitt < 2) riff = imAbschnitt === 0 ? 'X---------------' : '........m.m.m.mm';
    if (c.fill && stufe >= 1) riff = 'X-------X-------';
    const ch = riff[pos];
    // Gitarren-Grundton zwischen E2 und D#3
    let w = def.grund + (((ak.s % 12) + 12) % 12);
    if (w > def.grund + 7) w -= 12;
    if (w < 38) w += 12;
    const power = [w, w + 7, w + 12];
    if (ch === 'X' || ch === 'x') {
      let len = 1;
      while (ch === 'X' && pos + len < 16 && riff[pos + len] === '-') len++;
      if (ch === 'x') len = 2;
      if (!intro) this.note(out, 'gitarre', power, len, (ch === 'X' ? 0.8 : 0.6) * (ruhe ? 0.75 : 1));
      this.note(out, 'bassRock', [w - 12], len, 0.85);
    } else if (ch === 'm') {
      this.note(out, 'gitarreMute', [w, w + 7], 1, (stufe === 0 ? 0.55 : 0.7) * (ruhe ? 0.75 : 1));
      this.note(out, 'bassRock', [w - 12], 1, 0.75);
    }
    // Lead-Gitarre nur in der wilden Stufe (bzw. Boss-C-Teil), dezent
    if ((stufe >= 2 && (p.typ === 'A' || p.typ === 'B' || p.typ === 'C')) || (boss && p.typ === 'C')) {
      this.melodie(c, 'leadRock', def.grund + 24, PENTA_MOLL, 0.5);
    }
  }

  /* ---------- Pop ---------- */

  private pop(c: Ctx): void {
    const { def, p, ak, pos, out, stufe, imAbschnitt } = c;
    const boss = this.stimmung === 'boss', ruhe = this.stimmung === 'shop' || this.stimmung === 'menu';
    const brk = p.typ === 'brk' && imAbschnitt < 3;
    const intro = p.typ === 'intro' && imAbschnitt < 2;
    // Schlagzeug
    if (!brk) {
      const g = boss ? POP_BOSS[p.wahl[0] % POP_BOSS.length] : POP_GROOVES[stufe][p.wahl[stufe] % POP_GROOVES[stufe].length];
      if (!intro || pos % 4 === 0) this.drums(c, intro ? POP_GROOVES[0][0] : g, { crash: true, fill: 'pop', leise: ruhe ? 0.6 : 1 });
    } else if (imAbschnitt === 2) {
      // Aufbau: Snare-Wirbel
      if (pos % (pos < 8 ? 4 : pos < 12 ? 2 : 1) === 0) this.note(out, 'snare', [], 1, 0.15 + pos * 0.03);
    }
    const wurzel = def.grund + ak.s;
    // Pad: ganzer Takt
    if (pos === 0) this.note(out, 'pad', voicing(def.grund, ak, 57), 16, ruhe ? 0.5 : brk ? 0.6 : 0.45);
    // Bass
    const bass = wurzel > def.grund + 7 ? wurzel - 24 : wurzel - 12;
    if (!intro && !(brk && imAbschnitt < 2)) {
      const muster = stufe === 0 || ruhe ? 'x.......x...x...' : boss ? 'x.x.x.x.x.x.x.x.' : 'x.X.x.X.x.X.x.X.';
      const m = muster[pos];
      if (m === 'x') this.note(out, 'bassSynth', [bass], stufe === 0 || ruhe ? 3 : 1.5, 0.8);
      else if (m === 'X') this.note(out, 'bassSynth', [bass + 12], 1.5, 0.65);
    }
    // Arpeggio (Pluck)
    const arpTakt = stufe >= 2 ? 1 : 2;
    if ((stufe >= 1 || (ruhe && p.typ !== 'brk')) && pos % arpTakt === 0 && !intro) {
      const toene = voicing(def.grund, ak, 64, ak.t === 'moll' || ak.t === 'dur' ? [12] : []);
      const reihe = p.arp === 0 ? toene : p.arp === 1 ? [...toene, ...toene.slice(1, -1).reverse()] : [toene[0], toene[2], toene[1], toene[3] ?? toene[0] + 12];
      const i = Math.floor(pos / arpTakt) % reihe.length;
      this.note(out, 'pluck', [reihe[i]], arpTakt * 1.5, ruhe ? 0.35 : 0.45);
    }
    // Hook-Melodie
    if (stufe >= 2 && (p.typ === 'A' || p.typ === 'C' || p.typ === 'B')) this.melodie(c, 'leadPop', def.grund + 24, PENTA_MOLL, 0.45);
    else if (this.stimmung === 'menu' && p.typ === 'A') this.melodie(c, 'leadPop', def.grund + 24, PENTA_MOLL, 0.3);
  }

  /* ---------- Retro (8/16 Bit) ---------- */

  private retro(c: Ctx): void {
    const { def, p, ak, pos, out, stufe, imAbschnitt } = c;
    const boss = this.stimmung === 'boss', ruhe = this.stimmung === 'shop' || this.stimmung === 'menu';
    const intro = p.typ === 'intro' && imAbschnitt < 2;
    const brk = p.typ === 'brk' && imAbschnitt < 2;
    // Rausch-Schlagzeug
    const g = ruhe ? RETRO_RUHE : boss ? RETRO_BOSS : RETRO_GROOVES[stufe][p.wahl[stufe] % RETRO_GROOVES[stufe].length];
    if (!brk && (!intro || pos % 4 === 0)) this.drums(c, intro ? G('x.......x.......', '................', 'x...x...x...x...') : g, { crash: false, fill: 'rock', leise: ruhe ? 0.6 : 0.85 });
    // Dreieck-Bass
    const wurzel = def.grund + ak.s;
    // eine Oktave höher als bei Rock/Pop: der Dreieck-Bass soll auch aus Handy-Lautsprechern hörbar sein
    const bass = wurzel > def.grund + 6 ? wurzel - 12 : wurzel;
    const bm = ruhe ? (this.stimmung === 'menu' ? 'x.......x...x...' : 'x..x..x.x..x..x.') : stufe === 0 || brk ? 'x...x...x...x...' : boss ? 'x.x.X.x.x.x.X.x.' : 'x.X.x.X.x.X.x.X.';
    if (!intro) {
      const b = bm[pos];
      if (b === 'x') this.note(out, 'retroBass', [bass], ruhe || stufe === 0 ? 3 : 1.6, 0.85);
      else if (b === 'X') this.note(out, 'retroBass', [bass + 12], 1.6, 0.75);
    }
    // Arpeggio (dünner Puls): gebrochene Akkorde
    const arpTakt = stufe >= 1 && !ruhe ? 1 : 2;
    if (pos % arpTakt === 0) {
      const toene = voicing(def.grund, ak, 60, [12]);
      const reihe = p.arp === 0 ? toene : p.arp === 1 ? [...toene, ...toene.slice(1, -1).reverse()] : [toene[0], toene[2], toene[1], toene[3] ?? toene[0] + 12];
      this.note(out, 'retroArp', [reihe[Math.floor(pos / arpTakt) % reihe.length]], arpTakt * 0.9, brk ? 0.6 : 0.5);
    }
    // Melodie: das Herzstück – in Ruhe-Stimmungen und ab Stufe 1 fast immer, in Stufe 2 zweistimmig
    const skala = boss ? HARM_MOLL : ruhe ? DUR_SKALA : MOLL_SKALA;
    const spielen = !intro && !brk && (stufe >= 1 || ruhe || p.typ === 'A');
    if (spielen) this.melodie(c, 'retroLead', def.grund + 24, skala, stufe === 0 && !ruhe ? 0.4 : 0.55, stufe >= 2 ? 'retroHarm' : undefined, true);
  }

  /** Motiv-Melodie (Rock-/Pop-Lead), Skalenstufen relativ zur Tonart */
  private melodie(c: Ctx, inst: Instrument, basis: number, skala: number[], vel: number, harmonie?: Instrument, aufAkkord = false): void {
    const { p, pos, imAbschnitt, out } = c;
    const s = (imAbschnitt % 2) * 16 + pos;
    const rh = p.motiv.rhythmus;
    if (rh[s] !== 'x') return;
    let idx = 0;
    for (let i = 0; i < s; i++) if (rh[i] === 'x') idx++;
    let stufe = p.motiv.stufen[idx] ?? 0;
    // zweite Hälfte des Abschnitts: Antwort mit leicht verändertem Schluss
    if (imAbschnitt >= 2 && idx === p.motiv.stufen.length - 1) stufe = Math.min(skala.length - 1, stufe + 2);
    let len = 1;
    while (s + len < 32 && rh[s + len] === '-') len++;
    let ton = basis + skala[stufe];
    // auf den schweren Zählzeiten (1 und 3) einen Akkordton nehmen – klingt „richtig"
    if (aufAkkord && pos % 8 === 0) ton = naechsterAkkordton(ton, c.def.grund + c.ak.s, c.ak);
    this.note(out, inst, [ton], len, vel);
    // zweite Stimme: zwei Skalenstufen tiefer (meist eine Terz)
    if (harmonie) this.note(out, harmonie, [basis + skala[Math.max(0, stufe - 2)] - (stufe < 2 ? 12 : 0)], len, vel * 0.6);
  }

  /* ---------- Chiptune (die bisherige Musik) ---------- */

  private chip(step: number, out: MusikNote[]): void {
    const t = CHIP[this.stimmung];
    const takt = Math.floor(step / 16) % t.akkorde.length;
    const chord = 69 + t.root + t.akkorde[takt];
    const b = t.bass[step % 16];
    if (b !== null) out.push({ inst: 'chipBass', noten: [chord + b - 12], dauer: 1.6, vel: 0.14, versatz: 0, welle: 'triangle' });
    const l = t.lead[step % 32];
    if (l !== null) out.push({ inst: 'chipLead', noten: [chord + l + 12], dauer: 1.8, vel: t.leadVol, versatz: 0, welle: t.leadWave });
    const d = t.drums[step % 16];
    if (d === 'k') out.push({ inst: 'chipKick', noten: [], dauer: 1, vel: 0.35, versatz: 0 });
    else if (d === 's') out.push({ inst: 'chipSnare', noten: [], dauer: 1, vel: 0.12, versatz: 0 });
    else if (d === 'h') out.push({ inst: 'chipHat', noten: [], dauer: 1, vel: 0.05, versatz: 0 });
  }
}

interface Ctx {
  def: StimmungDef;
  p: Plan;
  ak: Akkord;
  naechster: Akkord;
  pos: number;
  imAbschnitt: number;
  fill: boolean;
  swing: number;
  stufe: number;
  out: MusikNote[];
}

/* ---------------- Chiptune-Daten (bisherige Stücke) ---------------- */

interface ChipTrack {
  bpm: number;
  /** Grundton in Halbtönen relativ zu A4 */
  root: number;
  akkorde: number[];
  bass: (number | null)[];
  lead: (number | null)[];
  drums: string;
  leadWave: 'square' | 'triangle' | 'sawtooth';
  leadVol: number;
}
const _ = null;
export const CHIP: Record<Stimmung, ChipTrack> = {
  menu: {
    bpm: 92, root: -12, akkorde: [0, -4, -7, -2], leadWave: 'triangle', leadVol: 0.07,
    bass: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, _, _],
    lead: [12, _, 15, _, 19, _, 15, _, 12, _, _, _, 10, _, _, _, 12, _, 15, _, 19, _, 22, _, 19, _, _, _, 15, _, _, _],
    drums: 'k.......s.......'
  },
  kampf: {
    bpm: 140, root: -12, akkorde: [0, 0, -4, -2], leadWave: 'square', leadVol: 0.05,
    bass: [0, _, 0, 12, 0, _, 0, 12, 0, _, 0, 12, 3, _, 5, 7],
    lead: [12, _, _, 15, _, 12, 10, _, 7, _, 10, _, 12, _, _, _, 15, _, _, 17, _, 15, 12, _, 10, _, 7, _, 10, _, _, _],
    drums: 'k.h.s.h.k.k.s.hh'
  },
  boss: {
    bpm: 156, root: -14, akkorde: [0, 1, 0, -2], leadWave: 'sawtooth', leadVol: 0.04,
    bass: [0, 0, 12, 0, 0, 12, 0, 13, 0, 0, 12, 0, 1, 1, 13, 12],
    lead: [12, _, 13, _, 12, _, 8, _, 7, _, 8, _, 12, _, 15, _, 13, _, 12, _, 8, _, 7, _, 5, _, 7, _, 8, _, _, _],
    drums: 'k.hsk.hsk.hsk.ss'
  },
  shop: {
    bpm: 108, root: -10, akkorde: [0, 5, 3, 7], leadWave: 'triangle', leadVol: 0.06,
    bass: [0, _, _, 7, _, _, 12, _, 0, _, _, 7, _, _, 10, _],
    lead: [_, _, 12, _, 16, _, 19, _, _, _, 16, _, 12, _, _, _, _, _, 14, _, 17, _, 21, _, _, _, 17, _, 14, _, _, _],
    drums: 'k...s..hk...s.h.'
  }
};
