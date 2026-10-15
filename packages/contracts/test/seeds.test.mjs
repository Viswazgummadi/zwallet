// SPDX-License-Identifier: GPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedId } from '../lib/ids.mjs';
import { openDb } from '../lib/sqlite.mjs';

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8'));
const categories = read('seed/categories.json');
const tags = read('seed/tags.json');
const tokens = read('../design-tokens/tokens.json');
const all = categories.groups.flatMap((g) => [g, ...g.categories]);
const byKey = Object.fromEntries(all.map((c) => [c.system_key, c]));

test('seed ids are UUIDv8("seed:v1|" + system_key) and unique', () => {
  for (const c of all) assert.equal(c.id, seedId(c.system_key), c.system_key);
  for (const t of tags.tags) assert.equal(t.id, seedId(t.system_key), t.system_key);
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  assert.equal(new Set(all.map((c) => c.system_key)).size, all.length);
});

test('every group has an identity color in tokens.categoryIdentity (DESIGN §2.4)', () => {
  for (const g of categories.groups) {
    assert.ok(g.system_key in tokens.categoryIdentity.containers, g.system_key);
    assert.equal(g.color_token, `category.${g.system_key}`);
    for (const c of g.categories) {
      assert.equal(c.color_token, g.color_token, `${c.system_key} inherits its group color`);
      assert.ok(c.system_key.startsWith(`${g.system_key}.`), c.system_key);
    }
  }
});

test('kickoff counts_as decisions hold (SPEC §6.1, §9.2)', () => {
  const expect = {
    'family.support': 'excluded',
    'finance.emi_loans': 'excluded',
    'income.reimbursement': 'excluded',
    'system.transfer': 'excluded',
    'system.lending': 'excluded',
    'shopping.small_upi': 'spend',
    'system.uncategorized': 'spend',
    'income.salary': 'income',
  };
  for (const [k, v] of Object.entries(expect)) assert.equal(byKey[k]?.counts_as, v, k);
  for (const c of categories.groups.find((g) => g.system_key === 'investments').categories) {
    assert.equal(c.counts_as, 'savings', c.system_key);
  }
  assert.deepEqual(tags.tags.map((t) => t.system_key), ['reimbursable']);
});

test('the SPEC §6.1 taxonomy is complete', () => {
  assert.deepEqual(
    categories.groups.map((g) => g.name),
    [
      'Food & Dining', 'Groceries', 'Transport', 'Housing', 'Bills & Utilities', 'Shopping', 'Health',
      'Entertainment', 'Travel', 'Education', 'Personal care', 'Family & gifts', 'Finance', 'Investments',
      'Income', 'System',
    ],
  );
  assert.equal(all.length - categories.groups.length, 57);
});

test('seed rows insert into the canonical schema with the minimum HLC', () => {
  const db = openDb({ local: false });
  const ins = db.prepare(
    `INSERT INTO categories (id, hlc, field_hlc, created_at, updated_at, parent_id, name, icon, color_token,
       counts_as, sort_order, system_key) VALUES (?, ?, '{}', 0, 0, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const g of categories.groups) {
    ins.run(g.id, categories.seed_hlc, null, g.name, g.icon, g.color_token, g.counts_as, g.sort_order, g.system_key);
    for (const c of g.categories) {
      ins.run(c.id, categories.seed_hlc, g.id, c.name, c.icon, c.color_token, c.counts_as, c.sort_order, c.system_key);
    }
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM categories').get().n, all.length);
  assert.equal(categories.seed_hlc, '0000000000000-0000-00000000');
});
