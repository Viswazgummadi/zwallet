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

| Column kind                    | Rule on import                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| merge group `g`                | take incoming values iff `incoming.field_hlc[g] > local.field_hlc[g]` (missing = `""`); losers → `conflict_log` |
| `deleted` group                | same rule, so tombstones are sticky: only a newer `deleted` write (Restore) clears `deleted_at`                 |
| `field_hlc` / `hlc`            | per-group max / max over groups                                                                                 |
| `created_at` / `updated_at`    | min / max                                                                                                       |
| `id` and `x-immutable` columns | never change; equal on every copy by construction                                                               |

Adding a column = assign it to a group (or `x-immutable`) in `schema/<table>.json`, update the SQL,
run `codegen`, and follow `.claude/skills/schema-change`.
