// SPDX-License-Identifier: GPL-3.0-only
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures.ts';
import { HlcClock, HlcError, MAX_DRIFT_MS, MAX_WALL, formatHlc, parseHlc } from './hlc.ts';

interface ParseCase {
  text: string;
  wall?: number;
  counter?: number;
  node?: string;
  error?: string;
}
interface Step {
  op: 'now' | 'receive';
  phys: number;
  hlc?: string;
  expect?: string;
  expect_last?: string;
  error?: string;
}
const hlc = fixture<{
  parse: ParseCase[];
  order: string[];
  clock: Array<{ name: string; node: string; last: string; steps: Step[] }>;
}>('hlc.json');

describe('hlc vectors (packages/contracts/fixtures/hlc.json)', () => {
  it.each(hlc.parse)('parse $text', (c) => {
    const parsed = parseHlc(c.text);
    if (c.error) {
      expect(parsed).toBeNull();
    } else {
      expect(parsed).toEqual({ wall: c.wall, counter: c.counter, node: c.node });
      expect(formatHlc(parsed!)).toBe(c.text);
    }
  });

  it('text order is clock order', () => {
    expect([...hlc.order].sort()).toEqual(hlc.order);
  });

  it.each(hlc.clock)('$name', (c) => {
    let phys = 0;
    const clock = new HlcClock(c.node, c.last || null, () => phys);
    for (const s of c.steps) {
      phys = s.phys;
      const run = (): string | null => {
        if (s.op === 'now') return clock.now();
        clock.receive(s.hlc!);
        return null;
      };
      if (s.error) {
        expect(run).toThrow(expect.objectContaining({ code: s.error }) as Error);
        expect(clock.last).toBe(s.expect_last);
      } else if (s.op === 'now') {
        expect(run()).toBe(s.expect);
      } else {
        run();
        expect(clock.last).toBe(s.expect_last);
      }
    }
  });

  it('shares MAX_WALL with the 13-digit text form', () => {
    expect(formatHlc({ wall: MAX_WALL, counter: 0, node: '00000000' })).toBe(
      '9999999999999-0000-00000000',
    );
    expect(MAX_DRIFT_MS).toBe(24 * 60 * 60 * 1000);
  });

  it.each(hlc.parse.filter((c) => c.error))('constructor rejects malformed last "$text"', (c) => {
    expect(() => new HlcClock('0a1b2c3d', c.text)).toThrow(HlcError);
  });

  it.each(hlc.parse.filter((c) => c.error))('receive rejects malformed "$text"', (c) => {
    const clock = new HlcClock('0a1b2c3d', '1760000000000-0000-0a1b2c3d', () => 1_760_000_000_000);
    expect(() => {
      clock.receive(c.text);
    }).toThrow(expect.objectContaining({ code: 'invalid' }) as Error);
    expect(clock.last).toBe('1760000000000-0000-0a1b2c3d');
  });
});

it('now() is strictly monotonic whatever the wall clock does', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 200 }),
      (walls) => {
        let i = 0;
        const clock = new HlcClock('0a1b2c3d', null, () => walls[i]!);
        let prev = '';
        for (i = 0; i < walls.length; i++) {
          const next = clock.now();
          expect(next > prev).toBe(true);
          prev = next;
        }
      },
    ),
    { numRuns: 500 },
  );
});
