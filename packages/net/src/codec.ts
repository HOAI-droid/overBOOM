/**
 * Kleiner Binär-Schreiber/-Leser für Snapshots. Werte werden quantisiert
 * (z. B. Positionen auf 1 cm als Int16) und beim Schreiben auf den Wertebereich begrenzt.
 */

export type Kind = 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'f32';

const LIMIT: Record<Kind, [number, number]> = {
  u8: [0, 255], i8: [-128, 127], u16: [0, 65535], i16: [-32768, 32767], u32: [0, 4294967295], f32: [-3.4e38, 3.4e38]
};
const SIZE: Record<Kind, number> = { u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, f32: 4 };

export class Writer {
  private buf: ArrayBuffer;
  private view: DataView;
  pos = 0;

  constructor(size = 64 * 1024) {
    this.buf = new ArrayBuffer(size);
    this.view = new DataView(this.buf);
  }

  reset(): this { this.pos = 0; return this; }

  private need(n: number): void {
    if (this.pos + n <= this.buf.byteLength) return;
    const next = new ArrayBuffer(Math.max(this.buf.byteLength * 2, this.pos + n));
    new Uint8Array(next).set(new Uint8Array(this.buf, 0, this.pos));
    this.buf = next;
    this.view = new DataView(next);
  }

  /** Wert quantisiert (× scale, gerundet) und begrenzt schreiben */
  put(kind: Kind, v: number, scale = 1): void {
    this.need(SIZE[kind]);
    let q = kind === 'f32' ? v * scale : Math.round(v * scale);
    if (!Number.isFinite(q)) q = q > 0 ? LIMIT[kind][1] : q < 0 ? LIMIT[kind][0] : 0;
    const [lo, hi] = LIMIT[kind];
    if (q < lo) q = lo; else if (q > hi) q = hi;
    const p = this.pos;
    switch (kind) {
      case 'u8': this.view.setUint8(p, q); break;
      case 'i8': this.view.setInt8(p, q); break;
      case 'u16': this.view.setUint16(p, q, true); break;
      case 'i16': this.view.setInt16(p, q, true); break;
      case 'u32': this.view.setUint32(p, q, true); break;
      case 'f32': this.view.setFloat32(p, q, true); break;
    }
    this.pos += SIZE[kind];
  }

  /** UTF-8-Text mit Längenpräfix (u32) */
  text(s: string): void {
    const bytes = new TextEncoder().encode(s);
    this.put('u32', bytes.length);
    this.need(bytes.length);
    new Uint8Array(this.buf, this.pos, bytes.length).set(bytes);
    this.pos += bytes.length;
  }

  /** fertige Nachricht (Kopie, damit der Puffer weiterverwendet werden kann) */
  finish(): ArrayBuffer {
    return this.buf.slice(0, this.pos);
  }
}

export class Reader {
  private bytes: Uint8Array;
  private view: DataView;
  pos = 0;

  /** nimmt ArrayBuffer oder einen Ausschnitt (Uint8Array) – Trystero liefert Letzteres */
  constructor(buf: ArrayBuffer | ArrayBufferView) {
    this.bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
    this.view = new DataView(this.bytes.buffer as ArrayBuffer, this.bytes.byteOffset, this.bytes.byteLength);
  }

  get(kind: Kind, scale = 1): number {
    const p = this.pos;
    this.pos += SIZE[kind];
    let v: number;
    switch (kind) {
      case 'u8': v = this.view.getUint8(p); break;
      case 'i8': v = this.view.getInt8(p); break;
      case 'u16': v = this.view.getUint16(p, true); break;
      case 'i16': v = this.view.getInt16(p, true); break;
      case 'u32': v = this.view.getUint32(p, true); break;
      default: v = this.view.getFloat32(p, true);
    }
    return scale === 1 ? v : v / scale;
  }

  text(): string {
    const n = this.get('u32');
    const s = new TextDecoder().decode(this.bytes.subarray(this.pos, this.pos + n));
    this.pos += n;
    return s;
  }

  get done(): boolean { return this.pos >= this.bytes.byteLength; }
}

/** Spalte einer Entity-Tabelle: Typ, Skalierung, Lesen/Schreiben am Objekt */
export interface Field<T> {
  name: string;
  k: Kind;
  s?: number;
  get(e: T): number;
  set(e: T, v: number): void;
}

/**
 * Tabelle (Struct of Arrays) für eine Entity-Art in einem Snapshot.
 * Wird wiederverwendet, damit beim Empfangen keine Objekte entstehen.
 */
export class Table<T> {
  n = 0;
  readonly cols: Float64Array[];
  readonly fields: readonly Field<T>[];
  readonly cap: number;

  constructor(fields: readonly Field<T>[], cap: number) {
    this.fields = fields;
    this.cap = cap;
    this.cols = fields.map(() => new Float64Array(cap));
  }

  write(w: Writer, list: readonly T[], include: (e: T) => boolean): void {
    let n = 0;
    for (const e of list) if (include(e)) n++;
    w.put('u16', n);
    for (const e of list) {
      if (!include(e)) continue;
      for (const f of this.fields) w.put(f.k, f.get(e), f.s ?? 1);
    }
  }

  read(r: Reader): void {
    const n = r.get('u16');
    this.n = Math.min(n, this.cap);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < this.fields.length; c++) {
        const f = this.fields[c];
        const v = r.get(f.k, f.s ?? 1);
        if (i < this.cap) this.cols[c][i] = v;
      }
    }
  }

  /** Zeile i auf ein Objekt übertragen */
  apply(i: number, e: T): void {
    for (let c = 0; c < this.fields.length; c++) this.fields[c].set(e, this.cols[c][i]);
  }

  col(name: string): Float64Array {
    const i = this.fields.findIndex((f) => f.name === name);
    return this.cols[i];
  }
}
