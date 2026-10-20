# OVERBOOM

3D-Voxel-Arena-Roguelite mit Waffen-Fusion. Läuft im Browser (Handy + PC), später als App (Capacitor) und Desktop (Tauri) aus demselben Code.

## Stand: Phase 1 – Fundament
- Monorepo: `packages/core` (Simulation, ohne DOM), `render` (Three.js), `ui`, `platform`, `net` (Interface für Koop), `data` (60 Waffen + Fusion)
- Deterministische Simulation mit festem 30-Hz-Tick, Kollision, Laufen, Dash
- Low-Res-Voxel-Rendering (270 px kurze Seite, Nearest-Upscale), isometrische Kamera mit Texel-Snapping und Subpixel-Ausgleich
- Held mit Lauf-/Dash-Animation, Silhouette hinter Wänden, Staub- und Funken-Partikel, Schatten, Fackeln, Lava, Kristalle, Grummelbolde (Deko)
- Eingabe: Tastatur (WASD/Pfeile, Leertaste), Touch-Joystick + Dash-Button, Gamepad

## Befehle
```bash
npm install
npm run dev            # Entwicklungsserver (auch im WLAN erreichbar → Handy testen)
npm test               # Simulationstests (Node 22+)
npm run typecheck
npm run build:web      # statischer Build in dist/
npm run build:single   # alles in einer HTML-Datei
```

URL-Parameter: `?res=360` (Auflösung), `?seed=42` (Arena), `?shadows=0` (Schatten aus).

## Nächster Schritt: Phase 2 – Kampf-Kern
3 Waffen, 3 Gegner, Wellen-Timer, Kristalle, Explosionen mit Voxel-Trümmern, Hit-Stop, Screen-Shake.
Vollständige Planung: `docs/OVERBOOM_Prompt.md`, Waffendaten: `docs/Waffenkatalog.md`.
