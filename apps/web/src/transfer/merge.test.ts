// SPDX-License-Identifier: GPL-3.0-only
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TABLES, type TableName } from '../generated/contracts.ts';
import { fixture } from '../test/fixtures.ts';
import {
  mergeRow,
  parseFieldHlc,
  stringifyFieldHlc,
  type Frontier,
  type MergeResult,
  type Row,
  type Value,
} from './merge.ts';

interface Case {
  name: string;
  table: TableName;
  local: Row | null;
  incoming: Row;
  local_frontier?: Frontier;
  incoming_frontier?: Frontier;
  expected: MergeResult;
}
const vectors = fixture<{ cases: Case[] }>('merge.json');

describe('merge vectors (packages/contracts/fixtures/merge.json)', () => {
  it.each(vectors.cases)('$name', (c) => {
    const ctx = {
      ...(c.local_frontier && { localFrontier: c.local_frontier }),
      ...(c.incoming_frontier && { incomingFrontier: c.incoming_frontier }),
    };
    expect(mergeRow(TABLES[c.table], c.local, c.incoming, ctx)).toEqual(c.expected);
  });
});

// ── ARCHITECTURE §5.6 invariants (mirrors core:transfer RowMergeTest) ─────────────────────────
const spec = TABLES.transactions;
const groupOf = (col: string) =>
  Object.entries(spec.groups).find(([, cols]) => (cols as readonly string[]).includes(col))![0];
const CHOICES: Record<string, Value[]> = {
  note: [null, 'a', 'b', 'lunch'],
  category_id: ['c1', 'c2', null],
  amount_minor: [100, 4200, 99],
  currency: ['INR', 'USD'],
  deleted_at: [null, 5, 9],
  review_state: ['confirmed', 'needs_review'],
};
const H0 = '0000000000001-0000-00000000';
function baseRow(): Record<string, Value> {
  const r: Record<string, Value> = Object.fromEntries(spec.columns.map((c) => [c, null]));
  Object.assign(r, {
    id: 'x',
    type: 'expense',
    amount_minor: 100,
    currency: 'INR',
    occurred_at: 1,
    occurred_tz: 'Asia/Kolkata',
    payment_method: 'other',
    source: 'manual',
    review_state: 'confirmed',
    created_at: 1,
    updated_at: 1,
  });
  r.field_hlc = stringifyFieldHlc(Object.fromEntries(Object.keys(spec.groups).map((g) => [g, H0])));
  r.hlc = H0;
  return r;
}

/** A tiny seeded PRNG so a failing seed reproduces exactly. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32;
}

class Device {
  row: Row = baseRow();
  private wall = 1;
  private counter = 0;
  constructor(readonly node: string) {}

  edit(r: () => number) {
    const cols = Object.keys(CHOICES);
    const col = cols[Math.floor(r() * cols.length)]!;
    const now = this.wall + Math.floor(r() * 3);
    this.counter = now === this.wall ? this.counter + 1 : 0;
    this.wall = now;
    const h = `${String(this.wall).padStart(13, '0')}-${this.counter.toString(16).padStart(4, '0')}-${this.node}`;
    const stamps = { ...parseFieldHlc(this.row.field_hlc as string), [groupOf(col)]: h };
    const choices = CHOICES[col]!;
    this.row = {
      ...this.row,
      [col]: choices[Math.floor(r() * choices.length)]!,
      field_hlc: stringifyFieldHlc(stamps),
      hlc: h,
      updated_at: this.wall,
    };
  }

  receive(file: Row) {
    this.row = mergeRow(spec, this.row, file).row;
    const seen = this.row.hlc as string;
    const w = Number(seen.slice(0, 13));
    const c = parseInt(seen.slice(14, 18), 16);
    if (w > this.wall || (w === this.wall && c >= this.counter)) {
      this.wall = w;
      this.counter = c + 1;
    }
  }
}

it('convergence + idempotence over random edit/exchange histories', () => {
  fc.assert(
    fc.property(fc.integer(), (seed) => {
      const r = rng(seed);
      const devices = [new Device('aaaaaaaa'), new Device('bbbbbbbb'), new Device('cccccccc')];
      for (let step = 0; step < 12; step++) {
        const d = devices[Math.floor(r() * 3)]!;
        if (r() < 0.6) d.edit(r);
        else {
          const other = devices[Math.floor(r() * 3)]!;
          if (other !== d) d.receive(other.row);
        }
      }
      for (let round = 0; round < 2; round++)
        for (const a of devices) for (const b of devices) if (a !== b) a.receive(b.row);
      for (const d of devices) expect(d.row).toEqual(devices[0]!.row);
      expect(mergeRow(spec, devices[0]!.row, devices[1]!.row).outcome).toBe('unchanged');
    }),
    { numRuns: 1000 },
  );
});

it('merge is commutative even with HLC ties from a cloned install', () => {
  fc.assert(
    fc.property(fc.integer(), (seed) => {
      const r = rng(seed);
      const a = new Device('aaaaaaaa');
      const b = new Device(r() < 1 / 3 ? 'aaaaaaaa' : 'bbbbbbbb');
      for (let i = 0; i < 6; i++) (r() < 0.5 ? a : b).edit(r);
      expect(mergeRow(spec, a.row, b.row).row).toEqual(mergeRow(spec, b.row, a.row).row);
    }),
    { numRuns: 1000 },
  );
});

it('field_hlc is written with sorted keys and parsed strictly', () => {
  expect(stringifyFieldHlc({ b: '2', a: '1' })).toBe('{"a":"1","b":"2"}');
  expect(() => parseFieldHlc('{"a": "1"}')).toThrow();
});
