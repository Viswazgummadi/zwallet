# 0009 — Per-field (field-group) last-writer-wins merge

- Status: accepted
- Date: 2026-10-15

## Context
With row-level LWW (the original ARCH §5), suppose you change a transaction's category on the
phone while offline and edit its note on the web. One of those two edits is silently discarded.
The owner chose to merge per field instead (kickoff interview). This changes the stored data
shape, which is why it needs an ADR.

## Decision
- Every synced table gains a `field_hlc` column: `jsonb not null default '{}'` in Postgres,
  `TEXT` JSON in SQLite. It maps **merge group → HLC of that group's last write**.
- The row-level `hlc` stays, equal to the max over all groups (used for ordering and the push
  batch order).
- **Merge groups** are sets of columns that must change together. They are declared once per
  table in `packages/contracts/schema/<table>.json` under `x-merge-groups`. For example, on
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

  Immutable columns (`id`, `user_id`, `created_at`, `source`, `external_ref`) are in no group.
- A migration mirrors the groups into a `sync_field_groups(table_name, group_name, columns text[])`
  table that `sync_push` reads. A contracts test asserts that the two definitions are equal.
- **Merge rule** (server in `sync_push`, and both clients when applying pulls): for each group,
  take the incoming values if `incoming.field_hlc[g] > existing.field_hlc[g]` (a missing group
  counts as the empty string). The resulting `field_hlc` is the per-group max, and `hlc` is the
  max of that.
- **Tombstones are sticky.** A field edit with a higher HLC updates the deleted row's fields but
  does not clear `deleted_at`. Only an explicit restore, which writes the `deleted` group with
  `deleted_at = null`, brings it back.
- `sync_push` returns `merged: [{table, row}]` (the post-merge server row) for every row where any
  incoming group lost. The client applies that row and clears `dirty`. Groups that lost are
  recorded in `conflict_log`.

## Consequences
- Concurrent edits to different fields of the same row both survive (new AC-11.3).
- About 100–300 bytes of JSON per row, plus a slightly more complex push function. The property
  tests (convergence, idempotence, no lost writes) now run per group.
- Clients must stamp the group HLC on every local write. The repository layer does this, not the
  UI.
- Adding a column means assigning it to a group, which is a contracts change.

## Alternatives considered
- **Row-level LWW.** Silent loss of concurrent edits to different fields.
- **A CRDT library (Automerge, Yjs, cr-sqlite).** Powerful, but another runtime, a binary format,
  and a protocol we don't fully control.
- **One HLC per column, with no groups.** Lets coupled fields (amount + currency) tear apart.
