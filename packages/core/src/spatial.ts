/**
 * Raster-Hash für schnelle Nachbarschaftssuche (Gegner ↔ Geschosse, Explosionen, Abstoßung).
 * Verkettete Listen in typisierten Arrays – keine Allokationen pro Tick.
 */
export class SpatialHash {
  readonly cols: number;
  readonly cell: number;
  private head: Int32Array;
  private next: Int32Array;
  /** Ergebnis der letzten Abfrage (Slot-Indizes); gültig bis zur nächsten Abfrage */
  readonly result: Int32Array;

  constructor(worldSize: number, cell: number, capacity: number) {
    this.cell = cell;
    this.cols = Math.ceil(worldSize / cell);
    this.head = new Int32Array(this.cols * this.cols).fill(-1);
    this.next = new Int32Array(capacity).fill(-1);
    this.result = new Int32Array(capacity);
  }

  clear(): void {
    this.head.fill(-1);
  }

  private cellOf(v: number): number {
    const c = Math.floor(v / this.cell);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  insert(i: number, x: number, z: number): void {
    const k = this.cellOf(z) * this.cols + this.cellOf(x);
    this.next[i] = this.head[k];
    this.head[k] = i;
  }

  /** Alle Einträge in Zellen, die den Kreis (x, z, r) berühren. Abstand prüft der Aufrufer. */
  query(x: number, z: number, r: number): number {
    const x0 = this.cellOf(x - r), x1 = this.cellOf(x + r);
    const z0 = this.cellOf(z - r), z1 = this.cellOf(z + r);
    let n = 0;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.head[cz * this.cols + cx]; i !== -1; i = this.next[i]) {
          if (n < this.result.length) this.result[n++] = i;
        }
      }
    }
    return n;
  }
}
