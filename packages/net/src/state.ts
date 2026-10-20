import type { Player, World } from '../../core/src/index.ts';
import type { Offer, UpgradeOffer, WeaponSlot } from '../../core/src/entities.ts';
import { layoutWeapons, recomputeStats } from '../../core/src/progression.ts';
import { modMask, spezialMask } from '../../core/src/weapons.ts';
import { W, waffeById, type Ausruestung, type PlatzId } from '../../data/src/index.ts';

/**
 * Langsamer Zustand (selten geändert, als JSON): Inventar und Shop jedes Spielers,
 * Insel und Run-Statistik. Der Host schickt ihn nur, wenn er sich geändert hat.
 */

export interface WaffenInfo { id: string; tier: number; stars: number; kills: number; mods: string[] }

export interface PlayerState {
  name: string;
  held: string;
  weapons: WaffenInfo[];
  items: Record<string, number>;
  upgrades: UpgradeOffer[];
  offers: Offer[];
  upgradeOffers: UpgradeOffer[];
  rerolls: number;
  pendingLevels: number;
  modInv: string[];
  ausruestung: Record<PlatzId, Ausruestung | null>;
  beute: Ausruestung[];
}

export interface WorldState {
  insel: string;
  gefahr: number;
  endless: boolean;
  waffen: Record<string, number>;
  players: PlayerState[];
}

export function playerState(p: Player): PlayerState {
  return {
    name: p.name, held: p.held,
    weapons: p.weapons.map((s) => ({ id: s.waffe.id, tier: s.tier, stars: s.stars, kills: s.kills, mods: s.mods })),
    items: p.items, upgrades: p.upgrades, offers: p.offers, upgradeOffers: p.upgradeOffers,
    rerolls: p.rerolls, pendingLevels: p.pendingLevels, modInv: p.modInv, ausruestung: p.ausruestung, beute: p.beute
  };
}

export function worldState(w: World): WorldState {
  return { insel: w.insel.id, gefahr: w.gefahr, endless: w.endless, waffen: w.stats.waffen, players: w.players.map(playerState) };
}

const lastWeapons = new WeakMap<Player, string>();

/** Client: langsamen Zustand in die Spiegelwelt übernehmen */
export function applyWorldState(w: World, st: WorldState): void {
  if (st.insel && st.insel !== w.insel.id) w.setIsland(st.insel);
  w.endless = st.endless;
  if (st.gefahr !== w.gefahr) w.setGefahr(st.gefahr);
  w.stats.waffen = st.waffen;
  st.players.forEach((ps, i) => {
    const p = w.players[i];
    if (!p) return;
    p.name = ps.name;
    if (ps.held && ps.held !== p.held) w.setHero(p, ps.held);
    p.items = ps.items; p.upgrades = ps.upgrades; p.offers = ps.offers; p.upgradeOffers = ps.upgradeOffers;
    p.rerolls = ps.rerolls; p.pendingLevels = ps.pendingLevels; p.modInv = ps.modInv;
    p.ausruestung = ps.ausruestung; p.beute = ps.beute;
    const key = JSON.stringify(ps.weapons);
    if (lastWeapons.get(p) !== key) {
      lastWeapons.set(p, key);
      const old = p.weapons;
      p.weapons = ps.weapons.map((wi, k): WeaponSlot => {
        const waffe = waffeById(wi.id) ?? W.pistole;
        return { waffe, tier: wi.tier, cd: 0, aim: old[k]?.aim ?? 0, ox: 0, oz: 0, target: -1, mask: spezialMask(waffe), kills: wi.kills, stars: wi.stars, mods: wi.mods, modMask: modMask(wi.mods) };
      });
      layoutWeapons(p);
    } else {
      // Kills/Sterne können sich ohne Waffenwechsel ändern
      ps.weapons.forEach((wi, k) => { const s = p.weapons[k]; if (s) { s.kills = wi.kills; s.stars = wi.stars; } });
      recomputeStats(p);
    }
  });
}
