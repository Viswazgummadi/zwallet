// SPDX-License-Identifier: GPL-3.0-only
// Hybrid logical clock (ARCHITECTURE §5.1, ADR 0009). Text form `{wall:13}-{counter:4 hex}-{node:8 hex}`;
// text order is clock order, so HLCs compare as plain strings. Vectors: fixtures/hlc.json.

export interface Hlc {
  readonly wall: number;
  readonly counter: number;
  readonly node: string;
}

export const MAX_COUNTER = 0xffff;
const TEXT = /^(\d{13})-([0-9a-f]{4})-([0-9a-f]{8})$/;

export function formatHlc(h: Hlc): string {
  return `${String(h.wall).padStart(13, '0')}-${h.counter.toString(16).padStart(4, '0')}-${h.node}`;
}

export function parseHlc(text: string): Hlc | null {
  const m = TEXT.exec(text);
  if (!m) return null;
  return { wall: Number(m[1]), counter: parseInt(m[2]!, 16), node: m[3]! };
}

/** The per-install clock: now() stamps local writes; receive() runs after an import with max_hlc. */
export class HlcClock {
  #last: string;

  constructor(
    readonly node: string,
    last: string | null,
    private readonly physicalMs: () => number = Date.now,
  ) {
    if (!/^[0-9a-f]{8}$/.test(node)) throw new Error('node must be 8 lowercase hex digits');
    this.#last = last ?? '';
  }

  get last(): string {
    return this.#last;
  }

  now(): string {
    const prev = this.#last ? parseHlc(this.#last) : null;
    let wall = Math.max(this.physicalMs(), prev?.wall ?? -Infinity);
    let counter = prev && wall === prev.wall ? prev.counter + 1 : 0;
    if (counter > MAX_COUNTER) {
      wall += 1;
      counter = 0;
    }
    this.#last = formatHlc({ wall, counter, node: this.node });
    return this.#last;
  }

  receive(remote: string): void {
    if (parseHlc(remote) === null) throw new Error('invalid HLC');
    if (remote > this.#last) this.#last = remote;
  }
}
