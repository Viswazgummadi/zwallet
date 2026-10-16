// SPDX-License-Identifier: GPL-3.0-only
// Loads the row schemas (schema/<table>.json) and orders tables by foreign keys (parents first),
// using the canonical SQL as the source of the FK graph.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, userTables, columns } from './sqlite.mjs';

export const schemaPath = (name) => fileURLToPath(new URL(`../schema/${name}`, import.meta.url));
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** Topological order over FK edges (self-references ignored), ties broken by declaration order. */
export function fkOrder() {
  const db = openDb({ local: false });
  const tables = userTables();
  const deps = new Map(
    tables.map((t) => [
      t,
      new Set(
        db
          .prepare(`PRAGMA foreign_key_list(${JSON.stringify(t)})`)
          .all()
          .map((fk) => fk.table)
          .filter((p) => p !== t),
      ),
    ]),
  );
  const order = [];
  const done = new Set();
  while (order.length < tables.length) {
    const next = tables.find((t) => !done.has(t) && [...deps.get(t)].every((d) => done.has(d)));
    if (!next) throw new Error('Foreign-key cycle between user tables');
    order.push(next);
    done.add(next);
  }
  return order;
}

/** SQLite DEFAULT literal ('text' or integer) → JSON value. */
export function sqlDefault(literal) {
  if (/^-?\d+$/.test(literal)) return Number(literal);
  const m = /^'((?:[^']|'')*)'$/.exec(literal);
  if (m) return m[1].replaceAll("''", "'");
  throw new Error(`Unsupported DEFAULT literal ${literal}`);
}

/**
 * Tombstone compaction (ARCH §5.5): column → compacted value for every column of every group
 * except `deleted`, in group order. NULL when nullable, else the SQL DEFAULT, else the table's
 * `x-compact` placeholder. Columns in `x-compact-keep` (NOT NULL foreign keys, which no
 * placeholder can satisfy) keep their value and are left out of the map. Throws on any gap or
 * stray entry so codegen can never emit a partial map.
 */
export function compaction(db, name, schema) {
  const info = new Map(columns(db, name).map((c) => [c.name, c]));
  const placeholders = schema['x-compact'] ?? {};
  const keep = schema['x-compact-keep'] ?? [];
  const compact = {};
  const used = new Set();
  for (const [group, cols] of Object.entries(schema['x-merge-groups'])) {
    if (group === 'deleted') continue;
    for (const c of cols) {
      if (keep.includes(c)) continue;
      const col = info.get(c);
      if (Object.hasOwn(placeholders, c)) {
        if (col.notnull === 0 || col.dflt_value !== null) {
          throw new Error(`${name}.x-compact.${c}: only NOT NULL columns without DEFAULT take a placeholder`);
        }
        compact[c] = placeholders[c];
        used.add(c);
      } else if (col.notnull === 0) compact[c] = null;
      else if (col.dflt_value !== null) compact[c] = sqlDefault(col.dflt_value);
      else throw new Error(`${name}.${c}: NOT NULL without DEFAULT needs an x-compact placeholder`);
    }
  }
  for (const c of Object.keys(placeholders)) {
    if (!used.has(c)) throw new Error(`${name}.x-compact.${c}: not a payload-group column`);
  }
  for (const c of keep) {
    const fk = db.prepare(`PRAGMA foreign_key_list(${JSON.stringify(name)})`).all().some((f) => f.from === c);
    if (!fk || info.get(c)?.notnull !== 1) throw new Error(`${name}.x-compact-keep.${c}: only NOT NULL foreign keys are kept`);
  }
  return { compact, compactKeep: keep };
}

export function loadContracts() {
  const payload = readJson(schemaPath('zwallet-payload.json'));
  const envelope = readJson(schemaPath('zwallet-envelope.json'));
  const db = openDb({ local: false });
  const tables = fkOrder().map((name) => {
    const s = readJson(schemaPath(`${name}.json`));
    return {
      name,
      columns: Object.keys(s.properties),
      immutable: s['x-immutable'],
      groups: s['x-merge-groups'],
      ...compaction(db, name, s),
      properties: s.properties,
      schema: s,
    };
  });
  return {
    schemaVersion: payload.properties.schema_version.const,
    formatVersion: envelope.properties.format_version.minimum,
    tables,
  };
}
