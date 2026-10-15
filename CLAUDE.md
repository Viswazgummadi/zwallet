# zwallet

Local-only personal finance: **Android app (Kotlin/Compose, primary) + offline web app (React/Vite
PWA on GitHub Pages)**. No backend, no accounts, no network — phone ↔ web via encrypted `.zwallet`
export/import files that merge both ways. Android reads bank/UPI SMS on-device. Centerpiece: the
Analyzer. Free software, GPL-3.0-only, © Viswaz Gummadi.

Start here: `MASTER_PROMPT.md` (mission, non-negotiables, process).
Specs (read the relevant one before changing an area — they are the source of truth):
`docs/SPEC.md` (features, ACs) · `docs/ARCHITECTURE.md` (data model, export/import + merge, SMS,
analytics, budgets) · `docs/DESIGN.md` (tokens, components, every screen, charts) · `docs/adr/`
(0012 local-only, 0013 `.zwallet` format, 0014 license are the newest foundations).

## Golden rules
- Money = integer minor units (`Long` / safe-integer `number` branded `Minor`) + ISO currency.
  Never Double/Float/parseFloat/toFixed on money outside the `Money` libs.
- **Nothing online.** Never add `INTERNET`/network permissions, HTTP clients, remote fonts/CDNs,
  telemetry, or network-capable dependencies. Web CSP stays `connect-src 'self'`.
- Raw SMS text never leaves the device, never appears in logs, never goes into an export.
- Every write stamps HLCs on the merge groups it touches (repository layer). Import = per-group
  LWW merge in one transaction, with snapshot + Undo. Tombstones are compacted, never purged.
- Every Analyzer number must drill down to its exact transactions.
- No hardcoded colors/sizes/durations — use generated design tokens.
- Migrations are append-only (Room migrations, web worker migrations). New change = new step.
- No new third-party SDKs. Deps > 500 KB or with GPL-incompatible licenses need an ADR.
- Every UI state (loading/empty/error/populated, light/dark, font 2.0) has a screenshot test.
- New source files start with `// SPDX-License-Identifier: GPL-3.0-only`. Commits are signed off
  (`git commit -s`).

## Commands (canonical — `scripts/verify.mjs` wraps them; created in M0)
Dev machine is **Windows 11** (CI is Linux) — ADR 0011. Commands below work in Git Bash (Claude's
Bash tool); in PowerShell use `.\gradlew.bat` and `$env:TEMP`. The repo path has a space: quote it.
```bash
node scripts/verify.mjs all            # everything CI runs (use before saying "done")
node scripts/verify.mjs android|web|contracts
# Android (from apps/android; gradlew.bat on Windows if ./gradlew misbehaves)
./gradlew :app:assembleDebug :app:assembleRelease
./gradlew test                             # JVM + Robolectric unit tests (shared vectors)
./gradlew verifyRoborazziDebug             # screenshot tests; recordRoborazziDebug to update
./gradlew :app:checkNoNetworkPermission    # fails if the merged manifest has INTERNET
./gradlew :benchmark:connectedBenchmarkAndroidTest   # device required
# Web
pnpm install && pnpm --filter web dev
pnpm -w turbo run lint typecheck test build
pnpm --filter web e2e
# Contracts & SMS rules
pnpm --filter @zwallet/contracts codegen    # regenerate Contracts.kt + contracts.ts
pnpm --filter @zwallet/design-tokens build  # regenerate tokens, icons, Android XML
pnpm --filter @zwallet/contracts golden     # regenerate expected/ (M4; never hand-edit)
pnpm --filter @zwallet/contracts vectors    # regenerate cross-platform merge/backup vectors
pnpm --filter @zwallet/sms-rules report     # parser accuracy per institution (M2)
# Device checks
adb exec-out screencap -p > "${TEMP:-/tmp}/zw.png"   # or the session scratchpad; then Read the PNG
```

## Workflow
- Explore → plan (plan mode for > 3 files) → implement → verify with evidence → commit.
- Conventional commits, small PRs, branch per task. Contract changes update both apps in one PR.
- Ask before: changing stored data shape or the `.zwallet` format, deleting user data, adding a
  permission/dependency, or contradicting a doc. Record decisions as ADRs. Append open questions
  to `docs/OPEN_QUESTIONS.md`.
- Use subagents in `.claude/agents/` for review, perf audits, design QA, and parallel research.
- When compacting, preserve: current milestone, files changed, failing tests, and next step.
