import { NO_INPUT, DT, World, type SimEvent } from '../../core/src/index.ts';
import { MemoryHub, HostSession, ClientSession, encodeSnapshot, decodeSnapshot, SNAPSHOT_MAX, normalizeRoomCode, makeRoomCode, type LobbySpieler } from '../src/index.ts';

let fails = 0;
function ok(cond: boolean, msg: string): void {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fails++;
}

console.log('\n— Netz: Koop über Speicher-Transport —');

// Raumcodes
{
  let s = 7;
  const code = makeRoomCode(() => ((s = (s * 16807) % 2147483647) / 2147483647));
  ok(/^[A-HJ-NP-Z2-9]{6}$/.test(code), `Raumcode ${code}: 6 Zeichen ohne 0/O/1/I`);
  ok(normalizeRoomCode(' ab-c d2e9 ') === 'ABCD2E', 'Eingabe wird gesäubert (Großbuchstaben, nur gültige Zeichen)');
}

const hub = new MemoryHub();
let now = 0;
const clock = () => now;
const lobbyLog: LobbySpieler[][] = [];
const host = new HostSession(hub.join('ROOM42'), 'Hosti', 'tok-host', { lobby: (l) => lobbyLog.push(l) }, clock);
let started = 0, welcomed = -1, rejected = '';
const t1 = hub.join('ROOM42');
const client = new ClientSession(t1, 'Gasti', 'tok-gast', { welcome: (s) => { welcomed = s; }, start: () => started++, reject: (g) => { rejected = g; } }, clock);
client.hello();
hub.flush();
ok(welcomed === 1 && host.slots.length === 2 && host.slots[1].name === 'Gasti', 'Client tritt bei und bekommt Platz 2');
client.pick('pyromane', true);
host.pick('bauerbruno', 'gackerfeld');
hub.flush();
ok(host.slots[1].held === 'pyromane' && host.slots[1].bereit, 'Heldenwahl des Clients kommt beim Host an');
ok(lobbyLog.length > 0 && lobbyLog[lobbyLog.length - 1].length === 2, 'Lobby-Liste mit 2 Spielern');

// Spiel starten
const w = host.start(4242);
(w.opt as { god: boolean }).god = true;
hub.flush();
ok(started === 1 && !!client.world && client.world.players.length === 2 && client.world.insel.id === 'gackerfeld', 'Client baut Spiegelwelt (2 Spieler, Gackerfeld)');
ok(w.players[0].held === 'bauerbruno' && w.players[1].held === 'pyromane' && w.phase === 'welle', 'Host: beide Helden gesetzt, Welle läuft');

// 12 Sekunden spielen: Client läuft nach rechts
const evs: SimEvent[] = [];
const seen: Record<string, number> = {};
let maxBytes = 0, maxErr = 0;
for (let i = 0; i < 30 * 12; i++) {
  now += DT * 1000;
  client.input({ mx: i < 30 * 6 ? 1 : -1, mz: 0, dash: i === 40 });
  hub.flush();
  host.tick(NO_INPUT);
  hub.flush();
  client.update(evs);
  for (const e of evs) seen[e.type] = (seen[e.type] ?? 0) + 1;
  maxBytes = Math.max(maxBytes, client.bytes);
  if (i > 30) {
    const cp = client.world!.players[1], hp = w.players[1];
    maxErr = Math.max(maxErr, Math.hypot(cp.x - hp.x, cp.z - hp.z));
  }
}
const cw = client.world!;
ok((seen.waveStart ?? 0) + (seen.spawn ?? 0) > 0 && (seen.fire ?? 0) > 0, `Ereignisse kommen an (${Object.keys(seen).length} Arten, ${seen.fire ?? 0}× Feuer)`);
ok(cw.players[1].weapons.length === w.players[1].weapons.length && cw.players[1].weapons[0]?.waffe.id === w.players[1].weapons[0]?.waffe.id, `Inventar synchron (${cw.players[1].weapons.map((s) => s.waffe.name).join(', ')})`);
const hostEnemies = w.enemies.filter((e) => e.alive).length, clientEnemies = cw.enemies.filter((e) => e.alive).length;
ok(Math.abs(hostEnemies - clientEnemies) <= Math.max(4, hostEnemies * 0.4), `Gegner sichtbar: Host ${hostEnemies}, Client ${clientEnemies} (100 ms verzögert)`);
ok(maxErr < 1.2, `Vorhersage der eigenen Figur: max. Abweichung ${maxErr.toFixed(2)} m`);
ok(maxBytes > 0 && maxBytes < 16000, `Snapshot-Größe ${maxBytes} Byte`);

// Extremfall: sehr viele Geschosse, Kristalle und Ereignisse → Snapshot bleibt unter 16 KB
{
  const w = new World(5, 2);
  let feind = 0;
  for (let i = 0; i < Math.min(400, w.projectiles.length); i++) {
    const pr = w.projectiles[i];
    pr.alive = true; pr.x = 5 + (i % 20); pr.z = 5 + Math.floor(i / 20); pr.hostile = i % 10 === 0;
    if (pr.hostile) feind++;
  }
  for (let i = 0; i < Math.min(300, w.crystals.length); i++) { const c = w.crystals[i]; c.alive = true; c.x = 3 + (i % 30); c.z = 3 + Math.floor(i / 30); }
  const evs = Array.from({ length: 400 }, (_, i) => ({ type: 'hit', x: i % 30, z: 4, dmg: 12.5, crit: false } as unknown as SimEvent));
  evs.push({ type: 'explosion', x: 5, z: 5, r: 2, chain: 3 } as unknown as SimEvent);
  const buf = encodeSnapshot(w, evs, [0, 0]);
  const snap = decodeSnapshot(new Uint8Array(buf));
  let feindDa = 0;
  const fi = snap.shots.fields.findIndex((f) => f.name === 'flags');
  for (let i = 0; i < snap.shots.n; i++) if (snap.shots.cols[fi][i] & 1) feindDa++;
  ok(buf.byteLength <= SNAPSHOT_MAX, `Extremfall: Snapshot ${buf.byteLength} Byte ≤ ${SNAPSHOT_MAX} (passt in eine Trystero-Nachricht)`);
  ok(feindDa === feind, `Extremfall: alle ${feind} feindlichen Geschosse bleiben drin (${feindDa})`);
  ok(snap.events.some((e) => e.type === 'explosion'), 'Extremfall: wichtige Ereignisse (Explosion) bleiben drin');
}
const other = cw.players[0], hostSelf = w.players[0];
ok(Math.hypot(other.x - hostSelf.x, other.z - hostSelf.z) < 0.5, 'Mitspieler (Host) wird interpoliert angezeigt');

// Snapshot-Rundreise
{
  const buf = encodeSnapshot(w, [], [0, 0]);
  const s = decodeSnapshot(buf);
  const alive = w.enemies.filter((e) => e.alive);
  const ids = s.enemies.col('id'), xs = s.enemies.col('x');
  let maxD = 0;
  for (let i = 0; i < s.enemies.n; i++) { const e = alive.find((q) => q.id === ids[i]); if (e) maxD = Math.max(maxD, Math.abs(e.x - xs[i])); }
  ok(s.enemies.n === alive.length && maxD <= 0.006, `Snapshot verlustarm: ${s.enemies.n} Gegner, Abweichung ≤ ${maxD.toFixed(3)} m`);
}

// Shop: Welle beenden, Client kauft/rerollt per Befehl
w.waveTime = 0.05;
for (let i = 0; i < 30 * 6 && w.phase !== 'shop'; i++) { now += 33; host.tick(NO_INPUT); hub.flush(); client.update(evs); }
for (let i = 0; i < 10; i++) { now += 33; host.tick(NO_INPUT); hub.flush(); client.update(evs); }
ok(w.phase === 'shop' && cw.phase === 'shop', 'Shop-Phase bei Host und Client');
w.players[1].crystals = 500;
while (w.players[1].pendingLevels > 0) host.command(1, { type: 'upgrade', index: 0 });
host.sendState();
hub.flush();
const before = JSON.stringify(w.players[1].offers);
client.command({ type: 'reroll' });
hub.flush();
host.sendState();
hub.flush();
ok(JSON.stringify(w.players[1].offers) !== before && JSON.stringify(cw.players[1].offers) === JSON.stringify(w.players[1].offers), 'Client-Befehl (Neu würfeln) läuft beim Host, Angebote synchron');
client.command({ type: 'ready' });
hub.flush();
ok(w.players[1].ready && w.phase === 'shop', 'Client bereit – Host noch nicht → Shop bleibt offen');
while (w.players[0].pendingLevels > 0) host.command(0, { type: 'upgrade', index: 0 });
host.command(0, { type: 'ready' });
ok(w.phase === 'welle', 'Alle bereit → nächste Welle');

// Reise im Koop: nach der Baron-Welle (Koop 8) geht es auf die nächste Insel – der Client baut dieselbe Arena
{
  w.startWave(9);
  for (let i = 0; i < 20; i++) { now += 33; host.tick(NO_INPUT); hub.flush(); client.update(evs); }
  host.sendState(); hub.flush();
  for (let i = 0; i < 10; i++) { now += 33; host.tick(NO_INPUT); hub.flush(); client.update(evs); }
  ok(w.insel.id === 'funkenschlund' && cw.insel.id === 'funkenschlund' && cw.arenaSeed === w.arenaSeed && cw.arena.tiles.every((t, i) => t === w.arena.tiles[i]),
    'Inselwechsel: Client auf Funkenschlund mit identischer Arena');
  ok(cw.inselWelle === 1 && cw.wellenArt === 'normal' && cw.reiseRegel.wellen === 8, 'Client kennt Inselwelle und Koop-Regel');
}

// Verbindungsabbruch und Wiederverbinden
{
  let info = '';
  (host as unknown as { hooks: { info: (t: string) => void } }).hooks.info = (t) => { info = t; };
  void t1.leave();
  ok(host.slots[1].peer === null && host.slots[1].weg > 0 && info.includes('Verbindung'), 'Abbruch erkannt, Platz wird freigehalten');
  let started2 = 0;
  const t2 = hub.join('ROOM42');
  const back = new ClientSession(t2, 'Gasti', 'tok-gast', { start: () => started2++ }, clock);
  back.hello();
  hub.flush();
  host.tick(NO_INPUT);
  hub.flush();
  ok(back.slot === 1 && started2 === 1 && host.slots[1].peer === t2.selfId && back.world?.players[1].weapons.length === w.players[1].weapons.length, 'Wiederverbunden: gleicher Platz, Spielstand kommt an');
  // Fremder mitten im Spiel → abgelehnt
  let grund = '';
  const t3 = hub.join('ROOM42');
  const fremd = new ClientSession(t3, 'Spät', 'tok-neu', { reject: (g) => { grund = g; } }, clock);
  fremd.hello();
  hub.flush();
  ok(grund.includes('läuft'), `Neuer Spieler im laufenden Spiel: „${grund}"`);
  // länger als 30 s weg → scheidet aus
  void t2.leave();
  now += 31000;
  host.tick(NO_INPUT);
  ok(!w.players[1].alive && !w.players[1].downed, 'Nach 30 s ohne Verbindung scheidet der Spieler aus');
}

// Volle Lobby
{
  const h2 = new MemoryHub();
  const hs = new HostSession(h2.join('FULL'), 'H', 'h', {}, clock);
  const gr: string[] = [];
  for (let i = 0; i < 4; i++) { const c = new ClientSession(h2.join('FULL'), `C${i}`, `c${i}`, { reject: (g) => gr.push(g) }, clock); c.hello(); h2.flush(); }
  ok(hs.slots.length === 4 && gr.length === 1 && gr[0].includes('voll'), 'Höchstens 4 Spieler, der 5. bekommt „voll"');
}
void rejected;

if (fails) { console.log(`\n${fails} Netz-Test(s) fehlgeschlagen`); process.exit(1); } else console.log('\nAlle Netz-Tests bestanden');
