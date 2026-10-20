import type { World } from './sim.ts';
import type { Offer, UpgradeOffer, WeaponSlot } from './entities.ts';
import { computeSynergies, layoutWeapons, recomputeStats } from './progression.ts';
import { modMask, spezialMask } from './weapons.ts';
import { W, waffeById, type Ausruestung, type PlatzId } from '../../data/src/index.ts';

/**
 * Spielstand für „Fortsetzen" (nur solo): wird nach jeder Welle im Shop gespeichert.
 * Enthält alles, was der Run braucht; Arenen entstehen wieder aus dem Seed.
 */
export interface Spielstand {
  v: 1;
  seed: number;
  start: string;
  wave: number;
  gefahr: number;
  endless: boolean;
  equipUid: number;
  rng: [number, number, number];
  stats: World['stats'];
  spieler: {
    held: string; name: string; level: number; xp: number; crystals: number;
    weapons: { id: string; tier: number; stars: number; kills: number; mods: string[] }[];
    items: Record<string, number>; upgrades: UpgradeOffer[]; offers: Offer[]; upgradeOffers: UpgradeOffer[];
    rerolls: number; pendingLevels: number; modInv: string[];
    ausruestung: Record<PlatzId, Ausruestung | null>; beute: Ausruestung[];
  };
}

/** Kann der Run gespeichert werden? (solo, im Shop, noch nicht vorbei) */
export function speicherbar(w: World): boolean {
  return w.players.length === 1 && w.phase === 'shop' && w.players[0].alive && w.players[0].weapons.length > 0;
}

export function speichereLauf(w: World): Spielstand {
  const p = w.players[0];
  return {
    v: 1, seed: w.runSeed, start: w.reise[0], wave: w.wave, gefahr: w.gefahr, endless: w.endless, equipUid: w.equipUid,
    rng: [w.rng.state, w.shopRng.state, w.lootRng.state],
    stats: JSON.parse(JSON.stringify(w.stats)),
    spieler: JSON.parse(JSON.stringify({
      held: p.held, name: p.name, level: p.level, xp: p.xp, crystals: p.crystals,
      weapons: p.weapons.map((s) => ({ id: s.waffe.id, tier: s.tier, stars: s.stars, kills: s.kills, mods: s.mods })),
      items: p.items, upgrades: p.upgrades, offers: p.offers, upgradeOffers: p.upgradeOffers,
      rerolls: p.rerolls, pendingLevels: p.pendingLevels, modInv: p.modInv, ausruestung: p.ausruestung, beute: p.beute
    }))
  };
}

/** Prüft grob, ob ein gespeicherter Wert ein brauchbarer Spielstand ist */
export function istSpielstand(x: unknown): x is Spielstand {
  const s = x as Spielstand;
  return !!s && s.v === 1 && typeof s.seed === 'number' && typeof s.wave === 'number' && s.wave >= 1 && !!s.spieler && Array.isArray(s.spieler.weapons) && s.spieler.weapons.length > 0;
}

/** Spielstand in eine (Solo-)Welt laden: danach steht sie im Shop nach Welle `wave` */
export function ladeLauf(w: World, st: Spielstand): void {
  w.reset(st.seed);
  w.startReise(st.start);
  w.setGefahr(st.gefahr);
  w.endless = st.endless;
  w.equipUid = st.equipUid;
  w.wave = st.wave;
  const pos = w.reisePos(st.wave);
  if (pos.index !== w.reiseIndex) w.geheZuInsel(pos.index);
  w.ordneWelleEin(st.wave);
  Object.assign(w.stats, st.stats);
  for (const e of w.enemies) e.alive = false;
  for (const warn of w.warnings) warn.active = false;
  w.enemyCount = 0;
  const p = w.players[0], s = st.spieler;
  if (s.held) w.setHero(p, s.held);
  p.name = s.name; p.level = s.level; p.xp = s.xp; p.crystals = s.crystals;
  p.items = s.items; p.upgrades = s.upgrades; p.offers = s.offers; p.upgradeOffers = s.upgradeOffers;
  p.rerolls = s.rerolls; p.pendingLevels = s.pendingLevels; p.modInv = s.modInv;
  p.ausruestung = s.ausruestung; p.beute = s.beute;
  p.weapons = s.weapons.map((wi): WeaponSlot => {
    const waffe = waffeById(wi.id) ?? W.pistole;
    return { waffe, tier: wi.tier, cd: 0, aim: 0, ox: 0, oz: 0, target: -1, mask: spezialMask(waffe), kills: wi.kills, stars: wi.stars, mods: wi.mods, modMask: modMask(wi.mods) };
  });
  p.loadout++;
  layoutWeapons(p);
  computeSynergies(p);
  recomputeStats(p);
  p.hp = p.maxHp;
  p.ready = false;
  w.rng.state = st.rng[0]; w.shopRng.state = st.rng[1]; w.lootRng.state = st.rng[2];
  w.phase = 'shop';
}
