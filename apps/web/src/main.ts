import { World, DT, DASH_COOLDOWN, NO_INPUT, MetaTracker, heldenFrei, inselFrei, ladeProfil, profilAusCode, profilCode, spawnEnemy, type Command, type InputState, type SimEvent } from '@overboom/core';
import { BOSS_LORE, ELEMENT_INFO, ERFOLGE, GEGNER, GEGNER_BY_ID, HELD_BY_ID, INSELN, INSEL_BY_ID, INSEL_LORE, KARTE_BY_ID, LEVEL, SELTENHEIT, SYNERGIEN, WELLEN_SPRUECHE, waffeById, waehle } from '@overboom/data';
import { CardArt, GameRenderer, type PlayerPose } from '@overboom/render';
import { Controls, DamageNumbers, Hud, MenuNav, Menus, NameTags, karteAlsBild, screenToWorld, type CoopAktion, type CoopAnsicht } from '@overboom/ui';
import { ClientSession, HostSession, LocalTransport, createTrysteroTransport, makeRoomCode, normalizeRoomCode, type LobbySpieler, type Transport } from '@overboom/net';
import { createWebPlatform } from '@overboom/platform';

const root = document.getElementById('game')!;
const platform = createWebPlatform();
const params = new URLSearchParams(location.search);
const num = (key: string, def: number) => (params.has(key) && Number.isFinite(Number(params.get(key))) ? Number(params.get(key)) : def);
const internalShort = Math.max(144, Math.min(720, num('res', 270)));
const seed = num('seed', 1337) || 1337;
/** ?netz=lokal: Koop zwischen Tabs desselben Browsers (Test/Entwicklung) statt WebRTC */
const lokalNetz = params.get('netz') === 'lokal';

function fail(msg: string) {
  const d = document.createElement('div');
  d.className = 'ob-error';
  d.textContent = msg;
  document.body.appendChild(d);
}

/** TURN-Zugang kommt aus der Build-Umgebung (siehe README) */
function turnConfig() {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const urls = env.VITE_TURN_URLS?.split(',').map((u) => u.trim()).filter(Boolean);
  return urls?.length ? [{ urls, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS }] : undefined;
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

  // Koop-Kennung (zum Wiederverbinden) und Name
  let token = (await platform.storage.get('koop-token')) ?? '';
  if (!token) { token = platform.randomId(); platform.storage.set('koop-token', token); }
  if (lokalNetz) token += '-' + platform.randomId();
  let spielerName = (await platform.storage.get('name')) ?? '';

  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  // Debug: ?wave=10 (Startwelle), ?god=1 (unverwundbar), ?gems=500 (Startkristalle)
  const soloWorld = new World(seed, 1, { wave: Math.max(1, Math.floor(num('wave', 1))), god: params.get('god') === '1', choose: true });
  let world = soloWorld;
  const startGems = Math.max(0, num('gems', 0));
  world.players[0].crystals = startGems;
  // Debug: ?held=pyromane&insel=lavakessel (Schnellstart), ?waffen=a,b,c (Waffen), ?galerie=1 (alle Gegner zum Anschauen)
  const debugWeapons = (params.get('waffen') ?? '').split(',').filter((id) => waffeById(id));
  const dbgHeld = params.get('held') ?? '', dbgInsel = params.get('insel') ?? '', galerie = params.get('galerie') === '1';
  const giveDebug = (): boolean => {
    if (!debugWeapons.length && !dbgHeld && !dbgInsel && !galerie) return false;
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
    return true;
  };
  const debugStart = giveDebug();
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
  const tags = new NameTags(root);
  const controls = new Controls(root, hud.dashButton);

  /* ---------------- Sitzung: Solo, Host oder Client ---------------- */
  let modus: 'solo' | 'host' | 'client' = 'solo';
  let host: HostSession | null = null;
  let client: ClientSession | null = null;
  let me = 0;
  const netEvents: SimEvent[] = [];
  let coop: CoopAnsicht | null = null;
  let meinHeld = 'kawummkid', meinBereit = false;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let peerTimer: ReturnType<typeof setInterval> | null = null;

  // Entdeckte Rezepte (Rezeptbuch) kommen aus dem Profil
  let recipes = new Set(profil.rezepte);
  // Befehle aus Menüs: Ereignisse (Fusion, Merge …) sofort verarbeiten, sonst löscht sie der nächste Tick
  const send = (cmd: Command) => {
    if (modus === 'client') { client?.command(cmd); return true; }
    if (modus === 'host' && host) {
      const r = host.command(me, cmd);
      processEvents(r.events, performance.now());
      return r.ok;
    }
    world.events.length = 0;
    const ok = world.command(0, cmd);
    processEvents(world.events, performance.now());
    world.events.length = 0;
    return ok;
  };
  const menus = new Menus(root, world, send, touch, () => (recipes.size === meta.profil.rezepte.length ? recipes : (recipes = new Set(meta.profil.rezepte))));
  menus.profil = () => meta.profil;
  menus.heldenFrei = () => heldenFrei(meta.profil);
  menus.name = spielerName;
  menus.codeVorgabe = normalizeRoomCode(params.get('raum') ?? '');
  if (debugStart) menus.screen = 'solo';
  // Kartenalbum: Artworks in eigenem kleinen WebGL-Kontext (erst beim ersten Öffnen)
  let kunst: CardArt | null = null;
  Object.defineProperty(menus, 'kunst', { get: () => (kunst ??= new CardArt(96)) });
  menus.gesehen = (id) => { meta.gesehen(id); save(); };
  menus.profilCode = () => profilCode(meta.profil);
  menus.kopieren = (text) => { platform.copyText(text).then((ok) => hud.toast(ok ? 'Kopiert' : 'Kopieren ging nicht', ok ? 'Spielstand-Code' : 'Bitte von Hand markieren', ok ? '#3de8ff' : '#ff3d6a')); };
  menus.importCode = (code) => {
    const p = profilAusCode(code);
    if (!p) return false;
    meta.profil = p;
    meta.dirty = true;
    save(true);
    hud.toast('Spielstand geladen', `${Object.keys(p.karten).length} Karten`, '#3de8ff');
    return true;
  };
  menus.exportBild = (k, glanz) => {
    const art = (kunst ??= new CardArt(96)).thumb(k, false);
    karteAlsBild(k, art, glanz).then((blob) => platform.saveImage(blob, `overboom-${String(k.nr).padStart(3, '0')}-${k.ref}.png`)).catch(() => hud.toast('Fehler', 'Bild konnte nicht erstellt werden', '#ff3d6a'));
  };
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
  /** Hit-Stop: Simulation steht kurz still, Darstellung (Shake) läuft weiter – nur solo */
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
  const prevSelf: PlayerPose = { x: 0, z: 0, facing: 0 };

  /** andere Welt anzeigen (Koop-Start, Rückkehr zu Solo) */
  const useWorld = (w: World, slot: number) => {
    world = w;
    me = slot;
    renderer.setWorld(w);
    renderer.local = slot;
    menus.world = w;
    menus.me = slot;
    meta.setSpieler(slot);
    prev = poses();
    damage.clear();
    lastLoadout = -1; lastPhase = '';
    endTimer = -1; freeze = 0; acc = 0; paused = false;
  };

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
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (!menus.back()) pause(!paused);
    }
  });
  // Tab im Hintergrund → automatisch pausieren (nur solo – im Koop läuft die Welt weiter)
  document.addEventListener('visibilitychange', () => { if (document.hidden && modus === 'solo') pause(true); });

  root.addEventListener('pointerdown', () => platform.keepAwake(true), { once: true });

  /* ---------------- Koop: Lobby und Verbindung ---------------- */

  const link = (code: string) => `${location.origin}${location.pathname}?raum=${code}${lokalNetz ? '&netz=lokal' : ''}`;

  const updateCoop = (patch: Partial<CoopAnsicht> = {}) => {
    if (!coop) return;
    Object.assign(coop, patch);
    if (host) { coop.spieler = host.lobbyList(); coop.insel = host.insel; }
    coop.inselnFrei = INSELN.filter((i) => inselFrei(meta.profil, i.id)).map((i) => i.id);
    coop.heldenFrei = heldenFrei(meta.profil);
    menus.coop = { ...coop, spieler: coop.spieler.map((s) => ({ ...s })) };
  };

  const makeTransport = async (code: string): Promise<Transport> =>
    lokalNetz ? new LocalTransport(code, platform.randomId()) : createTrysteroTransport(code, { appId: 'overboom-koop-v1', turn: turnConfig() });

  const leaveCoop = async (grund = '') => {
    if (connectTimer) clearTimeout(connectTimer);
    if (peerTimer) clearInterval(peerTimer);
    connectTimer = peerTimer = null;
    const h = host, c = client;
    host = null; client = null; coop = null; menus.coop = null; menus.koop = null;
    modus = 'solo';
    try { if (h) await h.leave(); if (c) await c.leave(); } catch { /* egal */ }
    soloWorld.reset();
    soloWorld.players[0].crystals = startGems;
    useWorld(soloWorld, 0);
    menus.hide();
    menus.screen = 'titel';
    tags.update([], 0, () => {}, 0, 0);
    if (grund) hud.toast('Koop beendet', grund, '#ff3d6a');
  };

  const startGameView = (w: World, slot: number, rolle: 'host' | 'client') => {
    useWorld(w, slot);
    menus.koop = rolle;
    menus.screen = 'spiel';
    menus.hide();
    runs++;
    meta.neuerRun();
  };

  const nameMerken = (name: string) => {
    spielerName = name || spielerName || `Jäger ${platform.randomId().slice(0, 3).toUpperCase()}`;
    menus.name = spielerName;
    platform.storage.set('name', spielerName);
  };

  menus.onCoop = async (a: CoopAktion | { t: 'lobby' }) => {
    switch (a.t) {
      case 'erstellen': {
        nameMerken(a.name);
        const code = makeRoomCode(() => Math.random());
        const t = await makeTransport(code);
        modus = 'host';
        meinHeld = heldenFrei(meta.profil).includes(meinHeld) ? meinHeld : 'kawummkid';
        host = new HostSession(t, spielerName, token, {
          lobby: () => updateCoop(),
          events: (ev) => processEvents(ev, performance.now()),
          info: (text) => hud.toast('Koop', text, '#ffd23f')
        });
        const ersteFreie = INSELN.filter((i) => inselFrei(meta.profil, i.id));
        host.pick(meinHeld, (ersteFreie.find((i) => !meta.profil.befreit.includes(i.id)) ?? ersteFreie[0] ?? INSELN[0]).id);
        coop = { rolle: 'host', code, link: link(code), spieler: host.lobbyList(), slot: 0, insel: host.insel, status: 'Teile den Code oder Link – bis zu 3 Freunde können beitreten.', fehler: false, inselnFrei: [], heldenFrei: [] };
        updateCoop();
        menus.screen = 'lobby';
        menus.hide();
        peerTimer = setInterval(() => { void host?.refreshPeers(); }, 2000);
        return;
      }
      case 'beitreten': {
        nameMerken(a.name);
        const code = normalizeRoomCode(a.code);
        if (code.length !== 6) { hud.toast('Raumcode?', 'Der Code hat 6 Zeichen.', '#ff3d6a'); return; }
        const t = await makeTransport(code);
        modus = 'client';
        coop = { rolle: 'client', code, link: link(code), spieler: [], slot: -1, insel: '', status: `Suche Raum ${code} …`, fehler: false, inselnFrei: [], heldenFrei: [] };
        client = new ClientSession(t, spielerName, token, {
          welcome: (slot) => {
            if (connectTimer) clearTimeout(connectTimer);
            meinHeld = heldenFrei(meta.profil).includes(meinHeld) ? meinHeld : 'kawummkid';
            client?.pick(meinHeld, meinBereit);
            updateCoop({ slot, status: '', fehler: false });
          },
          reject: (grund) => updateCoop({ status: grund, fehler: true }),
          lobby: (spieler: LobbySpieler[], insel: string) => updateCoop({ spieler, insel }),
          start: (w) => startGameView(w, client?.slot ?? 1, 'client'),
          lobbyzurueck: () => { meinBereit = false; client?.pick(meinHeld, false); menus.koop = null; menus.screen = 'lobby'; menus.hide(); updateCoop(); },
          bye: (grund) => { void leaveCoop(grund); }
        });
        client.startHello();
        connectTimer = setTimeout(() => {
          if (client && client.slot < 0) updateCoop({ status: 'Keine Verbindung zum Raum. Stimmt der Code? Manche Netze (Mobilfunk, Firmen-WLAN) blockieren direkte Verbindungen – dann braucht es einen TURN-Relay.', fehler: true });
        }, 15000);
        updateCoop();
        menus.screen = 'lobby';
        menus.hide();
        return;
      }
      case 'held':
        meinHeld = a.id;
        if (host) host.pick(a.id); else client?.pick(a.id, meinBereit);
        updateCoop();
        return;
      case 'bereit':
        meinBereit = a.on;
        client?.pick(meinHeld, a.on);
        return;
      case 'insel': if (host) { host.pick(meinHeld, a.id); updateCoop(); } return;
      case 'start': {
        if (!host) return;
        const w = host.start((Math.random() * 1e9) | 0);
        startGameView(w, 0, 'host');
        processEvents(w.events, performance.now());
        return;
      }
      case 'teilen': {
        if (!coop) return;
        const r = await platform.shareLink('OVERBOOM – spiel mit!', coop.link);
        if (r === 'kopiert') hud.toast('Link kopiert', coop.code, '#3de8ff');
        return;
      }
      case 'lobby': if (host) { host.backToLobby(); menus.koop = null; menus.screen = 'lobby'; menus.hide(); updateCoop(); } return;
      case 'verlassen': await leaveCoop(); return;
      case 'solo': return;
    }
  };

  // Einladungslink ?raum=CODE: gleich beitreten
  if (menus.codeVorgabe.length === 6 && !debugStart) {
    void menus.onCoop({ t: 'beitreten', code: menus.codeVorgabe, name: spielerName });
  }

  const endStats = (victory: boolean) => {
    const p = world.players[me];
    const ws = Object.entries(world.stats.waffen).sort((a, b) => b[1] - a[1]);
    return {
      victory, wave: world.wave, level: p.level, kills: world.stats.kills, damage: world.stats.damage,
      maxChain: world.stats.maxChain, crystals: world.stats.crystals, mvp: ws[0]?.[0] ?? '', mvpDamage: ws[0]?.[1] ?? 0
    };
  };

  /** Ereignisse eines Ticks (oder Befehls) an Renderer, HUD, Haptik verteilen */
  function processEvents(events: readonly SimEvent[], now: number) {
    const stop = renderer.handleEvents(events);
    if (modus === 'solo') freeze = Math.max(freeze, stop);
    for (const e of events) {
      switch (e.type) {
        case 'dash': if (e.player === me) platform.haptic(12); break;
        case 'bump': if (e.player === me) platform.haptic(25); break;
        case 'hit': damage.add(e.id, e.x, e.y, e.z, e.dmg, e.crit); break;
        case 'explosion':
          if (now - lastBoomHaptic > 120) { platform.haptic(e.r > 2 ? 30 : 15); lastBoomHaptic = now; }
          break;
        case 'chain': hud.chain(e.count); break;
        case 'hurt': if (e.player === me) { hud.hurt(); platform.haptic(60); } break;
        case 'dodge': damage.text(-e.player - 1, e.x, 1.2, e.z, 'Ausgewichen!', 'dodge'); break;
        case 'heal': damage.text(-e.player - 100, e.x, 1.1, e.z, `+${e.value}`, 'heal'); break;
        case 'levelUp': damage.text(-e.player - 200, e.x, 1.6, e.z, 'Level up!', 'lvl'); if (e.player === me) platform.haptic(30); break;
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
          if (e.player !== me) break;
          if (e.rezept && !meta.profil.rezepte.includes(e.rezept)) {
            hud.banner('Rezept entdeckt!', e.name, 'gelb');
            platform.haptic(150);
          } else hud.banner('Verschmolzen!', e.name, e.rezept ? 'gelb' : 'cyan');
          break;
        case 'reaction': damage.text(-5000 - (e.x * 37 | 0) - (e.z * 11 | 0), e.x, 1.5, e.z, e.name, 'reaction', e.farbe); break;
        case 'star': if (e.player === me) { damage.text(-7000 - e.slot, e.x, 1.9, e.z, `${'★'.repeat(e.stars)} ${e.weapon}`, 'lvl'); if (e.stars === 5) hud.banner('5 Sterne!', `${e.weapon} kann im Shop evolvieren`, 'gelb'); } break;
        case 'evolve': if (e.player === me) { hud.banner('Evolution!', e.weapon, 'gelb'); platform.haptic(120); } break;
        case 'loot': if (e.player === me) { damage.text(-8000 - (e.seltenheit), e.x, 1.6, e.z, `Beute: ${e.name}`, 'lvl', SELTENHEIT[e.seltenheit - 1].farbe); platform.haptic(40); } break;
        case 'nuke': damage.text(-6000, e.x, 1.8, e.z, 'MINI-NUKE!', 'kawumm', '#ffd23f'); platform.haptic(120); break;
        case 'kawumm': damage.text(-999 - (e.x * 100 | 0), e.x, 1.3, e.z, 'Kawumm!', 'kawumm'); break;
        case 'downed':
          if (e.player === me) { hud.banner('Am Boden!', 'Ein Mitspieler kann dich wiederbeleben', 'rot'); platform.haptic(200); }
          else hud.toast('Hilfe!', `${world.players[e.player]?.name ?? 'Jemand'} ist am Boden`, '#ff3d6a');
          break;
        case 'revive':
          if (e.player === me) hud.banner('Wieder da!', e.by >= 0 ? `${world.players[e.by]?.name ?? ''} hat dich gerettet` : '', 'cyan');
          else if (e.by === me) hud.toast('Gerettet!', world.players[e.player]?.name ?? '', '#7dff5a');
          break;
        case 'death': platform.haptic(200); endTimer = 1.6; break;
      }
    }
    meta.events(world, events);
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

  // Host im Hintergrund (Tab gewechselt, App kurz weg): Browser drosseln requestAnimationFrame,
  // ein Worker-Takt hält die Simulation für die Mitspieler am Laufen
  let bgLast = 0;
  try {
    const src = 'setInterval(() => postMessage(0), 33);';
    const ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    ticker.onmessage = () => {
      if (!document.hidden || modus !== 'host' || !host?.world) { bgLast = 0; return; }
      const now = performance.now();
      if (!bgLast) bgLast = now;
      let n = 0;
      while (now - bgLast >= DT * 1000 && n < 5) {
        host.tick(NO_INPUT);
        world.events.length = 0;
        bgLast += DT * 1000;
        n++;
      }
      if (n === 5) bgLast = now;
    };
  } catch { /* ohne Worker: Host pausiert im Hintergrund */ }

  // ?test=1: Zustand für automatische Browser-Tests lesbar machen
  if (params.get('test') === '1') {
    (globalThis as Record<string, unknown>).__overboom = { get world() { return world; }, get me() { return me; }, get modus() { return modus; } };
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

    // Im Koop hält Pause die Welt nicht an
    const halt = paused && modus === 'solo';
    if (!halt) {
      if (freeze > 0) freeze -= dt;
      else acc += dt;
    }

    // Fester Simulations-Tick (30 Hz), Darstellung interpoliert dazwischen
    let steps = 0;
    while (!halt && acc >= DT && steps < 5 && freeze <= 0) {
      prev = poses();
      const w = screenToWorld(si.x, si.y);
      const input: InputState = world.phase === 'welle' && !inMenu ? { mx: w.mx, mz: w.mz, dash: dashQueued } : NO_INPUT;
      dashQueued = false;
      if (modus === 'host' && host?.world) {
        host.tick(input);
        processEvents(world.events, now);
      } else if (modus === 'client' && client?.world) {
        world.events.length = 0;
        const self = world.players[me];
        if (self) { prevSelf.x = self.x; prevSelf.z = self.z; prevSelf.facing = self.facing; }
        client.input(input);
        processEvents(world.events, now);
        world.events.length = 0;
      } else if (modus === 'solo') {
        world.step([input]);
        processEvents(world.events, now);
      }
      acc -= DT;
      steps++;
    }
    if (steps === 5) acc = 0;
    // Client: Welt aus den Snapshots einsetzen (100 ms verzögert, interpoliert)
    if (modus === 'client' && client?.world) {
      client.update(netEvents);
      if (netEvents.length) processEvents(netEvents, now);
    }

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
    menus.frame(now / 1000);

    const frozen = freeze > 0 || halt;
    const mapState = menus.mapState();
    // Client: Positionen kommen fertig interpoliert → alpha = 1
    // (eigene Figur: vorhergesagt, zwischen den Ticks interpoliert)
    const alpha = Math.min(1, acc / DT);
    if (modus === 'client') { prev = poses(); if (prev[me]) prev[me] = prevSelf; }
    if (mapState) {
      renderer.renderMap(mapState, dt, now / 1000);
      menus.updateMapLabels((id, out) => renderer.mapAnchor(id, out));
    } else renderer.render(prev, world.players, alpha, frozen ? dt * 0.08 : dt, now / 1000);
    const project = (x: number, y: number, z: number, out: { x: number; y: number }) => renderer.project(x, y, z, out);
    damage.update(frozen ? 0 : dt, project);
    tags.update(menus.screen === 'spiel' ? world.players : [], me, project, root.clientWidth, root.clientHeight);
    const p = world.players[me] ?? world.players[0];
    const boss = world.boss >= 0 ? world.enemies[world.boss] : null;
    const { w, h } = renderer.internalSize;
    hud.update(dt, {
      dashReady: 1 - p.dashCooldown / DASH_COOLDOWN,
      info: `${w}×${h} · ${world.enemyCount} Gegner${modus === 'client' && client ? ` · ${(client.bytes / 1024).toFixed(1)} KB` : ''}`,
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
    root.classList.toggle('on-title', menus.screen === 'titel' || menus.screen === 'lobby');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start();
