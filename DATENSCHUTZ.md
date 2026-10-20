# Datenschutzhinweise für OVERBOOM

Stand: Oktober 2026 · gilt für alle Versionen (Browser, Windows, Mac, Linux, Android, iOS, Xbox)

## Kurz gesagt
- **Solo-Spiel:** Es werden keine Daten übertragen. Kein Konto, keine Werbung, kein Tracking, keine Analyse.
- **Koop-Spiel:** Damit die Geräte sich finden und verbinden können, werden deine **IP-Adresse** und dein **Spielername** an Verbindungsserver und an deine Mitspieler übertragen.

## Verantwortlich
OVERBOOM ist ein privates, nicht-kommerzielles Hobbyprojekt von HOAI-droid.
Kontakt: über die Issues des Projekts auf GitHub: <https://github.com/HOAI-droid/overboom/issues>

## 1. Daten auf deinem Gerät
Diese Daten werden **nur lokal auf deinem Gerät** gespeichert, im Speicher des Browsers bzw. der App (IndexedDB/localStorage):
- Spielstand und Profil (freigeschaltete Helden, Inseln, Karten, Erfolge, Rezepte, Statistiken)
- Einstellungen (Lautstärke, Grafik usw.)
- dein gewählter Spielername
- eine zufällige Kennung, mit der du nach einem Verbindungsabbruch in denselben Koop-Platz zurückkommst

Sie verlassen dein Gerät nicht, außer:
- du nutzt Koop (siehe 2), oder
- du exportierst deinen Spielstand selbst als Code bzw. teilst ein Kartenbild.

Löschen: App deinstallieren bzw. die Website-Daten im Browser löschen.

## 2. Koop (nur wenn du einen Raum erstellst oder beitrittst)
Koop funktioniert ohne eigenen Spielserver: Die Geräte verbinden sich direkt miteinander (WebRTC, verschlüsselt). Um sich zu finden, nutzt das Spiel öffentliche Dienste Dritter.

| Empfänger | Welche Daten | Zweck |
|---|---|---|
| **Mitspieler im selben Raum** | IP-Adresse, Spielername, gewählter Held, Spieleingaben | direkte Verbindung und gemeinsames Spiel |
| **STUN-Server** von Google LLC (`stun.l.google.com`) und Cloudflare, Inc. (`stun.cloudflare.com`), beide USA | IP-Adresse und Port | ermitteln, unter welcher Adresse dein Gerät erreichbar ist |
| **Öffentliche Nostr-Relays** (weltweit, von Dritten betrieben, pro Raum eine Auswahl von 5) | IP-Adresse, verschlüsselte Verbindungsangebote, ein aus dem Raumcode abgeleiteter Kennwert | damit sich die Geräte im selben Raum finden |

Die Verbindungsangebote an die Relays sind verschlüsselt. Die Betreiber sehen aber, dass von deiner IP-Adresse aus eine Verbindung besteht.

Eingebaute Relays:
- nos.lol
- nostr.chaima.info, nostr.christiansass.de, nostr.rblb.it, nostr.robosats.org, nostr.stakey.net
- relay.aarpia.com, relay.agentry.com, relay.bitmacro.cloud, relay.bullishbounty.com, relay.degmods.com
- relay.flashapp.me, relay.grigic.org, relay.hackshed.dev, relay.kaleidoswap.com, relay.layer.systems
- relay.nostr.blockhenge.com, relay.nostr.dev.br, relay.nostrmap.net, relay.novospes.com
- relay.piazza.today, relay.routstr.com

Einige Anbieter sitzen außerhalb der EU, z. B. in den USA. Dort gilt ein anderes Datenschutzniveau. Google und Cloudflare sind nach dem EU-US Data Privacy Framework zertifiziert.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. f DSGVO: Ohne diese Übertragung ist Koop technisch nicht möglich. Wer das nicht möchte, spielt solo; dann wird nichts übertragen.

## 3. Download und Browser-Version über GitHub
Die Downloads und die Browser-Version (<https://hoai-droid.github.io/overboom/>, GitHub Pages) liegen bei GitHub (GitHub, Inc., USA). Beim Aufruf der Projektseite oder der Browser-Version und beim Herunterladen verarbeitet GitHub technische Daten wie die IP-Adresse; es gilt die [Datenschutzerklärung von GitHub](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement). Der Entwickler erhält davon nur anonyme Download-Zahlen; die Browser-Version enthält keine Analyse- oder Tracking-Dienste. Spielstände der Browser-Version liegen nur im Speicher deines Browsers.

## 4. App-Berechtigungen
- **Android/iOS:** Vibration; Teilen-Menü nur, wenn du selbst ein Kartenbild oder einen Einladungslink teilst.
- **Windows/Mac/Linux:** Schreiben in den Ordner „Downloads/OVERBOOM“ beim Speichern eines Kartenbilds.
- **Xbox:** Netzwerk (Koop); Schreiben in „Bilder\OVERBOOM“ beim Speichern eines Kartenbilds.

Es werden keine Kontakte, kein Standort, keine Kamera und kein Mikrofon genutzt.

## 5. Kinder
Das Spiel erhebt keine Daten, um Personen zu identifizieren. Im Koop sehen Mitspieler den selbst gewählten Spielernamen. Bitte keinen echten Namen verwenden.

## 6. Deine Rechte
Du hast nach der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Widerspruch. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren.

Da der Entwickler selbst keine Daten von dir speichert, liegen alle Spieldaten nur auf deinem Gerät. Für die Server der Drittanbieter (Abschnitt 2 und 3) gelten deren Datenschutzerklärungen.
