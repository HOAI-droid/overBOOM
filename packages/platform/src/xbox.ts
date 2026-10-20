import type { Platform } from './index.ts';
import { createWebPlatform } from './web.ts';

/**
 * Xbox-App: Das Spiel läuft in einer UWP-Hülle (apps/xbox) mit WebView2.
 * Die Hülle spricht über chrome.webview-Nachrichten mit uns:
 *   Hülle → Spiel: { t: 'zurueck' } (B-Taste/BackRequested), { t: 'speicher', knapp: true }
 *   Spiel → Hülle: { t: 'beenden' }, { t: 'bild', name, daten (Base64) }
 * Ohne Hülle (Test im Browser mit ?plattform=xbox) bleiben die Nachrichten folgenlos.
 */
interface WebView {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', cb: (e: { data: unknown }) => void): void;
}

export function createXboxPlatform(): Platform {
  const web = createWebPlatform();
  const wv = (globalThis as { chrome?: { webview?: WebView } }).chrome?.webview;
  const zurueck: (() => void)[] = [];
  const knapp: (() => void)[] = [];
  const bildWarte = new Map<string, (pfad: string | void) => void>();
  wv?.addEventListener('message', (e) => {
    const d = (typeof e.data === 'string' ? safeJson(e.data) : e.data) as { t?: string; knapp?: boolean; name?: string; pfad?: string } | null;
    if (!d) return;
    if (d.t === 'zurueck') for (const cb of zurueck) cb();
    else if (d.t === 'speicher' && d.knapp) for (const cb of knapp) cb();
    else if (d.t === 'bild' && d.name) { bildWarte.get(d.name)?.(d.pfad || undefined); bildWarte.delete(d.name); }
  });

  return {
    ...web,
    name: 'xbox',
    nurController: true,
    haptic(ms) {
      // Rumble über den Controller (Gamepad API)
      const pad = navigator.getGamepads?.().find((p) => p) as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }) | undefined;
      void pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: Math.min(400, ms), strongMagnitude: ms >= 120 ? 0.9 : 0.5, weakMagnitude: 0.6 })?.catch(() => {});
    },
    async toggleFullscreen() { /* immer Vollbild */ },
    async keepAwake() { /* Konsole dimmt beim Spielen nicht */ },
    isTouchDevice() { return false; },
    async saveImage(blob, filename) {
      if (!wv) return web.saveImage(blob, filename);
      const daten = await new Promise<string>((ok, err) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1] ?? '');
        r.onerror = () => err(r.error);
        r.readAsDataURL(blob);
      });
      // Hülle speichert in „Bilder\\OVERBOOM" und meldet den Pfad zurück
      return new Promise((ok) => {
        bildWarte.set(filename, ok);
        setTimeout(() => { if (bildWarte.delete(filename)) ok(); }, 8000);
        wv.postMessage({ t: 'bild', name: filename, daten });
      });
    },
    registerOffline() { /* Dateien liegen ohnehin in der App */ },
    beenden() { wv?.postMessage({ t: 'beenden' }); },
    onZurueck(cb) { zurueck.push(cb); },
    onSpeicherKnapp(cb) { knapp.push(cb); }
  };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
