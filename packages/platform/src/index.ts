/**
 * Plattform-Schicht. Der Spielcode spricht NUR mit diesem Interface –
 * nie direkt mit localStorage, navigator, Capacitor- oder Tauri-APIs.
 * Später kommen capacitor.ts (iOS/Android) und tauri.ts (Desktop) dazu.
 */
export interface Platform {
  readonly name: 'web' | 'capacitor' | 'tauri';
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
  /** Link teilen (Handy: Teilen-Menü, sonst Zwischenablage). true = geteilt/kopiert */
  shareLink(title: string, url: string): Promise<'geteilt' | 'kopiert' | 'fehler'>;
  /** Offline-Modus/Installierbarkeit einschalten (Service Worker), wo möglich */
  registerOffline(): void;
  /** Zufallskennung (für den Koop-Platz beim Wiederverbinden) */
  randomId(): string;
  /** Text in die Zwischenablage */
  copyText(text: string): Promise<boolean>;
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

/** Passende Plattform wählen: Tauri (Desktop), Capacitor (iOS/Android), sonst Web */
export async function createPlatform(): Promise<Platform> {
  if (isCapacitor()) {
    try { return await (await import('./capacitor.ts')).createCapacitorPlatform(); } catch { /* Fallback */ }
  }
  if (isTauri()) {
    try { return await (await import('./tauri.ts')).createTauriPlatform(); } catch { /* Fallback */ }
  }
  return createWebPlatform();
}
