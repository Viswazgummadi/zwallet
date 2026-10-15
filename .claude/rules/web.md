---
paths:
  - "apps/web/**"
---

# Web rules

- TypeScript strict, no `any`. Money is `Minor` (branded integer `number`, checked with
  `Number.isSafeInteger`) — all arithmetic through `src/lib/money.ts`.
- All database access happens in the SQLite-WASM worker (`src/db/worker.ts`) via Comlink;
  components use TanStack Query hooks from `src/db/queries`. Never touch OPFS from the main thread.
- Only the leader tab (Web Locks) runs sync; invalidate queries via BroadcastChannel.
- Styling: Tailwind v4 with CSS variables generated from `packages/design-tokens`. No raw hex.
- Components: Radix primitives wrapped in `src/ui`; every interactive element keyboard-reachable
  with a visible focus ring; shortcuts registered in the command palette registry.
- Routes are code-split; charts and Sankey lazy-loaded. Keep initial JS ≤ 180 KB gzip.
- Large lists/tables use TanStack Virtual. No layout thrash in scroll handlers.
- Tests: Vitest for logic, Playwright for flows + screenshots (light/dark). After UI changes run
  the dev server and verify with the Playwright MCP (screenshot) against `docs/DESIGN.md` §6.
