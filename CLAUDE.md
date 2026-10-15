# zwallet

Local-first personal finance: **Android app (Kotlin/Compose) + web app (React/Vite PWA) +
Supabase**, synced. Android reads bank/UPI SMS on-device. Centerpiece: the Analyzer.

Start here: `MASTER_PROMPT.md` (mission, non-negotiables, process).
Specs (read the relevant one before changing an area — they are the source of truth):
`docs/SPEC.md` (features, ACs) · `docs/ARCHITECTURE.md` (data model, sync, SMS, analytics,
budgets) · `docs/DESIGN.md` (tokens, components, every screen, charts) · `docs/adr/`.

## Golden rules
- Money = integer minor units (`Long` / safe-integer `number` branded `Minor` / `bigint` in SQL)
  + ISO currency. Never Double/Float/parseFloat/toFixed on money outside the `Money` libs.
- Raw SMS text never leaves the device and never appears in logs.
- Local-first: UI reads/writes local SQLite only; sync runs in the background.
- Every Analyzer number must drill down to its exact transactions.
- No hardcoded colors/sizes/durations — use generated design tokens.
- Migrations are append-only (`supabase/migrations`, Room migrations). New change = new file.
- No new third-party SDKs that phone home. Deps > 500 KB need an ADR.
- Every UI state (loading/empty/error/offline/populated, light/dark, font 2.0) has a screenshot test.

## Commands (canonical — `scripts/verify.mjs` wraps them; created in M0)
Dev machine is **Windows 11** (CI is Linux) — ADR 0011. Commands below work in Git Bash (Claude's
Bash tool); in PowerShell use `.\gradlew.bat` and `$env:TEMP`. The repo path has a space: quote it.
```bash
node scripts/verify.mjs all            # everything CI runs (use before saying "done")
node scripts/verify.mjs android|web|db|contracts
# Android (from apps/android; gradlew.bat on Windows if ./gradlew misbehaves)
./gradlew :app:assembleSmsDebug :app:assembleLiteDebug
./gradlew testDebugUnitTest :core:smsparser:test
./gradlew verifyRoborazziSmsDebug          # screenshot tests; recordRoborazziSmsDebug to update
./gradlew :benchmark:connectedBenchmarkAndroidTest   # device required
# Web
pnpm install && pnpm --filter web dev
pnpm -w turbo run lint typecheck test build
pnpm --filter web e2e
# Supabase
supabase start && supabase db reset && supabase test db   # needs Docker Desktop (WSL2) running
# Contracts & SMS rules
pnpm --filter @zwallet/contracts golden     # regenerate expected/ (never hand-edit)
pnpm --filter @zwallet/sms-rules report     # parser accuracy per institution
# Device checks
adb exec-out screencap -p > "${TEMP:-/tmp}/zw.png"   # or the session scratchpad; then Read the PNG
```

## Workflow
- Explore → plan (plan mode for > 3 files) → implement → verify with evidence → commit.
- Conventional commits, small PRs, branch per task. Contract changes update all clients in one PR.
- Ask before: changing stored data shape, deleting user data, adding a permission/dependency,
  or contradicting a doc. Record decisions as ADRs. Append open questions to `docs/OPEN_QUESTIONS.md`.
- Use subagents in `.claude/agents/` for review, perf audits, design QA, and parallel research.
- When compacting, preserve: current milestone, files changed, failing tests, and next step.
