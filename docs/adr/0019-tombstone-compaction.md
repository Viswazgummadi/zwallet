# 0019 — Tombstone compaction

- Status: accepted
- Date: 2026-10-16

## Context
ARCHITECTURE §5.5 says a deleted row leaves Trash after 30 days and is then compacted: its payload
is cleared, while `id`, stamps and `deleted_at` remain forever, so old files can't resurrect it.
The M0 review found that this was unspecified and inconsistent with the schema:

- **Schema constraints.** Payload columns can't simply be "cleared": many are `NOT NULL` with
  CHECKs (`amount_minor > 0`, `type IN (…)`).
- **Stale stamps.** If compaction cleared values but kept the old stamps, an old file with equal
  stamps would win the tie-break (non-null > null). It would put the payload back on the compacted
  device, and the next export would carry the deleted data again. The row stays deleted, but
  compaction is undone.

From the user's side, compaction is mostly a privacy promise: after deleting something and emptying
Trash, its amount, note and counterparty no longer travel in backups.

## Decision
- **Compaction is a local write like any other.** It stamps **one fresh HLC on every payload
  group** of the deleted row (every group except `deleted`) and writes compacted values:
  - nullable column → `NULL`;
  - `NOT NULL` column with a SQL `DEFAULT` → that default;
  - `NOT NULL` column without a default → a CHECK-valid placeholder declared per table in the row
    schema as `x-compact` (for example `amount_minor: 1`, `occurred_at: 0`).
- **Placeholders are validated and generated.**
  - A contracts meta-test inserts every placeholder set as a deleted row into the canonical schema
    to prove it satisfies every constraint.
  - Codegen exports `x-compact` to Kotlin and TS.
- **Compaction wins over older copies.** The fresh stamps beat any older copy of the payload, so
  importing an old file leaves the compacted row compacted. Two devices that compact independently
  write equal values, so they converge.
- **Late edits are re-compacted.** If a newer edit from an offline device arrives after compaction
  (stamp newer than the compaction), the row stays deleted (tombstones are sticky). The compaction
  job runs again after every import on deleted rows whose payload differs from the placeholders.
- **Compacted rows are invisible.** A compacted row is never shown, never counted in analytics (all
  queries already filter `deleted_at IS NULL`), and cannot be restored: it is no longer in Trash.

## Consequences
- Deleted data really leaves backups once Trash is emptied, which is the behaviour users expect.
- Tombstones cost a few dozen bytes plus placeholders, forever. That is acceptable at 50k rows.
- Each table schema now declares `x-compact`, enforced by meta-tests.
- `merge.cases.json` gains "compacted tombstone beats an older full row and never resurrects".

## Alternatives considered
- **Relax CHECKs for deleted rows (`deleted_at IS NOT NULL OR …`).** This complicates every CHECK
  in every table, and it still needs fresh stamps.
- **Never compact (keep full tombstones).** Simpler, but deleted amounts and notes would ride along
  in every export indefinitely.
- **Purge tombstones.** An old file would then resurrect deleted rows, breaking the §5.6
  no-resurrection invariant.
