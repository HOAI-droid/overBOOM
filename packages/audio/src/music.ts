/**
 * Chiptune-Musik als kleiner Sequenzer: Bass, Melodie und Schlagzeug werden mit
 * WebAudio-Oszillatoren kurz im Voraus geplant (Lookahead), Loops ohne Dateien.
 */

interface Track {
  bpm: number;
  /** Grundton in Halbtönen relativ zu A4 */
  root: number;
  /** Akkord-Grundtöne je Takt (Halbtöne), Loop */
  akkorde: number[];
  /** 16 Schritte: Bass-Intervall oder null */
  bass: (number | null)[];
  /** 32 Schritte (2 Takte): Melodie-Intervall oder null */
  lead: (number | null)[];
  /** 16 Schritte: k = Kick, s = Snare, h = Hi-Hat, . = nichts */
  drums: string;
  leadWave: OscillatorType;
  leadVol: number;
}

const _ = null;
export const TRACKS: Record<string, Track> = {
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

const freq = (semi: number) => 440 * Math.pow(2, semi / 12);

export class Musik {
  private ctx: AudioContext;
  private out: GainNode;
  private track: Track | null = null;
  private id = '';
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer;

  constructor(ctx: AudioContext, out: GainNode) {
    this.ctx = ctx;
    this.out = out;
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
  }

  get aktuell(): string { return this.id; }

  play(id: string | null): void {
    if ((id ?? '') === this.id) return;
    this.id = id ?? '';
    this.track = id ? TRACKS[id] ?? null : null;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    if (this.track && !this.timer) this.timer = setInterval(() => this.tick(), 25);
    if (!this.track && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private tick(): void {
    const t = this.track;
    if (!t) return;
    const stepLen = 60 / t.bpm / 4;
    // nach einer Pause (Tab im Hintergrund) nicht alles nachholen
    if (this.next < this.ctx.currentTime - 0.2) this.next = this.ctx.currentTime + 0.05;
    while (this.next < this.ctx.currentTime + 0.12) {
      this.schedule(t, this.step, this.next, stepLen);
      this.next += stepLen;
      this.step++;
    }
  }

  private schedule(t: Track, step: number, at: number, len: number): void {
    const bar = Math.floor(step / 16) % t.akkorde.length;
    const chord = t.root + t.akkorde[bar];
    const b = t.bass[step % 16];
    if (b !== null) this.tone('triangle', freq(chord + b - 12), at, len * 1.6, 0.14);
    const l = t.lead[step % 32];
    if (l !== null) this.tone(t.leadWave, freq(chord + l + 12), at, len * 1.8, t.leadVol);
    const d = t.drums[step % 16];
    if (d === 'k') this.kick(at);
    else if (d === 's') this.hit(at, 1800, 0.16, 0.12);
    else if (d === 'h') this.hit(at, 7000, 0.04, 0.05);
  }

  private tone(type: OscillatorType, f: number, at: number, dur: number, vol: number): void {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.out);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private kick(at: number): void {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(40, at + 0.12);
    g.gain.setValueAtTime(0.35, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g).connect(this.out);
    o.start(at);
    o.stop(at + 0.18);
  }

  private hit(at: number, cutoff: number, dur: number, vol: number): void {
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(at, Math.random() * 0.1);
    src.stop(at + dur + 0.02);
  }
}
