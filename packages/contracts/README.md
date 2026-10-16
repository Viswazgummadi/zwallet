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
