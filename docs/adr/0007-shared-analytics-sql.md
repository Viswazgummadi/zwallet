# 0007 — Analytics SQL shared via `packages/contracts`

- Status: accepted
- Date: 2026-10-15

## Context
The Analyzer's numbers must be identical on Android and web and must drill down to the exact
transactions behind them. Both clients run SQLite (ADR 0001).

## Decision
- Every Analyzer metric is one SQL file in `packages/contracts/sql/analytics/<module>.sql`, with
  named parameters. Android runs it via `SupportSQLiteDatabase`; web runs it in the worker.
- Output DTOs are defined in `packages/contracts/schema/analytics/<module>.json`.
- Logic that can't live in SQL (forecast bootstrap, anomalies, recurring detection, insight
  rules) is mirrored in Kotlin and TypeScript, with seeded RNG.
- Golden fixtures (a synthetic 18-month, roughly 20k-transaction dataset) feed
  `expected/<module>__<params>.json`. Both clients must produce **byte-identical** JSON.
  `expected/` is generated, never hand-edited.

## Consequences
- Each metric definition lives in one place, and parity is a CI test.
- The SQL must stay inside the SQLite feature subset that both Room's bundled SQLite and
  SQLite-WASM support. Pin the versions.
- Changing a metric means regenerating goldens and reviewing the diff.

## Alternatives considered
- **Separate implementations per platform.** Drift is guaranteed.
- **Server-side analytics.** Breaks offline use and local-first latency.
