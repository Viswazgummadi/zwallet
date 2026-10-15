---
name: schema-change
description: Make a data model change end-to-end (Supabase migration, RLS, contracts, Room, web worker, sync) safely.
argument-hint: "<what changes and why>"
disable-model-invocation: true
---

Schema change: $ARGUMENTS

Use the `backend-sync-engineer` subagent for steps 1–4, then implement client parts.
1. Write an ADR if the change alters semantics (not just adds a nullable column).
2. `supabase migration new <name>`; table/column changes with sync columns, trigger, RLS, indexes.
3. pgTAP tests (isolation + behavior). `supabase db reset && supabase test db`.
4. Contracts: JSON schema, `client-schema.sql`, bump `schema_version`; update `min_client_version`
   only if old clients would corrupt data.
5. Android: Room entity + `Migration(n, n+1)` + migration test; web: worker migration + test.
6. Sync: both engines handle the new fields; run sync property tests.
7. Backfill strategy for existing rows documented in the PR.
8. `./scripts/verify.sh all`, then `code-reviewer` subagent.
