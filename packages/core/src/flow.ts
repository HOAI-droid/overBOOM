import type { Arena } from './arena.ts';

/**
 * Flow-Field: kürzeste Wege aller Kacheln zum nächsten Spieler (Dijkstra, 8 Nachbarn,
 * keine Diagonale an Ecken vorbei). Gegner folgen dem Gefälle und laufen so um Säulen
 * und Mauern herum. Wird nur ein paarmal pro Sekunde neu berechnet, keine Allokationen.
 */
export class FlowField {
  size = 0;
  /** Weglänge in Kacheln (Infinity = unerreichbar oder fest) */
  dist = new Float32Array(0);
  private fest = new Uint8Array(0);
  private heap = new Int32Array(0);
  private heapKey = new Float32Array(0);
  private n = 0;
  /** Zeit bis zur nächsten Neuberechnung */
  private timer = 0;
  private quellen = -1;

  private resize(size: number): void {
    if (this.size === size) return;
    this.size = size;
    const N = size * size;
    this.dist = new Float32Array(N);
    this.fest = new Uint8Array(N);
    // Dijkstra mit „lazy deletion“: jede Kachel kann mehrfach im Heap landen
    this.heap = new Int32Array(N * 8);
    this.heapKey = new Float32Array(N * 8);
  }

  /** Neu berechnen, wenn fällig oder ein Spieler die Kachel gewechselt hat */
  update(a: Arena, spieler: readonly { x: number; z: number; alive: boolean }[], props: readonly { x: number; z: number; r: number; broken?: boolean }[], dt: number): void {
    this.resize(a.size);
    // Kennzahl der Spieler-Kacheln (ohne Strings, keine Allokation)
    let key = 0, k = 1;
    for (const p of spieler) { k++; if (p.alive) key += (Math.floor(p.z) * a.size + Math.floor(p.x) + 1) * (k * 7919 + 1); }
    this.timer -= dt;
    if (key === this.quellen && this.timer > 0) return;
    this.quellen = key;
    this.timer = 0.5;
    this.berechne(a, spieler, props);
  }

  private berechne(a: Arena, spieler: readonly { x: number; z: number; alive: boolean }[], props: readonly { x: number; z: number; r: number; broken?: boolean }[]): void {
    const S = this.size, dist = this.dist, fest = this.fest;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) fest[z * S + x] = a.isSolidTile(x, z) ? 1 : 0;
    for (const p of props) if (p.r > 0 && !p.broken) {
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (x >= 0 && z >= 0 && x < S && z < S) fest[z * S + x] = 1;
    }
    dist.fill(Infinity);
    this.n = 0;
    for (const p of spieler) {
      if (!p.alive) continue;
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (x < 0 || z < 0 || x >= S || z >= S) continue;
      const i = z * S + x;
      dist[i] = 0;
      this.push(i, 0);
    }
    while (this.n > 0) {
      const d = this.heapKey[0], i = this.pop();
      if (d > dist[i]) continue;
      const x = i % S, z = (i - x) / S;
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oz) continue;
        const nx = x + ox, nz = z + oz;
        if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
        const j = nz * S + nx;
        if (fest[j]) continue;
        // diagonal nur, wenn beide Nachbarn frei sind (nicht über Ecken schneiden)
        if (ox && oz && (fest[z * S + nx] || fest[nz * S + x])) continue;
        const nd = d + (ox && oz ? 1.4142 : 1);
        if (nd < dist[j]) { dist[j] = nd; this.push(j, nd); }
      }
    }
  }

  /**
   * Laufrichtung an (x, z) entlang des Feldes. Schreibt eine Einheitsrichtung nach out;
   * false, wenn es kein Gefälle gibt (dann direkt auf den Spieler zu laufen).
   */
  richtung(x: number, z: number, out: { x: number; z: number }): boolean {
    const S = this.size;
    const cx = Math.floor(x), cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= S || cz >= S) return false;
    const here = this.dist[cz * S + cx];
    let best = here, bx = 0, bz = 0;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oz) continue;
      const nx = cx + ox, nz = cz + oz;
      if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
      if (ox && oz && (this.fest[cz * S + nx] || this.fest[nz * S + cx])) continue;
      const d = this.dist[nz * S + nx];
      if (d < best) { best = d; bx = nx; bz = nz; }
    }
    if (best === here || !isFinite(best)) return false;
    // zur Mitte der besten Nachbarkachel steuern (glättet die Ecken)
    const dx = bx + 0.5 - x, dz = bz + 0.5 - z, l = Math.hypot(dx, dz) || 1;
    out.x = dx / l; out.z = dz / l;
    return true;
  }

  /** Freie Sicht zwischen zwei Punkten (keine festen Kacheln dazwischen)? */
  sicht(x0: number, z0: number, x1: number, z1: number): boolean {
    const S = this.size;
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
    const schritte = Math.ceil(l * 3);
    for (let k = 1; k < schritte; k++) {
      const t = k / schritte;
      const x = Math.floor(x0 + dx * t), z = Math.floor(z0 + dz * t);
      if (x < 0 || z < 0 || x >= S || z >= S || this.fest[z * S + x]) return false;
    }
    return true;
  }

  /** zurücksetzen (neue Arena) */
  reset(): void {
    this.quellen = -1;
    this.timer = 0;
  }

  private push(i: number, k: number): void {
    const h = this.heap, hk = this.heapKey;
    if (this.n >= h.length) return;
    let c = this.n++;
    while (c > 0) {
      const par = (c - 1) >> 1;
      if (hk[par] <= k) break;
      h[c] = h[par]; hk[c] = hk[par]; c = par;
    }
    h[c] = i; hk[c] = k;
  }

  private pop(): number {
    const h = this.heap, hk = this.heapKey;
    const top = h[0];
    const n = --this.n;
    if (n > 0) {
      const li = h[n], lk = hk[n];
      let c = 0;
      for (;;) {
        let m = c * 2 + 1;
        if (m >= n) break;
        if (m + 1 < n && hk[m + 1] < hk[m]) m++;
        if (hk[m] >= lk) break;
        h[c] = h[m]; hk[c] = hk[m]; c = m;
      }
      h[c] = li; hk[c] = lk;
    }
    return top;
  }
}
