---
paths:
  - "supabase/**"
  - "packages/contracts/**"
---

# Backend & contracts rules

- New migration file for every change: `supabase migration new <name>`. Never edit an applied one.
- Every table: sync columns (`id, user_id, hlc, created_at, updated_at, deleted_at,
  server_version`), the `touch_sync_cols` trigger, RLS enabled with `user_id = auth.uid()`
  policies, and a pgTAP test proving cross-user isolation.
- Money columns are `bigint` minor units with `check (> 0)` where applicable. Never numeric/float.
- RPCs are `security invoker` unless an ADR justifies `definer` (then `set search_path = ''`).
- A schema change must update, in the same PR: `packages/contracts/schema/*.json`,
  `packages/contracts/sql/client-schema.sql`, Room entities + migration, web worker migration,
  and bump `schema_version`.
- Analytics SQL in `packages/contracts/sql/analytics/` must run on SQLite (both clients):
  no Postgres-only syntax. Regenerate golden outputs with the script; never hand-edit `expected/`.
