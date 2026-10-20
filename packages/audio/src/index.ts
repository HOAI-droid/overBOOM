import type { SimEvent } from '@overboom/core';
import { waffeById } from '@overboom/data';
import { SR } from './synth.ts';
import { SOUNDS } from './sounds.ts';
import { Musik } from './music.ts';

export { TRACKS } from './music.ts';

/** Klang je Waffe: aus Gruppe und Geschoss abgeleitet (gecacht) */
const fireCache = new Map<string, string>();
function fireSound(id: string): string {
  let s = fireCache.get(id);
  if (s) return s;
  const w = waffeById(id);
  s = 'pew';
  if (w) {
    const g = w.geschoss, gr = w.gruppe;
    if (g === 'huhn' || g === 'ei' || g === 'kueken' || w.ladung === 'verhuehnern') s = 'gacker';
    else if (g === 'note') s = 'kazoo';
    else if (g === 'rakete' || g === 'granate' || g === 'dynamit' || g === 'meteor') s = 'rakete';
    else if (g === 'blitzkugel' || w.ladung === 'kettenblitz') s = 'zap';
    else if (g === 'flamme') s = 'flamme';
    else if (g === 'laser') s = 'laser';
    else if (gr === 'Nahkampf' || w.antrieb === 'nahkampf') s = 'swing';
    else if (gr === 'Werfer' || w.antrieb === 'bogen') s = 'wurf';
    else if (g === 'blase' || g === 'wasser' || g === 'schleim' || g === 'luftballon') s = 'plopp';
    else if (g === 'kugel' && (w.antrieb === 'faecher' || w.ladung === 'rueckstoss')) s = 'peng';
  }
  fireCache.set(id, s);
  return s;
}

export interface Lautstaerke { gesamt: number; effekte: number; musik: number }

/**
 * Audio: prozedurale Effekte und Musik. Erst nach der ersten Berührung/Taste
 * entsperren (iOS erlaubt vorher keinen Ton). Spielt Sounds direkt aus `world.events`.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicGain!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private last = new Map<string, number>();
  private voices = 0;
  private musik: Musik | null = null;
  private vol: Lautstaerke = { gesamt: 0.8, effekte: 0.8, musik: 0.5 };
  private wunschMusik: string | null = null;
  private gemStreak = 0;
  private gemT = 0;

  get bereit(): boolean { return !!this.ctx && this.ctx.state === 'running'; }

  /** Bei Nutzerinteraktion aufrufen (Touch, Klick, Taste) */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.sfx = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        // leichter Kompressor: viele Explosionen gleichzeitig übersteuern nicht
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.sfx.connect(this.master);
        this.musicGain.connect(this.master);
        this.master.connect(comp).connect(this.ctx.destination);
        this.musik = new Musik(this.ctx, this.musicGain);
        this.apply();
        if (this.wunschMusik) this.musik.play(this.wunschMusik);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* kein Audio verfügbar */ }
  }

  /** Tab im Hintergrund: Ton aus, sonst weiter */
  suspend(on: boolean): void {
    if (!this.ctx) return;
    if (on) void this.ctx.suspend(); else void this.ctx.resume();
  }

  setLautstaerke(v: Lautstaerke): void {
    this.vol = v;
    this.apply();
  }

  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.gesamt, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.effekte, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.vol.musik * 0.6, t, 0.2);
  }

  music(id: string | null): void {
    this.wunschMusik = id;
    this.musik?.play(id);
  }

  private buffer(name: string): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let b = this.buffers.get(name);
    if (!b) {
      const gen = SOUNDS[name];
      if (!gen) return null;
      const data = gen();
      b = ctx.createBuffer(1, data.length, SR);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(name, b);
    }
    return b;
  }

  /** Sound abspielen. minGap verhindert Dauerfeuer desselben Sounds. */
  play(name: string, opt: { vol?: number; pitch?: number; pan?: number; minGap?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.vol.gesamt <= 0) return;
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < (opt.minGap ?? 0.035)) return;
    if (this.voices > 28) return;
    const b = this.buffer(name);
    if (!b) return;
    this.last.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (opt.pitch ?? 1) * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = opt.vol ?? 1;
    let node: AudioNode = src.connect(g);
    if (opt.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opt.pan));
      node = node.connect(p);
    }
    node.connect(this.sfx);
    this.voices++;
    src.onended = () => { this.voices--; };
    src.start();
  }

  /** Spielereignisse vertonen; (lx, lz) = eigener Spieler für Lautstärke/Stereo */
  events(events: readonly SimEvent[], me: number, lx: number, lz: number): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const pos = (x: number, z: number) => {
      // isometrische Kamera: Bildschirm-x ≈ (x − z)
      const dx = x - lx, dz = z - lz;
      const d = Math.hypot(dx, dz);
      return { vol: Math.max(0.15, 1 - d / 18), pan: (dx - dz) / 14 };
    };
    for (const e of events) {
      switch (e.type) {
        case 'fire': {
          const p = pos(e.x, e.z);
          this.play(fireSound(e.weapon), { vol: p.vol * (e.player === me ? 0.8 : 0.4), pan: p.pan, minGap: 0.05 });
          break;
        }
        case 'hit': this.play(e.crit ? 'krit' : 'treffer', { vol: 0.7, minGap: e.crit ? 0.05 : 0.03 }); break;
        case 'kill': { const p = pos(e.x, e.z); this.play(e.enemy === 'kampfhuhn' ? 'gacker' : e.enemy.startsWith('schleim') ? 'matsch' : 'pop', { vol: p.vol * 0.8, pan: p.pan, minGap: 0.04 }); break; }
        case 'explosion': {
          const p = pos(e.x, e.z);
          this.play(e.r > 1.9 ? 'bumm' : 'bummklein', { vol: p.vol, pan: p.pan, pitch: 1 + Math.min(0.5, e.chain * 0.04), minGap: 0.06 });
          break;
        }
        case 'pickup':
          if (e.player !== me) break;
          this.gemStreak = this.gemT > 0 ? Math.min(12, this.gemStreak + 1) : 0;
          this.gemT = 0.5;
          this.play('kristall', { pitch: 1 + this.gemStreak * 0.05, vol: 0.7, minGap: 0.03 });
          break;
        case 'dash': if (e.player === me) this.play('dash'); break;
        case 'hurt': if (e.player === me) this.play('aua', { minGap: 0.1 }); break;
        case 'dodge': if (e.player === me) this.play('ausweichen'); break;
        case 'heal': if (e.player === me) this.play('heilung', { vol: 0.6, minGap: 0.3 }); break;
        case 'keks': this.play('nom'); break;
        case 'levelUp': if (e.player === me) this.play('levelup'); break;
        case 'waveStart': this.play(e.boss ? 'boss' : 'horn'); break;
        case 'waveClear': this.play('fanfare'); break;
        case 'bossSpawn': this.play('boss'); break;
        case 'windup': { const p = pos(e.x, e.z); this.play('ansage', { vol: p.vol * 0.7, pan: p.pan, minGap: 0.15 }); break; }
        case 'enemyShot': { const p = pos(e.x, e.z); this.play('feindschuss', { vol: p.vol * 0.7, pan: p.pan, minGap: 0.08 }); break; }
        case 'block': this.play('block', { minGap: 0.08 }); break;
        case 'split': this.play('teilen', { minGap: 0.08 }); break;
        case 'fusion': this.play('amboss'); if (e.rezept) this.play('rezept'); break;
        case 'merge': this.play('amboss', { pitch: 1.3 }); break;
        case 'star': if (e.player === me) this.play('stern'); break;
        case 'evolve': this.play('rezept', { pitch: 0.8 }); break;
        case 'loot': if (e.player === me) this.play('beute'); break;
        case 'reaction': this.play('reaktion', { minGap: 0.08 }); break;
        case 'nuke': this.play('megabumm'); break;
        case 'storm': this.play('donner', { minGap: 0.2 }); break;
        case 'shock': if (e.phase === 'entladen') this.play('zap', { pitch: 0.6, vol: 1 }); break;
        case 'kawumm': this.play('bummklein', { pitch: 1.3 }); break;
        case 'downed': this.play('amboden'); break;
        case 'revive': this.play('wiederda'); break;
        case 'death': this.play('tod'); break;
        case 'victory': this.play('fanfare', { pitch: 1.12 }); break;
      }
    }
  }

  /** pro Frame (Zähler für Kristall-Tonleiter) */
  update(dt: number): void {
    if (this.gemT > 0) this.gemT -= dt;
  }
}
