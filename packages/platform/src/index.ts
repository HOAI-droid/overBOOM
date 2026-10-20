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
  /** Bild teilen (Handy) oder herunterladen (PC) */
  saveImage(blob: Blob, filename: string): Promise<void>;
  /** Text in die Zwischenablage */
  copyText(text: string): Promise<boolean>;
}

export { createWebPlatform } from './web.ts';
