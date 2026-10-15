// SPDX-License-Identifier: GPL-3.0-only
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures.ts';
import { HlcClock, formatHlc, parseHlc } from './hlc.ts';

interface ParseCase {
  text: string;
  wall?: number;
  counter?: number;
  node?: string;
  error?: string;
}
interface Step {
  op: 'now' | 'receive';
  phys?: number;
  hlc?: string;
  expect?: string;
  expect_last?: string;
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
      if (s.op === 'now') {
        phys = s.phys!;
        expect(clock.now()).toBe(s.expect);
      } else {
        clock.receive(s.hlc!);
        expect(clock.last).toBe(s.expect_last);
      }
    }
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
