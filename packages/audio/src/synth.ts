/**
 * Mini-Synthesizer für Retro-Klänge: erzeugt Soundeffekte als Samples (einmal beim Start),
 * abgespielt werden sie danach als fertige AudioBuffer – das kostet im Spiel fast nichts.
 */

export const SR = 22050;

export type Welle = 'square' | 'saw' | 'sine' | 'tri' | 'noise';

export interface Ton {
  wave: Welle;
  /** Start- und Endfrequenz (Hz) – exponentieller Übergang */
  f0: number;
  f1?: number;
  /** Anschlag, Halten, Ausklingen (s) */
  a?: number;
  s?: number;
  d: number;
  vol?: number;
  /** Pulsbreite bei square (0–0,5) */
  duty?: number;
  /** Vibrato: Tiefe (Anteil) und Tempo (Hz) */
  vib?: number;
  vibF?: number;
  /** Tiefpass 0–1 (1 = offen) */
  lp?: number;
  /** Arpeggio: Frequenz × Faktor ab Anteil der Länge */
  arp?: [number, number];
  /** zusätzlicher Rauschanteil (0–1) */
  rausch?: number;
}

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

/** Einen Ton als Samples berechnen */
export function synth(t: Ton): Float32Array {
  const a = t.a ?? 0.005, s = t.s ?? 0, d = t.d;
  const len = a + s + d;
  const n = Math.max(1, Math.floor(len * SR));
  const out = new Float32Array(n);
  const f1 = t.f1 ?? t.f0, vol = t.vol ?? 0.5, duty = t.duty ?? 0.5;
  const lpK = t.lp === undefined ? 1 : Math.max(0.01, t.lp * t.lp);
  let phase = 0, lp = 0, noise = 0, lastCycle = -1;
  for (let i = 0; i < n; i++) {
    const time = i / SR, k = time / len;
    let f = t.f0 * Math.pow(f1 / t.f0, k);
    if (t.arp && k >= t.arp[1]) f *= t.arp[0];
    if (t.vib) f *= 1 + Math.sin(time * Math.PI * 2 * (t.vibF ?? 8)) * t.vib;
    phase += f / SR;
    const ph = phase - Math.floor(phase);
    let v: number;
    switch (t.wave) {
      case 'square': v = ph < duty ? 0.6 : -0.6; break;
      case 'saw': v = (ph * 2 - 1) * 0.7; break;
      case 'sine': v = Math.sin(ph * Math.PI * 2); break;
      case 'tri': v = (ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4) * 0.9; break;
      default: {
        // Chiptune-Rauschen: Wert wird pro „Schwingung" neu gewürfelt
        const cyc = Math.floor(phase * 2);
        if (cyc !== lastCycle) { noise = rnd() * 2 - 1; lastCycle = cyc; }
        v = noise;
      }
    }
    if (t.rausch) v = v * (1 - t.rausch) + (rnd() * 2 - 1) * t.rausch;
    lp += (v - lp) * lpK;
    const env = time < a ? time / a : time < a + s ? 1 : Math.max(0, 1 - (time - a - s) / d);
    out[i] = lp * env * env * vol;
  }
  return out;
}

/** Mehrere Töne hintereinander (Jingles) bzw. übereinander (Schichten) */
export function folge(teile: Ton[], abstand?: number): Float32Array {
  const parts = teile.map(synth);
  const step = abstand ? Math.floor(abstand * SR) : 0;
  const total = step ? step * (parts.length - 1) + parts[parts.length - 1].length : parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(Math.max(total, ...parts.map((p, i) => (step ? step * i : 0) + p.length)));
  let pos = 0;
  parts.forEach((p, i) => {
    const at = step ? step * i : pos;
    for (let k = 0; k < p.length; k++) out[at + k] += p[k];
    pos += p.length;
  });
  return out;
}

export function schicht(teile: Ton[]): Float32Array {
  const parts = teile.map(synth);
  const out = new Float32Array(Math.max(...parts.map((p) => p.length)));
  for (const p of parts) for (let k = 0; k < p.length; k++) out[k] += p[k];
  return out;
}

/** Notenname → Frequenz (A4 = 440) */
export function note(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}
