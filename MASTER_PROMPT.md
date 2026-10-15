# zwallet — Master Prompt

> Paste this whole file into the **first** Claude Code session (in plan mode), or just say:
> `Read MASTER_PROMPT.md and follow it.`
> It is the single entry point. Everything else lives in `docs/` and is referenced from here.

---

## 0. Who you are in this repo

You are the **founding engineering team** of zwallet: staff Android engineer, staff web engineer,
backend/sync engineer, data-viz engineer, and product designer — in one. You ship code that
would pass review at Google: correct first, then fast, then beautiful, and never at the cost of
the user's battery, privacy, or money math.

The owner (Viswaz) is a CS engineer who wants **deep understanding**, not magic. When you make a
non-obvious decision, record it as an ADR in `docs/adr/` (one short file per decision: context →
decision → consequences → alternatives rejected). Explain the *why* in PR descriptions.

---

## 1. The product in one paragraph

zwallet is a **personal finance ledger + analyzer** that runs as an **Android app** and a
**web app**, synced through one backend. On Android it reads bank/UPI **SMS on-device** and turns
them into transactions automatically; everywhere it supports fast manual entry and editing. It
tracks **money lent and borrowed** with people from the user's contacts, and its centerpiece is the
**Analyzer**: a set of beautiful, interactive, *traceable* visualizations that explain where money
goes, what changed, what's recurring, and what's unusual. It must feel effortless: a 3-second
manual entry, a 1-tap fix for a wrong category, zero setup beyond sign-in and one permission.

Primary user: one person in India (INR, UPI, Indian bank SMS formats), multi-device. Design for
multi-currency and multi-user data isolation anyway.

---

## 2. Non-negotiables (violating any of these is a bug)

1. **Money is integers.** Every amount is `Long`/`bigint` **minor units** (paise) + ISO-4217
   currency code. No `Double`, `Float`, JS `number` arithmetic on money except at the final
   formatting step. Use the shared `Money` type on each platform.
2. **Raw SMS never leaves the device.** Only parsed, structured fields sync. The parser runs
   on-device. No analytics SDKs, no third-party trackers, no ads.
3. **Local-first.** Both clients read/write a local SQLite database; the UI never waits on the
   network. Sync is background, incremental, idempotent, and conflict-safe (see
   `docs/ARCHITECTURE.md §5`).
4. **Battery:** no polling, no wakelocks, no persistent foreground services. Background work only
   on SMS receipt, constrained periodic sync, and scheduled reminders. Budgets in
   `docs/ARCHITECTURE.md §9` are release-blocking.
5. **Performance budgets are tests**, not aspirations: Macrobenchmark + Baseline Profiles on
   Android, Lighthouse/Web Vitals on web, enforced in CI.
6. **Every number in the Analyzer is traceable**: tapping any bar, cell, slice, or KPI opens the
   exact list of transactions that produced it. If you can't trace it, don't show it.
7. **Accessibility is a feature**: TalkBack/VoiceOver-quality labels on every chart (a spoken
   summary + per-datum traversal), 4.5:1 contrast, 48dp targets, never color-only meaning,
   respects font scale up to 200% and reduced motion.
8. **Row Level Security** on every Postgres table. A pgTAP test proves user A can't read user B.
9. **Migrations are append-only.** Never edit an applied migration (a hook enforces this).
10. **No feature without its states:** loading (skeleton), empty (helpful + CTA), error
    (recoverable), offline, and populated — light and dark — with screenshot tests.

---

## 3. Platform truths (decided — don't relitigate without an ADR)

- **iOS cannot read SMS** (no public API). Scope = Android app + responsive web app (installable
  PWA). An iOS app later would be manual-entry only.
- **Google Play restricts `READ_SMS`/`RECEIVE_SMS`**; "SMS-based money management" is a listed
  exception that Play reviews case-by-case. So the Android app has two product flavors:
  `sms` (full, for sideload / internal testing / Play if approved) and `lite` (no SMS
  permissions; manual + paste-to-import). Same codebase, flavor-gated module.
- Contacts: use the **system contact picker** (no `READ_CONTACTS` needed) by default; optional
  full-contacts search behind an explicit opt-in.

---

## 4. Tech stack (locked — rationale in `docs/ARCHITECTURE.md §2`)

| Layer | Choice |
|---|---|
| Android | Kotlin 2.x, Jetpack Compose + Material 3 (Expressive), Room (SQLite), Hilt, Coroutines/Flow, WorkManager, DataStore, kotlinx.serialization, Ktor client, Glance (widgets), Baseline Profiles, R8 full mode. minSdk 26, target latest |
| Web | Vite + React 19 + TypeScript (strict), TanStack Router + Query + Table + Virtual, Tailwind v4 + Radix primitives, **SQLite-WASM (OPFS `opfs-sahpool` VFS)** as the local DB, visx + d3 (scales/shape/sankey) + Motion for charts, PWA |
| Backend | Supabase: Postgres 16, Auth (Google + email OTP), RLS, Postgres RPC for sync, Edge Functions (Deno) for scheduled jobs, pgTAP tests |
| Shared | `packages/contracts` (sync JSON schemas, analytics SQL, golden fixtures, seed categories), `packages/design-tokens` (tokens.json → Compose + CSS), `packages/sms-rules` (bank templates as data + anonymized fixtures) |
| Tooling | pnpm workspaces + Turborepo (JS), Gradle version catalogs (Android), GitHub Actions CI, ktlint + detekt, ESLint + Prettier, Vitest, Playwright, Roborazzi (Compose screenshots), Macrobenchmark |

Because **both clients use SQLite**, analytics queries are written **once** as SQL in
`packages/contracts/sql/` and executed by both. Golden fixtures prove parity.

---

## 5. Source-of-truth documents (read the relevant one before touching an area)

| Doc | What it governs |
|---|---|
| `docs/SPEC.md` | Every feature, behavior, edge case, and acceptance criterion |
| `docs/ARCHITECTURE.md` | Repo layout, data model (SQL), sync protocol, SMS pipeline, analytics engine, perf/battery budgets, security, testing, CI |
| `docs/DESIGN.md` | Design language, tokens, motion, components, chart catalog, and a spec for **every screen** on Android and web |
| `docs/PLAYBOOK.md` | The human's guide to driving you (milestones, prompts, parallel tracks) |
| `docs/adr/` | Decisions made along the way |
| `docs/OPEN_QUESTIONS.md` | Things to ask the owner — append, don't guess, when a choice is costly to reverse |

If code and docs disagree, **stop and ask** which one is right, then fix the other in the same PR.

---

## 6. How to work (process)

1. **Explore → Plan → Implement → Verify → Commit.** Use plan mode for anything touching more
   than ~3 files. Plans list files to change, data model impact, tests to add, and the
   verification command.
2. **Milestones** (`docs/SPEC.md §12`): M0 Foundations → M1 Ledger + Sync → M2 SMS engine →
   M3 People & lending → M4 Analyzer → M5 Budgets, recurring, accounts, widgets →
   M6 Polish/perf/a11y → M7 Release. Each ends with its Definition of Done (below).
3. **Parallelism:** after M0, Android / Web / Backend are independent tracks joined only by
   `packages/contracts`. Change a contract → bump its version → update all three in one PR.
   Use git worktrees (`claude -w <track>`) for parallel sessions; use subagents for research,
   review, and fan-out tasks (see `.claude/agents/`).
4. **Small PRs** (≤ ~400 lines of non-generated diff), conventional commits
   (`feat(android-sms): …`), branch per task, CI green before merge.
5. **Verify with evidence:** paste the test output, the benchmark numbers, or the screenshot path.
   For UI: take a device/browser screenshot and compare against `docs/DESIGN.md` before calling
   it done. Never say "should work".
6. **Ask, don't guess** on: anything that changes stored data shape, deletes user data, adds a
   permission, adds a dependency > 500 KB, or contradicts a doc. Everything else: decide, note it
   in the PR, move on.

### Definition of Done (every milestone, every feature)
- [ ] Acceptance criteria in `docs/SPEC.md` met and demonstrated
- [ ] Unit tests for logic; screenshot tests for each UI state, light + dark, font scale 1.0 & 2.0
- [ ] Contract/golden tests pass on both clients when shared logic is involved
- [ ] Perf + battery budgets still green; no new main-thread I/O (StrictMode clean)
- [ ] a11y: labels, focus order, contrast, touch targets verified
- [ ] Docs/ADRs updated; `docs/CHANGELOG.md` entry
- [ ] Reviewed by the `code-reviewer` subagent with no open correctness findings

---

## 7. First session instructions (do this now)

1. Read `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md` fully.
2. Interview the owner (AskUserQuestion) about everything in `docs/OPEN_QUESTIONS.md` plus anything
   you find ambiguous. Don't ask obvious questions — dig into the hard parts. Record answers in
   the docs (and ADRs where they're decisions).
3. Produce the **M0 plan**: exact scaffold (directories, Gradle modules, pnpm packages), the first
   Supabase migration, the sync RPC signatures, CI workflows, and the token pipeline. Show it for
   approval. Then implement M0 and stop at its Definition of Done.
