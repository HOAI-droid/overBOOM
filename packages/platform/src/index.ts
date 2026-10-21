/**
 * Plattform-Schicht. Der Spielcode spricht NUR mit diesem Interface –
 * nie direkt mit localStorage, navigator, Capacitor- oder Tauri-APIs.
 * Umsetzungen: web.ts (Browser/PWA), tauri.ts (Desktop), capacitor.ts (iOS/Android),
 * xbox.ts (Xbox-App: UWP-Hülle mit WebView2).
 */
export interface Platform {
  readonly name: 'web' | 'capacitor' | 'tauri' | 'xbox';
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  /** kurzes Vibrieren in Millisekunden (wo verfügbar) */
  haptic(ms: number): void;
  toggleFullscreen(): Promise<void>;
  /** verhindert, dass der Bildschirm während des Spielens ausgeht */
  keepAwake(on: boolean): Promise<void>;
  isTouchDevice(): boolean;
  /** Bild teilen (Handy) oder herunterladen (PC); Rückgabe: Speicherort, falls bekannt */
  saveImage(blob: Blob, filename: string): Promise<string | void>;
  /** Datei speichern (PC: Download/Ordner, Handy: Teilen-Menü); Rückgabe: Speicherort, falls bekannt */
  saveFile(blob: Blob, filename: string): Promise<string | void>;
  /** Textdatei auswählen und lesen (z. B. .boom); null = abgebrochen */
  openTextFile(accept: string): Promise<string | null>;
  /** Link teilen (Handy: Teilen-Menü, sonst Zwischenablage). true = geteilt/kopiert */
  shareLink(title: string, url: string): Promise<'geteilt' | 'kopiert' | 'fehler'>;
  /** Offline-Modus/Installierbarkeit einschalten (Service Worker), wo möglich */
  registerOffline(): void;
  /** Zufallskennung (für den Koop-Platz beim Wiederverbinden) */
  randomId(): string;
  /** Text in die Zwischenablage */
  copyText(text: string): Promise<boolean>;
  /** Systemsprache, z. B. „de-DE" (für den Vorschlag bei der Sprachwahl) */
  systemSprache(): string;
  /** App neu laden (z. B. nach Sprachwechsel) */
  neuLaden(): void;
  /** nur Controller, kein Zeiger/Touch (Konsole) – Menüs zeigen Controller-Symbole */
  readonly nurController?: boolean;
  /** App beenden (nur wo erlaubt, z. B. Xbox über das Titelmenü) */
  beenden?(): void;
  /** System-Zurück (Xbox: B-Taste/BackRequested der Hülle) */
  onZurueck?(cb: () => void): void;
  /** Hülle meldet knappen Arbeitsspeicher → Qualität senken */
  onSpeicherKnapp?(cb: () => void): void;
}

export { createWebPlatform } from './web.ts';
import { createWebPlatform } from './web.ts';

/** Läuft das Spiel als Desktop-App (Tauri)? */
export function isTauri(): boolean {
  return typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;
}

/** Läuft das Spiel als Handy-App (Capacitor)? */
export function isCapacitor(): boolean {
  const c = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!c?.isNativePlatform?.();
}

/** Läuft das Spiel in der Xbox-Hülle (oder zum Testen mit ?plattform=xbox)? */
export function isXbox(): boolean {
  const g = globalThis as { __OVERBOOM_XBOX__?: boolean; location?: { search?: string } };
  if (g.__OVERBOOM_XBOX__) return true;
  try { return new URLSearchParams(g.location?.search ?? '').get('plattform') === 'xbox'; } catch { return false; }
}

/** Passende Plattform wählen: Xbox, Capacitor (iOS/Android), Tauri (Desktop), sonst Web */
export async function createPlatform(): Promise<Platform> {
  if (isXbox()) {
    try { return (await import('./xbox.ts')).createXboxPlatform(); } catch { /* Fallback */ }
  }
  if (isCapacitor()) {
    try { return await (await import('./capacitor.ts')).createCapacitorPlatform(); } catch { /* Fallback */ }
  }
  if (isTauri()) {
    try { return await (await import('./tauri.ts')).createTauriPlatform(); } catch { /* Fallback */ }
  }
  return createWebPlatform();
}
