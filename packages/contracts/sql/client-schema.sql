-- SPDX-License-Identifier: GPL-3.0-only
-- zwallet canonical client schema — schema_version 1 (ARCHITECTURE §4, ADR 0009/0013/0016).
--
-- The source of truth for every user-data table on both clients. Room entities must match it
-- (schema-diff test) and the web worker applies it as-is. Every table here is exported in a
-- .zwallet file, tombstones included. Device-local tables live in client-local.sql.
--
-- Conventions (every table):
--   id          TEXT    UUIDv7 (client-generated), UUIDv8 for SMS/seed/deterministic rows (ADR 0010)
--   hlc         TEXT    HLC of the last write = max over field_hlc
--   field_hlc   TEXT    JSON {merge_group: hlc} — per-group LWW key (ADR 0009)
--   created_at  INTEGER epoch ms, set locally
--   updated_at  INTEGER epoch ms, set locally
--   deleted_at  INTEGER tombstone; never purged, payload compacted after Trash (ARCH §5.5)
--
-- Money is INTEGER minor units + ISO-4217 currency (ADR 0003). Never REAL.
-- Calendar days are TEXT 'YYYY-MM-DD'; months are TEXT 'YYYY-MM'.
-- Booleans are INTEGER 0/1. JSON columns are TEXT.
-- Merge groups per table: packages/contracts/schema/<table>.json (x-merge-groups).
--
-- Schema v1 may be edited in place until the first public release (ADR 0016); after that,
-- every change is a new append-only migration on both clients.

-- ── profile ──────────────────────────────────────────────────────────────────────────────────
-- Single row, id = 'me'. phone_hash_salt is exported so phone hashes stay comparable.
CREATE TABLE profile (
  id               TEXT    NOT NULL PRIMARY KEY CHECK (id = 'me'),
  hlc              TEXT    NOT NULL,
  field_hlc        TEXT    NOT NULL DEFAULT '{}',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER,
  display_name     TEXT,
  default_currency TEXT    NOT NULL DEFAULT 'INR' CHECK (length(default_currency) = 3),
  month_start_day  INTEGER NOT NULL DEFAULT 1 CHECK (month_start_day BETWEEN 1 AND 28),
  my_vpa           TEXT,
  phone_hash_salt  TEXT    NOT NULL,
  prefs            TEXT    NOT NULL DEFAULT '{}'
);

-- ── accounts ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE accounts (
  id                     TEXT    NOT NULL PRIMARY KEY,
  hlc                    TEXT    NOT NULL,
  field_hlc              TEXT    NOT NULL DEFAULT '{}',
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  deleted_at             INTEGER,
  name                   TEXT    NOT NULL,
  kind                   TEXT    NOT NULL
                         CHECK (kind IN ('bank','credit_card','cash','wallet','upi_lite','other')),
  institution            TEXT,
  last4                  TEXT    CHECK (last4 IS NULL OR length(last4) BETWEEN 2 AND 6),
  color_token            TEXT,
  opening_balance_minor  INTEGER NOT NULL DEFAULT 0,
  currency               TEXT    NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
  card_cycle_day         INTEGER CHECK (card_cycle_day IS NULL OR card_cycle_day BETWEEN 1 AND 31),
  card_due_day           INTEGER CHECK (card_due_day IS NULL OR card_due_day BETWEEN 1 AND 31),
  credit_limit_minor     INTEGER CHECK (credit_limit_minor IS NULL OR credit_limit_minor > 0),
  balance_snapshot_minor INTEGER,
  balance_snapshot_at    INTEGER,
  archived               INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

-- ── categories ───────────────────────────────────────────────────────────────────────────────
-- Two levels: a group row (parent_id NULL) and its categories. Seeded rows have fixed ids.
CREATE TABLE categories (
  id          TEXT    NOT NULL PRIMARY KEY,
  hlc         TEXT    NOT NULL,
  field_hlc   TEXT    NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  parent_id   TEXT    REFERENCES categories (id),
  name        TEXT    NOT NULL,
  icon        TEXT    NOT NULL,
  color_token TEXT    NOT NULL,
  counts_as   TEXT    NOT NULL CHECK (counts_as IN ('spend','savings','income','excluded')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  system_key  TEXT
);
CREATE INDEX categories_parent ON categories (parent_id);

-- ── merchants ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE merchants (
  id                  TEXT    NOT NULL PRIMARY KEY,
  hlc                 TEXT    NOT NULL,
  field_hlc           TEXT    NOT NULL DEFAULT '{}',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  deleted_at          INTEGER,
  name                TEXT    NOT NULL,
  logo_key            TEXT,
  default_category_id TEXT    REFERENCES categories (id),
  aliases             TEXT    NOT NULL DEFAULT '[]',
  vpa_patterns        TEXT    NOT NULL DEFAULT '[]'
);

-- ── transactions ─────────────────────────────────────────────────────────────────────────────
-- A transfer is two rows (one per leg) linked by transfer_peer_id (SPEC §4.6).
-- location is opt-in and coarse: JSON {"lat_e3": int, "lng_e3": int} (milli-degrees).
CREATE TABLE transactions (
  id                    TEXT    NOT NULL PRIMARY KEY,
  hlc                   TEXT    NOT NULL,
  field_hlc             TEXT    NOT NULL DEFAULT '{}',
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  deleted_at            INTEGER,
  type                  TEXT    NOT NULL CHECK (type IN ('expense','income','transfer','refund')),
  amount_minor          INTEGER NOT NULL CHECK (amount_minor > 0),
  currency              TEXT    NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
  original_amount_minor INTEGER CHECK (original_amount_minor IS NULL OR original_amount_minor > 0),
  original_currency     TEXT    CHECK (original_currency IS NULL OR length(original_currency) = 3),
  occurred_at           INTEGER NOT NULL,
  occurred_tz           TEXT    NOT NULL DEFAULT 'Asia/Kolkata',
  account_id            TEXT    REFERENCES accounts (id),
  category_id           TEXT    REFERENCES categories (id),
  merchant_id           TEXT    REFERENCES merchants (id),
  counterparty_raw      TEXT,
  note                  TEXT    CHECK (note IS NULL OR length(note) <= 500),
  payment_method        TEXT    NOT NULL DEFAULT 'other'
                        CHECK (payment_method IN
                          ('upi','card','netbanking','cash','atm','wallet','auto_debit','other')),
  source                TEXT    NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual','sms','paste','csv_import','recurring_auto')),
  review_state          TEXT    NOT NULL DEFAULT 'confirmed'
                        CHECK (review_state IN ('confirmed','needs_review')),
  external_ref          TEXT,
  refund_of_id          TEXT    REFERENCES transactions (id),
  transfer_peer_id      TEXT    REFERENCES transactions (id),
  split_group_id        TEXT,
  my_share_minor        INTEGER CHECK (my_share_minor IS NULL OR my_share_minor >= 0),
  recurring_series_id   TEXT    REFERENCES recurring_series (id),
  location              TEXT
);
CREATE INDEX transactions_occurred ON transactions (occurred_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX transactions_external_ref ON transactions (external_ref, account_id)
  WHERE external_ref IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX transactions_account ON transactions (account_id, occurred_at);
CREATE INDEX transactions_category ON transactions (category_id, occurred_at);
CREATE INDEX transactions_merchant ON transactions (merchant_id, occurred_at);
CREATE INDEX transactions_split_group ON transactions (split_group_id) WHERE split_group_id IS NOT NULL;

-- ── tags ─────────────────────────────────────────────────────────────────────────────────────
-- System tags (e.g. system_key 'reimbursable') are seeded with fixed ids.
CREATE TABLE tags (
  id          TEXT    NOT NULL PRIMARY KEY,
  hlc         TEXT    NOT NULL,
  field_hlc   TEXT    NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  name        TEXT    NOT NULL,
  color_token TEXT,
  system_key  TEXT
);

-- ── transaction_tags ─────────────────────────────────────────────────────────────────────────
-- id = UUIDv8("tt:v1|" + transaction_id + "|" + tag_id), so the same link added on two copies
-- merges into one row. Removing a tag sets deleted_at; re-adding restores it.
CREATE TABLE transaction_tags (
  id             TEXT    NOT NULL PRIMARY KEY,
  hlc            TEXT    NOT NULL,
  field_hlc      TEXT    NOT NULL DEFAULT '{}',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER,
  transaction_id TEXT    NOT NULL REFERENCES transactions (id),
  tag_id         TEXT    NOT NULL REFERENCES tags (id)
);
CREATE UNIQUE INDEX transaction_tags_pair ON transaction_tags (transaction_id, tag_id);
CREATE INDEX transaction_tags_tag ON transaction_tags (tag_id);

-- ── people ───────────────────────────────────────────────────────────────────────────────────
-- phone_hash = hex(SHA-256(profile.phone_hash_salt + E.164)). The raw number is never stored.
CREATE TABLE people (
  id                 TEXT    NOT NULL PRIMARY KEY,
  hlc                TEXT    NOT NULL,
  field_hlc          TEXT    NOT NULL DEFAULT '{}',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  deleted_at         INTEGER,
  display_name       TEXT    NOT NULL,
  phone_hash         TEXT,
  vpa                TEXT,
  contact_lookup_key TEXT,
  avatar_color_token TEXT
);

-- ── ledger_entries ───────────────────────────────────────────────────────────────────────────
CREATE TABLE ledger_entries (
  id             TEXT    NOT NULL PRIMARY KEY,
  hlc            TEXT    NOT NULL,
  field_hlc      TEXT    NOT NULL DEFAULT '{}',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER,
  person_id      TEXT    NOT NULL REFERENCES people (id),
  kind           TEXT    NOT NULL
                 CHECK (kind IN ('lent','borrowed','repaid_to_me','repaid_by_me')),
  amount_minor   INTEGER NOT NULL CHECK (amount_minor > 0),
  currency       TEXT    NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
  occurred_at    INTEGER NOT NULL,
  due_on         TEXT    CHECK (due_on IS NULL OR due_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  note           TEXT    CHECK (note IS NULL OR length(note) <= 500),
  transaction_id TEXT    REFERENCES transactions (id),
  split_group_id TEXT
);
CREATE INDEX ledger_entries_person ON ledger_entries (person_id, occurred_at);

-- ── rules ────────────────────────────────────────────────────────────────────────────────────
-- match/actions are JSON (SPEC §6.3). Lower priority runs first; first match wins per field.
CREATE TABLE rules (
  id          TEXT    NOT NULL PRIMARY KEY,
  hlc         TEXT    NOT NULL,
  field_hlc   TEXT    NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  name        TEXT,
  priority    INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  origin      TEXT    NOT NULL DEFAULT 'user' CHECK (origin IN ('user','learned','system')),
  match       TEXT    NOT NULL,
  actions     TEXT    NOT NULL
);

-- ── budgets ──────────────────────────────────────────────────────────────────────────────────
-- scope 'overall' has category_id NULL; 'category' / 'group' point at a category row.
CREATE TABLE budgets (
  id           TEXT    NOT NULL PRIMARY KEY,
  hlc          TEXT    NOT NULL,
  field_hlc    TEXT    NOT NULL DEFAULT '{}',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER,
  scope        TEXT    NOT NULL CHECK (scope IN ('overall','category','group')),
  category_id  TEXT    REFERENCES categories (id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency     TEXT    NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
  period       TEXT    NOT NULL DEFAULT 'month' CHECK (period IN ('month')),
  rollover     INTEGER NOT NULL DEFAULT 0 CHECK (rollover IN (0, 1)),
  starts_on    TEXT    CHECK (starts_on IS NULL OR starts_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  CHECK ((scope = 'overall') = (category_id IS NULL))
);

-- ── recurring_series ─────────────────────────────────────────────────────────────────────────
CREATE TABLE recurring_series (
  id                    TEXT    NOT NULL PRIMARY KEY,
  hlc                   TEXT    NOT NULL,
  field_hlc             TEXT    NOT NULL DEFAULT '{}',
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  deleted_at            INTEGER,
  name                  TEXT    NOT NULL,
  merchant_id           TEXT    REFERENCES merchants (id),
  category_id           TEXT    REFERENCES categories (id),
  account_id            TEXT    REFERENCES accounts (id),
  cadence               TEXT    NOT NULL
                        CHECK (cadence IN ('weekly','biweekly','monthly','quarterly','yearly','custom')),
  interval_days         INTEGER CHECK (interval_days IS NULL OR interval_days > 0),
  expected_amount_minor INTEGER CHECK (expected_amount_minor IS NULL OR expected_amount_minor > 0),
  currency              TEXT    NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
  next_due_on           TEXT    CHECK (next_due_on IS NULL OR next_due_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  status                TEXT    NOT NULL DEFAULT 'detected'
                        CHECK (status IN ('detected','confirmed','dismissed')),
  origin                TEXT    NOT NULL DEFAULT 'detected' CHECK (origin IN ('detected','manual')),
  remind_days_before    INTEGER CHECK (remind_days_before IS NULL OR remind_days_before BETWEEN 0 AND 30)
);

-- ── upcoming_items ───────────────────────────────────────────────────────────────────────────
-- Bills, mandates and dues that are not transactions yet (SPEC §5.4 step 8, §10).
CREATE TABLE upcoming_items (
  id                  TEXT    NOT NULL PRIMARY KEY,
  hlc                 TEXT    NOT NULL,
  field_hlc           TEXT    NOT NULL DEFAULT '{}',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  deleted_at          INTEGER,
  kind                TEXT    NOT NULL
                      CHECK (kind IN ('mandate','card_bill','emi','loan_due','recurring','other')),
  title               TEXT    NOT NULL,
  amount_minor        INTEGER CHECK (amount_minor IS NULL OR amount_minor > 0),
  currency            TEXT    NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
  due_on              TEXT    NOT NULL CHECK (due_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  account_id          TEXT    REFERENCES accounts (id),
  recurring_series_id TEXT    REFERENCES recurring_series (id),
  ledger_entry_id     TEXT    REFERENCES ledger_entries (id),
  status              TEXT    NOT NULL DEFAULT 'upcoming'
                      CHECK (status IN ('upcoming','paid','dismissed')),
  transaction_id      TEXT    REFERENCES transactions (id),
  source              TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','sms','recurring'))
);
CREATE INDEX upcoming_items_due ON upcoming_items (due_on) WHERE deleted_at IS NULL;

-- ── saved_filters ────────────────────────────────────────────────────────────────────────────
-- query is a search-grammar string (packages/contracts/search-grammar.md, M1).
CREATE TABLE saved_filters (
  id         TEXT    NOT NULL PRIMARY KEY,
  hlc        TEXT    NOT NULL,
  field_hlc  TEXT    NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  name       TEXT    NOT NULL,
  query      TEXT    NOT NULL,
  pinned     INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── insight_dismissals ───────────────────────────────────────────────────────────────────────
-- id = UUIDv8("insight:v1|" + rule_id + "|" + subject_key) so a dismissal merges across copies.
CREATE TABLE insight_dismissals (
  id              TEXT    NOT NULL PRIMARY KEY,
  hlc             TEXT    NOT NULL,
  field_hlc       TEXT    NOT NULL DEFAULT '{}',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  rule_id         TEXT    NOT NULL,
  subject_key     TEXT    NOT NULL,
  dismissed_until INTEGER
);

-- ── attachments ──────────────────────────────────────────────────────────────────────────────
-- Metadata only. The blob is a local file named by sha256; it travels in a .zwallet only when
-- "Include receipt photos" is ticked (attachments_blobs in the payload, ARCH §5.3).
CREATE TABLE attachments (
  id             TEXT    NOT NULL PRIMARY KEY,
  hlc            TEXT    NOT NULL,
  field_hlc      TEXT    NOT NULL DEFAULT '{}',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER,
  transaction_id TEXT    NOT NULL REFERENCES transactions (id),
  mime_type      TEXT    NOT NULL CHECK (mime_type IN ('image/webp','image/jpeg','image/png')),
  byte_size      INTEGER NOT NULL CHECK (byte_size > 0),
  sha256         TEXT    NOT NULL CHECK (length(sha256) = 64),
  width          INTEGER CHECK (width IS NULL OR width > 0),
  height         INTEGER CHECK (height IS NULL OR height > 0)
);
CREATE INDEX attachments_transaction ON attachments (transaction_id);
