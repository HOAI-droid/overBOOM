/**
 * Rechtliches im Spiel: Datenschutz-Kurzfassung, Lizenzen und der einmalige Koop-Hinweis.
 * Ausführlich: DATENSCHUTZ.md, DRITTANBIETER.md und LICENSE im Projekt
 * (bei neuen Abhängigkeiten oder Servern hier und dort aktualisieren!).
 */
const PROJEKT = 'github.com/HOAI-droid/overboom';

/** Seite „Datenschutz & Lizenzen" (aus den Einstellungen) */
export function rechtlichesHtml(): string {
  return `
    <div class="ob-panel ob-wide ob-recht">
      <div class="ob-shop-head">
        <h2 class="ob-h">Datenschutz &amp; Lizenzen</h2>
        <button type="button" class="ob-go" data-act="rechtzu" data-focus="rechtzu">Zurück</button>
      </div>
      <h3 class="ob-h3">Datenschutz</h3>
      <ul class="ob-recht-liste">
        <li><b>Solo:</b> Es werden keine Daten übertragen. Kein Konto, keine Werbung, kein Tracking.</li>
        <li><b>Spielstand, Einstellungen, Name</b> bleiben nur auf diesem Gerät. Löschen: App deinstallieren bzw. Website-Daten löschen.</li>
        <li><b>Koop:</b> Damit sich die Geräte finden, gehen deine IP-Adresse und dein Spielername an Verbindungsserver
          (STUN von Google und Cloudflare, öffentliche Nostr-Relays) und an deine Mitspieler. Die Verbindung selbst ist verschlüsselt.</li>
        <li>Einige dieser Anbieter sitzen außerhalb der EU (z. B. USA).</li>
      </ul>
      <p class="ob-hint2">Ausführlich: ${PROJEKT} → DATENSCHUTZ.md</p>
      <h3 class="ob-h3">Lizenz</h3>
      <p class="ob-recht-text">OVERBOOM © 2026 HOAI-droid – alle Rechte vorbehalten. Bereitgestellt ohne Gewähr.</p>
      <h3 class="ob-h3">Verwendete Open-Source-Software</h3>
      <ul class="ob-recht-liste">
        <li>three.js – MIT – © three.js authors</li>
        <li>Trystero – MIT – © Dan Motzenbecker</li>
        <li>@noble/secp256k1 – MIT – © Paul Miller</li>
        <li>qrcode-generator – MIT – © Kazuhiko Arase</li>
        <li>Schrift Silkscreen – SIL Open Font License 1.1 – © The Silkscreen Project Authors</li>
        <li>Apps: Tauri (MIT/Apache 2.0), Capacitor (MIT), AndroidX (Apache 2.0), WinUI 2 (MIT) und weitere Bibliotheken</li>
      </ul>
      <p class="ob-hint2">Vollständige Liste mit allen Lizenzen: ${PROJEKT} → DRITTANBIETER.md</p>
    </div>`;
}

/** Einmaliger Hinweis vor dem ersten Koop-Raum */
export function koopHinweisHtml(): string {
  return `
    <div class="ob-panel ob-recht ob-koophinweis">
      <h2 class="ob-h">Kurz vor dem Koop</h2>
      <p class="ob-recht-text">Damit sich eure Geräte finden und direkt verbinden können, werden deine <b>IP-Adresse</b>
        und dein <b>Spielername</b> an Verbindungsserver (Google, Cloudflare, öffentliche Nostr-Relays – teils außerhalb der EU)
        und an deine Mitspieler übertragen.</p>
      <p class="ob-recht-text">Solo werden keine Daten übertragen. Tipp: Nimm einen Spitznamen statt deines echten Namens.</p>
      <div class="ob-row ob-center">
        <button type="button" class="ob-go" data-act="khok" data-focus="khok">Verstanden – weiter</button>
        <button type="button" class="ob-btn2" data-act="khmehr" data-focus="khmehr">Mehr lesen</button>
        <button type="button" class="ob-btn2" data-act="khab" data-focus="khab">Abbrechen</button>
      </div>
    </div>`;
}
