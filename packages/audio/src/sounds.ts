import { folge, note, schicht, synth } from './synth.ts';

/**
 * Alle Soundeffekte von OVERBOOM – prozedural, keine Dateien.
 * Varianten der Tonhöhe entstehen beim Abspielen (playbackRate).
 */
export const SOUNDS: Record<string, () => Float32Array> = {
  // Waffen
  pew: () => synth({ wave: 'square', f0: 950, f1: 320, d: 0.09, duty: 0.25, vol: 0.22 }),
  peng: () => schicht([{ wave: 'noise', f0: 2400, f1: 600, d: 0.12, vol: 0.3, lp: 0.7 }, { wave: 'square', f0: 220, f1: 90, d: 0.1, vol: 0.2 }]),
  rakete: () => schicht([{ wave: 'noise', f0: 500, f1: 150, a: 0.02, d: 0.35, vol: 0.28, lp: 0.35 }, { wave: 'saw', f0: 160, f1: 320, d: 0.25, vol: 0.12 }]),
  zap: () => synth({ wave: 'saw', f0: 1600, f1: 240, d: 0.14, vol: 0.2, vib: 0.3, vibF: 40 }),
  flamme: () => synth({ wave: 'noise', f0: 900, f1: 500, a: 0.02, d: 0.16, vol: 0.2, lp: 0.45 }),
  laser: () => synth({ wave: 'sine', f0: 2000, f1: 1100, d: 0.13, vol: 0.2, vib: 0.08, vibF: 30 }),
  swing: () => synth({ wave: 'noise', f0: 600, f1: 2400, d: 0.11, vol: 0.18, lp: 0.6 }),
  wurf: () => synth({ wave: 'tri', f0: 500, f1: 950, d: 0.08, vol: 0.2 }),
  gacker: () => folge([{ wave: 'square', f0: 780, f1: 620, d: 0.06, vol: 0.2, duty: 0.3, vib: 0.1, vibF: 50 }, { wave: 'square', f0: 900, f1: 700, d: 0.09, vol: 0.2, duty: 0.3, vib: 0.12, vibF: 45 }]),
  kazoo: () => synth({ wave: 'saw', f0: 440, f1: 470, a: 0.02, d: 0.22, vol: 0.18, vib: 0.06, vibF: 7, lp: 0.55, rausch: 0.1 }),
  plopp: () => synth({ wave: 'sine', f0: 300, f1: 120, d: 0.1, vol: 0.3 }),
  feindschuss: () => synth({ wave: 'square', f0: 520, f1: 180, d: 0.12, duty: 0.4, vol: 0.14 }),

  // Treffer und Tod
  treffer: () => synth({ wave: 'noise', f0: 3500, f1: 1500, d: 0.04, vol: 0.16 }),
  krit: () => schicht([{ wave: 'square', f0: 1300, f1: 2000, d: 0.07, vol: 0.14, duty: 0.2 }, { wave: 'noise', f0: 4000, d: 0.05, vol: 0.12 }]),
  pop: () => synth({ wave: 'square', f0: 260, f1: 900, d: 0.08, vol: 0.18, duty: 0.4 }),
  matsch: () => synth({ wave: 'noise', f0: 500, f1: 120, d: 0.14, vol: 0.22, lp: 0.25 }),
  bumm: () => schicht([{ wave: 'noise', f0: 140, f1: 40, d: 0.55, vol: 0.55, lp: 0.4 }, { wave: 'sine', f0: 90, f1: 35, d: 0.4, vol: 0.45 }]),
  bummklein: () => schicht([{ wave: 'noise', f0: 260, f1: 70, d: 0.3, vol: 0.4, lp: 0.45 }, { wave: 'sine', f0: 140, f1: 50, d: 0.22, vol: 0.3 }]),
  megabumm: () => schicht([{ wave: 'noise', f0: 90, f1: 25, a: 0.01, s: 0.15, d: 1.1, vol: 0.7, lp: 0.3 }, { wave: 'sine', f0: 70, f1: 25, d: 0.9, vol: 0.55 }]),
  donner: () => schicht([{ wave: 'noise', f0: 400, f1: 60, s: 0.05, d: 0.7, vol: 0.45, lp: 0.3 }, { wave: 'saw', f0: 1800, f1: 200, d: 0.1, vol: 0.12 }]),

  // Spieler
  dash: () => synth({ wave: 'noise', f0: 700, f1: 2600, d: 0.13, vol: 0.18, lp: 0.65 }),
  aua: () => synth({ wave: 'saw', f0: 320, f1: 90, d: 0.22, vol: 0.28 }),
  ausweichen: () => synth({ wave: 'noise', f0: 2000, f1: 900, d: 0.1, vol: 0.12, lp: 0.8 }),
  kristall: () => synth({ wave: 'square', f0: 1320, d: 0.06, vol: 0.12, duty: 0.25, arp: [1.335, 0.4] }),
  heilung: () => synth({ wave: 'sine', f0: 700, f1: 1300, d: 0.22, vol: 0.18, vib: 0.05, vibF: 12 }),
  nom: () => folge([{ wave: 'square', f0: 330, d: 0.06, vol: 0.18, duty: 0.4 }, { wave: 'square', f0: 280, d: 0.08, vol: 0.18, duty: 0.4 }]),
  amboden: () => folge([note(3), note(-1), note(-6), note(-12)].map((f) => ({ wave: 'square' as const, f0: f, d: 0.12, vol: 0.2, duty: 0.4 })), 0.11),
  wiederda: () => folge([note(-5), note(0), note(4), note(7)].map((f) => ({ wave: 'square' as const, f0: f, d: 0.09, vol: 0.18, duty: 0.25 })), 0.07),
  tod: () => folge([note(0), note(-2), note(-5), note(-9), note(-14)].map((f, i) => ({ wave: 'saw' as const, f0: f, f1: f * 0.97, d: i === 4 ? 0.5 : 0.15, vol: 0.2, lp: 0.6 })), 0.16),

  // Gegner
  ansage: () => synth({ wave: 'square', f0: 180, f1: 760, d: 0.42, vol: 0.12, duty: 0.3 }),
  block: () => schicht([{ wave: 'square', f0: 1900, f1: 1750, d: 0.14, vol: 0.12, duty: 0.15 }, { wave: 'noise', f0: 5000, d: 0.04, vol: 0.12 }]),
  boss: () => schicht([{ wave: 'saw', f0: 75, f1: 55, a: 0.05, s: 0.3, d: 0.9, vol: 0.35, vib: 0.03, vibF: 5, lp: 0.4 }, { wave: 'noise', f0: 80, d: 1, vol: 0.2, lp: 0.2 }]),
  teilen: () => synth({ wave: 'sine', f0: 200, f1: 600, d: 0.12, vol: 0.2, vib: 0.2, vibF: 25 }),

  // Fortschritt, UI, Jingles
  levelup: () => folge([note(3), note(7), note(10), note(15)].map((f) => ({ wave: 'square' as const, f0: f, d: 0.1, vol: 0.18, duty: 0.25 })), 0.08),
  horn: () => schicht([{ wave: 'saw', f0: 220, a: 0.03, s: 0.2, d: 0.3, vol: 0.18, lp: 0.5 }, { wave: 'saw', f0: 330, a: 0.03, s: 0.2, d: 0.3, vol: 0.12, lp: 0.5 }]),
  fanfare: () => folge([note(3), note(7), note(10), note(15), note(10), note(15)].map((f, i) => ({ wave: 'square' as const, f0: f, d: i === 5 ? 0.35 : 0.1, vol: 0.18, duty: 0.25 })), 0.09),
  amboss: () => schicht([{ wave: 'square', f0: 2100, f1: 1900, d: 0.3, vol: 0.14, duty: 0.1 }, { wave: 'noise', f0: 6000, d: 0.06, vol: 0.2 }, { wave: 'sine', f0: 140, f1: 60, d: 0.15, vol: 0.3 }]),
  rezept: () => folge([note(7), note(11), note(14), note(19), note(23), note(26)].map((f) => ({ wave: 'sine' as const, f0: f, d: 0.16, vol: 0.18, vib: 0.02, vibF: 9 })), 0.07),
  stern: () => synth({ wave: 'sine', f0: 1760, d: 0.18, vol: 0.14, arp: [1.5, 0.35], vib: 0.02, vibF: 15 }),
  beute: () => folge([note(10), note(14), note(17)].map((f) => ({ wave: 'tri' as const, f0: f, d: 0.08, vol: 0.2 })), 0.06),
  reaktion: () => synth({ wave: 'sine', f0: 500, f1: 1400, d: 0.2, vol: 0.18, vib: 0.15, vibF: 20 }),
  klick: () => synth({ wave: 'square', f0: 1100, d: 0.025, vol: 0.1, duty: 0.3 }),
  kauf: () => folge([{ wave: 'square', f0: 1320, d: 0.05, vol: 0.14, duty: 0.25 }, { wave: 'square', f0: 1760, d: 0.08, vol: 0.14, duty: 0.25 }]),
  nein: () => synth({ wave: 'square', f0: 180, f1: 140, d: 0.14, vol: 0.14, duty: 0.4 }),
  overboom: () => schicht([{ wave: 'saw', f0: 110, f1: 880, s: 0.2, d: 0.5, vol: 0.25, lp: 0.6 }, { wave: 'noise', f0: 200, f1: 3000, d: 0.6, vol: 0.2, lp: 0.5 }])
};
