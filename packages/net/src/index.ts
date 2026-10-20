/**
 * Netzwerk-Schicht (Phase 5). Das Spiel kennt nur dieses Interface;
 * die erste Implementierung nutzt Trystero (WebRTC, Signaling über Nostr)
 * mit konfigurierbarem TURN-Fallback. Später austauschbar gegen einen eigenen Relay.
 */
import type { InputState } from '@overboom/core';

export interface PeerInfo {
  id: string;
  name: string;
  /** 'direct' = Peer-to-Peer, 'relay' = über TURN */
  route: 'direct' | 'relay' | 'unknown';
  pingMs: number;
}

export interface Transport {
  readonly roomCode: string;
  readonly isHost: boolean;
  peers(): PeerInfo[];
  /** Client → Host: Eingabe des lokalen Spielers */
  sendInput(tick: number, input: InputState): void;
  /** Host → Clients: kompakter Binär-Snapshot */
  broadcastSnapshot(data: ArrayBuffer): void;
  onInput(cb: (peerId: string, tick: number, input: InputState) => void): void;
  onSnapshot(cb: (data: ArrayBuffer) => void): void;
  onPeersChanged(cb: (peers: PeerInfo[]) => void): void;
  leave(): Promise<void>;
}

export interface NetConfig {
  appId: string;
  /** z. B. Cloudflare-TURN-Zugangsdaten; ohne TURN klappt Koop nicht in jedem Netz */
  turn?: { urls: string | string[]; username?: string; credential?: string }[];
}

/** Raumcode: 6 Zeichen ohne verwechselbare Buchstaben (kein 0/O, 1/I). */
export function makeRoomCode(rand: () => number): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(rand() * abc.length)];
  return s;
}
