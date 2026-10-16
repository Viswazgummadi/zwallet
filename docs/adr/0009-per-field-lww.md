# 0009 — Per-field (field-group) last-writer-wins merge

- Status: accepted (transport updated by 0013: merge runs on `.zwallet` import, not via a server)
- Date: 2026-10-15

## Context
Take one transaction. You change its category on the phone, and its note in the web UI on your
laptop, before the next file exchange. With row-level last-writer-wins, one of those two edits is
silently discarded when the copies merge. The owner chose to merge per field instead (kickoff
interview). This changes the stored data shape, which is why it needs an ADR. After ADR 0012 the
merge happens when a `.zwallet` file is imported (ADR 0013), but the semantics are unchanged.

## Decision
- Every user-data table has a `field_hlc TEXT NOT NULL DEFAULT '{}'` column. It is a JSON map
  of **merge group → HLC of that group's last write**. The row-level `hlc` stays, equal to the
  max over all groups.
- **Merge groups** are sets of columns that must change together. They are declared once per
  table in `packages/contracts/schema/<table>.json` under `x-merge-groups`, and generated into
  Kotlin and TS constants, with a CI check that the generated code is current. For example, on
  `transactions`:
  - `amount` {amount_minor, currency, original_amount_minor, original_currency}
  - `type`
  - `when` {occurred_at, occurred_tz}
  - `account`, `category`
  - `merchant` {merchant_id, counterparty_raw}
  - `note`, `method` {payment_method}, `review` {review_state}
  - `links` {refund_of_id, transfer_peer_id, split_group_id, my_share_minor}
  - `recurring` {recurring_series_id}
  - `deleted` {deleted_at}

  Immutable columns (`id`, `created_at`, `source`) are in no group (`external_ref` is the `ref` group since ADR 0018; differing immutables converge to the greater value).
- **Local writes** stamp a fresh HLC on each group they touch, in the repository layer.
- **Merge rule** (on import, identical in Kotlin and TS): for each group, take the incoming
  values if `incoming.field_hlc[g] > local.field_hlc[g]` (a missing group counts as the empty
  string). The resulting `field_hlc` is the per-group max, and `hlc` is the max of that. Groups
  that lose are recorded in the local `conflict_log` with their values, so the user can re-apply
  them.
- **Tombstones are sticky.** A field edit with a higher HLC updates the deleted row's fields but
  does not clear `deleted_at`. Only an explicit restore, which writes the `deleted` group with
  `deleted_at = null`, brings it back.

## Consequences
- Concurrent edits to different fields of the same row both survive (AC-11.2).
- About 100–300 bytes of JSON per row. Merge property tests (convergence, idempotence, field
  preservation, no resurrection) run per group, on both platforms, against shared vectors.
- Adding a column means assigning it to a group, which is a contracts change.

## Alternatives considered
- **Row-level LWW.** Silent loss of concurrent edits to different fields.
- **A CRDT library (Automerge, Yjs, cr-sqlite).** Powerful, but another runtime, a binary format,
  and a protocol we don't fully control.
- **One HLC per column, with no groups.** Lets coupled fields (amount + currency) tear apart.
