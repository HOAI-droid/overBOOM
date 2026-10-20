# OVERBOOM auf der Xbox Series X|S (Developer Mode)

Die Xbox-Version ist eine kleine **UWP-App** (C#, WinUI 2) unter `apps/xbox`. Sie zeigt das Spiel in einem
**WebView2** an und liefert den Web-Build (`dist/`) im Paket mit. Das Spiel startet also **offline**:
Es wird nichts aus dem Internet nachgeladen. Nur der Koop braucht Netz.

- Das Paket ist als **App** registriert, **nicht als Game**: Im Spiele-Modus stürzt WebView2 auf der Xbox ab.
- Kein Mauszeiger (`RequiresPointerMode = WhenRequested`), Vollbild, TV-sichere Ränder (5 %) macht das Spiel selbst.
- Die **B-Taste** schließt die App nie. Sie wirkt im Spiel wie „Zurück“ (Menü zurück bzw. Pause).
  Beenden geht nur über **Titelmenü → Beenden**.

## 1. Developer Mode aktivieren (einmalig)

1. Auf der Xbox die App **Xbox Dev Mode** aus dem Store installieren und starten.
2. Den angezeigten Code unter <https://partner.microsoft.com/xbox/devmode> mit dem Partner-Center-Konto eintragen.
3. In der Dev-Mode-App **Neu starten und zum Dev Mode wechseln**. Nach dem Neustart erscheint **Dev Home**.

## 2. Device Portal einschalten

1. In **Dev Home** unter *Remote Access Settings* **Enable Xbox Device Portal** aktivieren.
2. Benutzername und Passwort setzen und die angezeigte Adresse notieren, z. B. `https://192.168.178.42:11443`.
3. Die Adresse am PC im Browser öffnen. Die Zertifikatswarnung bestätigen und dich anmelden.

## 3. Paket holen

GitHub → *Actions* → **Xbox-App** → neuester Lauf → Artefakt **OVERBOOM-Xbox** herunterladen und entpacken:

| Datei | Zweck |
|---|---|
| `OVERBOOM-Xbox.msix` | die App |
| `Dependencies/*.appx` | Laufzeitpakete (VCLibs, .NET Native, Microsoft.UI.Xaml 2.8) |
| `OVERBOOM-Test.cer` | selbstsigniertes Testzertifikat (`CN=OVERBOOM Test`) |
| `ANLEITUNG.md` | diese Anleitung |

Selbst bauen (Windows mit Visual Studio 2022 + Workload „UWP-Entwicklung“):

```powershell
npm ci
npm run build:xbox          # Web-Build → apps/xbox/OverboomXbox/Web
# dann apps/xbox/OverboomXbox.sln öffnen, Release | x64,
# Projekt → Veröffentlichen → App-Pakete erstellen → Sideloading
```

## 4. Installieren

1. Im Device Portal auf **Home → My games & apps → Add** klicken.
2. `OVERBOOM-Xbox.msix` wählen → **Next**.
3. Unter *Optional* alle Dateien aus `Dependencies/` hinzufügen. Falls nach einem Zertifikat gefragt wird, `OVERBOOM-Test.cer` wählen.
4. **Start** klicken. Nach der Installation steht OVERBOOM in Dev Home und unter *Meine Spiele & Apps → Apps*.
5. **Als App prüfen:** In Dev Home OVERBOOM markieren → Menütaste (☰) → **View details** → *App type* muss **App** sein.
   Falls dort *Game* steht, auf **App** umstellen.

Alternativ geht es direkt aus Visual Studio: *Remotecomputer*, IP der Xbox, Authentifizierung *Universell*,
Kopplungs-PIN über Dev Home → *Pair with Visual Studio*.

Updates: neue `.msix` genauso installieren. Spielstand, Profil und Karten bleiben erhalten (IndexedDB der App).

## 5. Steuerung

| Taste | Im Spiel | In Menüs |
|---|---|---|
| Linker Stick | laufen | Fokus bewegen |
| Steuerkreuz | – | Fokus bewegen, Regler mit ◀ ▶ verstellen |
| A | Dash | auswählen / Textfeld öffnen (Bildschirmtastatur) |
| RB / RT | Dash | – |
| Y / X | OVERBOOM auslösen | – |
| B | Pause | zurück |
| Menü ☰ | Pause | – |

Hinweise im Spiel zeigen Controller-Symbole statt Tastatur- oder Touch-Hinweisen.

## 6. Remote-Debugging (edge://inspect)

Die WebView2-DevTools sind in der App eingeschaltet.

1. Device Portal muss aktiv sein (Schritt 2). Die Xbox und der PC müssen im selben Netz sein.
2. Am PC in **Microsoft Edge** `edge://inspect` öffnen.
3. Unter **Connect to a remote Windows device** die Device-Portal-Adresse eintragen, z. B. `https://192.168.178.42:11443`,
   und mit den Device-Portal-Zugangsdaten verbinden.
4. OVERBOOM starten. Unter *Remote Target* erscheint `https://overboom.local/index.html` → **inspect**.
   Damit hast du Konsole, Netzwerk, Performance und Speicher-Profil.

Falls kein Ziel erscheint: In Dev Home prüfen, ob *Remote Tools for Microsoft Edge* bzw. das
Debugging für WebView2 angeboten wird, und die App neu starten. Im Browser am PC lässt sich die Xbox-Oberfläche
auch ohne Konsole testen: `npm run dev` und `http://localhost:5173/?plattform=xbox` mit angeschlossenem Controller.

## 7. Speicher und Qualität

- **Budget:** UWP-Apps (nicht Games) haben auf der Xbox **etwa 1 GB** Arbeitsspeicher.
- **Messung (Chromium, 1080p, Welle mit 200 Gegnern):**
  - JS-Heap maximal **~15 MB**.
  - Alle Browser-Prozesse zusammen, inklusive Software-GPU, **~740 MB**.
  - Die Xbox rendert per GPU, dort ist der Bedarf eher geringer.
- **Qualität „Automatisch“ ist auf der Xbox konservativ:**
  - Sie startet auf **mittel** (216 px interne Höhe) und steigt nie auf „hoch“.
  - Bei schwacher Bildrate fällt sie auf „niedrig“.
- **Speicher-Wächter:**
  - Die Hülle beobachtet `MemoryManager.AppMemoryUsageLevel`.
  - Bei *High*/*OverLimit* schaltet das Spiel auf „niedrig“ und zeigt den Hinweis „Speicher knapp“.

## 8. Technik

- Die Hülle mappt den Ordner `Web/` auf `https://overboom.local/` (`SetVirtualHostNameToFolderMapping`).
- Vor dem ersten Skript setzt sie `globalThis.__OVERBOOM_XBOX__ = true`. Daran erkennt `createPlatform()` die Plattform `xbox` (`packages/platform/src/xbox.ts`).
- Nachrichten (JSON über `chrome.webview`):
  - Hülle → Spiel: `{t:'zurueck'}`, `{t:'speicher', knapp:true}`, `{t:'bild', name, pfad}`
  - Spiel → Hülle: `{t:'beenden'}`, `{t:'bild', name, daten}`
- Kommen B (Gamepad-API) und `BackRequested` gleichzeitig an, zählt nur der erste Druck innerhalb von 300 ms.
- Sammelkarten-Bilder speichert die Hülle in **Bilder\OVERBOOM**.

## Bekannte Grenzen

- Ungetestet auf echter Hardware: Ob WebView2 auf der Xbox die Gamepad-API direkt durchreicht, hängt von der Systemversion ab.
  Falls der Controller im Spiel nicht reagiert, bitte melden. Die Menüs verstehen zusätzlich die Tastencodes `GamepadA`/`GamepadDPad…`.
- Das Testzertifikat ist nur für den Developer Mode gedacht. Für den Store braucht es Partner Center (ID@Xbox bzw. Creators Program).
