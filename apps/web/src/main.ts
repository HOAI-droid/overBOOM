import { World, DT, DASH_COOLDOWN, type InputState } from '@overboom/core';
import { GameRenderer, type PlayerPose } from '@overboom/render';
import { Controls, Hud, screenToWorld } from '@overboom/ui';
import { createWebPlatform } from '@overboom/platform';

const root = document.getElementById('game')!;
const platform = createWebPlatform();
const params = new URLSearchParams(location.search);
const internalShort = Math.max(144, Math.min(720, Number(params.get('res')) || 270));
const seed = Number(params.get('seed')) || 1337;

function fail(msg: string) {
  const d = document.createElement('div');
  d.className = 'ob-error';
  d.textContent = msg;
  document.body.appendChild(d);
}

function start() {
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  const world = new World(seed, 1);
  let renderer: GameRenderer;
  try {
    renderer = new GameRenderer(canvas, world, { internalShort, shadows: params.get('shadows') !== '0' });
  } catch (e) {
    fail('WebGL konnte nicht gestartet werden. Bitte einen aktuellen Browser verwenden.');
    throw e;
  }

  const hud = new Hud(root, platform, () => `Seed ${seed}`);
  const controls = new Controls(root, hud.dashButton);

  const resize = () => renderer.resize(root.clientWidth, root.clientHeight, devicePixelRatio || 1);
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 150));
  resize();

  let prev: PlayerPose[] = world.players.map((p) => ({ x: p.x, z: p.z, facing: p.facing }));
  let acc = 0;
  let last = performance.now();
  let dashQueued = false;
  let moving = false;

  root.addEventListener('pointerdown', () => platform.keepAwake(true), { once: true });

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;

    const si = controls.poll();
    if (si.dash) dashQueued = true;
    if (!moving && (Math.abs(si.x) + Math.abs(si.y) > 0.1 || si.dash)) { moving = true; hud.moved(); }

    // Fester Simulations-Tick (30 Hz), Darstellung interpoliert dazwischen
    let steps = 0;
    while (acc >= DT && steps < 5) {
      prev = world.players.map((p) => ({ x: p.x, z: p.z, facing: p.facing }));
      const w = screenToWorld(si.x, si.y);
      const input: InputState = { mx: w.mx, mz: w.mz, dash: dashQueued };
      dashQueued = false;
      world.step([input]);
      renderer.handleEvents(world.events);
      for (const e of world.events) {
        if (e.type === 'dash') platform.haptic(12);
        if (e.type === 'bump') platform.haptic(25);
      }
      acc -= DT;
      steps++;
    }
    if (steps === 5) acc = 0;

    renderer.render(prev, world.players, acc / DT, dt, now / 1000);
    const p = world.players[0];
    const { w, h } = renderer.internalSize;
    hud.update(dt, 1 - p.dashCooldown / DASH_COOLDOWN, `${w}×${h}`);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start();
