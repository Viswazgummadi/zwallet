// SPDX-License-Identifier: GPL-3.0-only
// Loads the row schemas (schema/<table>.json) and orders tables by foreign keys (parents first),
// using the canonical SQL as the source of the FK graph.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb, userTables } from './sqlite.mjs';

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

export function loadContracts() {
  const payload = readJson(schemaPath('zwallet-payload.json'));
  const envelope = readJson(schemaPath('zwallet-envelope.json'));
  const tables = fkOrder().map((name) => {
    const s = readJson(schemaPath(`${name}.json`));
    return {
      name,
      columns: Object.keys(s.properties),
      immutable: s['x-immutable'],
      groups: s['x-merge-groups'],
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
