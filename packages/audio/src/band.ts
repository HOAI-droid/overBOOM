import type { Instrument, MusikNote, MusikStil } from './komponist.ts';

/**
 * Die „Band": spielt die Noten des Komponisten mit WebAudio-Bausteinen.
 * Keine Audiodateien – alle Instrumente entstehen aus Oszillatoren, Rauschen und Filtern.
 *
 * Signalweg: Instrument → Gruppen-Bus (Schlagzeug, Bass, Gitarre, Keys, Lead)
 *   → Mischpult → sanfte Höhenabsenkung → Kompressor → Ducking → Ausgang.
 * Hall (generierte Impulsantwort) und Echo (Lead) als Sends.
 * „Dezent": Höhen leicht gedämpft, damit Explosionen und Effekte vorne bleiben.
 */
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Pegel je Instrument (abgestimmt auf die Lautheit der Effekte) */
const PEGEL: Partial<Record<Instrument, number>> = {
  kick: 0.55, snare: 0.55, ghost: 0.5, clap: 0.5, hat: 0.18, hatOffen: 0.16, shaker: 0.12,
  ride: 0.13, crash: 0.16, tomHoch: 0.5, tomTief: 0.55,
  gitarre: 0.4, gitarreMute: 0.4, bassRock: 0.1, bassSynth: 0.15, leadRock: 0.13,
  pad: 0.07, pluck: 0.36, leadPop: 0.25,
  retroLead: 0.35, retroHarm: 0.21, retroArp: 0.25, retroBass: 0.13
};

const SCHLAGZEUG = new Set<Instrument>(['kick', 'snare', 'ghost', 'clap', 'hat', 'hatOffen', 'shaker', 'ride', 'crash', 'tomHoch', 'tomTief']);
/** Retro-Schlagzeug (Rauschen) relativ zum normalen Pegel */
const RETRO_DRUMS = 1;

export class Band {
  private ctx: BaseAudioContext;
  private rauschen: AudioBuffer;
  private kurven = new Map<number, Float32Array<ArrayBuffer>>();
  private wellen = new Map<number, PeriodicWave>();
  private kurzRauschen: AudioBuffer;
  private mix: GainNode;
  private duckGain: GainNode;
  private busse: Record<'drums' | 'bass' | 'git' | 'keys' | 'lead', GainNode>;
  private pump: GainNode;
  private echo: DelayNode;
  private stil: MusikStil = 'rock';
  private pumpAn = false;

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    // Rauschen (1 s), deterministisch erzeugt
    this.rauschen = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.rauschen.getChannelData(0);
    let s = 7;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }

    this.kurzRauschen = ctx.createBuffer(1, 93, ctx.sampleRate);
    const kd = this.kurzRauschen.getChannelData(0);
    for (let i = 0; i < kd.length; i++) { s = (s * 16807) % 2147483647; kd[i] = s > 1073741823 ? 1 : -1; }

    this.mix = ctx.createGain();
    const hoehen = ctx.createBiquadFilter();
    hoehen.type = 'highshelf'; hoehen.frequency.value = 6000; hoehen.gain.value = -3;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25; comp.knee.value = 10;
    this.duckGain = ctx.createGain();
    this.mix.connect(hoehen).connect(comp).connect(this.duckGain).connect(out);

    // Hall: generierte Impulsantwort (Rauschen mit abklingender Hüllkurve, stereo)
    const hall = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const c = ir.getChannelData(ch);
      let z = 11 + ch * 17;
      for (let i = 0; i < len; i++) { z = (z * 16807) % 2147483647; c[i] = (z / 1073741823.5 - 1) * Math.pow(1 - i / len, 3); }
    }
    hall.buffer = ir;
    const hallPegel = ctx.createGain();
    hallPegel.gain.value = 0.35;
    hall.connect(hallPegel).connect(this.mix);

    // Echo für Lead-Stimmen
    this.echo = ctx.createDelay(2);
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const echoFilter = ctx.createBiquadFilter(); echoFilter.type = 'lowpass'; echoFilter.frequency.value = 2400;
    const echoPegel = ctx.createGain(); echoPegel.gain.value = 0.3;
    this.echo.connect(echoFilter).connect(fb).connect(this.echo);
    echoFilter.connect(echoPegel).connect(this.mix);

    const bus = (hallAnteil: number, echoAnteil = 0) => {
      const g = ctx.createGain();
      g.connect(this.mix);
      if (hallAnteil > 0) { const s2 = ctx.createGain(); s2.gain.value = hallAnteil; g.connect(s2).connect(hall); }
      if (echoAnteil > 0) { const s3 = ctx.createGain(); s3.gain.value = echoAnteil; g.connect(s3).connect(this.echo); }
      return g;
    };
    this.busse = { drums: bus(0.12), bass: bus(0), git: bus(0.1), keys: bus(0.35), lead: bus(0.3, 0.6) };
    // Pop: „Pumpen" der Flächen im Takt der Kick
    this.pump = ctx.createGain();
    this.pump.connect(this.busse.keys);
  }

  /** Stil setzen (Klangfarben, Pumpen, Echo-Zeit) */
  setStil(stil: MusikStil, bpm: number): void {
    this.stil = stil;
    this.pumpAn = stil === 'pop';
    // gleiche Lautheit für alle Stile (Chiptune ist der Bezug)
    this.mix.gain.value = stil === 'chip' ? 1 : stil === 'rock' ? 0.6 : 0.7;
    // Echo: punktierte Achtel
    this.echo.delayTime.value = Math.min(1.9, (60 / bpm) * 0.75);
  }

  /** Musik kurz leiser (große Explosionen bleiben wuchtig und gut hörbar) */
  duck(menge: number): void {
    const t = this.ctx.currentTime, g = this.duckGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(Math.max(0.15, 1 - menge), t + 0.03);
    g.setTargetAtTime(1, t + 0.15, 0.35);
  }

  /** Eine Note zum Zeitpunkt `at` spielen; stepLen = Länge einer 16tel in Sekunden */
  spiele(n: MusikNote, at: number, stepLen: number): void {
    const dur = Math.max(0.03, n.dauer * stepLen);
    const v = n.vel * (PEGEL[n.inst] ?? 1) * (this.stil === 'retro' && SCHLAGZEUG.has(n.inst) ? RETRO_DRUMS : 1);
    switch (n.inst) {
      case 'kick': this.kick(at, v); break;
      case 'snare': this.snare(at, v, 1); break;
      case 'ghost': this.snare(at, v, 0.6); break;
      case 'clap': this.clap(at, v); break;
      case 'hat': this.rauschStoss(at, v, 'highpass', 7500, this.stil === 'retro' ? 0.025 : 0.04, this.busse.drums); break;
      case 'hatOffen': this.rauschStoss(at, v, 'highpass', 7000, 0.3, this.busse.drums); break;
      case 'shaker': this.rauschStoss(at, v, 'bandpass', 9000, 0.05, this.busse.drums, 0.012); break;
      case 'ride': this.becken(at, v, 0.7, 6500); break;
      case 'crash': this.rauschStoss(at, v, 'highpass', 4500, 1.6, this.busse.drums, 0.005); this.becken(at, v * 0.6, 1.2, 5000); break;
      case 'tomHoch': this.tom(at, v, 210); break;
      case 'tomTief': this.tom(at, v, 140); break;
      case 'gitarre': this.gitarre(n.noten, at, dur, v, false); break;
      case 'gitarreMute': this.gitarre(n.noten, at, Math.min(dur, stepLen * 1.2), v, true); break;
      case 'bassRock': this.bass(n.noten[0], at, dur, v, 'sawtooth', 750, 3); break;
      case 'bassSynth': this.bass(n.noten[0], at, dur, v, 'sawtooth', 600, 0, true); break;
      case 'leadRock': this.lead(n.noten[0], at, dur, v, true); break;
      case 'leadPop': this.lead(n.noten[0], at, dur, v, false); break;
      case 'pad': this.pad(n.noten, at, dur, v); break;
      case 'pluck': this.pluck(n.noten[0], at, dur, v); break;
      case 'retroLead': this.puls(n.noten[0], at, dur, v, 0.25, true, this.busse.lead, 0); break;
      case 'retroHarm': this.puls(n.noten[0], at, dur, v, 0.5, true, this.busse.keys, 0.35); break;
      case 'retroArp': this.puls(n.noten[0], at, Math.min(dur, stepLen * 1.5), v, 0.125, false, this.busse.keys, -0.35); break;
      case 'retroBass': this.dreieck(n.noten[0], at, dur, v); break;
      case 'chipBass': case 'chipLead': this.chipTon(n.welle ?? 'square', n.noten[0], at, dur, n.vel); break;
      case 'chipKick': this.chipKick(at); break;
      case 'chipSnare': this.rauschStoss(at, 0.12, 'highpass', 1800, 0.16, this.mix); break;
      case 'chipHat': this.rauschStoss(at, 0.05, 'highpass', 7000, 0.04, this.mix); break;
    }
  }

  /* ---------------- Bausteine ---------------- */

  private osc(type: OscillatorType, f: number, at: number, stop: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    o.start(at);
    o.stop(stop);
    return o;
  }

  private filter(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }

  /** Hüllkurve: Anschlag, Abklingen auf Haltepegel, Loslassen am Ende */
  private huelle(at: number, peak: number, attack: number, decay: number, halt: number, ende: number, release: number): GainNode {
    const g = this.ctx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, at);
    p.linearRampToValueAtTime(peak, at + attack);
    const h = Math.max(0.0001, peak * halt);
    if (decay > 0) p.setTargetAtTime(h, at + attack, decay / 3);
    p.setValueAtTime(h, Math.max(at + attack + 0.001, ende));
    p.exponentialRampToValueAtTime(0.0001, ende + release);
    return g;
  }

  private verzerrung(k: number): Float32Array<ArrayBuffer> {
    let c = this.kurven.get(k);
    if (!c) {
      c = new Float32Array(1024);
      const n = Math.tanh(k);
      for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(k * x) / n; }
      this.kurven.set(k, c);
    }
    return c;
  }

  private rauschStoss(at: number, v: number, typ: BiquadFilterType, f: number, dauer: number, ziel: AudioNode, attack = 0.001): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.rauschen;
    const fl = this.filter(typ, f, typ === 'bandpass' ? 0.9 : 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(v, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + dauer);
    src.connect(fl).connect(g).connect(ziel);
    src.start(at, (at * 7.31) % 0.6);
    src.stop(at + attack + dauer + 0.02);
  }

  /* ---------------- Schlagzeug ---------------- */

  private kick(at: number, v: number): void {
    const retro = this.stil === 'retro', pop = this.stil === 'pop';
    // Retro: Dreieck mit schnellem Tonabfall (klassischer Konsolen-Bums)
    const o = this.osc(retro ? 'triangle' : 'sine', retro ? 220 : pop ? 140 : 120, at, at + 0.4);
    o.frequency.exponentialRampToValueAtTime(retro ? 50 : 45, at + (retro ? 0.07 : pop ? 0.11 : 0.08));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + (pop ? 0.3 : retro ? 0.14 : 0.2));
    o.connect(g).connect(this.busse.drums);
    if (!retro) this.rauschStoss(at, v * 0.25, 'highpass', 3000, 0.008, this.busse.drums);
    // Pop: Flächen „pumpen" mit der Kick
    if (this.pumpAn) {
      const p = this.pump.gain;
      p.cancelScheduledValues(at);
      p.setValueAtTime(0.3, at);
      p.linearRampToValueAtTime(1, at + 0.22);
    }
  }

  private snare(at: number, v: number, koerper: number): void {
    if (this.stil === 'retro') {
      // 8-Bit-Snare: „metallisches" Schleifen-Rauschen, kurz
      this.retroRauschen(at, v, 0.09);
      return;
    }
    this.rauschStoss(at, v, 'bandpass', 1900, 0.18, this.busse.drums);
    const o = this.osc('triangle', 190, at, at + 0.12);
    o.frequency.exponentialRampToValueAtTime(150, at + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v * 0.6 * koerper, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    o.connect(g).connect(this.busse.drums);
  }

  private clap(at: number, v: number): void {
    for (let i = 0; i < 3; i++) this.rauschStoss(at + i * 0.011, v * 0.7, 'bandpass', 1300, 0.012, this.busse.drums);
    this.rauschStoss(at + 0.033, v, 'bandpass', 1200, 0.14, this.busse.drums);
  }

  /** metallisches Becken aus sechs Rechteck-Oszillatoren (klassischer Drumcomputer-Trick) */
  private becken(at: number, v: number, dauer: number, hp: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(v, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dauer);
    const f1 = this.filter('highpass', hp), f2 = this.filter('bandpass', 9000, 0.5);
    f1.connect(f2).connect(g).connect(this.busse.drums);
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) this.osc('square', f * 1.7, at, at + dauer + 0.02).connect(f1);
  }

  private tom(at: number, v: number, f: number): void {
    const o = this.osc('sine', f, at, at + 0.35);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, at + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    o.connect(g).connect(this.busse.drums);
  }

  /* ---------------- Saiten & Tasten ---------------- */

  /** E-Gitarre: verstimmte Sägezähne → Verzerrung → „Verstärker"-Filter; links/rechts gedoppelt */
  private gitarre(noten: number[], at: number, dur: number, v: number, mute: boolean): void {
    const ruhe = this.stil !== 'rock';
    for (const seite of [-1, 1]) {
      const vor = this.ctx.createGain();
      vor.gain.value = 0.32;
      const start = at + (seite > 0 ? 0.011 : 0);
      const ende = start + dur;
      for (const m of noten) {
        const o = this.osc('sawtooth', mtof(m), start, ende + 0.12);
        o.detune.value = seite * 7;
        o.connect(vor);
      }
      const hp = this.filter('highpass', 140);
      const sh = this.ctx.createWaveShaper();
      sh.curve = this.verzerrung(ruhe ? 4 : 9);
      sh.oversample = '2x';
      const box = this.filter('lowpass', mute ? 2200 : 5200, 0.9);
      const mitten = this.filter('peaking', 1400, 0.8);
      mitten.gain.value = 4;
      // Präsenz wie ein Gitarrenlautsprecher (sonst klingt es mumpfig)
      const praesenz = this.filter('peaking', 2700, 1.2);
      praesenz.gain.value = 6;
      const g = mute ? this.huelle(start, v, 0.003, 0.12, 0.05, start + Math.min(dur, 0.1), 0.05) : this.huelle(start, v, 0.004, 0.4, 0.65, ende, 0.08);
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = seite * 0.65;
      vor.connect(hp).connect(sh).connect(box).connect(mitten).connect(praesenz).connect(g).connect(pan).connect(this.busse.git);
    }
  }

  private bass(m: number, at: number, dur: number, v: number, typ: OscillatorType, cutoff: number, drive: number, filterHuelle = false): void {
    const ende = at + dur;
    const o = this.osc(typ, mtof(m), at, ende + 0.1);
    const sub = this.osc('sine', mtof(m), at, ende + 0.1);
    const lp = this.filter('lowpass', cutoff, 1.2);
    if (filterHuelle) {
      lp.frequency.setValueAtTime(cutoff * 3, at);
      lp.frequency.exponentialRampToValueAtTime(cutoff, at + 0.12);
    }
    const g = this.huelle(at, v, 0.005, 0.25, 0.75, ende - 0.01, 0.06);
    const subG = this.ctx.createGain(); subG.gain.value = 0.25;
    let kette: AudioNode = o.connect(lp);
    if (drive > 0) {
      const sh = this.ctx.createWaveShaper();
      sh.curve = this.verzerrung(drive);
      kette = kette.connect(sh);
    }
    kette.connect(g);
    sub.connect(subG).connect(g);
    g.connect(this.busse.bass);
  }

  private lead(m: number, at: number, dur: number, v: number, rock: boolean): void {
    const ende = at + dur;
    const f = mtof(m);
    const o = this.osc(rock ? 'sawtooth' : 'square', f, at, ende + 0.25);
    const o2 = this.osc(rock ? 'square' : 'triangle', f * (rock ? 1 : 2), at, ende + 0.25);
    o2.detune.value = 5;
    // Vibrato setzt verzögert ein
    const lfo = this.osc('sine', 5.5, at, ende + 0.25);
    const tiefe = this.ctx.createGain();
    tiefe.gain.setValueAtTime(0, at);
    tiefe.gain.linearRampToValueAtTime(f * 0.012, at + Math.min(0.35, dur));
    lfo.connect(tiefe);
    tiefe.connect(o.frequency);
    tiefe.connect(o2.frequency);
    const vor = this.ctx.createGain(); vor.gain.value = 0.5;
    o.connect(vor); o2.connect(vor);
    let kette: AudioNode = vor;
    if (rock) {
      const sh = this.ctx.createWaveShaper();
      sh.curve = this.verzerrung(5);
      kette = kette.connect(sh);
    }
    const lp = this.filter('lowpass', rock ? 2600 : 3200, 0.8);
    const g = this.huelle(at, v, 0.01, 0.2, 0.8, ende, 0.12);
    kette.connect(lp).connect(g).connect(this.busse.lead);
  }

  private pad(noten: number[], at: number, dur: number, v: number): void {
    const ende = at + dur;
    const lp = this.filter('lowpass', 1500, 0.6);
    const g = this.huelle(at, v, 0.25, 0, 1, ende - 0.05, 0.45);
    lp.connect(g).connect(this.pumpAn ? this.pump : this.busse.keys);
    const links = this.ctx.createStereoPanner(), rechts = this.ctx.createStereoPanner();
    links.pan.value = -0.5; rechts.pan.value = 0.5;
    links.connect(lp); rechts.connect(lp);
    for (const m of noten) for (const d of [-9, 9]) {
      const o = this.osc('sawtooth', mtof(m), at, ende + 0.5);
      o.detune.value = d;
      o.connect(d < 0 ? links : rechts);
    }
  }

  private pluck(m: number, at: number, dur: number, v: number): void {
    const ende = at + Math.min(dur, 0.4);
    const lp = this.filter('lowpass', 700, 2);
    lp.frequency.setValueAtTime(4200, at);
    lp.frequency.exponentialRampToValueAtTime(700, at + 0.18);
    const g = this.huelle(at, v, 0.003, 0.2, 0.25, ende, 0.12);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = (m % 2 ? -0.3 : 0.3);
    lp.connect(g).connect(pan).connect(this.pumpAn ? this.pump : this.busse.keys);
    for (const d of [-6, 6]) {
      const o = this.osc('sawtooth', mtof(m), at, ende + 0.15);
      o.detune.value = d;
      o.connect(lp);
    }
  }

  /** Pulswelle mit Tastverhältnis (12,5 / 25 / 50 %) – der typische 8-Bit-Klang */
  private pulsWelle(duty: number): PeriodicWave {
    let w = this.wellen.get(duty);
    if (!w) {
      const n = 48, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      w = this.ctx.createPeriodicWave(re, im);
      this.wellen.set(duty, w);
    }
    return w;
  }

  private puls(m: number, at: number, dur: number, v: number, duty: number, vibrato: boolean, bus: AudioNode, pan: number): void {
    const ende = at + dur;
    const f = mtof(m);
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(this.pulsWelle(duty));
    o.frequency.setValueAtTime(f, at);
    o.start(at);
    o.stop(ende + 0.12);
    if (vibrato && dur > 0.18) {
      // Vibrato erst nach dem Anschlag – wie bei Konsolen-Melodien
      const lfo = this.osc('sine', 6, at, ende + 0.12);
      const tiefe = this.ctx.createGain();
      tiefe.gain.setValueAtTime(0, at);
      tiefe.gain.setValueAtTime(0, at + 0.12);
      tiefe.gain.linearRampToValueAtTime(f * 0.01, at + 0.3);
      lfo.connect(tiefe).connect(o.frequency);
    }
    const g = this.huelle(at, v, 0.004, 0.15, 0.7, ende - 0.01, 0.05);
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      o.connect(g).connect(p).connect(bus);
    } else o.connect(g).connect(bus);
  }

  /** Dreieck-Bass mit hartem Ein/Aus (8-Bit-Gate) */
  private dreieck(m: number, at: number, dur: number, v: number): void {
    const ende = at + dur * 0.92;
    const o = this.osc('triangle', mtof(m), at, ende + 0.03);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(v, at + 0.003);
    g.gain.setValueAtTime(v, ende);
    g.gain.linearRampToValueAtTime(0.0001, ende + 0.02);
    o.connect(g).connect(this.busse.bass);
  }

  /** kurzes, schleifendes Rauschen (93 Werte) – klingt „metallisch" wie alte Rauschkanäle */
  private retroRauschen(at: number, v: number, dauer: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.kurzRauschen;
    src.loop = true;
    const hp = this.filter('highpass', 1000);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dauer);
    src.connect(hp).connect(g).connect(this.busse.drums);
    src.start(at);
    src.stop(at + dauer + 0.02);
    // dazu normales Rauschen für Körper
    this.rauschStoss(at, v * 0.6, 'bandpass', 2500, dauer * 0.8, this.busse.drums);
  }

  /* ---------------- Chiptune (bisheriger Klang) ---------------- */

  private chipTon(type: OscillatorType, m: number, at: number, dur: number, vol: number): void {
    const o = this.osc(type, mtof(m), at, at + dur + 0.02);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.mix);
  }

  private chipKick(at: number): void {
    const o = this.osc('sine', 150, at, at + 0.18);
    o.frequency.exponentialRampToValueAtTime(40, at + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g).connect(this.mix);
  }
}
