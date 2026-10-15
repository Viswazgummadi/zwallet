# 0001 — Local-first with SQLite on both clients

- Status: accepted
- Date: 2026-10-15

## Context
zwallet must feel instant (no spinners for local data), work offline indefinitely, and run the
same analytics on Android and web over up to ~50k transactions. The phone ingests SMS while
offline; the web app is used for bulk clean-up and deep analysis.

## Decision
Both clients keep a full local copy of the user's data in SQLite: Room on Android, SQLite-WASM on
the `opfs-sahpool` VFS inside a Web Worker on web. The UI reads and writes only the local
database. Sync with the server runs in the background (ADR 0002 and ADR 0009). Both clients use
one canonical client schema, `packages/contracts/sql/client-schema.sql`, with FTS5 for search
and trigger-maintained `daily_agg` for analytics.

## Consequences
- UI latency doesn't depend on the network. Offline is the normal case, not an error path.
- One SQL dialect on both clients, so analytics SQL can be shared (ADR 0007).
- Every client stores data, so we must handle schema migrations, conflicts and tombstones.
- On web: OPFS storage quotas and a single sync leader tab (Web Locks), with BroadcastChannel
  invalidation across tabs.
- Room's exported schema is diffed against `client-schema.sql` in tests to prevent drift.

## Alternatives considered
- **IndexedDB/Dexie on web.** No SQL, so analytics logic would be duplicated and fixtures harder.
- **Server-first (thin clients).** Breaks offline SMS capture and the instant-UI principle.
- **PouchDB/Couch-style replication.** Document model is a poor fit for relational ledger queries.
