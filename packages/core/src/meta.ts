import type { SimEvent, World } from './sim.ts';
import { ERFOLGE, GEGNER_BY_ID, HELDEN, HELD_FREI, INSELN, KARTE_BY_ID, KARTEN_REGELN, SETS, setBoni, type MetaStat } from '../../data/src/index.ts';

/**
 * Meta-Progression zwischen den Runs: Kartenalbum, Erfolge, befreite Inseln.
 * Reine Logik ohne Speicher – die App lädt/speichert das Profil über `platform.storage`.
 * Gilt immer für den lokalen Spieler (Index `spieler`).
 */

/** 1 = Karte gefunden, 2 = Glanzkarte */
export type KartenStufe = 1 | 2;

export interface Profil {
  v: 1;
  karten: Record<string, KartenStufe>;
  /** noch nicht im Album angesehen */
  neu: string[];
  kills: Record<string, number>;
  bossKills: Record<string, number>;
  /** Inseln, deren Boss besiegt wurde */
  befreit: string[];
  /** Inseln, auf denen ein ganzer Run gewonnen wurde */
  erobert: string[];
  erfolge: string[];
  rezepte: string[];
  stats: Record<MetaStat, number>;
}

export interface Neuigkeit {
  art: 'karte' | 'glanz' | 'erfolg' | 'insel';
  id: string;
}

export function neuesProfil(): Profil {
  return {
    v: 1, karten: {}, neu: [], kills: {}, bossKills: {}, befreit: [], erobert: [], erfolge: [], rezepte: [],
    stats: { runs: 0, siege: 0, kills: 0, maxKette: 0, fusionen: 0, rezepte: 0, reaktionen: 0, befreit: 0, evolutionen: 0, kristalle: 0, sets: 0, bestWelle: 0, bosse: 0 }
  };
}

/** Profil aus gespeichertem JSON (fehlende Felder werden ergänzt, kaputtes → neu) */
export function ladeProfil(json: string | null): Profil {
  const p = neuesProfil();
  if (!json) return p;
  try {
    const d = JSON.parse(json) as Partial<Profil>;
    if (!d || typeof d !== 'object') return p;
    const obj = <T extends object>(v: unknown, def: T): T => (v && typeof v === 'object' && !Array.isArray(v) ? v as T : def);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    p.karten = obj(d.karten, {});
    p.neu = arr(d.neu);
    p.kills = obj(d.kills, {});
    p.bossKills = obj(d.bossKills, {});
    p.befreit = arr(d.befreit);
    p.erobert = arr(d.erobert);
    p.erfolge = arr(d.erfolge);
    p.rezepte = arr(d.rezepte);
    p.stats = { ...p.stats, ...obj(d.stats, {}) };
  } catch { /* kaputt → neues Profil */ }
  return p;
}

/** Profil als teilbarer Code (Export) */
export function profilCode(p: Profil): string {
  const json = JSON.stringify(p);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'OB1-' + btoa(bin);
}

/** Code → Profil, oder null bei ungültigem Code */
export function profilAusCode(code: string): Profil | null {
  const c = code.trim();
  if (!c.startsWith('OB1-')) return null;
  try {
    const bin = atob(c.slice(4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    JSON.parse(json);
    return ladeProfil(json);
  } catch { return null; }
}

/** Ist die Insel auf der Weltkarte anwählbar? Erste Insel immer, sonst nach Befreiung der vorigen. */
export function inselFrei(p: Profil, id: string): boolean {
  const i = INSELN.findIndex((x) => x.id === id);
  if (i <= 0) return i === 0;
  return p.befreit.includes(INSELN[i - 1].id);
}

/** Ist der Held spielbar? (manche werden über Erfolge freigeschaltet) */
export function heldFrei(p: Profil, id: string): boolean {
  const r = HELD_FREI[id];
  return !r || (p.stats[r.stat] ?? 0) >= r.ziel || p.karten[`held:${id}`] !== undefined;
}

export function heldenFrei(p: Profil): string[] {
  return HELDEN.filter((h) => heldFrei(p, h.id)).map((h) => h.id);
}

/** Basis-ID einer Waffe (Evolutionen zählen für die Grundwaffe) */
function basisWaffe(id: string): string {
  return id.startsWith('evo:') ? id.slice(6) : id;
}

/**
 * Sammelt Freischaltungen während eines Runs. `events` nach jedem Tick/Befehl,
 * `sync` bei Shop/Phasenwechseln, `runEnde` einmal am Ende.
 */
export class MetaTracker {
  profil: Profil;
  /** neue Freischaltungen seit dem letzten Abholen (für Banner/Toast) */
  readonly neues: Neuigkeit[] = [];
  /** wurde das Profil verändert? (→ speichern) */
  dirty = false;
  private spieler: number;
  private runGezaehlt = false;

  constructor(profil: Profil, spieler = 0) {
    this.profil = profil;
    this.spieler = spieler;
  }

  /** lokaler Spieler (Koop-Client hat einen anderen Platz) */
  setSpieler(i: number): void {
    this.spieler = i;
  }

  /** neuer Run (nach reset) */
  neuerRun(): void {
    this.runGezaehlt = false;
  }

  karte(id: string, stufe: KartenStufe): void {
    if (!KARTE_BY_ID[id]) return;
    const alt = this.profil.karten[id] ?? 0;
    if (alt >= stufe) return;
    this.profil.karten[id] = stufe;
    if (!this.profil.neu.includes(id)) this.profil.neu.push(id);
    this.neues.push({ art: stufe === 2 ? 'glanz' : 'karte', id });
    this.dirty = true;
  }

  private stat(k: MetaStat, v: number, max = false): void {
    const s = this.profil.stats;
    const neu = max ? Math.max(s[k], v) : s[k] + v;
    if (neu === s[k]) return;
    s[k] = neu;
    this.dirty = true;
  }

  /** Erfolge prüfen */
  private erfolge(): void {
    for (const e of ERFOLGE) {
      if (this.profil.erfolge.includes(e.id) || this.profil.stats[e.stat] < e.ziel) continue;
      this.profil.erfolge.push(e.id);
      this.neues.push({ art: 'erfolg', id: e.id });
      this.karte(e.karte, 2);
      this.dirty = true;
    }
  }

  /** Ereignisse eines Ticks auswerten */
  events(w: World, events: readonly SimEvent[]): void {
    const p = this.profil;
    let changed = false;
    for (const e of events) {
      switch (e.type) {
        case 'kill': {
          if (e.doomed) break;
          const def = GEGNER_BY_ID[e.enemy];
          if (!def) break;
          changed = true;
          p.stats.kills++;
          if (def.verhalten === 'boss') {
            const n = p.bossKills[e.enemy] = (p.bossKills[e.enemy] ?? 0) + 1;
            p.stats.bosse++;
            this.karte(`gegner:${e.enemy}`, n >= KARTEN_REGELN.bossGlanz ? 2 : 1);
            if ((e.enemy === w.insel.boss || e.enemy === 'baron') && !p.befreit.includes(w.insel.id)) {
              p.befreit.push(w.insel.id);
              p.stats.befreit = p.befreit.length;
              this.neues.push({ art: 'insel', id: w.insel.id });
            }
          } else {
            const n = p.kills[e.enemy] = (p.kills[e.enemy] ?? 0) + 1;
            if (n === KARTEN_REGELN.gegnerKills) this.karte(`gegner:${e.enemy}`, 1);
            if (n === KARTEN_REGELN.gegnerGlanz) this.karte(`gegner:${e.enemy}`, 2);
          }
          break;
        }
        case 'chain': if (e.count > p.stats.maxKette) { p.stats.maxKette = e.count; changed = true; } break;
        case 'reaction': p.stats.reaktionen++; changed = true; break;
        case 'evolve': if (e.player === this.spieler) { p.stats.evolutionen++; changed = true; } break;
        case 'fusion':
          if (e.player !== this.spieler) break;
          p.stats.fusionen++;
          changed = true;
          if (e.rezept && !p.rezepte.includes(e.rezept)) {
            p.rezepte.push(e.rezept);
            p.stats.rezepte = p.rezepte.length;
          }
          if (e.rezept) this.karte(`rezept:${e.rezept}`, 1);
          break;
        case 'pickup': if (e.player === this.spieler) { p.stats.kristalle += e.value; changed = true; } break;
        case 'waveStart': if (e.wave > p.stats.bestWelle) { p.stats.bestWelle = e.wave; changed = true; } break;
      }
    }
    if (changed) { this.dirty = true; this.erfolge(); }
  }

  /** Zustand des Spielers abgleichen: Held, Waffen, Items, Sets */
  sync(w: World): void {
    const pl = w.players[this.spieler];
    if (!pl || !pl.weapons.length) return;
    if (!this.runGezaehlt) {
      this.runGezaehlt = true;
      this.stat('runs', 1);
    }
    if (pl.held) this.karte(`held:${pl.held}`, 1);
    for (const s of pl.weapons) {
      const rz = s.waffe.fusion?.rezept;
      if (rz) {
        this.karte(`rezept:${rz}`, s.tier >= 5 ? 2 : 1);
        if (!this.profil.rezepte.includes(rz)) { this.profil.rezepte.push(rz); this.stat('rezepte', this.profil.rezepte.length, true); }
      } else if (!s.waffe.fusion) this.karte(`waffe:${basisWaffe(s.waffe.id)}`, s.stars >= 5 ? 2 : 1);
    }
    for (const id in pl.items) this.karte(`item:${id}`, pl.items[id] >= KARTEN_REGELN.itemGlanz ? 2 : 1);
    const komplett = setBoni(Object.values(pl.ausruestung)).filter((x) => x.anzahl >= SETS.find((s) => s.id === x.set.id)!.teile.length).length;
    if (komplett) this.stat('sets', komplett, true);
    this.erfolge();
  }

  /** Run vorbei (Sieg oder Tod) */
  runEnde(w: World, sieg: boolean): void {
    this.sync(w);
    const pl = w.players[this.spieler];
    if (sieg) {
      this.stat('siege', 1);
      if (!this.profil.erobert.includes(w.insel.id)) { this.profil.erobert.push(w.insel.id); this.dirty = true; }
      if (pl?.held) this.karte(`held:${pl.held}`, 2);
      // einzigartige Items glänzen nach einem Sieg
      if (pl) for (const id in pl.items) if (isUnique(id)) this.karte(`item:${id}`, 2);
    }
    this.erfolge();
  }

  /** Karte im Album angesehen → nicht mehr „neu" */
  gesehen(id: string): void {
    const i = this.profil.neu.indexOf(id);
    if (i >= 0) { this.profil.neu.splice(i, 1); this.dirty = true; }
  }

  /** alles freischalten (Debug) */
  allesFrei(): void {
    for (const id in KARTE_BY_ID) this.profil.karten[id] = 2;
    this.profil.befreit = INSELN.map((i) => i.id);
    this.dirty = true;
  }
}

function isUnique(id: string): boolean {
  return KARTE_BY_ID[`item:${id}`]?.typzeile.endsWith('Einzigartig') ?? false;
}
