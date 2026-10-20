/**
 * Netzwerk-Schicht für Koop (1–4 Spieler, Host-autoritativ).
 * Das Spiel kennt nur `Transport`, `HostSession` und `ClientSession`; der Transport ist
 * austauschbar (Trystero/WebRTC, BroadcastChannel für mehrere Tabs, Speicher für Tests).
 */
export * from './transport.ts';
export * from './session.ts';
export { encodeSnapshot, decodeSnapshot, applySnapshot, Snapshot } from './snapshot.ts';
export { worldState, applyWorldState, type WorldState, type PlayerState } from './state.ts';

/** WebRTC-Transport erst bei Bedarf laden (hält den Solo-Start schlank) */
export async function createTrysteroTransport(roomCode: string, cfg: import('./trystero.ts').NetConfig): Promise<import('./transport.ts').Transport> {
  const { TrysteroTransport } = await import('./trystero.ts');
  return new TrysteroTransport(roomCode, cfg);
}
export type { NetConfig } from './trystero.ts';
