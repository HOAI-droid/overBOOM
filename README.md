# OVERBOOM

3D-Voxel-Arena-Roguelite mit Waffen-Fusion. Läuft im Browser (Handy + PC), später als App (Capacitor) und Desktop (Tauri) aus demselben Code.

## Stand: Phase 6 – Welt & Karten (v0.6.0)
- **Weltkarte Krawummia**: schwebende Voxel-Inseln über einem Wolkenmeer, jede mit eigener Deko (Scheune, Tesla-Türme, Fabrik, Riesenpilze, Vulkan, Eiskristalle, Bummburg). Ablauf: Held wählen → Insel auf der Karte wählen → los.
- **Insel-Freischaltung**: Am Anfang ist nur Gackerfeld offen. Wer den Insel-Boss (Welle 10) besiegt, befreit die Insel (Flagge) und schaltet die nächste frei; ein Sieg auf Welle 20 erobert sie (Krone).
- **Kartenalbum** (Set „Das Große Kawumm", 292 Karten): alle Helden, Waffen, 40 Rezepte, Gegner, Bosse und Items. Jede Karte mit Name, Element-Symbolen, Hauptwert (Wucht/HP/Preis), live gerendertem und drehendem Voxel-Artwork, Typzeile, Fähigkeiten, Flavor-Text mit Zitat, Seltenheit und Kartennummer.
- **Freischalten nur durchs Spielen**: Waffe benutzt, Held gespielt, Item gekauft, 50 Gegner besiegt, Boss besiegt, Rezept entdeckt. Gesperrte Karten zeigen eine Silhouette und wie man sie bekommt.
- **Glanzkarten** mit holografischem Schimmer (folgt dem Zeiger): z. B. Waffe auf 5 Sterne, Sieg mit dem Helden, 500 Gegner einer Art – und über **18 Erfolge**.
- **Karten als Bild** speichern bzw. am Handy teilen (PNG mit Rahmen).
- **Rezeptbuch** im Album: 40 geheime Rezepte (30 neu), unentdeckte mit Hinweis. Neue Rezept-Wirkungen: Mini-Bumm, Feuerspur, Frostnova, Goldregen, Donnerschlag.
- **Lore** (`data/lore.ts`): Weltgeschichte, Ankunfts- und Befreiungstexte je Insel, Boss-Auftritte, Wellen- und Todessprüche, Karten-Zitate.
- **Spielstand**: Profil wird auf dem Gerät gespeichert; Export/Import als Code (Album → Erfolge). Meldungen für neue Karten, Glanzkarten, Erfolge und Inseln.

## Stand: Phase 5 – Content-Ausbau (v0.5.0)
- **13 Helden** mit Startwaffe, Werten und Macke (z. B. Pyromane bekommt nur Explosiv/Feuer, Glückspilz startet mit Zufallswaffe, Oma Kawumm verteilt Heil-Kekse, Turmbauer darf 2 Türme). Start: Held wählen → Insel wählen.
- **7 Inseln** mit eigener Gegner-Fraktion, Farbpalette, Bodengefahr (Eis rutscht, Gift, Tesla-Platten, Lava, brennendes Heu …) und Boss auf Welle 10; Welle 20 immer Baron von Bumm.
- **16 Gegnertypen + 4 Bosse** mit neuen Verhalten: Sprinter, Heiler, Schildträger, Minenleger, Spurleger, Beschwörer, Rutscher, Splitter (Schleimi teilt sich). Bosse König Gockel, Megatoaster, Morchella mit wechselnden Angriffsmustern.
- **Synergien**: 9 Elemente, Boni ab 2/4/6 Waffen gleichen Elements (Feuerpfützen, Mini-Nuke, Gewitter, Giftwolken, Drohnen, Küken, Eierregen …). Anzeige im Shop und als Chips im HUD.
- **15 Elementar-Reaktionen** (Dampfexplosion, Schockfrost, Plasmabrand, Sumpf, Strudel …), wenn zwei Elemente denselben Gegner treffen.
- **Sterne & Evolutionen**: Waffen sammeln Kills (★1–5, je Stern mehr Schaden/Feuerrate); mit 5 Sternen Evolution A „Mehr" (Salven) oder B „Größer" (2,4× Schaden), mit eigenen Namen (Schwarmraketen/Atomrakete, Doppelpistolen/Handkanone …).
- **12 Waffen-Mods** (Doppelschuss, Querschläger, Zielsuch-Chip, Clusterbombe, Kettenblitz, Gravitations-Kern …), im Shop kaufbar, Einbau ab Stufe II (II: 1 Slot … V: 4).
- **159 Items** (vorher 24), viele mit Vor- und Nachteil.
- **Ausrüstung**: 8 Plätze (Helm, Rüstung, Stiefel, Handschuhe, Amulett, 2 Ringe, Rucksack), Seltenheit I–IV mit zufälligen Zusatzwerten, **4 Sets** (Grummel-Garnitur, Barons Gala-Garderobe, Funkenkluft, Omas Strickset) mit Boni ab 2 Teilen bzw. komplett. Quellen: Elite-Gegner (30 %), Bosse (immer, oft Set-Teile), Shop. Shop-Tab „Ausrüstung": anlegen, ablegen, verschrotten.
- Tests: alle Reaktionen, Synergie-Stufen, Helden, Inseln, Bosse, Sterne, Evolution, Mods, Ausrüstung und Sets.

## Stand: Phase 4 – Waffen-Fusion
- **Fusions-Amboss** im Shop (Tab „⚒ Amboss"): 2–3 Waffen aus verschiedenen Gruppen wählen, dann festlegen, welche Waffe **Geschoss**, **Antrieb** und **Ladung** liefert (jede mindestens eins). Live-Vorschau mit Name, Werten, Elementen und Instabilität; Schmiedelohn steigt mit der Welle.
- **Systemisch**: Jede der ~16.700 Kombinationen funktioniert. Dafür simuliert der Kern jetzt **alle 19 Antriebe** (u. a. Kreisel, Querschläger, Bumerang, Spirale, Strahl, Kegel, Himmelsregen, Hüpfen, Minen, Türme, Schwarm-Begleiter, Rollen, Teleport, Rundumschlag) und **alle 22 Ladungen** (u. a. Küken-Begleiter, Verhühnerung, Lavapfützen, Nässe leitet Blitze doppelt weit, Säure, Magnet, Schwerkraft-Sog, Konfetti-Verwirrung, Einfrieren nach 3 Frost-Treffern). Dadurch sind auch **alle 60 Waffen im Shop**.
- **Werte**: Feuerrate und Reichweite vom Antriebs-Spender, Schaden so, dass der DPS dem Mittel der Zutaten entspricht – plus Bonus je nach **Instabilität** (0–100 %: je verschiedener die Gruppen, desto instabiler und stärker). Bei Krit kann eine instabile Waffe einen Bonus-„Kawumm!" auslösen (nie schädlich für dich).
- **Namensgenerator** (Adjektiv vom Geschoss + Element der Ladung + Nomen vom Antrieb, Endung nach Genus): „Gackernde Blitzrakete", „Rollender Kükenbumerang" …
- **Zusammengesteckte Voxel-Modelle**: Körper vom Antriebs-Spender, Aufsatz = Geschoss, Leuchtkern in Ladungsfarbe, Funken je nach Instabilität.
- **10 geheime Rezepte** mit eigenem Namen, Effekt und Modell, z. B. 3× Hühnerkanone = **HUHNAGEDDON** (Riesenhuhn, Eier-Bombenregen), Kawummageddon (Cluster-Explosionen), Donnertoaster, Schwarzes Buffet (Sog + Implosion), Omas Geheimrezept (heilende Kekse), Quietschendes Inferno, Frostfeuerwerk, Kettensägen-Karussell, Bienenkönigin (Giftwolken), Gackerndes Chaos (Verhühnerungs-Strahl). Beim ersten Entdecken: Fanfare + „Rezept entdeckt!".
- **Rezeptbuch** im Amboss: entdeckte Rezepte mit Zutaten, unentdeckte als „???" mit Hinweis (auf dem Gerät gespeichert).
- Fusionen lassen sich wie normale Waffen mergen, verkaufen und aufwerten.
- Tests: alle 418 Antrieb×Ladung-Kombinationen, 300 Zufallsfusionen, alle 60 Waffen und alle 10 Rezepte kämpfen ohne Fehler und machen Schaden.

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
Debug: `?wave=10` (Startwelle, 10 = Boss), `?god=1` (unverwundbar), `?gems=500` (Startkristalle), `?waffen=huehnerkanone,huehnerkanone,huehnerkanone` (Startwaffen, überspringt die Wahl), `?held=pyromane&insel=lavakessel` (Schnellstart), `?galerie=1` (alle Gegner zum Anschauen), `?beute=6` (Ausrüstung in den Beutel), `?alles=1` (alle Karten und Inseln freischalten).

## Bekannte Probleme
- Gegner laufen direkt auf den Spieler zu (noch kein Flow-Field); an Säulen rutschen sie seitlich ab.
- Simulations-Ereignisse sind kleine Objekte pro Tick (wenig, aber nicht null GC); Gegner, Geschosse und Partikel sind gepoolt.
- Hit-Stop hält die lokale Simulation an – im Koop (Phase 7) muss er rein visuell werden.
- Noch kein Audio (Phase 8), keine Overkill-Leiste, kein Debug-Menü (nur URL-Parameter).
- Phase-5-Inhalte sind grob balanciert; der Balancing-Bot kauft noch keine Mods/Ausrüstung und evolviert nicht.
- Helden sind alle von Anfang an frei (Freischaltung über Erfolge folgt mit der Meta-Progression in Phase 8).
- Speicherung noch über localStorage statt IndexedDB; Gefahrenstufen 0–10 fehlen noch (Phase 8).
- Das Kartenalbum nutzt einen zweiten kleinen WebGL-Kontext für die Artworks; auf sehr alten Geräten ungetestet.
- Rezepte ohne eigenes Modell nutzen das zusammengesteckte Fusionsmodell mit Krone; die 30 neuen Rezepte sind grob balanciert.
- Die Weltkarte kennt noch keine Zwischeninseln oder Zufallsereignisse.
- Balancing grob: Mit Bot-Spieler starke Streuung (Tod zwischen Welle 2 und 12, gute Runs gewinnen); Raketenwerfer als Start ist am stärksten. Muss mit echten Spielern nachjustiert werden (`data/src/balance.ts`).
- Fusions-Vorschau am Trainings-Dummy (10 s testen) fehlt noch; die Vorschau zeigt nur Werte.
- Fusionen aus Fusionen sind bewusst nicht möglich (nur Mergen).
- Neue Antriebe/Ladungen sind funktional, aber noch grob balanciert; Sammelkarten für Rezepte kommen mit Phase 6.
- Einstellungen (Shake, Zahlen) nur per URL, noch nicht im Menü gespeichert.
- Auf echten Handys noch nicht gemessen (nur Headless-Chromium mit Software-Rendering getestet).

## Nächster Schritt: Phase 7 – Multiplayer
Lobby mit Raumcode, Host-Simulation, Prediction/Interpolation, Wiederbeleben (Revive) – siehe `docs/OVERBOOM_Prompt.md`.
Vollständige Planung: `docs/OVERBOOM_Prompt.md`, Waffendaten: `docs/Waffenkatalog.md`.
