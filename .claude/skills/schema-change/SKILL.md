---
name: schema-change
description: Make a data model change end-to-end (client schema, merge groups, Room + web migrations, .zwallet upgrade path, merge vectors) safely.
argument-hint: "<what changes and why>"
disable-model-invocation: true
---

Schema change: $ARGUMENTS

Use the `data-engineer` subagent for steps 1–5, then implement client parts.
1. Write an ADR if the change alters semantics (not just adds a nullable column).
2. Contracts: `client-schema.sql`, row JSON schema, `x-merge-groups` (assign every new column to
   a group), regenerate Kotlin/TS constants, bump `schema_version`.
3. Android: Room entity + `Migration(n, n+1)` + `MigrationTestHelper` test.
4. Web: worker migration step + test.
5. `.zwallet`: in-memory upgrade step so files from the previous schema still import; regenerate
   `fixtures/merge.json` and `fixtures/backup/*.zwallet`; both platforms pass them.
6. Merge property tests on both platforms.
7. Backfill strategy for existing rows documented in the PR.
8. `node scripts/verify.mjs all`, then `code-reviewer` subagent.
