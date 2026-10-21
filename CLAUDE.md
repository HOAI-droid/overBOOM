# CLAUDE.md – OVERBOOM

Arena-Roguelite mit Wellen-Runden, 3D-Voxel-Pixel-Grafik (schräge isometrische Kamera), Waffen-Fusion und Koop für 1–4 Spieler. Läuft im Browser und als App (Tauri: Windows/Mac/Linux, Capacitor: iOS/Android, UWP+WebView2: Xbox) aus demselben Code.

**Die vollständige Spezifikation steht in `docs/OVERBOOM_Prompt.md` – vor größeren Änderungen lesen.** Waffendaten: `packages/data/src/weapons.ts` (lesbar: `docs/Waffenkatalog.md`).

## Sprache
- Kommunikation mit dem Nutzer, Spieltexte und Code-Kommentare auf Deutsch. Bezeichner im Code dürfen englisch oder deutsch sein, aber pro Datei einheitlich.
- Mehrsprachigkeit (ab v0.11): Ausgangssprache Deutsch.
  - **Jeder sichtbare Text im Code läuft über `t('…')`** aus `@overboom/data` (nur einfache Anführungszeichen, keine Verkettung, Variablen als `{platzhalter}`).
  - Texte, die erst woanders angezeigt werden (z. B. vom Host), mit `tx('…')` markieren und beim Anzeigen `t(text)`.
  - Spieldaten-Felder übersetzt `lokalisiereDaten()` (`data/src/lokalisierung.ts`, Feldliste `FELDER`). Werte, die zugleich Logik-Schlüssel sind (Elemente, Waffengruppen), nie in Daten übersetzen, sondern beim Anzeigen `t(wert)`. Nie Logik von Anzeigetexten abhängig machen.
  - Nach neuen/geänderten Texten: `npm run i18n katalog`, dann die neuen Einträge in `packages/data/src/i18n/{en,es,fr}.json` ergänzen, `npm run i18n bauen`. Der Sprachtest in `npm test` schlägt sonst fehl.

## Architektur-Regeln (nicht brechen)
- `packages/core`: reine Simulation. Kein DOM, kein Three.js, kein `Math.random()` (nur `Rng` mit Seed), fester Tick (`DT`). Muss in Node laufen (`npm test`).
- `packages/render`: liest nur den Zustand aus `core`, verändert ihn nie. Effekte entstehen aus `world.events`.
- `packages/platform`: einziger Zugriff auf Speicher, Vibration, Vollbild, Wake-Lock usw. Spielcode ruft nie direkt `localStorage`/`navigator` auf.
- `packages/net`: Koop (Host-autoritativ). `Transport`-Interface mit Trystero/WebRTC + TURN, BroadcastChannel (`?netz=lokal`) und Speicher-Transport (Tests). `HostSession`/`ClientSession`, binäre Snapshots (`snapshot.ts`), Inventar-Zustand als JSON (`state.ts`). Muss in Node laufen (`packages/net/test`).
- `packages/audio`: prozedurale SFX (`synth.ts`, `sounds.ts`), prozedurale Musik: `komponist.ts` (rein, Node-testbar: Stile rock/pop/retro/chip × Stimmungen menu/kampf/boss/shop, Abschnitte, 3 Intensitätsstufen), `band.ts` (WebAudio-Instrumente, Mix, Ducking), `music.ts` (Scheduler, `renderMusik` für Hörproben). `AudioEngine.events()` vertont `world.events`, `setLage()`/Explosionen steuern die Intensität, Einstellung `musikStil`.
- Daten (Waffen, Gegner, Items, Karten, Lore) gehören nach `packages/data`, nicht in die Logik.
- Performance-Pflicht: Instancing, Object-Pools, keine Allokationen pro Frame im Game-Loop.

## Look
- Low-Res-Rendering (kurze Seite 270 px), Nearest-Upscale, Kamera mit Texel-Snapping + Subpixel-Ausgleich (`renderer.ts`).
- Voxel-Modelle prozedural mit `VoxBuilder` (`packages/render/src/models.ts`).
- Gegner: „grimmig, aber knuffig" – große Köpfe, schräge Wut-Brauen, nie gruselig, kein Blut.
- Farben: dunkles Violett/Petrol, Akzente Orange #ff7a1a, Gelb #ffd23f, Cyan #3de8ff, Magenta #ff3df0. Schrift: Silkscreen.

## Befehle
- `npm run dev` – Entwicklungsserver (auch im WLAN, zum Testen am Handy)
- `npm test` – Simulations-, Netz- und Audio-Tests (Node 22+)
- `npm run balance` – Balancing-Bot spielt komplette Reisen (`node --experimental-strip-types packages/core/test/balance-bot.ts [Runs] [Erster] [Insel] [Spieler] [mess]`)
- `npm run typecheck`
- `npm run build:web` / `build:single` / `build:artifact`
- `npm run build:desktop` (Tauri), `build:mobile` (Capacitor sync), `build:xbox` (Web-Build → apps/xbox)

## Stand
- Phase 1 (Fundament) fertig: Bewegung, Dash, Kollision, Arena, Held-Animation, Touch/Tastatur/Gamepad.
- Phase 2 (Kampf-Kern) fertig: Pistole/Raketenwerfer/Tesla-Stab mit Auto-Aim (systemisch aus Antrieb + Ladung, `core/src/weapons.ts`), Grummelbold/Bomben-Kröte/Toastomat (`core/src/enemies.ts`, Daten in `data/src/enemies.ts`), Wellen, Kristalle, Ketten-Explosionen, Fässer, Hit-Stop, Shake, Schadenszahlen, Run-Ende. Balancing zentral in `data/src/balance.ts`.
- Effekte entstehen nur aus `world.events` (`render/src/effects.ts`); Gegner/Geschosse per Instancing (`render/src/instanced.ts`, `combatView.ts`).
- Phase 3 (Shop & Progression) fertig: Startwaffen-Wahl, XP/Level-Up (`data/src/upgrades.ts`), Shop mit Reroll/Lock/Verkauf/Merge (`core/src/progression.ts`), 24 Items (`data/src/items.ts`), Werte (`data/src/stats.ts`), Waffenstufen I–V, 20 Wellen, Boss Baron von Bumm (Welle 10/20), Elite-Gegner, Sieg/Endlos, Run-Statistik mit MVP-Waffe, Pause. Menüs in `ui/src/menus.ts` (Touch/Tastatur/Gamepad).
- UI ändert den Zustand nie direkt, sondern schickt Befehle: `world.command(spieler, { type: 'buy', index })` usw. (Koop-tauglich).
- Phasen: `wahl → welle → pause → shop → welle … → sieg | ende`. Tests ohne Shop: `new World(seed, 1, { autoShop: true })`.
- Phase 4 (Waffen-Fusion, v0.4.0) fertig: Fusions-Amboss im Shop (`ui/src/menus.ts`, Befehl `{ type: 'fuse', slots, geschoss, antrieb, ladung }`), Fusionsregeln + 10 geheime Rezepte + Namensgenerator in `data/src/fusion.ts` (`fusionsWaffe`, `waffeById` – Fusions-IDs `fusion:g+a+l` bzw. `rezept:id`), Instabilität mit Bonus-Kawumm. Alle 19 Antriebe und 22 Ladungen in `core/src/weapons.ts` (Treffer laufen über `impactAt`/`hitEnemy`, Pfützen/Sog als `world.hazards`). Fusionsmodelle in `render/src/models.ts` (`fusionModel`, `REZEPT_MODELLE`). Entdeckte Rezepte speichert `apps/web` über `platform.storage`.
- Phase 5 (Content-Ausbau, v0.5.0) fertig: 13 Helden (`data/src/heroes.ts`, Perks in `p.perk`), 7 Inseln mit Fraktion/Palette/Bodengefahr (`data/src/islands.ts`, `core/src/arena.ts` Stile), 16 Gegner + 4 Bosse (generischer `stepBoss` mit `angriffe`-Liste), Synergien (`data/src/synergies.ts`, `p.syn`/`world.synFx`), 15 Reaktionen (`data/src/reactions.ts`, `react()` in `core/src/weapons.ts`), Sterne/Evolutionen/Mods (`data/src/mods.ts`, IDs `evo:a|b:<id>`), 159 Items (`items_extra.ts`), Ausrüstung mit 8 Plätzen und 4 Sets (`data/src/equipment.ts`, Befehle `equip`/`unequip`/`scrap`, Beute über `world.lootRng`). Shop-Tabs Shop/Amboss/Ausrüstung.
- Phase 6 (Welt & Karten, v0.6.0) fertig: Lore in `data/lore.ts`; Sammelkarten + Erfolge in `data/cards.ts` (`KARTEN`, IDs `art:ref`); Meta-Profil in `core/src/meta.ts` (`MetaTracker`: `events`/`sync`/`runEnde`, `inselFrei`, Export-Code) – die App speichert es über `platform.storage` ('profil'); Weltkarte `render/src/worldMap.ts` (über `renderer.renderMap`, Beschriftungen per `menus.updateMapLabels`); Kartenalbum `ui/src/album.ts` + Artworks `render/src/cardArt.ts` (eigener WebGL-Kontext, UI kennt nur `KartenKunst`); PNG-Export `ui/src/cardImage.ts` → `platform.saveImage`. 40 Rezepte, neue Rezept-Wirkungen (`SP.minibumm` … `SP.donner`) in `rezeptTreffer`.
- Phase 7 (Multiplayer) fertig: Koop-Regeln im Kern (`downed`/`reviveT`, `KOOP` in balance.ts, `w.koop()`), Netz-Paket (s. o.), App-Ablauf Titel → Lobby → Spiel in `apps/web/src/main.ts` (`modus` solo/host/client, `useWorld`), Lobby/Titel in `ui/src/lobby.ts`, Namensschilder `ui/src/nametags.ts`. Client ruft nie `world.step`, sondern `client.input()` (Vorhersage) und `client.update()` (Snapshots).
- Phase 8 (Feinschliff, v0.8.0) fertig: Audio, Einstellungen (`ui/src/settings.ts`, `FX` in render/effects.ts), Overkill/OVERBOOM (`p.overkill`/`p.boomT`, `OVERKILL`), Gefahrenstufen (`data/src/danger.ts`, `w.gw`), Helden-Freischaltung (`HELD_FREI`), IndexedDB in `platform/web.ts`, PWA (`apps/web/public/sw.js`), Debug-Menü F1 (`ui/src/debug.ts`), automatische Qualitätsstufe.
- Phase 9 (Apps, v0.9.0) fertig: Tauri 2 in `apps/desktop` (Windows/Mac/Linux, `desktop.yml`), Capacitor 8 in `apps/mobile` (Android/iOS, `mobile.yml`, Plugins müssen in apps/mobile/package.json stehen), Xbox als UWP-Hülle mit WebView2 in `apps/xbox` (`xbox.yml`, Doku `docs/xbox.md`). Push auf main → `release.yml` (alle Apps als Release v<Version>) und `pages.yml` (Browser-Version auf https://hoai-droid.github.io/overboom/). Plattformen in `packages/platform` (`tauri.ts`, `capacitor.ts`, `xbox.ts`), optionale Felder `nurController`/`beenden`/`onZurueck`/`onSpeicherKnapp`. Controller-Symbole `ui/src/glyphs.ts`, `MenuNav` kann Textfelder (`textSperre`) und Regler. Schrift lokal in `apps/web/src/fonts`.
- v0.10.0: prozedurale Musik mit Stilwahl (rock/pop/retro/chip/aus, s. o.), Grafikstufen bis „max“ (540 px; `QUALI` in main.ts, „auto“ bis „ultra“), Balancing späte Wellen (`spaet()` in balance.ts, `KAMPF.waffenSchaden`, `SPIELER.lebensraubProSek`, Bot misst tiefstes Leben ab Welle 11), Explosionsgrafik ×0,8 (`EXPLOSION_GRAFIK` in render/effects.ts).
- Rechtliches: `LICENSE` (alle Rechte vorbehalten), `DATENSCHUTZ.md`, `DRITTANBIETER.md` – bei neuen Abhängigkeiten oder Servern aktualisieren, ebenso `ui/src/rechtliches.ts` (Seite „Datenschutz & Lizenzen“ in den Einstellungen und einmaliger Koop-Hinweis, gemerkt als 'koop-hinweis' im Speicher).
- v0.10.1: Koop-Fix (Trystero liefert Binärdaten als Uint8Array → `Reader` nimmt beides; Test-Transport bildet das nach), Snapshots < 16 KB (`SNAPSHOT_MAX`), Beenden aus Shop/Level-Up/Pause, Kristalle im Feld, Klippen-Ecken unter dem Boden, Balancing-Mittelweg.
- v0.11.0: vier Sprachen (`data/src/i18n.ts`, `lokalisierung.ts`, `i18n/*.json|ts`, `tools/i18n.ts`, `ui/src/sprachwahl.ts`), Sprache gespeichert als 'sprache', Wechsel lädt die App neu (`platform.neuLaden`).
- v0.12.0: Inselreise (`REISE` in balance.ts; `World.reise`, `reiseIndex`, `inselWelle`, `wellenArt`, `reisePos(n)`, `geheZuInsel`, Arena-Seed je Insel `arenaSeedFor`): Solo 15 Wellen/Insel (Boss 10, Baron 15), Koop 8 (5/8), danach Finale `kawumm` (3 Phasen, `zerbrichArena`). Inselbarone `insel.baron`, neue Boss-Angriffe in `core/src/enemies.ts` (spirale/faecher/flaechen/sprung/kreuz/minen, Telegraph-Ereignis `telegraph`). Insel gilt als befreit, wenn ihr Baron fällt. Spielstand solo `core/src/spielstand.ts` ('lauf', Titel „Fortsetzen“). Zufallsarenen in `createArena` (Seed + Stil). Balancing: Gegnerkurven ab Welle 15 als Potenzgesetz (Bot-Messung, `balance-bot.ts … mess`), `BOSS.hpFaktor(w, rang)`, `EXPLOSION` (Radius-Deckel + Überdruck), `PANZER`, `ELITE_ANGRIFF`, `VERSTAERKUNG`, Beute-Schwellen in `BEUTE`. UI: feste Kartengrößen (`karte()` in menus.ts), Rahmen = Waffengruppe, Album als Shop-Reiter.
- v0.13.0 (aus dem Zweig `hd`): feine Modelle in `render/src/hd/` (`HD_GEGNER`, `heroPartsHd`, halbe Voxelgröße), Umschaltung `DETAIL.hd` / `renderer.setDetail()` ab Grafikstufe „ultra“ (`?modelle=klein|fein` zum Vergleich), „Automatisch“ startet auf PC/Xbox mit „ultra“; Fülllicht aus Kamerarichtung, Held-Silhouette per Stencil; Voxel-Explosionen `render/src/voxelExplosion.ts` (`VoxelExplosions`, Größe S 0,5–1,4 aus dem Radius, vorberechnete Formen, Obergrenze `MAX_VOXEL`), aufgerufen aus `Effects.explosion()`. Keine Umrisslinien (vom Nutzer nicht gewünscht). Stand vor HD: Zweig `stand-v0.12.1` bzw. Release v0.12.1.
- v0.13.1: Effekt-Regler 0–2 (`shake`/`blitze`/`partikel`, 1 = halbe alte Stärke, Faktor 0,5 in `applyEinstellungen`; alte Werte per `skala` umgerechnet), Wackeln dosiert (`unruhe` in renderer.ts), Hit-Stop nur bei großen Momenten (`halt()`), Greedy-Meshing (`greedy` in `buildVoxels`, Standard bei `jitter: 0`), Schatten-Stellvertreter (`schatten` in `VoxelInstances`, Ebene 1, nur die Schattenkamera sieht sie).
- Nächster Schritt: Phase 10 – Store-Veröffentlichung (Signaturen, Store-Einträge) bzw. Feedback von echten Geräten.
- Nach jeder Phase: Tests + Typecheck grün, kurze Änderungsliste, bekannte Probleme, nächster Schritt.
