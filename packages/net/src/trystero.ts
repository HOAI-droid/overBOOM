import { joinRoom, selfId, type DataPayload, type MessageAction, type Room } from 'trystero';
import type { Msg, Route, Transport } from './transport.ts';

/**
 * WebRTC über Trystero: Signaling über öffentliche Nostr-Relays, dann direkte
 * Verbindung zwischen den Geräten. Ohne direkten Weg (Mobilfunk, Firmen-WLAN)
 * läuft der Verkehr über den konfigurierten TURN-Relay.
 */

export interface NetConfig {
  appId: string;
  /** z. B. Cloudflare-Realtime-TURN oder eigener coturn */
  turn?: { urls: string | string[]; username?: string; credential?: string }[];
  /** eigene Nostr-Relays (optional) */
  relays?: string[];
}

const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

export class TrysteroTransport implements Transport {
  onMessage: Transport['onMessage'] = null;
  onPeerJoin: Transport['onPeerJoin'] = null;
  onPeerLeave: Transport['onPeerLeave'] = null;
  readonly selfId = selfId;
  readonly roomCode: string;
  private room: Room;
  private json: MessageAction<DataPayload>;
  private bin: MessageAction<ArrayBuffer>;

  constructor(roomCode: string, cfg: NetConfig) {
    this.roomCode = roomCode;
    this.room = joinRoom({
      appId: cfg.appId,
      rtcConfig: { iceServers: [...STUN, ...(cfg.turn ?? [])] },
      turnConfig: cfg.turn,
      ...(cfg.relays?.length ? { relayConfig: { urls: cfg.relays } } : {})
    }, roomCode);
    this.json = this.room.makeAction<DataPayload>('m', { kind: 'message' });
    this.bin = this.room.makeAction<ArrayBuffer>('b', { kind: 'message' });
    this.json.onMessage = (data, ctx) => this.onMessage?.(data as unknown as Msg, ctx.peerId);
    this.bin.onMessage = (data, ctx) => this.onMessage?.({ t: 'snap', data }, ctx.peerId);
    this.room.onPeerJoin = (id) => this.onPeerJoin?.(id);
    this.room.onPeerLeave = (id) => this.onPeerLeave?.(id);
  }

  send(msg: Msg, to?: string): void {
    const opt = to ? { target: to } : undefined;
    if (msg.t === 'snap') void this.bin.send(msg.data, opt).catch(() => {});
    else void this.json.send(msg as never, opt).catch(() => {});
  }

  async peerInfo(id: string): Promise<{ pingMs: number; route: Route }> {
    let pingMs = 0, route: Route = 'unknown';
    try { pingMs = await this.room.ping(id); } catch { /* Peer weg */ }
    try {
      const pc = this.room.getPeers()[id];
      if (pc) {
        const stats = await pc.getStats();
        let pairId = '';
        stats.forEach((r: { type: string; selectedCandidatePairId?: string }) => { if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId; });
        stats.forEach((r: { type: string; id: string; state?: string; nominated?: boolean; localCandidateId?: string; remoteCandidateId?: string }) => {
          if (r.type !== 'candidate-pair' || (pairId ? r.id !== pairId : !(r.state === 'succeeded' && r.nominated))) return;
          const l = stats.get(r.localCandidateId ?? ''), rem = stats.get(r.remoteCandidateId ?? '');
          route = l?.candidateType === 'relay' || rem?.candidateType === 'relay' ? 'relay' : 'direct';
        });
      }
    } catch { /* Statistik nicht verfügbar */ }
    return { pingMs, route };
  }

  async leave(): Promise<void> {
    await this.room.leave();
  }
}
