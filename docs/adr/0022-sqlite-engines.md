# 0022 — SQLite engines and how tables are created

- Status: accepted (owner delegated the decision, 2026-10-16; resolves OPEN_QUESTIONS #19, #20)
- Date: 2026-10-16

## Context
Both apps must run the same canonical schema (`packages/contracts/sql/client-schema.sql`) with its
CHECK constraints and FTS5 search (ARCH §4). Room entities can't declare CHECKs, and the framework
SQLite on Android API 26 has no FTS5. The web app needs SQLite in a worker with persistent storage.

## Decision
- **Android:** `androidx.sqlite:sqlite-bundled` (Apache-2.0, ~1–2 MB per ABI; over the 500 KB
  threshold, approved here) as the engine, so FTS5 and a modern SQLite are identical on every
  device. Tables are created by executing the canonical SQL (client-schema + client-local +
  android-local) in `onCreate`; Room (or plain `androidx.sqlite` + hand-written DAOs, whichever is
  simpler) must not generate its own DDL. A test diffs `sqlite_master` against the canonical SQL.
- **Web:** `@sqlite.org/sqlite-wasm` (Apache-2.0, ~0.9 MB wasm) in a dedicated worker with OPFS
  persistence (`opfs-sahpool` VFS, which needs no COOP/COEP headers, so it works on GitHub
  Pages). It loads lazily after first paint, so the 180 KB initial-JS budget is unaffected. The
  wasm file is precached by the service worker. No network access is added.
- Both run the same canonical SQL verbatim. Foreign keys are deferred during import (ARCH §4.2).

## Consequences
- One schema, one set of CHECKs, FTS5 everywhere; APK grows by the engine size (budget ≤ 12 MB
  per ABI still holds).
- Schema edits stay in one file (ADR 0016).

## Alternatives considered
- **Room-generated DDL:** loses CHECK constraints.
- **Framework SQLite on Android:** no FTS5 on API 26.
- **IndexedDB on web:** no SQL, no shared analytics queries (ADR 0007).
