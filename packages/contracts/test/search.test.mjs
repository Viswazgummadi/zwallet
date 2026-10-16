// SPDX-License-Identifier: GPL-3.0-only
// fixtures/search.json: reference parser/SQL reproduce every case, and the SQL returns expect_ids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { search } from '../lib/search-reference.mjs';
import { openDb } from '../lib/sqlite.mjs';

const fx = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/search.json', import.meta.url)), 'utf8'));

test('search vectors: tokens, where, params and result ids', () => {
  const db = openDb({ local: true });
  for (const s of fx.dataset_sql) db.exec(s);
  assert.ok(fx.cases.length > 80);
  for (const c of fx.cases) {
    const r = search(c.input, fx.context);
    assert.deepEqual(r.tokens, c.tokens, c.input);
    assert.equal(r.where, c.where, c.input);
    assert.deepEqual(r.params, c.params, c.input);
    const ids = db.prepare(`SELECT t.id FROM transactions t WHERE ${c.where} ORDER BY t.id`).all(...c.params).map((x) => x.id);
    assert.deepEqual(ids, c.expect_ids, c.input);
    assert.ok(!ids.includes('t06'), 'deleted rows never match');
    assert.equal((c.where.match(/\?/g) ?? []).length, c.params.length, `placeholder count: ${c.input}`);
  }
});

test('search never interpolates user text into SQL', () => {
  for (const c of fx.cases) assert.ok(!/swiggy|biryani|hdfc/i.test(c.where), c.input);
});
