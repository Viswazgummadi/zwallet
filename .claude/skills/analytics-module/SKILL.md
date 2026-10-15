---
name: analytics-module
description: Build or change an Analyzer module (A1–A15) end-to-end - metric definition, shared SQL, golden fixtures, charts on both platforms, drill-down.
argument-hint: "<module id, e.g. A4>"
---

Analyzer module: $ARGUMENTS

Delegate to the `dataviz-engineer` subagent with this checklist:
1. Confirm the question, metric definitions (SPEC §9.2) and visual spec (DESIGN §7.5) for the module.
2. SQL in `packages/contracts/sql/analytics/<module>.sql` (SQLite dialect, named params) + DTO schema.
3. Regenerate golden outputs for the standard fixture datasets; both clients byte-identical.
4. Android chart (core/charts) + card (feature/insights); web chart (src/charts) + card.
5. Answer sentence, tooltip, cross-filter, drill-down to transactions via the search grammar,
   a11y summary + traversal, data table view.
6. Screenshot tests: dense, sparse (< 2 months), empty, light/dark.
7. Measure: render time at 50k transactions (must fit ARCH §9).
