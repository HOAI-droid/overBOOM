# OVERBOOM

3D-Voxel-Arena-Roguelite mit Waffen-Fusion. Läuft im Browser (Handy + PC), später als App (Capacitor) und Desktop (Tauri) aus demselben Code.

## Stand: Phase 2 – Kampf-Kern
- **3 Waffen mit Auto-Aim**, systemisch aus den Bauteilen (Antrieb → Flugbahn, Ladung → Wirkung): Pistole (gerade, Rückstoß), Raketenwerfer (zielsuchend im Bogen über Wände, Explosion), Tesla-Stab (zielsuchend, Kettenblitz über bis zu 5 Gegner). Krits mit größeren Zahlen.
- **3 Gegner** („grimmig, aber knuffig"): Grummelbold (jagt, kommt im Rudel), Bomben-Kröte (bläst sich auf, springt, explodiert – auch wenn man sie erwischt), Toastomat (hält Abstand, schießt glühenden Toast). Daten in `packages/data/src/enemies.ts`.
- **Wellen**: 20 s → 60 s, Spawn-Warnung (rotes Kreuz 1 s vorher), steigende Rate/HP; am Ende zerplatzen alle Gegner nacheinander vom Spieler aus nach außen, Kristalle fliegen ein, 5 s Pause (Phase 3: Shop).
- **Explosionen & Ketten**: verzögerte Kettenglieder, explosive Fässer, „CHAIN ×N!"-Anzeige. Effekte: Feuerball, Rauch, Voxel-Trümmer, Funken, Schockwellen-Ring, Lichtblitz, Brandflecken.
- **Game Feel**: Hit-Stop (gedrosselt), Screen-Shake (skaliert + gedeckelt), Treffer-Blitz, Rückstoß, Quetschen, Schadenszahlen (pro Gegner zusammengefasst), Haptik.
- **Kristalle** mit Magnet-Einsammeln, Leben + Schutzzeit, Dash macht unverwundbar, Run-Ende mit Statistik und Neustart.
- **Performance**: Instancing für Gegner/Geschosse/Kristalle/Partikel, feste Pools, Spatial Hash. Simulations-Tick mit 100+ Gegnern ≈ 0,3 ms (Node).
- Phase 1: Monorepo, deterministische 30-Hz-Simulation, Low-Res-Voxel-Rendering, isometrische Kamera, Touch/Tastatur/Gamepad.

## Befehle
```bash
npm install
npm run dev            # Entwicklungsserver (auch im WLAN erreichbar → Handy testen)
npm test               # Simulationstests (Node 22+)
npm run typecheck
npm run build:web      # statischer Build in dist/
npm run build:single   # alles in einer HTML-Datei
```

URL-Parameter: `?res=360` (Auflösung), `?seed=42` (Arena), `?shadows=0` (Schatten aus), `?shake=0` (Screen-Shake aus, 0–2), `?zahlen=0` (Schadenszahlen aus).
Debug: `?wave=8` (Startwelle), `?god=1` (unverwundbar).

## Bekannte Probleme
- Gegner laufen direkt auf den Spieler zu (noch kein Flow-Field); an Säulen rutschen sie seitlich ab.
- Simulations-Ereignisse sind kleine Objekte pro Tick (wenig, aber nicht null GC); Gegner, Geschosse und Partikel sind gepoolt.
- Hit-Stop hält die lokale Simulation an – im Koop (Phase 7) muss er rein visuell werden.
- Noch kein Audio (Phase 8), keine Overkill-Leiste, kein Debug-Menü (nur URL-Parameter).
- Auf echten Handys noch nicht gemessen (nur Headless-Chromium mit Software-Rendering getestet).

## Nächster Schritt: Phase 3 – Shop & Progression
Level-Up, Shop, Merge, 20 Wellen, Boss, Run-Ende.
Vollständige Planung: `docs/OVERBOOM_Prompt.md`, Waffendaten: `docs/Waffenkatalog.md`.
