# 0016 — Schema v1 stays editable until the first public release

- Status: accepted
- Date: 2026-10-15

## Context
CLAUDE.md and MASTER_PROMPT §2.9 say migrations are append-only: never edit a released Room or
web migration. M0 writes `schema_version 1` (`packages/contracts/sql/client-schema.sql`), but M1–M6
will refine it. They'll add columns for features as they land, tighten CHECKs and adjust indexes
for the 50k-row budgets. Applying "append-only" from the first commit would produce dozens of
throwaway migrations before anyone has real data in a released build.

## Decision
- Until the **first GitHub Release** (M7), `schema_version` stays **1** and
  `client-schema.sql`, the row JSON schemas, Room v1 and web migration 1 may be **edited in
  place**. Every such edit still regenerates codegen and vectors and passes the meta-tests in the
  same commit.
- Debug and dev installs made before that release may need a reinstall, or an export/import
  round trip, after a schema edit. The `.zwallet` format version and validation still apply, so
  a file that no longer validates is refused cleanly rather than half-imported.
- From the first release on, the rule is strict: every change is a new append-only Room
  `Migration` and web migration step, plus an in-memory `.zwallet` upgrade step, and bumps
  `schema_version` (`.claude/skills/schema-change`).

## Consequences
- A clean v1 at release, without migration archaeology.
- The owner should keep real data out of pre-release builds, or keep a recent export. The app
  can't promise to open pre-release databases.
- M7's release checklist must freeze v1. Room's exported schema JSON for v1 is committed at
  that point, and migration tests start from it.

## Alternatives considered
- **Frozen from M0.** Safest for dogfooding, but costs a migration per refinement during M1–M6.
- **Bump `schema_version` on every pre-release change, but without migrations.** Version numbers
  would be meaningless, and files from those versions would be unimportable.
