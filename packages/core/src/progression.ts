import type { Player, World } from './sim.ts';
import type { Offer, WeaponSlot } from './entities.ts';
import { spezialMask } from './weapons.ts';
import {
  AMBOSS, HELD_BY_ID, ITEMS, SYNERGIEN, ITEM_BY_ID, LEVEL, SHOP, SPIELER, STUFEN, UPGRADES, UPGRADE_BY_ID, W, WAFFEN, elemente,
  baseStats, fusionsWaffe, pruefeFusion, rollSeltenheit, waffeById, type Stats
} from '../../data/src/index.ts';

/**
 * Progression zwischen den Wellen: Level-Up, Shop, Merge.
 * Alles läuft über Befehle (`Command`), damit es später im Koop vom Host
 * ausgeführt werden kann – die UI schickt nur Befehle und liest den Zustand.
 */
export type Command =
  /** Run-Start: Held (bestimmt Startwaffe) und Insel; `weapon` nur ohne Held */
  | { type: 'start'; weapon?: string; held?: string; insel?: string }
  | { type: 'upgrade'; index: number }
  | { type: 'buy'; index: number }
  | { type: 'reroll' }
  | { type: 'lock'; index: number }
  | { type: 'sell'; slot: number }
  | { type: 'merge'; slot: number }
  | { type: 'ready' }
  | { type: 'endless' }
  /** Fusions-Amboss: `slots` = 2–3 Waffenplätze; teile = Index in `slots` je Bauteil */
  | { type: 'fuse'; slots: number[]; geschoss: number; antrieb: number; ladung: number };

/** Waffen, die der Shop anbieten darf (Antrieb ist schon simuliert). */
export const SHOP_WEAPONS = WAFFEN.filter((w) => SHOP.antriebe.includes(w.antrieb) || SPIELER.startAuswahl.includes(w.id)).map((w) => w.id);

export function weaponPrice(tier: number, wave: number): number {
  return Math.round(SHOP.waffenGrundpreis * STUFEN.preis[tier - 1] * SHOP.inflation(wave));
}

export function itemPrice(id: string, wave: number): number {
  return Math.round(ITEM_BY_ID[id].preis * SHOP.inflation(wave));
}

export function sellPrice(slot: WeaponSlot, wave: number): number {
  return Math.max(1, Math.round(weaponPrice(slot.tier, wave) * SHOP.verkaufsAnteil));
}

export function rerollPrice(w: World, p: Player): number {
  if (p.perk.zufall && p.rerolls === 0) return 0;
  return SHOP.rerollPreis(w.wave, p.rerolls);
}

/** Stats neu aus Upgrades + Items berechnen. */
export function recomputeStats(p: Player): void {
  const s: Stats = baseStats();
  for (const u of p.upgrades) {
    const def = UPGRADE_BY_ID[u.id];
    s[def.stat] += def.werte[u.tier - 1];
  }
  for (const id in p.items) {
    const n = p.items[id], def = ITEM_BY_ID[id];
    for (const k in def.werte) s[k as keyof Stats] += (def.werte[k as keyof Stats] ?? 0) * n;
  }
  // Synergie-Boni (Werte)
  for (const syn of SYNERGIEN) {
    const n = p.synCount[syn.element] ?? 0;
    for (const st of syn.stufen) if (n >= st.ab && st.werte) for (const k in st.werte) s[k as keyof Stats] += st.werte[k as keyof Stats] ?? 0;
  }
  const held = HELD_BY_ID[p.held];
  if (held) for (const k in held.werte) s[k as keyof Stats] += held.werte[k as keyof Stats] ?? 0;
  s.maxHp += (p.level - 1) * LEVEL.hpProLevel;
  p.stats = s;
  const oldMax = p.maxHp;
  p.maxHp = Math.max(1, SPIELER.maxHp + s.maxHp);
  if (p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
  p.hp = Math.min(p.hp, p.maxHp);
}

/** Waffen gleichmäßig um die Figur verteilen (bis 3: Halbkreis hinter der Figur, sonst Vollkreis). */
/** Elemente aller Waffen zählen und Synergie-Effekte setzen */
export function computeSynergies(p: Player): void {
  const count: Record<string, number> = {};
  for (const s of p.weapons) {
    const el = s.waffe.fusion ? s.waffe.fusion.elemente : elemente(s.waffe);
    for (const e of new Set(el)) count[e] = (count[e] ?? 0) + 1;
  }
  const fx: Record<string, boolean> = {};
  for (const syn of SYNERGIEN) for (const st of syn.stufen) if ((count[syn.element] ?? 0) >= st.ab && st.effekt) fx[st.effekt] = true;
  p.synCount = count;
  p.syn = fx;
}

export function layoutWeapons(p: Player): void {
  p.loadout++;
  computeSynergies(p);
  recomputeStats(p);
  const n = p.weapons.length;
  const back = Math.PI * 0.25 + Math.PI; // Bildschirm „oben"
  p.weapons.forEach((s, k) => {
    const ang = n <= 3
      ? back + ((k + 0.5) / n - 0.5) * Math.PI * 1.3
      : back + (k / n) * Math.PI * 2;
    s.ox = Math.sin(ang) * SPIELER.waffenAbstand;
    s.oz = Math.cos(ang) * SPIELER.waffenAbstand;
  });
}

export function addWeapon(p: Player, id: string, tier: number): void {
  const waffe = waffeById(id) ?? W.pistole;
  p.weapons.push({ waffe, tier, cd: 0.3 + p.weapons.length * 0.13, aim: 0, ox: 0, oz: 0, target: -1, mask: spezialMask(waffe) });
  layoutWeapons(p);
}

/** XP aus Kristallen; Level-Ups werden nach der Welle eingelöst. */
export function gainXp(w: World, p: Player, amount: number): void {
  p.xp += amount;
  while (p.xp >= LEVEL.xpBedarf(p.level)) {
    p.xp -= LEVEL.xpBedarf(p.level);
    p.level++;
    p.pendingLevels++;
    recomputeStats(p);
    w.events.push({ type: 'levelUp', player: p.id, level: p.level, x: p.x, z: p.z });
  }
}

function rollUpgrades(w: World, p: Player): void {
  const pool = UPGRADES.slice();
  p.upgradeOffers = [];
  for (let i = 0; i < LEVEL.angebote && pool.length; i++) {
    const k = Math.floor(w.shopRng.next() * pool.length);
    const u = pool.splice(k, 1)[0];
    p.upgradeOffers.push({ id: u.id, tier: rollSeltenheit(w.wave + p.level * 0.5, p.stats.glueck, w.shopRng.next()) });
  }
}

function rollOffer(w: World, p: Player): Offer {
  const r = w.shopRng;
  const tier = rollSeltenheit(w.wave + 1, p.stats.glueck, r.next());
  if (r.next() < SHOP.waffenAnteil) {
    // Bevorzugt Waffen, die man schon hat (zum Mergen) – wie in Brotato
    const ownable = p.weapons.filter((s) => !s.waffe.fusion);
    const own = ownable.length && r.next() < 0.35 ? ownable[Math.floor(r.next() * ownable.length)].waffe.id : '';
    // Der Pyromane bekommt nur, was knallt oder brennt
    const pool = p.perk.nurExplosiv ? SHOP_WEAPONS.filter((id) => elemente(W[id]).some((e) => e === 'Explosiv' || e === 'Feuer')) : SHOP_WEAPONS;
    const id = own || pool[Math.floor(r.next() * pool.length)];
    return { kind: 'waffe', id, tier, price: weaponPrice(tier, w.wave + 1), locked: false, sold: false };
  }
  let pool = ITEMS.filter((it) => it.seltenheit === tier && (!it.max || (p.items[it.id] ?? 0) < it.max));
  if (!pool.length) pool = ITEMS.filter((it) => it.seltenheit <= tier && (!it.max || (p.items[it.id] ?? 0) < it.max));
  const it = pool[Math.floor(r.next() * pool.length)];
  return { kind: 'item', id: it.id, tier: it.seltenheit, price: itemPrice(it.id, w.wave + 1), locked: false, sold: false };
}

function rollShop(w: World, p: Player): void {
  const next: Offer[] = [];
  for (let i = 0; i < SHOP.angebote; i++) {
    const old = p.offers[i];
    next.push(old && old.locked && !old.sold ? old : rollOffer(w, p));
  }
  p.offers = next;
}

/** Shop öffnen (nach der Welle). */
export function openShop(w: World): void {
  for (const p of w.players) {
    if (!p.alive) continue;
    // Ernte: Bonus-Kristalle (zählen nicht als XP)
    if (p.stats.ernte > 0) {
      p.crystals += p.stats.ernte;
      w.events.push({ type: 'harvest', player: p.id, value: p.stats.ernte });
    }
    p.rerolls = 0;
    p.ready = false;
    rollShop(w, p);
    if (p.pendingLevels > 0) rollUpgrades(w, p);
    else p.upgradeOffers = [];
  }
}

function mergeInto(p: Player, keep: number, remove: number): void {
  p.weapons[keep].tier++;
  p.weapons.splice(remove, 1);
  layoutWeapons(p);
}

/** Führt einen Befehl eines Spielers aus. Rückgabe: hat geklappt? */
export function runCommand(w: World, p: Player, cmd: Command): boolean {
  switch (cmd.type) {
    case 'start': {
      if (w.phase !== 'wahl' || p.weapons.length) return false;
      let weapon = cmd.weapon ?? '';
      if (cmd.held) {
        const h = HELD_BY_ID[cmd.held];
        if (!h) return false;
        w.setHero(p, h.id);
        // Glückspilz: irgendeine Waffe
        weapon = h.startWaffe === 'zufall' ? SHOP_WEAPONS[Math.floor(w.shopRng.next() * SHOP_WEAPONS.length)] : h.startWaffe;
      } else if (!SPIELER.startAuswahl.includes(weapon)) return false;
      if (cmd.insel) w.setIsland(cmd.insel);
      addWeapon(p, weapon, 1);
      recomputeStats(p);
      p.hp = p.maxHp;
      if (w.players.every((q) => q.weapons.length > 0)) w.startWave(w.opt.wave);
      return true;
    }
    case 'upgrade': {
      if (w.phase !== 'shop' || p.pendingLevels <= 0) return false;
      const o = p.upgradeOffers[cmd.index];
      if (!o) return false;
      p.upgrades.push({ id: o.id, tier: o.tier });
      p.pendingLevels--;
      recomputeStats(p);
      if (p.pendingLevels > 0) rollUpgrades(w, p);
      else p.upgradeOffers = [];
      return true;
    }
    case 'buy': {
      if (w.phase !== 'shop') return false;
      const o = p.offers[cmd.index];
      if (!o || o.sold || p.crystals < o.price) return false;
      if (o.kind === 'waffe') {
        if (p.weapons.length >= SPIELER.maxWaffen) {
          // Kein Platz: direkt mit gleicher Waffe gleicher Stufe verschmelzen
          const same = p.weapons.findIndex((s) => s.waffe.id === o.id && s.tier === o.tier && s.tier < 5);
          if (same < 0) return false;
          p.weapons[same].tier++;
          p.loadout++;
          computeSynergies(p);
          w.events.push({ type: 'merge', player: p.id, weapon: o.id, tier: p.weapons[same].tier });
        } else {
          addWeapon(p, o.id, o.tier);
        }
      } else {
        const def = ITEM_BY_ID[o.id];
        if (def.max && (p.items[o.id] ?? 0) >= def.max) return false;
        p.items[o.id] = (p.items[o.id] ?? 0) + 1;
        recomputeStats(p);
      }
      p.crystals -= o.price;
      o.sold = true;
      o.locked = false;
      return true;
    }
    case 'reroll': {
      if (w.phase !== 'shop') return false;
      const price = rerollPrice(w, p);
      if (p.crystals < price) return false;
      p.crystals -= price;
      p.rerolls++;
      rollShop(w, p);
      return true;
    }
    case 'lock': {
      const o = p.offers[cmd.index];
      if (w.phase !== 'shop' || !o || o.sold) return false;
      o.locked = !o.locked;
      return true;
    }
    case 'sell': {
      const s = p.weapons[cmd.slot];
      if (w.phase !== 'shop' || !s || p.weapons.length <= 1) return false;
      p.crystals += sellPrice(s, w.wave + 1);
      p.weapons.splice(cmd.slot, 1);
      layoutWeapons(p);
      return true;
    }
    case 'merge': {
      const s = p.weapons[cmd.slot];
      if (w.phase !== 'shop' || !s || s.tier >= 5) return false;
      const other = p.weapons.findIndex((o, i) => i !== cmd.slot && o.waffe.id === s.waffe.id && o.tier === s.tier);
      if (other < 0) return false;
      mergeInto(p, cmd.slot, other);
      w.events.push({ type: 'merge', player: p.id, weapon: s.waffe.id, tier: s.tier });
      return true;
    }
    case 'ready': {
      if (w.phase !== 'shop' || p.pendingLevels > 0) return false;
      p.ready = true;
      if (w.players.every((q) => !q.alive || q.ready)) w.startWave(w.wave + 1);
      return true;
    }
    case 'fuse': {
      if (w.phase !== 'shop') return false;
      const v = fusionPreview(w, p, cmd);
      if (!v.waffe || v.error || p.crystals < v.price) return false;
      const tier = v.tier;
      p.crystals -= v.price;
      // Eingangswaffen entfernen (von hinten, damit die Indizes stimmen)
      [...new Set(cmd.slots)].sort((a, b) => b - a).forEach((i) => p.weapons.splice(i, 1));
      addWeapon(p, v.waffe.id, tier);
      w.events.push({ type: 'fusion', player: p.id, weapon: v.waffe.id, name: v.waffe.name, rezept: v.waffe.fusion?.rezept ?? '', x: p.x, z: p.z });
      return true;
    }
    case 'endless': {
      if (w.phase !== 'sieg') return false;
      w.endless = true;
      w.phase = 'shop';
      openShop(w);
      return true;
    }
  }
}

/** Kann diese Waffe gerade gemergt werden? (für die UI) */
export function canMerge(p: Player, slot: number): boolean {
  const s = p.weapons[slot];
  return !!s && s.tier < 5 && p.weapons.some((o, i) => i !== slot && o.waffe.id === s.waffe.id && o.tier === s.tier);
}

export interface FusionPreview {
  waffe: import('../../data/src/index.ts').Waffe | null;
  tier: number;
  price: number;
  error: string | null;
}

/** Was käme am Amboss heraus? (für Vorschau und Befehl) */
export function fusionPreview(w: World, p: Player, cmd: { slots: number[]; geschoss: number; antrieb: number; ladung: number }): FusionPreview {
  const price = p.perk.fusionsprofi ? 0 : AMBOSS.preis(w.wave);
  const slots = cmd.slots;
  if (new Set(slots).size !== slots.length || slots.some((i) => !p.weapons[i])) return { waffe: null, tier: 1, price, error: 'Wähle 2 oder 3 Waffen.' };
  const ids = slots.map((i) => p.weapons[i].waffe.id);
  const pick = (k: number) => ids[k] ?? ids[0];
  const wahl = { geschoss: pick(cmd.geschoss), antrieb: pick(cmd.antrieb), ladung: pick(cmd.ladung) };
  // Indizes müssen auf gewählte Waffen zeigen
  const idxOk = [cmd.geschoss, cmd.antrieb, cmd.ladung].every((k) => k >= 0 && k < ids.length);
  const used = new Set([cmd.geschoss, cmd.antrieb, cmd.ladung]);
  let error = pruefeFusion(ids, wahl);
  if (!error && (!idxOk || (used.size < ids.length && !findRecipeIds(ids)))) error = 'Jede Waffe muss mindestens ein Bauteil liefern.';
  if (error) return { waffe: null, tier: 1, price, error };
  const tier = Math.max(1, Math.min(5, Math.round(slots.reduce((s, i) => s + p.weapons[i].tier, 0) / slots.length)));
  return { waffe: fusionsWaffe(wahl, ids), tier, price, error: p.crystals < price ? 'Nicht genug Kristalle.' : null };
}

function findRecipeIds(ids: string[]): boolean {
  return fusionsWaffe({ geschoss: ids[0], antrieb: ids[1] ?? ids[0], ladung: ids[2] ?? ids[0] }, ids).fusion?.rezept !== undefined;
}
