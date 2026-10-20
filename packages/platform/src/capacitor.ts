import type { Platform } from './index.ts';
import { createWebPlatform } from './web.ts';
import { t } from '../../data/src/i18n.ts';

/**
 * Handy-App (Capacitor, iOS/Android): Speicher bleibt IndexedDB in der App-WebView,
 * dazu echte Vibration und das System-Teilen-Menü für Links und Kartenbilder.
 * Vollbild, Querformat und „Bildschirm bleibt an" stellen die nativen Projekte ein.
 */
export async function createCapacitorPlatform(): Promise<Platform> {
  const web = createWebPlatform();
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  const { Share } = await import('@capacitor/share');
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  return {
    ...web,
    name: 'capacitor',
    haptic(ms) {
      // kurze Stöße als leichter Impuls, längere als kräftiger
      void Haptics.impact({ style: ms >= 120 ? ImpactStyle.Heavy : ms >= 40 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
    },
    async toggleFullscreen() { /* App läuft immer im Vollbild */ },
    async keepAwake() { /* nativ: Bildschirm bleibt während der App an */ },
    isTouchDevice() { return true; },
    async saveImage(blob, filename) {
      try {
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(',')[1] ?? '');
          r.onerror = () => rej(r.error);
          r.readAsDataURL(blob);
        });
        const f = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
        await Share.share({ title: t('OVERBOOM-Karte'), files: [f.uri] });
      } catch { /* abgebrochen */ }
    },
    async shareLink(title, url) {
      try { await Share.share({ title, url }); return 'geteilt'; } catch { return web.shareLink(title, url); }
    },
    registerOffline() { /* Dateien liegen in der App */ }
  };
}
