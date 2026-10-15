# 0002 — Custom pull/push sync protocol with HLC ordering

- Status: superseded by 0012 and 0013 (HLC clocks, tombstones and LWW merge carried over into file-based transfer)
- Date: 2026-10-15

## Context
There is one user and several devices (phone and web, maybe a second phone), each with a local
SQLite database (ADR 0001). The owner wants to fully understand the sync layer, and the surface
must be small and testable. Devices go offline for days, and wall clocks drift.

## Decision
- Every synced row carries a client-generated UUID, a **hybrid logical clock** string
  (`{wall_ms:013d}-{counter:04x}-{node:8 hex}`, lexicographically ordered), `deleted_at`
  tombstones, and a server-assigned `server_version` from a global sequence.
- Two Postgres RPCs (security invoker, so RLS applies):
  - `sync_push` upserts client changes using the last-writer-wins rule.
  - `sync_pull(since)` streams rows ordered by `server_version`.
- Clients push dirty rows, then pull until `has_more = false`, applying each batch in one local
  transaction.
- Conflicts are resolved by **last-writer-wins on HLC, per field group** (see 0009). Rows that
  lose are written to a local `conflict_log`.
- Triggers that start a sync: app foreground, a 2 s debounce after writes (foreground only),
  connectivity regained, a Realtime ping on `sync_cursors` (foreground only), and a constrained
  periodic job every 12 h on Android.
- Tombstones are purged after 90 days. Clients older than that get `resync_required`.

## Consequences
- The protocol is small, deterministic and property-testable: convergence, idempotence and no
  lost writes (ARCH §5.4).
- We own the edge cases: clock skew (absorbed by HLC), partial batch failures, replay, and the
  purge horizon.
- Without a background socket, sync is near-real-time only while the app is in the foreground.

## Alternatives considered
- **PowerSync / ElectricSQL.** Capable, but one more service and a protocol we don't control.
  Revisit if sync gets complex.
- **Supabase Realtime as the data channel.** Not a reliable delivery log, and it would keep a
  socket open in the background, which costs battery.
- **Server-wins or timestamp-only ordering.** Wall clocks lie, and server-wins drops offline edits.
