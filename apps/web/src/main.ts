import { World, DT, DASH_COOLDOWN, type InputState } from '@overboom/core';
import { GameRenderer, type PlayerPose } from '@overboom/render';
import { Controls, DamageNumbers, Hud, screenToWorld } from '@overboom/ui';
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

function start() {
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  // Debug: ?wave=5 (Startwelle), ?god=1 (unverwundbar)
  const world = new World(seed, 1, { wave: Math.max(1, Math.floor(num('wave', 1))), god: params.get('god') === '1' });
  let renderer: GameRenderer;
  try {
    renderer = new GameRenderer(canvas, world, { internalShort, shadows: params.get('shadows') !== '0', shake: Math.max(0, Math.min(2, num('shake', 1))) });
  } catch (e) {
    fail('WebGL konnte nicht gestartet werden. Bitte einen aktuellen Browser verwenden.');
    throw e;
  }

  const hud = new Hud(root, platform, () => `Seed ${seed}`);
  const damage = new DamageNumbers(root);
  damage.enabled = params.get('zahlen') !== '0';
  const controls = new Controls(root, hud.dashButton);

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
  let overTimer = -1;
  let runs = 0;
  let lastBoomHaptic = 0;

  const restart = () => {
    world.reset();
    prev = poses();
    damage.clear();
    hud.hideGameOver();
    overTimer = -1;
    freeze = 0;
    acc = 0;
    runs++;
    hud.banner(`Welle ${world.wave}`, 'Auf geht’s!', 'gelb');
  };
  hud.onRestart = restart;
  addEventListener('keydown', (e) => {
    if (hud.gameOverVisible && (e.code === 'Enter' || e.code === 'KeyR')) restart();
  });

  root.addEventListener('pointerdown', () => platform.keepAwake(true), { once: true });
  hud.banner(`Welle ${world.wave}`, 'Auf geht’s!', 'gelb');

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const si = controls.poll();
    if (si.dash) {
      if (hud.gameOverVisible) restart();
      else dashQueued = true;
    }
    if (!moving && (Math.abs(si.x) + Math.abs(si.y) > 0.1 || si.dash)) { moving = true; hud.moved(); }

    if (freeze > 0) freeze -= dt;
    else acc += dt;

    // Fester Simulations-Tick (30 Hz), Darstellung interpoliert dazwischen
    let steps = 0;
    while (acc >= DT && steps < 5 && freeze <= 0) {
      prev = poses();
      const w = screenToWorld(si.x, si.y);
      const input: InputState = { mx: w.mx, mz: w.mz, dash: dashQueued };
      dashQueued = false;
      world.step([input]);
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
          case 'waveStart': hud.banner(`Welle ${e.wave}`, e.wave === 1 ? 'Auf geht’s!' : 'Sie kommen wieder!', 'gelb'); break;
          case 'waveClear': hud.banner('Welle geschafft!', 'Alles fliegt in die Luft', 'cyan'); platform.haptic(80); break;
          case 'death': platform.haptic(200); overTimer = 1.6; break;
        }
      }
      acc -= DT;
      steps++;
    }
    if (steps === 5) acc = 0;

    if (overTimer > 0) {
      overTimer -= dt;
      if (overTimer <= 0) hud.showGameOver({ wave: world.wave, ...world.stats }, seed + runs);
    }

    const frozen = freeze > 0;
    renderer.render(prev, world.players, Math.min(1, acc / DT), frozen ? dt * 0.08 : dt, now / 1000);
    damage.update(frozen ? 0 : dt, (x, y, z, out) => renderer.project(x, y, z, out));
    const p = world.players[0];
    const { w, h } = renderer.internalSize;
    hud.update(dt, {
      dashReady: 1 - p.dashCooldown / DASH_COOLDOWN,
      info: `${w}×${h} · ${world.enemyCount} Gegner`,
      hp: p.hp, maxHp: p.maxHp, crystals: p.crystals,
      wave: world.wave, waveTime: world.waveTime, phase: world.phase
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start();
