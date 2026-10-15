// SPDX-License-Identifier: GPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, userTables, columns } from '../lib/sqlite.mjs';

const CONVENTION = [
  ['id', 'TEXT', 1],
  ['hlc', 'TEXT', 1],
  ['field_hlc', 'TEXT', 1],
  ['created_at', 'INTEGER', 1],
  ['updated_at', 'INTEGER', 1],
  ['deleted_at', 'INTEGER', 0],
];
const EXPECTED_USER_TABLES = [
  'profile', 'accounts', 'categories', 'merchants', 'transactions', 'tags', 'transaction_tags',
  'people', 'ledger_entries', 'rules', 'budgets', 'recurring_series', 'upcoming_items',
  'saved_filters', 'insight_dismissals', 'attachments',
];
const DEVICE_LOCAL = ['device_state', 'op_log', 'conflict_log', 'import_log', 'daily_agg', 'sms_index'];

test('schema files apply cleanly (incl. FTS5) with foreign keys on', () => {
  const db = openDb();
  const fts = db.prepare("SELECT name FROM sqlite_schema WHERE name = 'transactions_fts'").get();
  assert.ok(fts, 'transactions_fts exists');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('user-data tables are exactly the documented set', () => {
  assert.deepEqual([...userTables()].sort(), [...EXPECTED_USER_TABLES].sort());
});

test('device-local tables never appear in client-schema.sql', () => {
  const tables = userTables();
  for (const t of DEVICE_LOCAL) assert.ok(!tables.includes(t), t);
});

test('every user table starts with the convention columns (ARCH §4.1)', () => {
  const db = openDb({ local: false });
  for (const table of userTables()) {
    const cols = columns(db, table);
    const head = cols.slice(0, CONVENTION.length).map((c) => [c.name, c.type, c.notnull]);
    assert.deepEqual(head, CONVENTION, table);
    assert.equal(cols[0].pk, 1, `${table}.id is the primary key`);
    const fieldHlc = cols.find((c) => c.name === 'field_hlc');
    assert.equal(fieldHlc.dflt_value, `'{}'`, `${table}.field_hlc defaults to '{}'`);
  }
});

test('money columns are INTEGER minor units, never REAL/NUMERIC', () => {
  const db = openDb();
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_schema WHERE type = 'table' AND sql NOT LIKE 'CREATE VIRTUAL%'
         AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'transactions_fts%'`,
    )
    .all()
    .map((r) => r.name);
  for (const table of tables) {
    for (const c of columns(db, table)) {
      assert.ok(!/REAL|NUMERIC|DECIMAL|FLOAT|DOUBLE/i.test(c.type), `${table}.${c.name} is ${c.type}`);
      if (/_minor$/.test(c.name)) assert.equal(c.type, 'INTEGER', `${table}.${c.name}`);
    }
  }
});

const base = { hlc: 'h', created_at: 1, updated_at: 1 };
function insert(db, table, row) {
  const r = { ...base, ...row };
  const keys = Object.keys(r);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  db.prepare(sql).run(...keys.map((k) => r[k]));
}
const txn = (extra = {}) => ({ id: 't1', type: 'expense', amount_minor: 100, occurred_at: 1, ...extra });

test('CHECK constraints reject invalid rows', () => {
  const bad = [
    ['transactions', txn({ amount_minor: 0 })],
    ['transactions', txn({ amount_minor: -5 })],
    ['transactions', txn({ type: 'gift' })],
    ['transactions', txn({ note: 'x'.repeat(501) })],
    ['transactions', txn({ payment_method: 'cheque' })],
    ['transactions', txn({ review_state: 'maybe' })],
    ['transactions', txn({ source: 'email' })],
    ['transactions', txn({ currency: 'RUPEE' })],
    ['profile', { id: 'you', phone_hash_salt: 's' }],
    ['profile', { id: 'me', phone_hash_salt: 's', month_start_day: 29 }],
    ['accounts', { id: 'a', name: 'A', kind: 'piggy' }],
    ['categories', { id: 'c', name: 'C', icon: 'i', color_token: 'x', counts_as: 'maybe' }],
    ['ledger_entries', { id: 'l', person_id: 'p', kind: 'gifted', amount_minor: 1, occurred_at: 1 }],
    ['ledger_entries', { id: 'l', person_id: 'p', kind: 'lent', amount_minor: 1, occurred_at: 1, due_on: '15/10/2026' }],
    ['budgets', { id: 'b', scope: 'overall', category_id: 'c', amount_minor: 1 }],
    ['budgets', { id: 'b', scope: 'category', amount_minor: 1 }],
    ['attachments', { id: 'x', transaction_id: 't', mime_type: 'application/pdf', byte_size: 1, sha256: 'a'.repeat(64) }],
  ];
  for (const [table, row] of bad) {
    const db = openDb({ local: false });
    db.exec('PRAGMA foreign_keys = OFF');
    assert.throws(() => insert(db, table, row), /CHECK|constraint/i, `${table} ${JSON.stringify(row).slice(0, 80)}`);
  }
});

test('valid rows insert with documented defaults; external_ref unique per account among live rows', () => {
  const db = openDb({ local: false });
  insert(db, 'profile', { id: 'me', phone_hash_salt: 'salt' });
  insert(db, 'accounts', { id: 'a', name: 'SBI ••1234', kind: 'bank', last4: '1234' });
  insert(db, 'transactions', txn({ account_id: 'a', external_ref: 'R1' }));
  assert.throws(
    () => insert(db, 'transactions', txn({ id: 't2', account_id: 'a', external_ref: 'R1' })),
    /UNIQUE/,
  );
  db.prepare('UPDATE transactions SET deleted_at = 5 WHERE id = ?').run('t1');
  insert(db, 'transactions', txn({ id: 't2', account_id: 'a', external_ref: 'R1' }));
  const row = db
    .prepare('SELECT currency, occurred_tz, field_hlc, review_state, source, payment_method FROM transactions WHERE id = ?')
    .get('t2');
  assert.deepEqual(
    { ...row },
    {
      currency: 'INR',
      occurred_tz: 'Asia/Kolkata',
      field_hlc: '{}',
      review_state: 'confirmed',
      source: 'manual',
      payment_method: 'other',
    },
  );
});

test('foreign keys are declared (enforced locally; deferred during import, ARCH §4.2)', () => {
  const db = openDb({ local: false });
  assert.throws(() => insert(db, 'transactions', txn({ account_id: 'missing' })), /FOREIGN KEY/);
  db.exec('BEGIN; PRAGMA defer_foreign_keys = ON;');
  insert(db, 'transactions', txn({ account_id: 'a' }));
  insert(db, 'accounts', { id: 'a', name: 'Cash', kind: 'cash' });
  db.exec('COMMIT');
});
