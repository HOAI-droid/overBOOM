# Master-Prompt v2: OVERBOOM – 3D-Pixel-Arena-Roguelite mit Waffen-Fusion (Browser, 1–4 Spieler)

> Diesen Prompt komplett in Claude Code (oder ein anderes Coding-Modell) einfügen. Er ist in Phasen aufgebaut – lass das Modell jede Phase fertigstellen, testen und committen, bevor die nächste beginnt.

---

## 1. Rolle & Ziel

Du bist ein Senior Game Developer mit Erfahrung in Web-3D (Three.js), Netcode und Game Feel. Entwickle **OVERBOOM**, ein Arena-Roguelite mit kurzen Wellen-Runden, einer **3D-Voxel-Pixel-Optik** und einer **schrägen isometrischen Kamera** von oben.

Das Spiel läuft **komplett im Browser**, ist auf **Smartphones spielbar** (Touch) und unterstützt **lokalen Solo-Modus** sowie **Online-Koop mit bis zu 4 Spielern auf jeweils eigenem Gerät** – plattformübergreifend (iOS Safari, Android Chrome, Desktop Chrome/Firefox/Safari/Edge auf Windows, macOS, Linux).

Leitprinzip: **„Übertrieben, aber lesbar."** Absurde Explosionsmengen, Kettenreaktionen und Zahlen – aber der Spieler erkennt jederzeit seine Figur, Gefahren und Pickups.

### Die drei Säulen (alles andere ordnet sich unter)
1. **Waffen-Fusion** – das Alleinstellungsmerkmal: Waffen aus *verschiedenen* Gruppen werden zu neuen, absurden Waffen verschmolzen (z. B. Hühnerkanone + Raketenwerfer + Tesla-Stab = *Gackernde Blitzrakete*). Siehe Abschnitt 5b.
2. **Eine eigene Welt zum Sammeln** – „Krawummia", eine erfundene Welt mit Inseln, Fraktionen, Helden, Gegnern und Bossen. Jede Waffe, jeder Held und jeder Gegner ist eine **Sammelkarte** wie bei Magic oder Pokémon – mit Element, Werten, Fähigkeiten und Flavor-Text. Siehe Abschnitte 6b und 6c.
3. **Humor** – das Spiel ist witzig: absurde Waffen, sprechende Namen, grummelige Gegner, alberne Sounds (Gackern, Kazoo-Fanfaren, „Kawumm!"-Schriftzüge). Nie zynisch, nie eklig, kein Blut – Gegner zerplatzen in Voxel, Konfetti und Kristalle.

### Geschäftsmodell: komplett kostenlos
- Das Spiel ist **kostenlos**, ohne Werbung im Spielablauf, **ohne Pay-to-Win, ohne Lootboxen, ohne Energiesystem**.
- **Alle Karten, Waffen, Helden und Rezepte sind ausschließlich erspielbar.** Keine kaufbaren Booster.
- Optional später: freiwillige Unterstützung (Spenden-Link) oder rein kosmetische Extras, die keinen Spielvorteil geben.

---

## 2. Technik-Stack (verbindlich)

- **TypeScript + Vite**, kein schweres Engine-Framework.
- **Three.js** (WebGL2) für das Rendering.
- **Netzwerk:** WebRTC-DataChannels über **Trystero** (serverloses Signaling) als Default; abstrahiere die Transport-Schicht hinter einem Interface, damit später PeerJS oder ein eigener WebSocket-Relay einsetzbar ist.
- **Audio:** WebAudio-API, prozedurale SFX mit eigenem Retro-Klanggenerator + Musik-Loops. Audio erst nach erster Nutzerinteraktion entsperren (iOS!).
- **PWA:** Manifest + Service Worker, installierbar, offline spielbar im Solo-Modus, Vollbild/Landscape-Lock auf Mobilgeräten.
- **Hosting:** rein statisch (GitHub Pages / Netlify / Cloudflare Pages). Kein eigener Spielserver nötig – nur ein TURN-Relay als Fallback (siehe unten).
- Keine externen Asset-Downloads zur Laufzeit – Voxel-Modelle werden **prozedural im Code** definiert (Voxel-Arrays → zusammengeführte Geometrie mit Greedy-Meshing).

### Architektur: heute Browser, später App – ohne Neuprogrammierung
Das Spiel wird von Anfang an so gebaut, dass **derselbe Code** später als App läuft:
- **Web/PWA:** Hauptplattform, läuft auf allen Geräten ohne Installation.
- **iOS & Android:** Verpackung mit **Capacitor** (der Web-Build läuft in einer nativen App-Hülle, Veröffentlichung in App Store und Play Store).
- **Windows, macOS, Linux / Steam:** Verpackung mit **Tauri** (alternativ Electron).

Dafür gelten diese Regeln:
1. **Monorepo mit getrennten Paketen:** `core` (Spielsimulation, reines TypeScript, kein DOM, kein Three.js), `render` (Three.js), `ui`, `net`, `platform`, sowie `apps/web`, `apps/mobile` (Capacitor), `apps/desktop` (Tauri).
2. **Simulation strikt getrennt vom Rendering:** `core` läuft mit fester Tick-Rate, ist deterministisch (eigener Seed-Zufallsgenerator, keine `Math.random()`-Aufrufe) und **headless lauffähig** – in Node, im Web Worker oder später auf einem Server. Das Rendering liest nur den Zustand und interpoliert.
3. **Plattform-Schicht:** Alles Gerätespezifische geht über Interfaces in `platform`: Speichern, Haptik/Vibration, Teilen, Audio-Freigabe, Vollbild, Bildschirm-wach-halten, In-App-Rezensionen. Je Plattform eine Implementierung (Web, Capacitor, Tauri). Der Spielcode ruft nie direkt `localStorage`, `navigator.*` o. Ä. auf.
4. **Speicherstände doppelt absichern:** Im Browser kann Safari Website-Daten nach längerer Nichtnutzung löschen. Daher: als PWA installierbar machen, Spielstand zusätzlich als Code exportieren, optional später Cloud-Sync.
5. **Eingabe abstrahieren:** Touch, Tastatur, Maus und Gamepad liefern dieselben Aktionen (`move`, `dash`, `overboom`, Menü-Navigation).
6. **Performance-Pflicht:** Instancing, Object-Pools, kein GC im Game-Loop, automatische Qualitätsstufen. Simulation optional im Web Worker, damit die UI flüssig bleibt.
7. **Ein Build-Befehl pro Plattform** (`npm run build:web`, `build:ios`, `build:android`, `build:desktop`), alle aus demselben Code.

### Netzwerk-Realität: Koop „ohne eigenen Server"
- Die Spieldaten laufen **direkt zwischen den Geräten** (WebRTC, Host-autoritativ). Dafür braucht es **keinen eigenen Spielserver**.
- **Signaling** (das gegenseitige Finden über den Raumcode) läuft über Trystero und öffentliche Infrastruktur (Standard: Nostr-Relays; alternativ BitTorrent-Tracker, MQTT u. a.). Kostenlos, aber ohne Garantie – deshalb ist die Strategie konfigurierbar und ein eigener kleiner WebSocket-Relay kann später eingesetzt werden.
- **STUN** über öffentliche STUN-Server für die Adresserkennung.
- **TURN-Fallback ist Pflicht:** Manche Netze (vor allem Mobilfunk, Firmen-/Schul-WLAN) erlauben keine direkte Verbindung. Dann muss der Verkehr über einen TURN-Relay laufen. Konfigurierbar einbauen (z. B. Cloudflare Realtime TURN – großzügiges Freikontingent, danach günstig nach Datenvolumen – oder ein eigener coturn).
- **Verbindungsdiagnose in der Lobby:** Anzeige „direkt" oder „über Relay" je Spieler, verständliche Fehlermeldung statt Hängenbleiben.
- **Host-Last:** Das Host-Gerät simuliert für alle 4 Spieler. Gerätestärke beim Host-Wählen berücksichtigen (z. B. Vorschlag „PC als Host"), Gegnerzahl im Koop deckeln.
- **Später optional:** Weil `core` headless läuft, kann derselbe Code ohne Umbau als dedizierter Server laufen (z. B. für öffentliches Matchmaking).

---

## 3. Look & Feel

### Grafik-Stil „3D-Pixel"
- Szene wird in ein **niedrig aufgelöstes Render-Target** gerendert (z. B. 480×270 bzw. dynamisch: kurze Bildschirmseite ≈ 270 px) und mit **Nearest-Neighbor** auf den Bildschirm hochskaliert → echte, knackige Pixel bei echtem 3D.
- **Orthografische Kamera**, ca. 35–40° Neigung, 45° Drehung (isometrisch), sanftes Follow mit Lookahead in Bewegungsrichtung. Im Koop zoomt die Kamera, um alle Spieler einzufangen (mit Limit + Off-Screen-Indikatoren).
- Alles besteht aus **Voxeln**: Figuren, Gegner, Waffen, Props, Terrain (Höhenstufen, Klippen, Lava, Wasser).
- **Beleuchtung:** Ein Directional Light mit weicher Schatten-Map + farbige Point Lights für Explosionen/Projektile. **Stylized Toon-Shading** mit 3–4 Lichtstufen.
- **Post-Processing (im Low-Res-Pass):** Bloom für Emissives, Farb-Palettenquantisierung (begrenzte, kräftige Palette), leichte Outline (Tiefen-/Normalen-Kanten), optionales Dithering, Vignette.
- **Farbwelt:** dunkle, satte Umgebung (Violett/Petrol/Anthrazit) – Explosionen, Projektile und Loot leuchten in Orange, Gelb, Cyan, Magenta. Gegner haben klar unterscheidbare Silhouetten.

### Game Feel – das Herzstück
- **Explosionen:** Voxel-Debris (physikalisch fallende Würfel), Feuerball-Sprites, Rauchwolken, Shockwave-Ring, Lichtblitz, Decals (Brandflecken), Kamera-Shake (skaliert mit Größe, gedeckelt), **Hit-Stop** (2–4 Frames) bei großen Treffern.
- **Kettenreaktionen:** Gegner und explosive Fässer können bei Tod explodieren; Explosionen können weitere Explosionen auslösen. Zähle Ketten und zeige „CHAIN ×12!".
- **Overkill-Meter:** Füllt sich durch Schaden/Ketten. Voll → kurzer **OVERBOOM-Modus** (5 s: doppelte Feuerrate, alle Projektile explodieren, Zeitlupe-Akzente, Screen-Tint).
- **Schadenszahlen:** pixelige, poppende Zahlen; Krits größer/farbig; bei Massen-Treffern zusammenfassen statt Bildschirm zu fluten.
- **Feedback:** Treffer-Flash (weiß), Knockback, Gegner zerfallen in Voxel, Loot spritzt heraus und wird magnetisch eingesammelt.
- **Barrierefreiheit:** Regler für Screen-Shake, Flash-Intensität (Photosensitivität), Partikeldichte, Schadenszahlen an/aus, farbenblind-freundliche Gefahren-Markierung.

---

## 4. Gameplay-Kern (Wellen-Schleife)

1. **Charakterwahl** (startet mit 1 Waffe + Charakter-Perk).
2. **Welle** in einer Arena: 20–90 s Countdown (steigt mit Welle). Gegner spawnen kontinuierlich an Rändern/aus Portalen, mit Spawn-Warnung (rotes Kreuz 1 s vorher).
3. **Spieler bewegt sich nur – Waffen feuern automatisch** auf das nächste/priorisierte Ziel. Bis zu **6 Waffen gleichzeitig**, um die Figur kreisend angeordnet.
4. Gegner droppen **Kristalle (Währung + XP)**. Level-Up → nach der Welle Wahl aus 4 Stat-Upgrades.
5. **Welle endet** → Gegner explodieren alle (Massen-Kettenreaktion als Belohnung!) → **Shop-Phase**.
6. **Shop:** 4 zufällige Angebote (Waffen + Items), Reroll (Preis steigt), Lock einzelner Angebote, Verkaufen, **Waffen-Merge**.
7. **20 Wellen** pro Run, **Boss** auf Welle 10 und 20, Elite-Gegner ab Welle 5. Danach optional **Endlos-Modus**.
8. **Tod** = Run vorbei (im Koop: Mitspieler können innerhalb von 10 s wiederbeleben).

### Gegner (mind. 15 Typen + 3 Bosse)
Schwärmer, Sprinter, Tanks, Fernkämpfer, Selbstzerstörer (Kamikaze-Bomber), Splitter (teilen sich), Heiler, Schild-Träger, Portal-Beschwörer, Minenleger usw. Bosse mit klaren, telegrafierten Phasen.

### Gegner-Art-Direction: „grimmig, aber knuffig"
- Gegner sehen **lustig und cool** aus, **grimmig und böse**, aber **nie gruselig oder verstörend**. Zielgruppe: ab ca. 8 Jahren spielbar, trotzdem cool für Erwachsene.
- Formel: **großer Kopf, kleiner Körper**, **schräg nach innen zeigende Augenbrauen** (wütender Blick), Unterbiss mit zwei Hauern, übergroße Helme/Hüte, kräftige Farben, klare Silhouette.
- Jeder Gegnertyp hat eine **Persönlichkeit** (Name, Fraktion, Macke, Spruch), z. B.:
  - **Grummelbold** (Grummel-Fraktion): grüner Kobold mit verbeultem Kochtopf als Helm, grummelt beim Laufen, klaut Kristalle und rennt weg.
  - **Toastomat** (Blechbrut): wütender Toaster auf Stelzenbeinen, schießt glühenden Toast, rote LED-Augenbrauen.
  - **Bomben-Kröte** (Sumpfbande): dicke lila Kröte mit Glupschaugen und Bombe auf dem Rücken, springt dir vor die Füße und quakt „Kawumm".
  - **Pilzling** (Pilzmoor): kleiner Stinkepilz mit roter Kappe und Schmollmund, hinterlässt Giftwolken.
  - **Boss Baron von Bumm**: runder Bösewicht mit Zylinder, Monokel und Schnurrbart, eine brennende Bombe auf dem Hut. „Ich bin nicht dick, ich bin explosiv gebaut!"
- Treffer-Reaktionen sind komisch: Gegner fliegen mit Cartoon-Sternchen weg, Helme scheppern, Toaster spucken Toast.

---

## 5. Waffen-System (massiv)

### Umfang
- **Mind. 60 Waffen** in **10 Klassen**: Feuerwaffen, Explosiv, Elementar (Feuer/Eis/Blitz/Gift), Nahkampf, Energie/Laser, Drohnen & Türme, Beschwörung, Werfer, Exotisch (z. B. „Hühnerkanone", „Schwarzes-Loch-Werfer"), Support.
- Jede Waffe hat **1–3 Tags** (z. B. `Explosiv`, `Feuer`, `Projektil`, `Präzision`, `Elementar`, `Primitiv`, `Tech`).

### Seltenheit & Stufen
- **Tier I (Grau) → II (Blau) → III (Lila) → IV (Gold) → V „OVERBOOM" (Rot, animierter Rahmen)**.
- **Merge:** 2 gleiche Waffen gleicher Stufe → 1 Waffe der nächsten Stufe (im Shop per Drag & Drop oder Tap).
- **Waffen-Mods:** Jede Waffe ab Tier II hat **Mod-Slots** (II: 1, III: 2, IV: 3, V: 4). Mods z. B. *Clusterbombe* (Projektile teilen sich), *Brandmunition*, *Querschläger*, *Kettenblitz*, *Gravitations-Kern*, *Doppelschuss*, *Zielsuchend*, *Nachbrenner*.
- **Waffen-Level (pro Run):** Waffen sammeln XP durch Kills (0–5 Sterne). Jeder Stern: kleiner Bonus; Stern 5 schaltet eine **Waffen-Evolution** frei (Wahl aus 2 Varianten, z. B. Raketenwerfer → *Schwarmraketen* ODER *Atomrakete*).

### Synergien (Sets)
- Tags zählen über alle getragenen Waffen. Schwellen bei 2/4/6 geben Set-Boni, z. B.:
  - **Explosiv 2/4/6:** +15 % Radius / Explosionen hinterlassen Feuerpfützen / jede 10. Explosion ist eine Mini-Nuke.
  - **Elementar 3/6:** Status-Effekte kombinieren (Brennen + Gefroren = *Dampfexplosion*; Blitz + Nass = *Kettenschock*).
  - **Tech 2/4/6:** +1 Drohne / Drohnen schießen Laser / Drohnen kamikazen beim Tod.
- Zeige aktive Synergien jederzeit im Shop und als kleine Icons im HUD.

### Elementar-Reaktionen (Kombinationen)
Definiere eine Reaktions-Matrix (Feuer, Eis, Blitz, Gift, Nass, Gravitation). Jede Kombination erzeugt einen sichtbaren, eigenen Effekt. Das ist ein zentraler Spaß-Faktor – liebevoll umsetzen.

---

## 5b. Waffen-Fusion (Kern-Feature, höchste Priorität)

Am **Fusions-Amboss** (zwischen den Wellen, neben dem Shop) werden **2 oder 3 Waffen aus verschiedenen Gruppen** zu einer neuen Waffe verschmolzen.

### Bauteil-System
Jede Waffe ist in drei austauschbare **Bauteile** zerlegt. Bei der Fusion liefert jede Eingangswaffe genau ein Bauteil; der Spieler bestimmt, welche Waffe welches Bauteil gibt:

| Bauteil | Bestimmt | Beispiele |
|---|---|---|
| **Geschoss** | Was fliegt | Huhn (springt 3×), Rakete, Kugel, Säge, Bowlingkugel, Biene, Toastscheibe |
| **Antrieb** | Wie es fliegt | gerade, im Bogen, zielsuchend, kreisend, abprallend, Bumerang, teleportierend |
| **Ladung** | Was beim Treffer passiert | Explosion, Kettenblitz, Brand, Gift, Frost, Schwarzes Loch, Konfetti-Splitter |

- Beispiel: **Hühnerkanone** (Geschoss: Huhn) + **Raketenwerfer** (Antrieb: zielsuchend im Bogen) + **Tesla-Stab** (Ladung: Kettenblitz) = **Gackernde Blitzrakete** – Hühner mit Raketenrucksack, die beim Aufprall elektrisch gackern und Blitze an alle Hühner in der Nähe weitergeben.
- Set 1 hat 60 Waffen mit 40 Geschossen, 19 Antrieben und 22 Ladungen – das ergibt **rund 16.700 mechanisch verschiedene Fusionen**. Alle müssen *funktionieren*, also systemisch aus den Bauteilen zusammengesetzt werden, nicht von Hand. Mit jeder neuen Waffe wächst die Zahl weiter.
- **Startdaten liegen bei:** `weapons.ts` enthält alle 60 Waffen, die drei Bauteil-Bibliotheken, den Namensgenerator (inkl. Adjektivendung nach Genus: „Gackernde Blitzrakete", „Rollender Kükenbumerang") und `fusioniere()`. Übernimm diese Datei als `/src/data/weapons.ts` und baue darauf auf.
- **Namensgenerator:** Fusionswaffen bekommen automatisch witzige Namen aus Adjektiv (vom Geschoss) + Element (von der Ladung) + Nomen (vom Antrieb), z. B. „Gackernde Blitzrakete", „Brummende Frostsäge", „Toastender Gift-Bumerang".
- **Voxel-Modell:** wird aus den Teilmodellen der Eingangswaffen zusammengesteckt (Lauf von der einen, Aufsatz von der anderen, Leuchtkern von der dritten) – so sieht jede Fusion einzigartig aus.
- **Tags & Synergien** aller Eingangswaffen bleiben erhalten (eine Fusion zählt für alle ihre Tags).
- **Instabilität (0–100 %):** je unterschiedlicher die Gruppen, desto instabiler – und stärker. Bei Krit kann eine instabile Waffe spontan einen Bonus-„Kawumm" auslösen (gut für den Spieler, nie für ihn schädlich).
- **Geheime Rezepte:** ~40 handgemachte Sonder-Kombinationen mit eigenem Effekt und Modell (z. B. 3× Hühnerkanone = **HUHNAGEDDON**: ein Riesenhuhn legt explodierende Eier). Beim ersten Entdecken: Fanfare, „Rezept entdeckt!" und eine neue Sammelkarte.
- **Rezeptbuch** im Codex zeigt entdeckte und (als Silhouette) unentdeckte Rezepte mit Hinweisen.
- Fusionen können weiter gemergt und mit Sternen/Mods aufgewertet werden wie normale Waffen.
- **Vorschau:** Vor dem Verschmelzen kann man die Waffe 10 Sekunden an einem Trainings-Dummy testen.

---

## 6. Ausrüstung & Stats

- **Stats:** Max-HP, Regeneration, Lebensraub, Schaden %, Nahkampf-/Fernkampf-/Elementar-/Explosionsschaden, Angriffsgeschwindigkeit, Krit-Chance, Krit-Schaden, Reichweite, Rüstung, Ausweichen, Lauftempo, Glück, Ernte (Bonus-Währung pro Welle), Explosionsradius, Kettenchance.
- **Mind. 150 Items** (passiv, stapelbar oder einzigartig) mit Vor- und Nachteilen (z. B. *Dynamitweste*: +40 % Explosionsradius, −10 % Rüstung, du explodierst bei Treffer).
- **Ausrüstungs-Slots:** Helm, Rüstung, Stiefel, Handschuhe, Amulett, Ring ×2, Rucksack – jeweils mit Seltenheit und zufälligen Affixen. Sets aus 3–4 Teilen mit Bonus.
- **Mind. 12 Charaktere** mit starkem Gimmick (z. B. *Der Pyromane*: nur Explosivwaffen, +100 % Radius; *Die Ingenieurin*: startet mit Turm, Türme erben Waffen-Mods; *Der Glückspilz*: alles zufällig, +Glück).

---

## 6b. Die Welt: Krawummia

- **Lore:** Baron von Bumm zündete einst die größte Bombe aller Zeiten – „Das Große Kawumm". Seitdem schwebt die Welt in Brocken durch den Himmel, und auf jedem Brocken hat sich eine andere Bande breitgemacht. Die Spieler sind **Kawumm-Jäger**, die Insel für Insel befreien.
- **Inseln = Kapitel/Arenen**, jede mit eigenem Look, eigener Gegner-Fraktion, eigenem Boss und eigenen Arena-Gefahren:
  - **Gackerfeld** – Bauernhof-Insel, Hühner-Kult, Heuballen, Scheunen (Einsteiger-Insel)
  - **Funkenschlund** – Tesla-Türme, Blitzfelder, Funkenkobolde
  - **Rostgrat** – Schrottberge und Fabriken der Blechbrut (Toaster-Roboter)
  - **Pilzmoor** – Riesenpilze, Giftsporen, Sumpfbande
  - **Lavakessel** – Vulkan, Lavaströme, Feuer-Gegner
  - **Frostfass** – Eiskristalle, Schneestürme, rutschiger Boden
  - **Bummburg** – Festung im Zentrum, Sitz von Baron von Bumm (Finale)
- **Weltkarte** als schwebende Voxel-Inseln, auf der man Insel für Insel freischaltet.
- **Helden** (mind. 12) mit Persönlichkeit, Startwaffe und Macke, z. B. *Der Pyromane*, *Die Ingenieurin*, *Der Glückspilz*, *Oma Granate* (strickt Splittergranaten, verteilt Kekse als Heilung), *Bauer Bruno* (Hühnerflüsterer).
- Alle Texte (Namen, Sprüche, Flavor-Texte) in einer eigenen Datei `/data/lore.ts`, damit die Welt leicht erweitert werden kann.

## 6c. Sammelkarten-System (wie Magic / Pokémon)

- **Jede Waffe, jede Fusion, jeder Held, jedes Item, jeder Gegner und jeder Boss ist eine Karte** im Kartenalbum (= Codex).
- **Kartenaufbau:** Name, Element-Symbole, Hauptwert (Waffe: *Wucht*, Held/Gegner: *HP*), Voxel-Artwork (live gerendert, drehbar), Typzeile (z. B. „Fusionswaffe — Exotisch · Explosiv · Blitz"), 1–3 benannte Fähigkeiten mit Regeltext, Flavor-Text mit Zitat, Seltenheit, Kartennummer (z. B. 087/220), Set-Symbol.
- **Elemente:** Feuer, Blitz, Gift, Eis, Explosiv, Tech, Natur, **Gacker** (Hühner-Element) und **Chaos**. Jedes Element hat Farbe, Rahmen und Symbol.
- **Sets:** Set 1 „Das Große Kawumm" (220 Karten), später weitere Sets pro neuer Insel.
- **Freischalten nur durch Spielen:** Waffe erstmals benutzt → Karte; Gegner 50× besiegt → Gegnerkarte; Rezept entdeckt → Fusionskarte; Erfolge → **Glanzkarten** (holografischer Shader).
- Karten haben **keinen Spielvorteil** über das Freischalten hinaus – das Album ist Sammel- und Entdeckerspaß.
- Karten lassen sich als Bild teilen (Export als PNG mit Rahmen).

### Meta-Progression (zwischen Runs, lokal gespeichert)
- Freischaltbare Charaktere, Waffen und Items über Erfolge.
- **Gefahrenstufen 0–10**, jede mit zusätzlichem Modifikator.
- Statistik-Seite & Codex (alle entdeckten Waffen/Items/Gegner mit Beschreibung).
- Speichern in **IndexedDB**, Export/Import als Code.

---

## 7. Multiplayer (1–4 Spieler, Koop)

- **Lobby mit 6-stelligem Raumcode** + Teilen-Link/QR-Code. Host erstellt, andere treten bei.
- **Host-autoritativ:** Host simuliert die Welt (Gegner, Projektile, Loot) mit fester Tick-Rate (30 Hz). Clients senden nur Input (Bewegungsvektor, Aktionen).
- **Clients:** lokale Prediction für die eigene Bewegung, Interpolation für alles andere (100 ms Puffer). Effekte (Partikel, Debris, Zahlen) werden **lokal aus Events erzeugt**, nicht synchronisiert.
- **Bandbreite:** kompakte Binär-Snapshots (Quantisierung, Delta-Kompression), Gegner-Updates priorisiert nach Nähe.
- **Koop-Regeln:** gemeinsame Welle, eigener Shop pro Spieler (Phase endet, wenn alle „Bereit" drücken), Gegner-HP skaliert mit Spielerzahl, Wiederbeleben, Revive-Ring.
- **Host-Migration** oder zumindest sauberer Abbruch mit Hinweis. Reconnect innerhalb 30 s.
- Spielerfarben (Cyan, Magenta, Gelb, Grün) für Figuren-Outline und Namensschilder.

---

## 8. Steuerung & UI

- **Touch:** dynamischer virtueller Joystick (erscheint wo der Daumen landet), rechts Fähigkeitsbutton (Dash) + Overkill-Button. Auto-Aim. Landscape-Modus.
- **Desktop:** WASD/Pfeiltasten, Leertaste = Dash, Maus optional für manuelles Zielen (umschaltbar).
- **Gamepad:** Gamepad-API, volle Menü-Navigation.
- **UI-Stil:** Pixel-Font (z. B. eigene Bitmap-Font im Code), dicke Rahmen, Seltenheitsfarben, leicht schräge, „punchy" Panels, Animationen beim Hover/Tap. Alle Touch-Ziele mind. 44 px.
- **Screens:** Titel, Charakterwahl, Lobby (Host/Join), HUD, Level-Up-Wahl, Shop, Waffen-Detail (Mods, Sterne, Evolution), Inventar/Ausrüstung, Pause, Run-Ende mit Statistik (Gesamtschaden, größte Kette, MVP-Waffe), Codex, Einstellungen.

---

## 9. Performance-Budget (Mobilgeräte sind Pflicht)

- Ziel: **60 FPS auf einem Mittelklasse-Smartphone von 2022**, 30 FPS als Untergrenze.
- **Instancing** für Gegner, Projektile und Debris; **Object Pools** für alles, was spawnt.
- Spatial Hashing für Kollisionen; Gegner-KI als einfache Steering-Behaviours, Flow-Field für Massen.
- Harte Obergrenzen: ~400 Gegner, ~1.500 Projektile, ~3.000 Partikel – bei Überschreitung zusammenfassen statt ruckeln.
- **Automatische Qualitätsstufen** (Render-Auflösung, Schatten, Partikeldichte) nach gemessener Framerate.
- Kein GC-Druck im Game-Loop (keine Allokationen pro Frame).

---

## 10. Datengetriebenes Design

- Waffen (inkl. ihrer drei Bauteile), Fusions-Rezepte, Items, Gegner, Helden, Karten, Lore, Synergien und Reaktionen als **typisierte Daten-Dateien** (`/data/*.ts`), nicht hartcodiert in der Logik. So lassen sich später einfach neue Inhalte ergänzen.
- Balancing-Werte zentral; ein **Debug-Menü** (Taste F1 / 5-Finger-Tap) zum Spawnen von Waffen, Gegnern, Gold, Wellen-Skip und FPS-Anzeige.

---

## 11. Projektstruktur (Monorepo)

```
/packages
  /core      Simulation: fester Tick, Spieler, Gegner, Waffen, Fusion, Projektile,
             Explosionen, Wellen, Shop, Seed-RNG – kein DOM, kein Three.js
  /data      weapons.ts (liegt bei), Items, Gegner, Helden, Karten, Lore, Rezepte
  /render    Three.js: Low-Res-Pipeline, Voxel-Mesher, Kamera, Post-FX, Partikel
  /ui        Menüs, HUD, Shop, Amboss, Kartenalbum, Weltkarte, Touch-Controls
  /net       Transport-Interface, Trystero-Adapter, TURN-Konfig, Snapshots, Prediction
  /audio     SFX-Synth, Musik, Mixer
  /platform  Interfaces + Implementierungen: web, capacitor, tauri
/apps
  /web       Vite + PWA
  /mobile    Capacitor (iOS, Android)
  /desktop   Tauri (Windows, macOS, Linux)
```

---

## 12. Vorgehen in Phasen

1. **Fundament:** Monorepo mit `core`/`render`/`platform`-Trennung, Vite-Projekt, Low-Res-Voxel-Rendering, isometrische Kamera, Spielerfigur läuft mit Touch + Tastatur durch eine Test-Arena. → *Screenshot/Video zeigen.*
2. **Kampf-Kern:** 3 Waffen, 3 Gegner, Wellen-Timer, Kristalle, Explosionen mit Debris, Hit-Stop, Screen-Shake. → *Muss sich schon jetzt großartig anfühlen.*
3. **Shop & Progression:** Level-Up, Shop, Merge, 20 Wellen, Boss, Run-Ende.
4. **Waffen-Fusion:** Bauteil-System (Geschoss/Antrieb/Ladung), Fusions-Amboss, Namensgenerator, zusammengesteckte Voxel-Modelle, Instabilität, erste 10 geheime Rezepte. → *Vor allem anderen Content fertigstellen – das ist der Kern.*
5. **Content-Ausbau:** alle Waffen, Mods, Sterne/Evolutionen, Synergien, Reaktionen, Items, Ausrüstung, Helden, Gegner-Fraktionen, Inseln.
6. **Welt & Karten:** Weltkarte Krawummia, Kartenalbum mit allen Karten, Glanzkarten, Rezeptbuch, Lore-Texte.
7. **Multiplayer:** Lobby, Raumcode, Host-Sim, Prediction/Interpolation, Revive.
8. **Polish:** UI-Animationen, Audio, Humor-Feinschliff (Sprüche, Gackern, Kazoo), Meta-Progression, PWA, Qualitätsstufen, Barrierefreiheit.
9. **App-Builds:** Capacitor-Build für iOS/Android und Tauri-Build für Desktop aus demselben Code; Plattform-Implementierungen ergänzen.
10. **Test:** auf iOS Safari, Android Chrome, Desktop mit 4 Geräten im selben Raum testen; Netzwerk-Latenz (150 ms) und Paketverlust (5 %) simulieren.

Nach jeder Phase: lauffähiger Build, kurze Liste der Änderungen, bekannte Probleme, nächster Schritt.

---

## 13. Qualitätskriterien („Definition of Done")

- Ein neuer Spieler versteht das Spiel in **unter 30 Sekunden** ohne Tutorial-Text.
- Ab Welle 8 gibt es regelmäßig **Kettenreaktionen mit 20+ Explosionen** – ohne dass die Framerate einbricht.
- Jede Waffe fühlt sich **klanglich und visuell unterschiedlich** an.
- Es gibt mindestens **10 gezielt baubare „Broken Builds"**, die sich absurd stark anfühlen.
- 4 Spieler auf iPhone, Android, Mac und Linux-PC können gemeinsam eine komplette Runde spielen.
- Jede beliebige Fusion aus 2–3 Waffen funktioniert, hat einen sinnvollen Namen, ein eigenes Modell und fühlt sich anders an.
- Testspieler lachen bei mindestens einer Waffe, einem Gegner und einem Spruch laut auf.
- Gegner wirken grimmig und frech, aber ein 8-jähriges Kind findet sie nicht gruselig.
- Alles ist ohne Bezahlung freischaltbar.
