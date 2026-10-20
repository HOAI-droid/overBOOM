import { World, DT, DASH_COOLDOWN, NO_INPUT, MetaTracker, ladeProfil, spawnEnemy, type Command, type InputState } from '@overboom/core';
import { BOSS_LORE, ELEMENT_INFO, ERFOLGE, GEGNER, GEGNER_BY_ID, HELD_BY_ID, INSELN, INSEL_BY_ID, INSEL_LORE, KARTE_BY_ID, LEVEL, SELTENHEIT, SYNERGIEN, WELLEN_SPRUECHE, waffeById, waehle } from '@overboom/data';
import { GameRenderer, type PlayerPose } from '@overboom/render';
import { Controls, DamageNumbers, Hud, MenuNav, Menus, screenToWorld } from '@overboom/ui';
import { createWebPlatform } from '@overboom/platform';

const root = document.getElementById('game')!;
const platform = createWebPlatform();
const params = new URLSearchParams(location.search);
const num = (key: string, def: number) => (params.has(key) && Number.isFinite(Number(params.get(key))) ? Number(params.get(key)) : def);
const internalShort = Math.max(144, Math.min(720, num('res', 270)));
const seed = num('seed', 1337) || 1337;

function fail(msg: string) {
  const d = document.createElement('div');
  d.className = 'ob-error';
  d.textContent = msg;
  document.body.appendChild(d);
}

async function start() {
  // Profil (Kartenalbum, Erfolge, befreite Inseln) laden – alte Rezeptliste übernehmen
  const profil = ladeProfil(await platform.storage.get('profil'));
  if (!profil.rezepte.length) {
    try { for (const id of JSON.parse((await platform.storage.get('rezepte')) ?? '[]')) if (typeof id === 'string') profil.rezepte.push(id); } catch { /* egal */ }
    for (const id of profil.rezepte) profil.karten['rezept:' + id] ??= 1;
    profil.stats.rezepte = profil.rezepte.length;
  }
  const meta = new MetaTracker(profil);
  // Debug: ?alles=1 schaltet alle Karten und Inseln frei
  if (params.get('alles') === '1') meta.allesFrei();
  let lastSave = 0;
  const save = (force = false) => {
    if (!meta.dirty) return;
    const now = performance.now();
    if (!force && now - lastSave < 3000) return;
    lastSave = now;
    meta.dirty = false;
    platform.storage.set('profil', JSON.stringify(meta.profil));
  };
  addEventListener('pagehide', () => save(true));

  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  // Debug: ?wave=10 (Startwelle), ?god=1 (unverwundbar), ?gems=500 (Startkristalle)
  const world = new World(seed, 1, { wave: Math.max(1, Math.floor(num('wave', 1))), god: params.get('god') === '1', choose: true });
  const startGems = Math.max(0, num('gems', 0));
  world.players[0].crystals = startGems;
  // Debug: ?held=pyromane&insel=lavakessel (Schnellstart), ?waffen=a,b,c (Waffen), ?galerie=1 (alle Gegner zum Anschauen)
  const debugWeapons = (params.get('waffen') ?? '').split(',').filter((id) => waffeById(id));
  const dbgHeld = params.get('held') ?? '', dbgInsel = params.get('insel') ?? '', galerie = params.get('galerie') === '1';
  const giveDebug = () => {
    if (!debugWeapons.length && !dbgHeld && !dbgInsel && !galerie) return;
    world.command(0, { type: 'start', held: HELD_BY_ID[dbgHeld] ? dbgHeld : 'kawummkid', insel: INSEL_BY_ID[dbgInsel] ? dbgInsel : 'bummburg' });
    if (debugWeapons.length || galerie) { world.players[0].weapons.length = 0; for (const id of debugWeapons) world.debugGive(0, id); }
    // Debug: ?beute=6 (Ausrüstung in den Beutel)
    for (let i = 0; i < Math.min(10, num('beute', 0)); i++) world.dropLoot(0, 0, i % 2 === 0);
    if (galerie) {
      world.spawnAcc = -1e9;
      world.waveTime = 1e9;
      for (const wr of world.warnings) wr.active = false;
      const p = world.players[0];
      GEGNER.forEach((g, i) => {
        const boss = g.verhalten === 'boss';
        const k = boss ? GEGNER.filter((q, j) => q.verhalten === 'boss' && j < i).length : GEGNER.filter((q, j) => q.verhalten !== 'boss' && j < i).length;
        const x = boss ? p.x - 4.5 + k * 3 : p.x - 4 + (k % 6) * 1.6, z = boss ? p.z - 4.5 - k * 0.0 + 8 : p.z - 3 + Math.floor(k / 6) * 1.8;
        const e = spawnEnemy(world, i, x, z);
        if (e) { e.hp = e.maxHp = 1e9; e.stun = 1e9; e.facing = Math.PI * 0.25; }
      });
    }
  };
  giveDebug();
  let renderer: GameRenderer;
  try {
    renderer = new GameRenderer(canvas, world, { internalShort, shadows: params.get('shadows') !== '0', shake: Math.max(0, Math.min(2, num('shake', 1))) });
  } catch (e) {
    fail('WebGL konnte nicht gestartet werden. Bitte einen aktuellen Browser verwenden.');
    throw e;
  }

  const touch = platform.isTouchDevice();
  const hud = new Hud(root, platform, () => `Seed ${seed}`);
  const damage = new DamageNumbers(root);
  damage.enabled = params.get('zahlen') !== '0';
  const controls = new Controls(root, hud.dashButton);
  // Entdeckte Rezepte (Rezeptbuch) kommen aus dem Profil
  let recipes = new Set(profil.rezepte);
  // Befehle aus Menüs: Ereignisse (Fusion, Merge …) sofort verarbeiten, sonst löscht sie der nächste Tick
  const send = (cmd: Command) => {
    world.events.length = 0;
    const ok = world.command(0, cmd);
    processEvents(performance.now());
    world.events.length = 0;
    return ok;
  };
  const menus = new Menus(root, world, send, touch, () => (recipes.size === meta.profil.rezepte.length ? recipes : (recipes = new Set(meta.profil.rezepte))));
  menus.profil = () => meta.profil;
  const nav = new MenuNav(menus.root);

  const resize = () => renderer.resize(root.clientWidth, root.clientHeight, devicePixelRatio || 1);
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 150));
  resize();

  const poses = () => world.players.map((p) => ({ x: p.x, z: p.z, facing: p.facing }));
  let prev: PlayerPose[] = poses();
  let acc = 0;
  let last = performance.now();
  let dashQueued = false;
  let moving = false;
  /** Hit-Stop: Simulation steht kurz still, Darstellung (Shake) läuft weiter */
  let freeze = 0;
  let endTimer = -1;
  let runs = 0;
  let paused = false;
  let lastBoomHaptic = 0;
  let padStartWas = false;
  let lastLoadout = -1;
  let lastPhase = '';
  let lastItems: object | null = null;
  let lastItemCount = -1;

  const restart = () => {
    world.reset();
    world.players[0].crystals = startGems;
    giveDebug();
    prev = poses();
    damage.clear();
    menus.hide();
    endTimer = -1;
    freeze = 0;
    acc = 0;
    paused = false;
    runs++;
    meta.neuerRun();
    save(true);
  };
  const pause = (on: boolean) => {
    if (on === paused) return;
    if (on && (menus.open || world.phase !== 'welle')) return;
    paused = on;
    if (on) menus.showPause(); else menus.hide();
  };
  menus.onRestart = restart;
  menus.onResume = () => { paused = false; };
  nav.onBack = () => { if (!menus.back() && paused) pause(false); };
  hud.pauseButton.addEventListener('click', () => pause(!paused));
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!menus.back()) pause(!paused);
    }
  });
  // Tab im Hintergrund → automatisch pausieren
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  root.addEventListener('pointerdown', () => platform.keepAwake(true), { once: true });

  const endStats = (victory: boolean) => {
    const p = world.players[0];
    const ws = Object.entries(world.stats.waffen).sort((a, b) => b[1] - a[1]);
    return {
      victory, wave: world.wave, level: p.level, kills: world.stats.kills, damage: world.stats.damage,
      maxChain: world.stats.maxChain, crystals: world.stats.crystals, mvp: ws[0]?.[0] ?? '', mvpDamage: ws[0]?.[1] ?? 0
    };
  };

  /** Ereignisse eines Ticks (oder Befehls) an Renderer, HUD, Haptik verteilen */
  function processEvents(now: number) {
    freeze = Math.max(freeze, renderer.handleEvents(world.events));
    for (const e of world.events) {
      switch (e.type) {
        case 'dash': platform.haptic(12); break;
        case 'bump': platform.haptic(25); break;
        case 'hit': damage.add(e.id, e.x, e.y, e.z, e.dmg, e.crit); break;
        case 'explosion':
          if (now - lastBoomHaptic > 120) { platform.haptic(e.r > 2 ? 30 : 15); lastBoomHaptic = now; }
          break;
        case 'chain': hud.chain(e.count); break;
        case 'hurt': hud.hurt(); platform.haptic(60); break;
        case 'dodge': damage.text(-e.player - 1, e.x, 1.2, e.z, 'Ausgewichen!', 'dodge'); break;
        case 'heal': damage.text(-e.player - 100, e.x, 1.1, e.z, `+${e.value}`, 'heal'); break;
        case 'levelUp': damage.text(-e.player - 200, e.x, 1.6, e.z, 'Level up!', 'lvl'); platform.haptic(30); break;
        case 'waveStart': {
          const bossId = e.wave >= 20 ? 'baron' : world.insel.boss;
          if (e.boss) hud.banner(`${GEGNER_BY_ID[bossId]?.name ?? 'Boss'}!`, BOSS_LORE[bossId]?.auftritt ?? '', 'rot');
          else if (e.wave === 1) hud.banner(world.insel.name, INSEL_LORE[world.insel.id]?.ankunft ?? 'Auf geht’s!', 'gelb');
          else hud.banner(`Welle ${e.wave}`, e.wave === 20 ? 'Die letzte!' : waehle(WELLEN_SPRUECHE, `${seed}:${runs}:${e.wave}`), 'gelb');
          break;
        }
        case 'bossPhase': {
          const bossId = world.wave >= 20 ? 'baron' : world.insel.boss;
          hud.banner('Jetzt wird’s ernst!', BOSS_LORE[bossId]?.wut ?? '', 'rot'); platform.haptic(120); break;
        }
        case 'waveClear': hud.banner('Welle geschafft!', 'Alles fliegt in die Luft', 'cyan'); platform.haptic(80); break;
        case 'victory': endTimer = 1.2; break;
        case 'fusion':
          if (e.rezept && !meta.profil.rezepte.includes(e.rezept)) {
            hud.banner('Rezept entdeckt!', e.name, 'gelb');
            platform.haptic(150);
          } else hud.banner('Verschmolzen!', e.name, e.rezept ? 'gelb' : 'cyan');
          break;
        case 'reaction': damage.text(-5000 - (e.x * 37 | 0) - (e.z * 11 | 0), e.x, 1.5, e.z, e.name, 'reaction', e.farbe); break;
        case 'star': damage.text(-7000 - e.slot, e.x, 1.9, e.z, `${'★'.repeat(e.stars)} ${e.weapon}`, 'lvl'); if (e.stars === 5) hud.banner('5 Sterne!', `${e.weapon} kann im Shop evolvieren`, 'gelb'); break;
        case 'evolve': hud.banner('Evolution!', e.weapon, 'gelb'); platform.haptic(120); break;
        case 'loot': if (e.player === 0) { damage.text(-8000 - (e.seltenheit), e.x, 1.6, e.z, `Beute: ${e.name}`, 'lvl', SELTENHEIT[e.seltenheit - 1].farbe); platform.haptic(40); } break;
        case 'nuke': damage.text(-6000, e.x, 1.8, e.z, 'MINI-NUKE!', 'kawumm', '#ffd23f'); platform.haptic(120); break;
        case 'kawumm': damage.text(-999 - (e.x * 100 | 0), e.x, 1.3, e.z, 'Kawumm!', 'kawumm'); break;
        case 'death': platform.haptic(200); endTimer = 1.6; break;
      }
    }
    meta.events(world, world.events);
    announce();
  }

  /** Neue Karten, Erfolge und Inseln melden */
  function announce() {
    for (const n of meta.neues) {
      if (n.art === 'karte' || n.art === 'glanz') {
        const k = KARTE_BY_ID[n.id];
        if (!k) continue;
        const farbe = k.elemente[0] ? ELEMENT_INFO[k.elemente[0]].farbe : SELTENHEIT[k.seltenheit - 1].farbe;
        hud.toast(n.art === 'glanz' ? 'Glanzkarte!' : 'Neue Karte', k.name, farbe, n.art === 'glanz');
      } else if (n.art === 'erfolg') {
        const e = ERFOLGE.find((x) => x.id === n.id);
        if (e) hud.toast('Erfolg', e.name, '#3de8ff', true);
      } else if (n.art === 'insel') {
        const i = INSELN.findIndex((x) => x.id === n.id);
        hud.banner(`${INSELN[i].name} befreit!`, INSEL_LORE[n.id]?.befreit ?? '', 'cyan');
        if (INSELN[i + 1]) hud.toast('Neue Insel', INSELN[i + 1].name, '#3de8ff');
        platform.haptic(150);
      }
    }
    meta.neues.length = 0;
    save();
  }

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const si = controls.poll();
    nav.update(dt);
    // Gamepad-Start = Pause
    const pads = navigator.getGamepads?.() ?? [];
    const startBtn = !!pads.find((p) => p)?.buttons[9]?.pressed;
    if (startBtn && !padStartWas) pause(!paused);
    padStartWas = startBtn;

    const inMenu = menus.open || paused;
    if (si.dash && !inMenu) dashQueued = true;
    if (!moving && (Math.abs(si.x) + Math.abs(si.y) > 0.1 || si.dash)) { moving = true; hud.moved(); }

    if (!paused) {
      if (freeze > 0) freeze -= dt;
      else acc += dt;
    }

    // Fester Simulations-Tick (30 Hz), Darstellung interpoliert dazwischen
    let steps = 0;
    while (!paused && acc >= DT && steps < 5 && freeze <= 0) {
      prev = poses();
      const w = screenToWorld(si.x, si.y);
      const input: InputState = world.phase === 'welle' && !inMenu ? { mx: w.mx, mz: w.mz, dash: dashQueued } : NO_INPUT;
      dashQueued = false;
      world.step([input]);
      processEvents(now);
      acc -= DT;
      steps++;
    }
    if (steps === 5) acc = 0;

    if (endTimer > 0) {
      endTimer -= dt;
      if (endTimer <= 0) {
        meta.runEnde(world, world.phase === 'sieg');
        announce();
        save(true);
        menus.showEnd(endStats(world.phase === 'sieg'), seed + runs);
      }
    }
    if (!paused && menus.current !== 'end') menus.sync();

    const frozen = freeze > 0 || paused;
    const mapState = menus.mapState();
    if (mapState) {
      renderer.renderMap(mapState, dt, now / 1000);
      menus.updateMapLabels((id, out) => renderer.mapAnchor(id, out));
    } else renderer.render(prev, world.players, Math.min(1, acc / DT), frozen ? dt * 0.08 : dt, now / 1000);
    damage.update(frozen ? 0 : dt, (x, y, z, out) => renderer.project(x, y, z, out));
    const p = world.players[0];
    const boss = world.boss >= 0 ? world.enemies[world.boss] : null;
    const { w, h } = renderer.internalSize;
    hud.update(dt, {
      dashReady: 1 - p.dashCooldown / DASH_COOLDOWN,
      info: `${w}×${h} · ${world.enemyCount} Gegner`,
      hp: p.hp, maxHp: p.maxHp, crystals: p.crystals,
      wave: world.wave, waveTime: world.waveTime, phase: world.phase,
      level: p.level, xp: p.xp / LEVEL.xpBedarf(p.level),
      boss: boss && boss.alive ? Math.max(0, boss.hp / boss.maxHp) : -1
    });
    if (world.phase !== lastPhase || p.loadout !== lastLoadout || p.items !== lastItems || Object.keys(p.items).length !== lastItemCount) {
      lastPhase = world.phase;
      lastItems = p.items;
      lastItemCount = Object.keys(p.items).length;
      meta.sync(world);
      announce();
    }
    if (p.loadout !== lastLoadout) {
      lastLoadout = p.loadout;
      hud.synergies(SYNERGIEN.map((sy) => {
        const count = p.synCount[sy.element] ?? 0;
        return { element: sy.element, count, level: sy.stufen.filter((st) => count >= st.ab).length, farbe: sy.farbe };
      }));
    }
    root.classList.toggle('in-menu', menus.open);
    root.classList.toggle('on-map', !!mapState);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start();
