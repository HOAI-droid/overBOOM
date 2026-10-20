import { Band } from './band.ts';
import { Komponist, type MusikNote, type MusikStil, type Stimmung, STIMMUNGEN } from './komponist.ts';

export type MusikWahl = MusikStil | 'aus';

/**
 * Musik-Steuerung: plant die Noten des Komponisten mit kurzem Vorlauf (Lookahead)
 * und lässt sie von der Band spielen. Stil, Stimmung und Intensität lassen sich
 * jederzeit ändern; Wechsel greifen sofort mit kurzem Einblenden.
 */
export class Musik {
  private ctx: BaseAudioContext;
  private band: Band;
  private blende: GainNode;
  private stil: MusikWahl = 'rock';
  private stimmung: Stimmung | null = null;
  private komp: Komponist | null = null;
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ziel = 0.3;
  private intens = 0.3;
  private seedBasis: number;
  private wechsel = 0;
  private puffer: MusikNote[] = [];

  constructor(ctx: BaseAudioContext, out: AudioNode, seed = (Date.now() >>> 0)) {
    this.ctx = ctx;
    this.seedBasis = seed;
    this.blende = ctx.createGain();
    this.blende.connect(out);
    this.band = new Band(ctx, this.blende);
  }

  get aktuell(): string { return this.stimmung ?? ''; }
  get aktuellerStil(): MusikWahl { return this.stil; }
  get intensitaet(): number { return this.intens; }
  get stufe(): number { return this.komp?.aktuelleStufe ?? 0; }

  /** Stimmung wählen (menu/kampf/boss/shop) oder null = still */
  play(id: string | null): void {
    const s = id && (STIMMUNGEN as readonly string[]).includes(id) ? id as Stimmung : null;
    if (s === this.stimmung) return;
    this.stimmung = s;
    this.neu();
  }

  setStil(stil: MusikWahl): void {
    if (stil === this.stil) return;
    this.stil = stil;
    this.neu();
  }

  /** Ziel-Intensität 0–1 (vom Spielgeschehen); wird geglättet */
  setIntensitaet(x: number): void { this.ziel = Math.max(0, Math.min(1, x)); }

  duck(menge: number): void { this.band.duck(menge); }

  private neu(): void {
    const an = this.stimmung && this.stil !== 'aus';
    if (an) {
      this.wechsel++;
      this.komp = new Komponist(this.stil as MusikStil, this.stimmung!, this.seedBasis + this.wechsel * 7919);
      this.band.setStil(this.stil as MusikStil, this.komp.bpm);
      this.step = 0;
      this.next = this.ctx.currentTime + 0.08;
      // kurz einblenden, damit der Wechsel nicht hart klingt
      const g = this.blende.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      // Shop und Menü etwas zurückhaltender (Verschnaufpause)
      g.exponentialRampToValueAtTime(this.stimmung === 'shop' || this.stimmung === 'menu' ? 0.75 : 1, t + 0.4);
      const offline = typeof OfflineAudioContext !== 'undefined' && this.ctx instanceof OfflineAudioContext;
      if (!this.timer && !offline) this.timer = setInterval(() => this.tick(), 25);
    } else {
      this.komp = null;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }
  }

  private tick(): void {
    // nach einer Pause (Tab im Hintergrund) nicht alles nachholen
    if (this.next < this.ctx.currentTime - 0.2) this.next = this.ctx.currentTime + 0.05;
    this.planeBis(this.ctx.currentTime + 0.12);
  }

  /** alle Schritte bis Zeitpunkt `t` einplanen (auch für Offline-Rendering) */
  planeBis(t: number, intensitaet?: (zeit: number) => number): void {
    const k = this.komp;
    if (!k) return;
    const len = 60 / k.bpm / 4;
    while (this.next < t) {
      // Intensität glätten: rauf schnell (≈1,5 s), runter langsam (≈6 s)
      if (intensitaet) this.ziel = intensitaet(this.next);
      const tau = this.ziel > this.intens ? 1.5 : 6;
      this.intens += (this.ziel - this.intens) * Math.min(1, len / tau);
      k.schritt(this.step, this.intens, this.puffer);
      for (const n of this.puffer) this.band.spiele(n, this.next + n.versatz * len, len);
      this.next += len;
      this.step++;
    }
  }
}

/**
 * Musik offline in einen Puffer rendern (Hörproben, Tests im Browser).
 * verlauf: Intensität je Zeitpunkt in Sekunden.
 */
export async function renderMusik(stil: MusikStil, stimmung: Stimmung, sekunden: number, verlauf: (t: number) => number = () => 0.5, seed = 1): Promise<AudioBuffer> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * sekunden), sr);
  const pegel = ctx.createGain();
  pegel.gain.value = 0.6; // wie im Spiel: Musik-Lautstärke × 0,6
  pegel.connect(ctx.destination);
  const m = new Musik(ctx, pegel, seed);
  m.setStil(stil);
  m.play(stimmung);
  m.planeBis(sekunden, verlauf);
  return ctx.startRendering();
}
