-- SPDX-License-Identifier: GPL-3.0-only
-- Device-local tables (ARCHITECTURE §4.3). Created on both clients next to client-schema.sql.
-- NEVER exported to a .zwallet file and never merged.

-- HLC node id, last HLC, last export/import times, schema version.
CREATE TABLE device_state (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

-- Session undo stack: inverse operations as JSON.
CREATE TABLE op_log (
  op_id            TEXT    NOT NULL PRIMARY KEY,
  ts               INTEGER NOT NULL,
  label            TEXT    NOT NULL,
  inverse_ops_json TEXT    NOT NULL
);
CREATE INDEX op_log_ts ON op_log (ts);

-- Merge groups that lost on import, with the losing values, for "Use this value".
CREATE TABLE conflict_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT,
  table_name    TEXT    NOT NULL,
  row_id        TEXT    NOT NULL,
  merge_group   TEXT    NOT NULL,
  losing_values TEXT    NOT NULL,
  losing_hlc    TEXT    NOT NULL,
  winning_hlc   TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  resolved_at   INTEGER
);
CREATE INDEX conflict_log_row ON conflict_log (table_name, row_id);

-- One row per import, for the summary and Undo import (snapshot kept ≤ 7 days / until next import).
CREATE TABLE import_log (
  id            TEXT    NOT NULL PRIMARY KEY,
  imported_at   INTEGER NOT NULL,
  exported_at   INTEGER NOT NULL,
  source_node   TEXT    NOT NULL,
  source_app    TEXT    NOT NULL,
  counts_json   TEXT    NOT NULL,
  snapshot_path TEXT,
  undone_at     INTEGER
);

-- Analytics cache maintained by triggers (ARCH §7). Unknown dimensions use '' (not NULL) so the
-- primary key stays total.
CREATE TABLE daily_agg (
  day         TEXT    NOT NULL,
  account_id  TEXT    NOT NULL DEFAULT '',
  category_id TEXT    NOT NULL DEFAULT '',
  merchant_id TEXT    NOT NULL DEFAULT '',
  type        TEXT    NOT NULL,
  counts_as   TEXT    NOT NULL DEFAULT '',
  sum_minor   INTEGER NOT NULL DEFAULT 0,
  n           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, account_id, category_id, merchant_id, type, counts_as)
) WITHOUT ROWID;

-- Full-text search over merchant name, note, counterparty and tag names (AC-4.4.2).
-- Keyed by transaction id (not rowid, which VACUUM may renumber).
CREATE VIRTUAL TABLE transactions_fts USING fts5 (
  transaction_id UNINDEXED,
  merchant,
  note,
  counterparty,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);
