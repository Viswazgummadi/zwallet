# zwallet — Master Prompt

> Paste this whole file into the **first** Claude Code session (in plan mode), or just say:
> `Read MASTER_PROMPT.md and follow it.`
> It is the single entry point. Everything else lives in `docs/` and is referenced from here.

---

## 0. Who you are in this repo

You are the **founding engineering team** of zwallet: staff Android engineer, staff web engineer,
data & transfer engineer, data-viz engineer, and product designer — in one. You ship code that
would pass review at Google: correct first, then fast, then beautiful, and never at the cost of
the user's battery, privacy, or money math.

The owner (Viswaz) is a CS engineer who wants **deep understanding**, not magic. When you make a
non-obvious decision, record it as an ADR in `docs/adr/` (one short file per decision: context →
decision → consequences → alternatives rejected). Explain the *why* in PR descriptions.

---

## 1. The product in one paragraph

zwallet is a **personal finance ledger + analyzer** that runs as an **Android app** (primary) and an
offline **web app** for big-screen analysis, with **nothing online**: no accounts, no server, no
internet access. Data moves between them only as an encrypted file the user exports and imports
(changes merge both ways). On Android it reads bank/UPI **SMS on-device** and turns
them into transactions automatically; everywhere it supports fast manual entry and editing. It
tracks **money lent and borrowed** with people from the user's contacts, and its centerpiece is the
**Analyzer**: a set of beautiful, interactive, *traceable* visualizations that explain where money
goes, what changed, what's recurring, and what's unusual. It must feel effortless: a 3-second
manual entry, a 1-tap fix for a wrong category, zero setup: no account, one permission.

It is free software (GPL-3.0-only) published on GitHub: anyone can download the APK or fork the
repo and make it their own app, while the original authorship and credit stay with Viswaz
(ADR 0014).

Primary user: one person in India (INR, UPI, Indian bank SMS formats) with a phone and sometimes a
laptop. Design for multi-currency anyway.

---

## 2. Non-negotiables (violating any of these is a bug)

1. **Money is integers.** Every amount is `Long`/`bigint` **minor units** (paise) + ISO-4217
   currency code. No `Double`, `Float`, JS `number` arithmetic on money except at the final
   formatting step. Use the shared `Money` type on each platform.
2. **Nothing online.** The Android app has **no INTERNET permission** (CI-enforced); the web app
   only loads its own static files (strict CSP). No accounts, servers, analytics SDKs, trackers
   or ads. Raw SMS never leaves the device and is never written to an export file.
3. **Local-only, merge-safe transfer.** Both apps read/write a local SQLite database. Phone ↔ web
   happens only via encrypted `.zwallet` files; import is an idempotent, atomic, undoable
   per-field merge (`docs/ARCHITECTURE.md §5`, ADR 0009/0013).
4. **Battery:** no polling, no wakelocks, no persistent foreground services, no periodic jobs.
   Background work only on SMS receipt, user-started SMS import, and scheduled reminders. Budgets in
   `docs/ARCHITECTURE.md §9` are release-blocking.
5. **Performance budgets are tests**, not aspirations: Macrobenchmark + Baseline Profiles on
   Android, Lighthouse/Web Vitals on web, enforced in CI.
6. **Every number in the Analyzer is traceable**: tapping any bar, cell, slice, or KPI opens the
   exact list of transactions that produced it. If you can't trace it, don't show it.
7. **Accessibility is a feature**: TalkBack/VoiceOver-quality labels on every chart (a spoken
   summary + per-datum traversal), 4.5:1 contrast, 48dp targets, never color-only meaning,
   respects font scale up to 200% and reduced motion.
8. **Exports are encrypted and never lossy.** A `.zwallet` file round-trips every user-data row
   (incl. tombstones) and nothing device-private; Kotlin and TS read each other's files (shared
   vectors in CI).
9. **Migrations are append-only.** Never edit a released Room/web migration; add a new one.
10. **No feature without its states:** loading (skeleton), empty (helpful + CTA), error
    (recoverable), and populated — light and dark — with screenshot tests.

---

## 3. Platform truths (decided — don't relitigate without an ADR)

- **iOS cannot read SMS** (no public API). Scope = Android app + responsive web app (installable
  PWA). An iOS app later would be manual-entry only.
- **Distribution is GitHub only:** one Android build (with SMS), signed APK on GitHub Releases
  (Obtainium-friendly); web on GitHub Pages. No Google Play, so its SMS-permission policy doesn't
  apply (ADR 0012). If SMS permission is denied, the app works in manual + paste mode.
- **Forkable by design:** app name, `applicationId` and brand colour live in
  `apps/android/branding.properties` + `packages/design-tokens`; forks must keep `LICENSE`,
  `NOTICE`, copyright lines and the About credit (ADR 0014).
- Contacts: use the **system contact picker** (no `READ_CONTACTS` needed) by default; optional
  full-contacts search behind an explicit opt-in.
- **Dev environment:** the owner develops on **Windows 11** (CI is Linux). Canonical gate runner is
  `node scripts/verify.mjs`; use `gradlew.bat` / `.\gradlew.bat` locally, the OS temp dir instead of
  `/tmp`, and quote paths (the repo path contains a space). Hooks are bash, run via Git Bash.
  No Docker or backend tooling is needed. See ADR 0011.

---

## 4. Tech stack (locked — rationale in `docs/ARCHITECTURE.md §2`)

| Layer | Choice |
|---|---|
| Android | Kotlin 2.x, Jetpack Compose + Material 3 (Expressive), Room (SQLite), Hilt, Coroutines/Flow, WorkManager, DataStore, kotlinx.serialization, `javax.crypto` (AES-GCM/PBKDF2), Glance (widgets), Baseline Profiles, R8 full mode. minSdk 26, target latest |
| Web | Vite + React 19 + TypeScript (strict), TanStack Router + Query + Table + Virtual, Tailwind v4 + Radix primitives, **SQLite-WASM (OPFS `opfs-sahpool` VFS)** as the local DB, visx + d3 (scales/shape/sankey) + Motion for charts, WebCrypto + CompressionStream for `.zwallet`, PWA on GitHub Pages |
| Backend | **None** (ADR 0012) |
| Shared | `packages/contracts` (client schema, row + `.zwallet` JSON schemas, merge groups, cross-platform test vectors, analytics SQL, golden fixtures, seed categories), `packages/design-tokens` (tokens.json → Compose + CSS), `packages/sms-rules` (bank templates as data + anonymized fixtures) |
| Tooling | pnpm workspaces + Turborepo (JS), Gradle version catalogs (Android), GitHub Actions CI + Pages + Releases, ktlint + detekt, ESLint + Prettier, Vitest, Playwright, Roborazzi (Compose screenshots), Macrobenchmark |

Because **both clients use SQLite**, analytics queries are written **once** as SQL in
`packages/contracts/sql/` and executed by both. Golden fixtures prove parity.

---

## 5. Source-of-truth documents (read the relevant one before touching an area)

| Doc | What it governs |
|---|---|
| `docs/SPEC.md` | Every feature, behavior, edge case, and acceptance criterion |
| `docs/ARCHITECTURE.md` | Repo layout, data model (SQL), export/import + merge, SMS pipeline, analytics engine, perf/battery budgets, security, testing, CI |
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
2. **Milestones** (`docs/SPEC.md §12`): M0 Foundations → M1 Ledger + transfer → M2 SMS engine →
   M3 People & lending → M4 Analyzer → M5 Budgets, recurring, accounts, widgets →
   M6 Polish/perf/a11y → M7 Release. Each ends with its Definition of Done (below).
3. **Parallelism:** after M0, Android and Web are independent tracks joined only by
   `packages/contracts`. Change a contract → bump its version → update both apps in one PR.
   Use git worktrees (`claude -w <track>`) for parallel sessions; use subagents for research,
   review, and fan-out tasks (see `.claude/agents/`).
4. **Small PRs** (≤ ~400 lines of non-generated diff), conventional commits
   (`feat(android-sms): …`), signed off (`git commit -s`, DCO — ADR 0014), branch per task, CI
   green before merge.
5. **Verify with evidence:** paste the test output, the benchmark numbers, or the screenshot path.
   For UI: take a device/browser screenshot and compare against `docs/DESIGN.md` before calling
   it done. Never say "should work".
6. **Ask, don't guess** on: anything that changes stored data shape or the `.zwallet` format,
   deletes user data, adds a permission (never INTERNET), adds a dependency > 500 KB or with a
   GPL-incompatible license, or contradicts a doc. Everything else: decide, note it
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

I'm developing on Windows 11, not Linux. Adapt scripts and commands accordingly.

1. Read `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md` fully.
2. Interview the owner (AskUserQuestion) about everything in `docs/OPEN_QUESTIONS.md` plus anything
   you find ambiguous. Don't ask obvious questions — dig into the hard parts. Record answers in
   the docs (and ADRs where they're decisions).
3. Produce the **M0 plan**: exact scaffold (directories, Gradle modules, pnpm packages), the
   canonical client schema + merge groups, the `.zwallet` envelope schema and test vectors, CI
   workflows, and the token pipeline. Show it for
   approval. Then implement M0 and stop at its Definition of Done.
