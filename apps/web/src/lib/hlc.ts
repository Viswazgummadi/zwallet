// SPDX-License-Identifier: GPL-3.0-only
// Hybrid logical clock (ARCHITECTURE §5.1, ADR 0009). Text form `{wall:13}-{counter:4 hex}-{node:8 hex}`;
// text order is clock order, so HLCs compare as plain strings. Vectors: fixtures/hlc.json.

export interface Hlc {
  readonly wall: number;
  readonly counter: number;
  readonly node: string;
}

export const MAX_COUNTER = 0xffff;
/** The largest wall that fits 13 digits; the clock refuses to go past it. */
export const MAX_WALL = 9_999_999_999_999;
/** receive() rejects a remote HLC whose wall is more than this far ahead of the physical clock. */
export const MAX_DRIFT_MS = 86_400_000;
const TEXT = /^(\d{13})-([0-9a-f]{4})-([0-9a-f]{8})$/;

/** Error codes shared with Kotlin (fixtures/hlc.json). */
export type HlcErrorCode = 'invalid' | 'clock_ahead' | 'wall_out_of_range';

export class HlcError extends Error {
  constructor(readonly code: HlcErrorCode) {
    super(`hlc: ${code}`);
    this.name = 'HlcError';
  }
}

export function formatHlc(h: Hlc): string {
  return `${String(h.wall).padStart(13, '0')}-${h.counter.toString(16).padStart(4, '0')}-${h.node}`;
}

export function parseHlc(text: string): Hlc | null {
  const m = TEXT.exec(text);
  if (!m) return null;
  return { wall: Number(m[1]), counter: parseInt(m[2]!, 16), node: m[3]! };
}

/**
 * The per-install clock: now() stamps local writes; receive() runs after an import with max_hlc.
 * A failed call throws HlcError and leaves the clock unchanged.
 */
export class HlcClock {
  #last: string;

  /** `last` is the persisted clock (an HLC text) or null for a fresh install. */
  constructor(
    readonly node: string,
    last: string | null,
    private readonly physicalMs: () => number = Date.now,
  ) {
    if (!/^[0-9a-f]{8}$/.test(node)) throw new Error('node must be 8 lowercase hex digits');
    if (last !== null && parseHlc(last) === null) throw new HlcError('invalid');
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
    if (!Number.isSafeInteger(wall) || wall < 0 || wall > MAX_WALL)
      throw new HlcError('wall_out_of_range');
    this.#last = formatHlc({ wall, counter, node: this.node });
    return this.#last;
  }

  /**
   * Advances the clock past an imported HLC. A remote wall more than MAX_DRIFT_MS ahead of the
   * physical clock is rejected (clock_ahead): adopting it would pin every later local write to that
   * far-future wall and make them win every merge until real time catches up.
   */
  receive(remote: string): void {
    const parsed = parseHlc(remote);
    if (parsed === null) throw new HlcError('invalid');
    if (parsed.wall > this.physicalMs() + MAX_DRIFT_MS) throw new HlcError('clock_ahead');
    if (remote > this.#last) this.#last = remote;
  }
}
