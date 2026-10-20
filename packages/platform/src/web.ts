import type { Platform } from './index.ts';

export function createWebPlatform(): Platform {
  let wakeLock: { release(): Promise<void> } | null = null;
  return {
    name: 'web',
    storage: {
      async get(key) {
        try { return localStorage.getItem('overboom:' + key); } catch { return null; }
      },
      async set(key, value) {
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
    isTouchDevice() {
      return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    }
  };
}
