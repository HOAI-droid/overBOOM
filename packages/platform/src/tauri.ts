import type { Platform } from './index.ts';
import { createWebPlatform } from './web.ts';

/**
 * Desktop-App (Tauri): wie die Web-Plattform – Speicher bleibt IndexedDB im App-Datenordner –,
 * aber mit echtem Fenster-Vollbild und Bildexport in den Downloads-Ordner.
 */
export async function createTauriPlatform(): Promise<Platform> {
  const web = createWebPlatform();
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const fs = await import('@tauri-apps/plugin-fs');
  const win = getCurrentWindow();
  return {
    ...web,
    name: 'tauri',
    async toggleFullscreen() {
      try { await win.setFullscreen(!(await win.isFullscreen())); } catch { /* egal */ }
    },
    async saveImage(blob, filename) {
      try {
        await fs.mkdir('OVERBOOM', { baseDir: fs.BaseDirectory.Download, recursive: true });
        await fs.writeFile(`OVERBOOM/${filename}`, new Uint8Array(await blob.arrayBuffer()), { baseDir: fs.BaseDirectory.Download });
        return `Downloads/OVERBOOM/${filename}`;
      } catch {
        return web.saveImage(blob, filename);
      }
    },
    // Dateien liegen in der App – kein Service Worker nötig
    registerOffline() {}
  };
}
