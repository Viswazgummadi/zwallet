// SPDX-License-Identifier: GPL-3.0-only
// Opens an in-memory SQLite (Node's built-in node:sqlite) with the canonical schema applied.
// Used by tests and codegen; no third-party dependency.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const sqlPath = (name) => fileURLToPath(new URL(`../sql/${name}`, import.meta.url));

export function openDb({ local = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(sqlPath('client-schema.sql'), 'utf8'));
  if (local) {
    db.exec(readFileSync(sqlPath('client-local.sql'), 'utf8'));
    db.exec(readFileSync(sqlPath('android-local.sql'), 'utf8'));
  }
  return db;
}

/** User-data tables (everything in client-schema.sql), in declaration order. */
export function userTables() {
  const db = openDb({ local: false });
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
    .all()
    .map((r) => r.name);
}

/** [{name, type, notnull, dflt_value, pk}] for a table. */
export function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all();
}
