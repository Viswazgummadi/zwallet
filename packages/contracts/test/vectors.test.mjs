// SPDX-License-Identifier: GPL-3.0-only
// Self-checks for the vector files and property tests of the reference merge (ARCH §5.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mergeRow, frontier, parseFieldHlc, stringifyFieldHlc } from '../lib/merge-reference.mjs';
import { smsId } from '../lib/ids.mjs';
import { validate } from '../lib/row-schema.mjs';

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8'));
const money = read('fixtures/money.json');
const hlc = read('fixtures/hlc.json');
const schema = read('schema/transactions.json');
const spec = { columns: Object.keys(schema.properties), immutable: schema['x-immutable'], groups: schema['x-merge-groups'] };

test('money vectors are well-formed and within MAX_MINOR', () => {
  assert.equal(money.max_minor, Number.MAX_SAFE_INTEGER);
  for (const section of ['parse', 'format', 'compact', 'expression']) {
    assert.ok(money[section].cases.length > 0, section);
    for (const c of money[section].cases) {
      assert.ok(c.currency === 'XYZ' || c.currency in money.currencies, `${section}: ${c.currency}`);
      for (const k of ['minor']) if (k in c) assert.ok(Number.isSafeInteger(c[k]), `${section}: ${JSON.stringify(c)}`);
    }
  }
  const has = (s, text) => money.expression.cases.some((c) => c.input === text);
  assert.ok(has('expression', '0.1+0.2'), 'AC-4.2.4 vector present');
  for (const t of ['5++', '120--']) assert.ok(has('expression', t), `two trailing operators: ${t}`);
  // Every currency in the shared table is exercised by at least one format vector.
  for (const code of Object.keys(money.currencies).filter((k) => k !== 'description'))
    assert.ok(money.format.cases.some((c) => c.currency === code), `format vector for ${code}`);
});

test('hlc vectors: order list is sorted and parse cases round-trip', () => {
  assert.deepEqual([...hlc.order].sort(), hlc.order);
  const re = /^(\d{13})-([0-9a-f]{4})-([0-9a-f]{8})$/;
  for (const c of hlc.parse) {
    const m = re.exec(c.text);
    if (c.error) assert.equal(m, null, c.text);
    else assert.deepEqual([Number(m[1]), parseInt(m[2], 16), m[3]], [c.wall, c.counter, c.node]);
  }
});

test('hlc clock vectors: every step has a physical clock, errors keep last, drift and MAX_WALL are covered', () => {
  const errors = new Set();
  for (const c of hlc.clock)
    for (const s of c.steps) {
      assert.ok(Number.isSafeInteger(s.phys), `${c.name}: step without phys`);
      if (s.error) {
        assert.ok(['clock_ahead', 'wall_out_of_range'].includes(s.error), s.error);
        assert.ok('expect_last' in s, `${c.name}: error step must state the unchanged last`);
        errors.add(`${s.op}:${s.error}`);
      }
    }
  assert.deepEqual([...errors].sort(), ['now:wall_out_of_range', 'receive:clock_ahead']);
});

test('uuid vectors: sender trimming edges are covered and the reference rejects unsafe dates', () => {
  const uuid = read('fixtures/uuid.json');
  const senders = uuid.sms.map((c) => c.sender).join('');
  for (const cp of [0xfeff, 0x1c, 0x1f, 0xa0, 0x2028])
    assert.ok(senders.includes(String.fromCodePoint(cp)), `sender vector with U+${cp.toString(16)}`);
  for (const bad of [1.5, 2 ** 53, NaN]) assert.throws(() => smsId('AXISBK', 'b', bad), RangeError);
});

test('merge vectors: every row of a non-error case is valid against its row schema', () => {
  const merge = read('fixtures/merge.json');
  for (const c of merge.cases) {
    if (c.expected.error) continue;
    const rowSchema = read(`schema/${c.table}.json`);
    for (const [side, row] of [['local', c.local], ['incoming', c.incoming], ['expected', c.expected.row]]) {
      if (row) assert.deepEqual(validate(rowSchema, row), [], `${c.name}: ${side}`);
    }
  }
});

// ── property tests on the reference merge ────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32);
}
const groups = Object.keys(spec.groups);
const VALUES = {
  note: [null, 'a', 'b', 'lunch'],
  category_id: ['c1', 'c2', null],
  amount_minor: [100, 4200, 99],
  currency: ['INR', 'USD'],
  deleted_at: [null, 5, 9],
  review_state: ['confirmed', 'needs_review'],
};
const baseRow = () => {
  const r = Object.fromEntries(spec.columns.map((c) => [c, null]));
  Object.assign(r, { id: 'x', type: 'expense', amount_minor: 100, currency: 'INR', occurred_at: 1, occurred_tz: 'Asia/Kolkata', payment_method: 'other', source: 'manual', review_state: 'confirmed', created_at: 1, updated_at: 1 });
  const stamps = Object.fromEntries(groups.map((g) => [g, '0000000000001-0000-00000000']));
  r.field_hlc = stringifyFieldHlc(stamps);
  r.hlc = '0000000000001-0000-00000000';
  return r;
};

/** A device: one row, a clock, and edits that stamp touched groups (what the repository does). */
function device(node) {
  let wall = 1;
  let counter = 0;
  return {
    node,
    row: baseRow(),
    edit(r) {
      const col = Object.keys(VALUES)[Math.floor(r() * Object.keys(VALUES).length)];
      const choices = VALUES[col];
      const g = groups.find((x) => spec.groups[x].includes(col));
      const now = wall + Math.floor(r() * 3);
      if (now === wall) counter++;
      else counter = 0;
      wall = now;
      const h = `${String(wall).padStart(13, '0')}-${counter.toString(16).padStart(4, '0')}-${node}`;
      const stamps = parseFieldHlc(this.row.field_hlc);
      stamps[g] = h;
      this.row = { ...this.row, [col]: choices[Math.floor(r() * choices.length)], field_hlc: stringifyFieldHlc(stamps), hlc: h, updated_at: wall };
    },
    receive(file) {
      const { row } = mergeRow(spec, this.row, file, { localFrontier: frontier([this.row]), incomingFrontier: frontier([file]) });
      this.row = row;
      const maxSeen = row.hlc;
      const w = Number(maxSeen.slice(0, 13));
      if (w > wall || (w === wall && parseInt(maxSeen.slice(14, 18), 16) >= counter)) {
        wall = w;
        counter = parseInt(maxSeen.slice(14, 18), 16) + 1;
      }
    },
  };
}

test('convergence + idempotence: random edit/exchange histories end identical (2000 runs)', () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const r = rng(seed);
    const devs = [device('aaaaaaaa'), device('bbbbbbbb'), device('cccccccc')];
    for (let step = 0; step < 12; step++) {
      const d = devs[Math.floor(r() * devs.length)];
      if (r() < 0.6) d.edit(r);
      else {
        const other = devs[Math.floor(r() * devs.length)];
        if (other !== d) d.receive({ ...other.row });
      }
    }
    // Full exchange rounds until quiescent: everyone imports everyone's file.
    for (let round = 0; round < 2; round++) for (const a of devs) for (const b of devs) if (a !== b) a.receive({ ...b.row });
    const [x, ...rest] = devs.map((d) => JSON.stringify(d.row));
    for (const y of rest) assert.equal(y, x, `seed ${seed}: copies diverged`);
    const again = mergeRow(spec, devs[0].row, devs[1].row);
    assert.equal(again.outcome, 'unchanged', `seed ${seed}: second import changed something`);
  }
});

test('merge is commutative on values, even with HLC ties from a cloned install', () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const r = rng(seed * 7919);
    const a = device('aaaaaaaa');
    // A cloned install (same node id) is the only way two different writes share one HLC.
    const b = device(seed % 3 === 0 ? 'aaaaaaaa' : 'bbbbbbbb');
    for (let i = 0; i < 6; i++) (r() < 0.5 ? a : b).edit(r);
    const ab = mergeRow(spec, a.row, b.row).row;
    const ba = mergeRow(spec, b.row, a.row).row;
    assert.equal(JSON.stringify(ab), JSON.stringify(ba), `seed ${seed}`);
  }
});

test('no resurrection: a newer deleted-group stamp is never undone by other-group edits', () => {
  const a = device('aaaaaaaa');
  const b = device('bbbbbbbb');
  b.receive({ ...a.row });
  const stamps = parseFieldHlc(a.row.field_hlc);
  stamps.deleted = '0000000000500-0000-aaaaaaaa';
  a.row = { ...a.row, deleted_at: 500, field_hlc: stringifyFieldHlc(stamps), hlc: stamps.deleted };
  for (let i = 0; i < 50; i++) {
    const s = parseFieldHlc(b.row.field_hlc);
    s.note = `0000000000${String(600 + i)}-0000-bbbbbbbb`;
    b.row = { ...b.row, note: `n${i}`, field_hlc: stringifyFieldHlc(s), hlc: s.note };
    a.receive({ ...b.row });
    assert.equal(a.row.deleted_at, 500);
    assert.equal(a.row.note, `n${i}`, 'field edits still apply to the tombstoned row');
  }
});
