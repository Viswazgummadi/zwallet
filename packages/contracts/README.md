# @zwallet/contracts

The only coupling between the Android and web apps. Read `docs/ARCHITECTURE.md` §4–§5 first.

| Path                                                          | What                                                                    | Edited by                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| `sql/client-schema.sql`                                       | Canonical schema of every user-data table (exported in `.zwallet`)      | hand                     |
| `sql/client-local.sql`, `sql/android-local.sql`               | Device-local tables (never exported)                                    | hand                     |
| `schema/<table>.json`                                         | Row JSON Schema + `x-merge-groups` + `x-immutable` per table            | hand                     |
| `schema/zwallet-envelope.json`, `schema/zwallet-payload.json` | `.zwallet` file format (ADR 0013)                                       | hand                     |
| `seed/*.json`                                                 | Seeded categories and system tags with fixed UUIDv8 ids                 | hand (ids via `vectors`) |
| `fixtures/*.json`                                             | Cross-platform vectors (money, HLC, uuid, merge)                        | hand + `vectors`         |
| `scripts/codegen.mjs`                                         | → `Contracts.kt` (core:model) and `apps/web/src/generated/contracts.ts` | —                        |

```bash
pnpm --filter @zwallet/contracts test          # schema ↔ SQL ↔ merge-group meta-tests
pnpm --filter @zwallet/contracts codegen       # regenerate Kotlin/TS constants (CI: codegen:check)
pnpm --filter @zwallet/contracts vectors       # regenerate derived vectors (CI: vectors:check)
```

## Merge rules in one table (ADR 0009)

| Column kind                 | Rule on import                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| merge group `g`             | take incoming values iff `incoming.field_hlc[g] > local.field_hlc[g]` (missing = `""`); equal stamps → the larger value (null < integer < string); losers → `conflict_log` |
| `deleted` group             | same rule, so tombstones are sticky: only a newer `deleted` write (Restore) clears `deleted_at`                                                                 |
| `field_hlc` / `hlc`         | per-group max / max over groups; stamps of groups this build doesn't know (any name, incl. `constructor`) are kept as max, never touching values                |
| `created_at` / `updated_at` | min / max                                                                                                                                                       |
| `id`                        | never changes                                                                                                                                                   |
| `x-immutable` columns       | should be equal on every copy; if they differ the larger value wins (same order as ties), counted as an update, no `conflict_log` entry                         |

`external_ref` is **not** immutable: it has its own merge group `ref`, so a re-parse with newer rules
or a user edit can correct it. Its index is plain, never `UNIQUE`: a UNIQUE index over merged data
can make a valid file impossible to import, so the only UNIQUE index on user data is the one that
mirrors a deterministic id (`transaction_tags_pair`; meta-tested).

### Strict inputs and error vocabulary

Every column of `schema/<table>.json` must be present on both rows (`missing_column`), and
`field_hlc` must be canonical JSON (no whitespace) whose values all match
`^[0-9]{13}-[0-9a-f]{4}-[0-9a-f]{8}$` (`malformed_field_hlc`; `""` is malformed, `{}` is empty). Columns
are checked before stamps, incoming before local. `fixtures/merge.json` has error vectors
(`expected: {error}`) that Kotlin, TS and the reference must all reproduce.

### Outcomes (user-facing, from merge-group values only)

| Outcome            | Meaning                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `inserted`         | row absent locally, incoming is live                                            |
| `inserted_deleted` | tombstone for a row we never had (not "new" in the preview)                     |
| `updated`          | a non-`deleted` group value or an immutable column changed                      |
| `deleted`          | live locally → deleted                                                          |
| `restored`         | deleted locally → live                                                          |
| `unchanged`        | none of the above (stamps, `hlc`, `created_at`, `updated_at` may still differ)  |

`write` is a separate boolean: the merged row differs from local in **any** column. The importer must
persist it even when the outcome is `unchanged` (otherwise stamps and `field_hlc` drift).

### Tombstone compaction (`x-compact`)

Compaction re-stamps **every** payload group of a deleted row with one fresh HLC and writes compacted
values: nullable columns → `NULL`; `NOT NULL` with a `DEFAULT` → the default; `NOT NULL` without a
default → the CHECK-valid placeholder in the row schema's `x-compact`. `x-compact-keep` lists
`NOT NULL` foreign keys that compaction leaves as they are (no placeholder exists for them). Codegen
exports the resolved map as `compact` / `compactKeep` on each table spec (Kotlin and TS); a meta-test
inserts every compacted row into SQLite and validates it against the row schema.

Adding a column = assign it to a group (or `x-immutable`) in `schema/<table>.json`, update the SQL
(and `x-compact` if it is `NOT NULL` without a default), run `codegen`, and follow
`.claude/skills/schema-change`.

## The .zwallet codec (reference: `lib/backup-reference.mjs`)

Vectors: `fixtures/backup/index.json` lists every `fixtures/backup/*.zwallet` with the `password`, optional
`options` (`max_file_bytes`, `max_plaintext_bytes`) and `expect`: `{counts, max_hlc, payload_sha256}` or
`{error}`. Implementations must match `expect` (compare results, never ciphertext bytes: gzip output
depends on the zlib build). Salt/IV in the vectors are derived from the vector name; production code
must use a fresh random 16-byte salt and 12-byte IV per file.

- Key: PBKDF2-HMAC-SHA256, UTF-8 password, 16-byte salt, iterations from the envelope (schema: 600000..10000000;
  anything else is `damaged` before any KDF runs). AES-256-GCM, 12-byte IV, 128-bit tag appended to the ciphertext.
- AAD = canonical JSON of the envelope without `ciphertext`: keys sorted (UTF-16 order) at every level, no
  whitespace, strings escaped as `JSON.stringify` does (only `"`, `\` and control chars; non-ASCII verbatim).
  Kotlin must not let a serializer add spaces or escape non-ASCII.
- Plaintext = gzip(UTF-8 JSON). No BOM.
- Plain-digit scan runs on the raw text (envelope and payload) before parsing: reject `1.0`, `1e2`, `+1`, `-0`,
  `01` and integers beyond +-(2^53-1). Strings are skipped by the scan.
- `max_hlc` = max over every row `hlc` and every `field_hlc` stamp; with no rows it is `0000000000000-0000-00000000`.
- All 16 table arrays must be present (may be empty); `attachments_blobs` is optional.

Error codes and check order (first failure wins; `clock_ahead` is the importer's, not the codec's):

| Order | Condition                                                                               | Code                    |
| ----- | --------------------------------------------------------------------------------------- | ----------------------- |
| 1     | file larger than 200 MiB (`max_file_bytes`)                                              | `too_large`             |
| 2     | envelope not UTF-8/JSON, non-plain integer in it, wrong `format`, fails envelope schema  | `damaged`               |
| 2     | `format_version` > 1 (checked before the schema)                                         | `newer_schema`          |
| 3     | AES-GCM failure: wrong password, tampered header (AAD) or ciphertext, indistinguishable  | `wrong_password`        |
| 4     | gunzip fails / output exceeds 1 GiB (`max_plaintext_bytes`, enforce while streaming)     | `damaged` / `too_large` |
| 5     | payload not UTF-8 JSON                                                                   | `damaged`               |
| 6     | non-plain integer anywhere in the payload                                                | `invalid_row`           |
| 7     | `schema_version` > ours                                                                  | `newer_schema`          |
| 8     | payload header fails schema (`damaged`); any row fails its row schema / malformed `field_hlc` | `invalid_row`      |
| 9     | `max_hlc` differs from the max stamp in the rows                                         | `damaged`               |

Older `schema_version` files: none exist yet; when one does, upgrade in memory after step 7 with the same steps
as the DB. Memory at 50k rows: stream gunzip with the byte cap, validate rows incrementally, merge in batches
inside one transaction. Cancelling before the transaction commits changes nothing (the codec is pure).

## Search grammar (reference: `lib/search-reference.mjs`, vectors: `fixtures/search.json`)

`search(input, ctx) -> {tokens, where, params}`; `ctx = {today:'YYYY-MM-DD' (display tz), tzOffsetMinutes, minorScale}`.
Apps must reproduce `tokens` (deep-equal), `where` (string-equal) and `params` (same order and types) for every
case, and the ids the SQL returns on `dataset_sql` (canonical schema + `transactions_fts`). Bind `params`
positionally (`?`); never interpolate user text. The fragment assumes `FROM transactions t`.

- Lexing: split on Unicode White_Space. `"..."` is a phrase (no escapes; unterminated runs to the end). A token
  `key:value` uses a known key (case-insensitive); a `"` right after `:` or `,` opens a quoted value segment
  (`merchant:"big basket",uber`). Unknown `key:` and other text are free words.
- Keys: `cat group merchant acct tag person` (names), `type source method is has` (enums), `on from to month`
  (dates), `amt`. Comma = OR (`from`/`to`/`amt` take one value). Names/enums are ASCII-lowercased (matches SQLite
  `lower()`); name match is `lower(name) = v OR lower(replace(name,' ','-')) = v` (+ `system_key` for cat/tag;
  accounts also `name-last4` and `last4`). Enums: type `expense income transfer refund`; source `manual sms paste
  csv_import recurring_auto` (aliases `csv`, `recurring`); method `upi card netbanking cash atm wallet auto_debit
  other`; is `review split recurring`; has `note`.
- Amounts (major units, at most `minorScale` decimals, integer math only): `>N <N >=N <=N N..M` (bare) or `amt:`
  with those plus `amt:N` (equality). A bare `N` is free text.
- Dates: `today`, `yesterday`, `YYYY-MM-DD` for `on/from/to`; `month:YYYY-MM`. `to:` includes that day. Params are
  epoch-ms bounds of local calendar days in the display timezone (use the tz database, not +86400000).
- Free text: words become FTS5 prefix phrases `"word"*`, phrases `"phrase"`, ANDed in one `MATCH ?` (quotes
  doubled). A numeric word additionally matches `amount_minor = N` (OR). Tokens with no letter/digit are
  `invalid:no_text`.
- Invalid tokens (`kind:'invalid'`; reasons `empty_value unknown_value bad_date bad_amount bad_range
  single_value_only no_text`) stay in `tokens` for the UI and are ignored in SQL. Conjuncts AND;
  `t.deleted_at IS NULL` is always first.
