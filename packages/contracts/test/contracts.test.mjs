// SPDX-License-Identifier: GPL-3.0-only
// Meta-tests: row JSON schemas ↔ canonical SQL ↔ merge groups (ADR 0009, contracts rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDb, userTables, columns, sqlPath } from '../lib/sqlite.mjs';
import { loadContracts, readJson, schemaPath } from '../lib/contracts.mjs';

const META = ['id', 'hlc', 'field_hlc', 'created_at', 'updated_at'];
const contracts = loadContracts();
const db = openDb({ local: false });
const sql = readFileSync(sqlPath('client-schema.sql'), 'utf8');

test('every user table has a row schema and nothing else does', () => {
  assert.deepEqual(contracts.tables.map((t) => t.name).sort(), [...userTables()].sort());
});

for (const t of contracts.tables) {
  test(`${t.name}: schema columns, order, types and nullability match the SQL`, () => {
    const cols = columns(db, t.name);
    assert.deepEqual(t.columns, cols.map((c) => c.name), 'same columns in the same order');
    assert.deepEqual(t.schema.required, t.columns, 'every column is required in a file row');
    assert.equal(t.schema.additionalProperties, false);
    for (const c of cols) {
      const p = t.properties[c.name];
      const types = Array.isArray(p.type) ? p.type : [p.type];
      const base = c.type === 'INTEGER' ? 'integer' : 'string';
      assert.ok(types.includes(base), `${t.name}.${c.name}: ${c.type} → ${base}`);
      assert.equal(types.includes('null'), c.notnull === 0 && c.pk === 0, `${t.name}.${c.name} nullability`);
      if (p.enum) {
        const nonNull = p.enum.filter((v) => v !== null);
        const quoted = nonNull.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(',\\s*');
        assert.match(sql, new RegExp(`${c.name}\\s+IN\\s*\\(${quoted}\\)`), `${t.name}.${c.name} enum matches CHECK`);
      }
    }
  });

  test(`${t.name}: every mutable column is in exactly one merge group`, () => {
    const seen = new Map();
    for (const [group, cols] of Object.entries(t.groups)) {
      assert.match(group, /^[a-z][a-z0-9_]*$/, `group name ${group}`);
      assert.ok(cols.length > 0, `group ${group} is empty`);
      for (const col of cols) {
        assert.ok(!seen.has(col), `${col} in both ${seen.get(col)} and ${group}`);
        seen.set(col, group);
      }
    }
    for (const col of t.immutable) assert.ok(!seen.has(col), `immutable ${col} is also in group ${seen.get(col)}`);
    for (const col of META) assert.ok(!seen.has(col) && !t.immutable.includes(col), `meta ${col} is merged by rule`);
    const covered = new Set([...META, ...t.immutable, ...seen.keys()]);
    assert.deepEqual(t.columns.filter((c) => !covered.has(c)), [], 'uncovered columns');
    assert.deepEqual([...covered].filter((c) => !t.columns.includes(c)), [], 'groups name unknown columns');
    assert.deepEqual(t.groups.deleted, ['deleted_at'], 'tombstones live in their own `deleted` group');
  });
}

test('coupled columns share a group (amount+currency, budget scope+category)', () => {
  const g = (table) => contracts.tables.find((t) => t.name === table).groups;
  assert.deepEqual(g('transactions').amount, ['amount_minor', 'currency', 'original_amount_minor', 'original_currency']);
  assert.deepEqual(g('ledger_entries').amount, ['amount_minor', 'currency']);
  assert.deepEqual(g('budgets').scope, ['scope', 'category_id']);
  assert.deepEqual(g('transactions').when, ['occurred_at', 'occurred_tz']);
});

test('transactions groups match ARCH §5.2 exactly (+ location)', () => {
  const t = contracts.tables.find((x) => x.name === 'transactions');
  assert.deepEqual(Object.keys(t.groups), [
    'amount', 'type', 'when', 'account', 'category', 'merchant', 'note', 'method', 'review', 'links',
    'recurring', 'location', 'deleted',
  ]);
  assert.deepEqual(t.immutable, ['source', 'external_ref']);
});

test('payload schema lists every user table and references its row schema', () => {
  const payload = readJson(schemaPath('zwallet-payload.json'));
  const tables = payload.properties.tables;
  assert.deepEqual([...tables.required].sort(), [...userTables()].sort());
  for (const name of tables.required) assert.equal(tables.properties[name].items.$ref, `${name}.json`);
  for (const local of ['sms_index', 'op_log', 'conflict_log', 'daily_agg', 'device_state', 'import_log']) {
    assert.ok(!(local in tables.properties), `${local} must never be exported`);
  }
});

test('envelope schema pins the ADR 0013 crypto parameters', () => {
  const env = readJson(schemaPath('zwallet-envelope.json'));
  assert.equal(env.properties.format.const, 'zwallet-backup');
  assert.equal(env.properties.kdf.properties.name.const, 'PBKDF2-HMAC-SHA256');
  assert.equal(env.properties.kdf.properties.iterations.minimum, 600000);
  assert.equal(env.properties.cipher.properties.name.const, 'AES-256-GCM');
  assert.match(Buffer.alloc(16).toString('base64'), new RegExp(env.properties.kdf.properties.salt.pattern));
  assert.match(Buffer.alloc(12).toString('base64'), new RegExp(env.properties.cipher.properties.iv.pattern));
});

test('FK order puts parents before children', () => {
  const order = contracts.tables.map((t) => t.name);
  for (const t of order) {
    for (const fk of db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(t)})`).all()) {
      if (fk.table !== t) assert.ok(order.indexOf(fk.table) < order.indexOf(t), `${fk.table} before ${t}`);
    }
  }
});
