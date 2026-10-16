// SPDX-License-Identifier: GPL-3.0-only
// Meta-tests: row JSON schemas ↔ canonical SQL ↔ merge groups (ADR 0009, contracts rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, userTables, columns } from '../lib/sqlite.mjs';
import { loadContracts, readJson, schemaPath } from '../lib/contracts.mjs';
import { validate } from '../lib/row-schema.mjs';

const META = ['id', 'hlc', 'field_hlc', 'created_at', 'updated_at'];
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const contracts = loadContracts();
const db = openDb({ local: false });
const payloadSchema = readJson(schemaPath('zwallet-payload.json'));
const envelopeSchema = readJson(schemaPath('zwallet-envelope.json'));

// Patterns that have no SQL counterpart (checked by validation before import, not by SQLite).
const HLC = '^\\d{13}-[0-9a-f]{4}-[0-9a-f]{8}$';
const STAMP = '"[a-z][a-z0-9_]*":"\\d{13}-[0-9a-f]{4}-[0-9a-f]{8}"';
const FIELD_HLC = `^\\{(?:${STAMP}(?:,${STAMP})*)?\\}$`;
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const PHONE_HASH = '^v1:[0-9a-f]{32}:[0-9a-f]{64}$';
const SHA256 = '^[0-9a-f]{64}$';
const JSON_ONLY_PATTERNS = new Set([HLC, FIELD_HLC, UUID, PHONE_HASH, SHA256]);

const fksOf = (table) => db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(table)})`).all();
const typesOf = (p) => (Array.isArray(p.type) ? p.type : [p.type]);

// ── SQL CHECK parsing (column-level CHECKs only; table-level CHECKs are exercised by inserts) ──
function columnDefs(table) {
  const sql = db.prepare('SELECT sql FROM sqlite_schema WHERE name = ?').get(table).sql.replace(/--[^\n]*/g, '');
  const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
  const defs = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      defs.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  defs.push(cur.trim());
  return new Map(
    defs
      .filter((d) => !/^CHECK\b/.test(d))
      .map((d) => d.replace(/\s+/g, ' '))
      .map((d) => [d.split(' ')[0], d]),
  );
}

function checkOf(def) {
  const i = def.indexOf('CHECK (');
  if (i < 0) return null;
  let depth = 0;
  for (let j = i + 6; j < def.length; j++) {
    if (def[j] === '(') depth++;
    if (def[j] === ')' && --depth === 0) return def.slice(i + 7, j);
  }
  throw new Error(`unbalanced CHECK in ${def}`);
}

/** The constraint a column CHECK expresses, in JSON-Schema terms. Unknown forms fail loudly. */
function parseCheck(col, expr) {
  const e = expr.replace(new RegExp(`^${col} IS NULL OR `), '');
  const lit = (s) => (s.startsWith("'") ? s.slice(1, -1) : Number(s));
  let m;
  if ((m = new RegExp(`^${col} IN \\((.*)\\)$`).exec(e))) return { enum: m[1].split(',').map((s) => lit(s.trim())) };
  if ((m = new RegExp(`^${col} BETWEEN (-?\\d+) AND (-?\\d+)$`).exec(e))) return { minimum: +m[1], maximum: +m[2] };
  if ((m = new RegExp(`^${col} > (-?\\d+)$`).exec(e))) return { minimum: +m[1] + 1 };
  if ((m = new RegExp(`^${col} >= (-?\\d+)$`).exec(e))) return { minimum: +m[1] };
  if ((m = new RegExp(`^length\\(${col}\\) = (\\d+)$`).exec(e))) return { minLength: +m[1], maxLength: +m[1] };
  if ((m = new RegExp(`^length\\(${col}\\) <= (\\d+)$`).exec(e))) return { maxLength: +m[1] };
  if ((m = new RegExp(`^length\\(${col}\\) BETWEEN (\\d+) AND (\\d+)$`).exec(e))) return { minLength: +m[1], maxLength: +m[2] };
  if ((m = new RegExp(`^${col} GLOB '([^']*)'$`).exec(e))) return { glob: m[1] };
  if ((m = new RegExp(`^${col} = '([^']*)'$`).exec(e))) return { const: m[1] };
  throw new Error(`Unrecognised CHECK on ${col}: ${expr} (teach parseCheck, then compare it)`);
}

/** GLOB (classes and literals only) → anchored regex; `X{n}` in a pattern expands to n copies. */
const globToRegex = (glob) => {
  assert.doesNotMatch(glob, /[*?]/, 'only fixed-length GLOBs are compared');
  return `^${glob}$`;
};
const expandRepeats = (re) => re.replace(/(\[[^\]]+\]|\\d|.)\{(\d+)\}/g, (_, atom, n) => atom.repeat(+n));

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
      const types = typesOf(t.properties[c.name]);
      const base = c.type === 'INTEGER' ? 'integer' : 'string';
      assert.ok(types.includes(base), `${t.name}.${c.name}: ${c.type} → ${base}`);
      assert.equal(types.includes('null'), c.notnull === 0 && c.pk === 0, `${t.name}.${c.name} nullability`);
    }
  });

  test(`${t.name}: enums, bounds, lengths and patterns equal the SQL CHECKs (both directions)`, () => {
    const defs = columnDefs(t.name);
    for (const c of t.columns) {
      const p = t.properties[c];
      const expr = checkOf(defs.get(c));
      const sql = expr ? parseCheck(c, expr) : {};
      const where = `${t.name}.${c}`;
      const jsonEnum = p.enum?.filter((v) => v !== null);
      assert.deepEqual(jsonEnum, sql.enum, `${where} enum`);
      assert.equal(p.const, sql.const, `${where} const`);
      if (typesOf(p).includes('integer')) {
        const lo = sql.minimum ?? (sql.enum ? Math.min(...sql.enum) : -MAX_SAFE);
        const hi = sql.maximum ?? (sql.enum ? Math.max(...sql.enum) : MAX_SAFE);
        assert.equal(p.minimum, lo, `${where} minimum`);
        assert.equal(p.maximum, hi, `${where} maximum`);
      } else {
        assert.equal(sql.minimum, undefined, `${where}: numeric CHECK on a TEXT column`);
      }
      assert.equal(p.minLength, sql.minLength, `${where} minLength`);
      assert.equal(p.maxLength, sql.maxLength, `${where} maxLength`);
      if (sql.glob !== undefined) {
        assert.equal(expandRepeats(p.pattern ?? ''), globToRegex(sql.glob), `${where} pattern ↔ GLOB`);
      } else if (p.pattern !== undefined) {
        assert.ok(JSON_ONLY_PATTERNS.has(p.pattern), `${where}: pattern ${p.pattern} has no SQL GLOB`);
      }
    }
  });

  test(`${t.name}: ids, foreign keys and clocks carry their patterns`, () => {
    if (t.name === 'profile') assert.equal(t.properties.id.const, 'me');
    else assert.equal(t.properties.id.pattern, UUID, 'id is a lowercase UUID');
    for (const fk of fksOf(t.name)) assert.equal(t.properties[fk.from].pattern, UUID, `FK ${fk.from}`);
    assert.equal(t.properties.hlc.pattern, HLC);
    assert.equal(t.properties.field_hlc.pattern, FIELD_HLC);
    for (const c of t.columns) if (/(^|_)currency$/.test(c)) assert.equal(t.properties[c].pattern, '^[A-Z]{3}$', c);
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

  test(`${t.name}: a compacted tombstone satisfies the row schema and every SQL CHECK`, () => {
    assert.ok(t.schema['x-compact'] && Array.isArray(t.schema['x-compact-keep']), 'declares x-compact and x-compact-keep');
    const payloadCols = Object.entries(t.groups).filter(([g]) => g !== 'deleted').flatMap(([, c]) => c);
    assert.deepEqual(
      [...Object.keys(t.compact), ...t.compactKeep].sort(),
      [...payloadCols].sort(),
      'every payload column is compacted or kept',
    );
    // Values compaction never touches (meta, immutable, kept FKs) take any valid sample.
    const sample = {
      id: t.name === 'profile' ? 'me' : '01920000-0000-7000-8000-000000000001',
      hlc: '1760000000000-0000-aaaaaaaa',
      field_hlc: JSON.stringify(Object.fromEntries(Object.keys(t.groups).sort().map((g) => [g, '1760000000000-0000-aaaaaaaa']))),
      created_at: 1,
      updated_at: 1,
      deleted_at: 1760000000000,
      source: 'manual',
      origin: t.name === 'rules' ? 'user' : 'manual',
      system_key: null,
      rule_id: 'category_up_vs_typical',
      subject_key: 'food|2026-10',
      transaction_id: '01920000-0000-7000-8000-000000000002',
      tag_id: '01920000-0000-7000-8000-000000000003',
      person_id: '01920000-0000-7000-8000-000000000004',
      mime_type: 'image/webp',
      byte_size: 1,
      sha256: 'a'.repeat(64),
      width: null,
      height: null,
    };
    const row = Object.fromEntries(t.columns.map((c) => [c, Object.hasOwn(t.compact, c) ? t.compact[c] : sample[c]]));
    for (const c of t.columns) assert.notEqual(row[c], undefined, `no sample value for ${t.name}.${c}`);
    assert.deepEqual(validate(t.schema, row), [], 'schema-valid');
    const local = openDb({ local: false });
    local.exec('PRAGMA foreign_keys = OFF'); // parents are irrelevant here; CHECKs are not
    local
      .prepare(`INSERT INTO ${t.name} (${t.columns.join(',')}) VALUES (${t.columns.map(() => '?').join(',')})`)
      .run(...t.columns.map((c) => row[c]));
  });
}

test('UNIQUE indexes on user data are only those implied by a deterministic id', () => {
  // A UNIQUE index over mergeable data can make a valid .zwallet impossible to import: two copies
  // may legitimately hold different ids with equal indexed values, and the merge (which never
  // renames ids) would then violate the constraint inside the import transaction. Uniqueness is
  // safe only when the indexed columns fully determine the row's id, so equal values imply the
  // same id and the rows merge into one instead of colliding.
  const ALLOWED = {
    // id = UUIDv8("tt:v1|" + transaction_id + "|" + tag_id) (ADR 0010, client-schema.sql)
    transaction_tags_pair: { table: 'transaction_tags', columns: ['transaction_id', 'tag_id'] },
  };
  const found = {};
  for (const table of userTables()) {
    for (const ix of db.prepare(`PRAGMA index_list(${JSON.stringify(table)})`).all()) {
      if (!ix.unique || ix.origin === 'pk') continue;
      const cols = db.prepare(`PRAGMA index_info(${JSON.stringify(ix.name)})`).all().map((c) => c.name);
      found[ix.name] = { table, columns: cols };
    }
  }
  assert.deepEqual(found, ALLOWED);
  for (const { table, columns: cols } of Object.values(ALLOWED)) {
    const t = contracts.tables.find((x) => x.name === table);
    for (const c of cols) assert.ok(t.immutable.includes(c), `${table}.${c} is part of the id, so immutable`);
  }
});

test('every integer in every schema is a safe integer (S5)', () => {
  const walk = (schema, where) => {
    if (schema.properties) for (const [k, v] of Object.entries(schema.properties)) walk(v, `${where}.${k}`);
    if (schema.items) walk(schema.items, `${where}[]`);
    if (schema.type && typesOf(schema).includes('integer')) {
      assert.ok(Number.isSafeInteger(schema.minimum) && schema.minimum >= -MAX_SAFE, `${where} minimum`);
      assert.ok(Number.isSafeInteger(schema.maximum) && schema.maximum <= MAX_SAFE, `${where} maximum`);
    }
  };
  for (const t of contracts.tables) walk(t.schema, t.name);
  walk(payloadSchema, 'payload');
  walk(envelopeSchema, 'envelope');
});

test('coupled columns share a group (amount+currency, budget scope+category)', () => {
  const g = (table) => contracts.tables.find((t) => t.name === table).groups;
  assert.deepEqual(g('transactions').amount, ['amount_minor', 'currency', 'original_amount_minor', 'original_currency']);
  assert.deepEqual(g('ledger_entries').amount, ['amount_minor', 'currency']);
  assert.deepEqual(g('budgets').scope, ['scope', 'category_id']);
  assert.deepEqual(g('transactions').when, ['occurred_at', 'occurred_tz']);
});

test('transactions groups match ARCH §5.2 exactly (+ location, + ref)', () => {
  const t = contracts.tables.find((x) => x.name === 'transactions');
  assert.deepEqual(Object.keys(t.groups), [
    'amount', 'type', 'when', 'account', 'category', 'merchant', 'note', 'method', 'review', 'links',
    'recurring', 'location', 'ref', 'deleted',
  ]);
  assert.deepEqual(t.groups.ref, ['external_ref'], 'external_ref is LWW so a re-parse can correct it');
  assert.deepEqual(t.immutable, ['source']);
});

test('people.phone_hash is per-person salted; profile carries no salt', () => {
  const people = contracts.tables.find((t) => t.name === 'people');
  const profile = contracts.tables.find((t) => t.name === 'profile');
  assert.equal(people.properties.phone_hash.pattern, PHONE_HASH);
  assert.ok(!profile.columns.some((c) => c.includes('salt')));
});

test('payload schema lists every user table and references its row schema', () => {
  const tables = payloadSchema.properties.tables;
  assert.deepEqual([...tables.required].sort(), [...userTables()].sort());
  for (const name of tables.required) assert.equal(tables.properties[name].items.$ref, `${name}.json`);
  for (const local of ['sms_index', 'op_log', 'conflict_log', 'daily_agg', 'device_state', 'import_log']) {
    assert.ok(!(local in tables.properties), `${local} must never be exported`);
  }
  assert.equal(payloadSchema.properties.max_hlc.pattern, HLC);
});

test('envelope schema pins the ADR 0013 crypto parameters', () => {
  const env = envelopeSchema;
  assert.equal(env.properties.format.const, 'zwallet-backup');
  assert.equal(env.properties.kdf.properties.name.const, 'PBKDF2-HMAC-SHA256');
  assert.equal(env.properties.kdf.properties.iterations.minimum, 600000);
  assert.equal(env.properties.cipher.properties.name.const, 'AES-256-GCM');
  assert.match(Buffer.alloc(16).toString('base64'), new RegExp(env.properties.kdf.properties.salt.pattern));
  assert.match(Buffer.alloc(12).toString('base64'), new RegExp(env.properties.cipher.properties.iv.pattern));
});

test('envelope app_version is a short version token', () => {
  const re = new RegExp(envelopeSchema.properties.created_by.properties.app_version.pattern, 'u');
  for (const ok of ['1.2.0', '0.1.0-dev+3', 'v1']) assert.match(ok, re);
  for (const bad of ['', '1.2 beta', '1.0/..', 'x'.repeat(65), '1.0\n']) assert.doesNotMatch(bad, re);
});

test('FK order puts parents before children', () => {
  const order = contracts.tables.map((t) => t.name);
  for (const t of order) {
    for (const fk of fksOf(t)) {
      if (fk.table !== t) assert.ok(order.indexOf(fk.table) < order.indexOf(t), `${fk.table} before ${t}`);
    }
  }
});
