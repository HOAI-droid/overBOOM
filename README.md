# OVERBOOM

3D-Voxel-Arena-Roguelite mit Waffen-Fusion. Läuft im Browser (Handy + PC), später als App (Capacitor) und Desktop (Tauri) aus demselben Code.

## Stand: Phase 3 – Shop & Progression
- **Run-Ablauf**: Startwaffe wählen (Pistole, Raketenwerfer, Tesla-Stab, Schrotflinte) → 20 Wellen → Sieg (optional Endlos weiter) oder Niederlage. Nach jeder Welle: Level-Up-Wahl, dann Shop.
- **Level-Up**: Kristalle sind Währung *und* XP (Bedarf (Level+3)²). Pro Level 1 aus 4 Verbesserungen in 4 Seltenheiten; 14 Werte (Schaden, Feuerrate, Krit, Reichweite, Rüstung, Ausweichen, Regeneration, Lebensraub, Tempo, Glück, Ernte, Explosionsradius, Sammelradius, Max-Leben).
- **Shop**: 4 Angebote (Waffen + 24 Items mit Vor- und Nachteilen), Neu würfeln (Preis steigt), Sperren, Verkaufen, **Merge** (2 gleiche Waffen gleicher Stufe → nächste Stufe I–V, auch automatisch beim Kauf ohne freien Platz), bis zu 6 Waffen, Werte-Übersicht. 22 Waffen kaufbar – alle, deren Antrieb schon simuliert wird.
- **Neue Ladungen**: Durchschlag (Plasma), Frost/Kleister (verlangsamt), Brand/Gift (Schaden über Zeit), Splitter, Schwerkraft/Magnet (zieht zusammen), Schall/Ranken/Konfetti (betäubt, mit Sternchen), Glück (doppelte Kristalle), Lebensraub. Neuer Antrieb: Bogenwurf.
- **Boss Baron von Bumm** auf Welle 10 und 20: Bomben-Salven mit roten Einschlag-Markierungen, ab 50 % Leben Phase 2 (größere Salven, ruft Bomben-Kröten). Boss-Wellen enden mit seinem Tod, Boss-Leiste im HUD.
- **Elite-Gegner** ab Welle 5: größer, mit Krone, 5× Leben, 6× Kristalle.
- **Run-Ende** mit Statistik: Welle, Level, Besiegt, Gesamtschaden, größte Kette, Kristalle, MVP-Waffe. Pause-Menü (Esc/P/Start, automatisch im Hintergrund).
- **Menüs** komplett mit Touch, Maus, Tastatur (Pfeile + Enter, Esc) und Gamepad (Steuerkreuz + A/B).
- Alles läuft über Befehle (`world.command(...)`) – vorbereitet für Host-autoritativen Koop. Shop hat einen eigenen Zufallsgenerator.
- Balancing-Bot: `npm run balance` spielt komplette Runs und gibt Welle/Level/Ketten aus.

## Stand: Phase 2 – Kampf-Kern
- 3 Waffen mit Auto-Aim (systemisch aus Antrieb + Ladung), Grummelbold, Bomben-Kröte, Toastomat, Wellen mit Spawn-Warnung, Kristalle, Ketten-Explosionen, Fässer, Hit-Stop, Screen-Shake, Schadenszahlen. Instancing, Pools, Spatial Hash.
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
Debug: `?wave=10` (Startwelle, 10 = Boss), `?god=1` (unverwundbar), `?gems=500` (Startkristalle).

## Bekannte Probleme
- Gegner laufen direkt auf den Spieler zu (noch kein Flow-Field); an Säulen rutschen sie seitlich ab.
- Simulations-Ereignisse sind kleine Objekte pro Tick (wenig, aber nicht null GC); Gegner, Geschosse und Partikel sind gepoolt.
- Hit-Stop hält die lokale Simulation an – im Koop (Phase 7) muss er rein visuell werden.
- Noch kein Audio (Phase 8), keine Overkill-Leiste, kein Debug-Menü (nur URL-Parameter), keine Heldenwahl (nur Startwaffe).
- Balancing grob: Mit Bot-Spieler starke Streuung (Tod zwischen Welle 2 und 12, gute Runs gewinnen); Raketenwerfer als Start ist am stärksten. Muss mit echten Spielern nachjustiert werden (`data/src/balance.ts`).
- Gut die Hälfte der 60 Waffen fehlt noch im Shop, weil ihre Antriebe (Orbit, Bumerang, Turm, Nahkampf …) erst in Phase 5 kommen.
- Einstellungen (Shake, Zahlen) nur per URL, noch nicht im Menü gespeichert.
- Auf echten Handys noch nicht gemessen (nur Headless-Chromium mit Software-Rendering getestet).

## Nächster Schritt: Phase 4 – Waffen-Fusion
Bauteil-System (Geschoss/Antrieb/Ladung), Fusions-Amboss, Namensgenerator, zusammengesteckte Voxel-Modelle, Instabilität, erste 10 geheime Rezepte.
Vollständige Planung: `docs/OVERBOOM_Prompt.md`, Waffendaten: `docs/Waffenkatalog.md`.
