# CLAUDE.md – OVERBOOM

Arena-Roguelite im Stil von Brotato mit 3D-Voxel-Pixel-Grafik (Kamera wie Minecraft Dungeons), Waffen-Fusion und Koop für 1–4 Spieler. Läuft im Browser, später als App (Capacitor) und Desktop (Tauri) aus demselben Code.

**Die vollständige Spezifikation steht in `docs/OVERBOOM_Prompt.md` – vor größeren Änderungen lesen.** Waffendaten: `packages/data/src/weapons.ts` (lesbar: `docs/Waffenkatalog.md`).

## Sprache
- Kommunikation mit dem Nutzer, Spieltexte und Code-Kommentare auf Deutsch. Bezeichner im Code dürfen englisch oder deutsch sein, aber pro Datei einheitlich.

## Architektur-Regeln (nicht brechen)
- `packages/core`: reine Simulation. Kein DOM, kein Three.js, kein `Math.random()` (nur `Rng` mit Seed), fester Tick (`DT`). Muss in Node laufen (`npm test`).
- `packages/render`: liest nur den Zustand aus `core`, verändert ihn nie. Effekte entstehen aus `world.events`.
- `packages/platform`: einziger Zugriff auf Speicher, Vibration, Vollbild, Wake-Lock usw. Spielcode ruft nie direkt `localStorage`/`navigator` auf.
- `packages/net`: Transport-Interface für Koop (Host-autoritativ, WebRTC via Trystero + TURN-Fallback). Noch nicht implementiert.
- Daten (Waffen, Gegner, Items, Karten, Lore) gehören nach `packages/data`, nicht in die Logik.
- Performance-Pflicht: Instancing, Object-Pools, keine Allokationen pro Frame im Game-Loop.

## Look
- Low-Res-Rendering (kurze Seite 270 px), Nearest-Upscale, Kamera mit Texel-Snapping + Subpixel-Ausgleich (`renderer.ts`).
- Voxel-Modelle prozedural mit `VoxBuilder` (`packages/render/src/models.ts`).
- Gegner: „grimmig, aber knuffig" – große Köpfe, schräge Wut-Brauen, nie gruselig, kein Blut.
- Farben: dunkles Violett/Petrol, Akzente Orange #ff7a1a, Gelb #ffd23f, Cyan #3de8ff, Magenta #ff3df0. Schrift: Silkscreen.

## Befehle
- `npm run dev` – Entwicklungsserver (auch im WLAN, zum Testen am Handy)
- `npm test` – Simulationstests (Node 22+)
- `npm run typecheck`
- `npm run build:web` / `build:single` / `build:artifact`

## Stand
- Phase 1 (Fundament) fertig: Bewegung, Dash, Kollision, Arena, Held-Animation, Touch/Tastatur/Gamepad.
- Nächster Schritt: **Phase 2 – Kampf-Kern** (3 Waffen mit Auto-Aim, 3 Gegnertypen, Wellen-Timer, Kristalle, Explosionen mit Voxel-Trümmern, Hit-Stop, Screen-Shake).
- Nach jeder Phase: Tests + Typecheck grün, kurze Änderungsliste, bekannte Probleme, nächster Schritt.
