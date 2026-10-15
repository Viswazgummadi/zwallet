---
paths:
  - "packages/contracts/**"
  - "apps/android/core/database/**"
  - "apps/android/core/transfer/**"
  - "apps/web/src/db/**"
  - "apps/web/src/transfer/**"
---

# Schema, contracts & transfer rules

- `packages/contracts/sql/client-schema.sql` is the canonical schema; Room entities and the web
  worker must match it (schema-diff test). Every change ships a Room `Migration` + test and a web
  worker migration step — never edit a released one.
- Every user-data table has `id, hlc, field_hlc, created_at, updated_at, deleted_at` and appears
  in `x-merge-groups`; every mutable column belongs to exactly one merge group. Device-local
  tables (`sms_index`, `op_log`, `conflict_log`, `daily_agg`, `device_state`, `import_log`) are
  never exported.
- Money columns are `INTEGER` minor units with `CHECK (> 0)` where applicable. Never REAL.
- Repositories stamp HLCs on touched groups; nothing else writes `hlc`/`field_hlc`.
- Import: validate → preview → snapshot → single transaction → advance HLC → rebuild aggregates.
  All-or-nothing. Tombstones are compacted, never deleted.
- `.zwallet` crypto uses only platform APIs (`javax.crypto`, WebCrypto). Never log passwords,
  keys, plaintext payloads or row contents.
- A schema change updates, in the same PR: JSON schemas, merge groups, codegen, Room, web worker,
  file upgrade step, vectors, and bumps `schema_version`.
- Analytics SQL in `packages/contracts/sql/analytics/` must run on both SQLite builds. Regenerate
  golden outputs and vectors with the scripts; never hand-edit `expected/` or `fixtures/backup/`.
