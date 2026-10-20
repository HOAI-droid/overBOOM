import type { Platform } from './index.ts';
import { t } from '../../data/src/i18n.ts';

/* IndexedDB: Spielstand dauerhaft speichern (größer und robuster als localStorage) */
let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open('overboom', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
async function idbGet(key: string): Promise<string | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const r = d.transaction('kv', 'readonly').objectStore('kv').get(key);
      r.onsuccess = () => resolve(typeof r.result === 'string' ? r.result : undefined);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
async function idbSet(key: string, value: string): Promise<void> {
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export function createWebPlatform(): Platform {
  // Browser bitten, den Speicher nicht automatisch zu leeren
  try { void navigator.storage?.persist?.(); } catch { /* egal */ }
  let wakeLock: { release(): Promise<void> } | null = null;
  return {
    name: 'web',
    storage: {
      async get(key) {
        const v = await idbGet(key);
        if (v !== undefined) return v;
        // alter Spielstand aus localStorage → in IndexedDB übernehmen
        let old: string | null = null;
        try { old = localStorage.getItem('overboom:' + key); } catch { /* gesperrt */ }
        if (old !== null) void idbSet(key, old);
        return old;
      },
      async set(key, value) {
        await idbSet(key, value);
        // Sicherheitskopie (Safari löscht beides nach langer Pause – dafür gibt es den Export-Code)
        try { localStorage.setItem('overboom:' + key, value); } catch { /* privater Modus o. Ä. */ }
      }
    },
    haptic(ms) {
      try {
        // Browser blockieren Vibration vor der ersten Nutzer-Interaktion
        const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
        if (ua && !ua.hasBeenActive) return;
        navigator.vibrate?.(ms);
      } catch { /* nicht unterstützt (z. B. iOS-Safari) */ }
    },
    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (document.fullscreenElement) await o.lock?.('landscape').catch(() => {});
      } catch { /* iOS-Safari kennt kein Fullscreen für Seiten – als PWA installieren */ }
    },
    async keepAwake(on) {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
        if (on && nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
        if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
      } catch { /* nicht unterstützt */ }
    },
    async saveImage(blob, filename) {
      try {
        const file = new File([blob], filename, { type: blob.type });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (matchMedia('(pointer: coarse)').matches && nav.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: t('OVERBOOM-Karte') });
          return;
        }
      } catch { /* abgebrochen oder nicht unterstützt → Download */ }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    async shareLink(title, url) {
      try {
        if (matchMedia('(pointer: coarse)').matches && navigator.share) { await navigator.share({ title, url }); return 'geteilt'; }
      } catch { /* abgebrochen → kopieren */ }
      try { await navigator.clipboard.writeText(url); return 'kopiert'; } catch { return 'fehler'; }
    },
    registerOffline() {
      try {
        if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
        // Einzeldatei-Build (Artefakt) hat keinen Service Worker
        if (document.querySelector('meta[name="overboom-single"]')) return;
        void navigator.serviceWorker.register('./sw.js').catch(() => {});
      } catch { /* nicht unterstützt */ }
    },
    randomId() {
      const a = new Uint32Array(3);
      crypto.getRandomValues(a);
      return [...a].map((n) => n.toString(36)).join('');
    },
    systemSprache() {
      return (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'en';
    },
    neuLaden() { location.reload(); },
    async copyText(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
    },
    isTouchDevice() {
      return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    }
  };
}
