---
paths:
  - "apps/android/core/charts/**"
  - "apps/android/feature/insights/**"
  - "apps/web/src/charts/**"
  - "apps/web/src/features/insights/**"
---

# Chart rules (see docs/DESIGN.md §7)

- Charts are pure: `(data, selection, theme) -> marks`, emit events (`onSelect`, `onDrill`).
  No data fetching inside chart components.
- Color by job: single-series blue; categorical slots in fixed entity order (max 7 + Other);
  sequential blue ramp for magnitude; diverging blue↔red for deltas. Text never uses data colors.
- Never: dual y-axes, pies/donuts, 3D, dashed gridlines, rainbow scales, a number on every point.
- Marks: bars ≤ 24dp, 4dp rounded data-end; 2dp lines; 2dp surface gaps; markers ≥ 8dp with ring;
  hit targets ≥ 44dp.
- Every chart: answer sentence, a11y summary + traversable points, table/data view, drill-down to
  a transactions filter expressed in the search grammar.
- Animation keyed by entity id so period changes morph instead of re-entering.
