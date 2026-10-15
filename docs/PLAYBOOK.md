# zwallet — Playbook: building it with Claude Code

This is **your** guide (the human driving). It tells you what to set up, what to type, when to run
things in parallel, and how to verify Claude's work so you end up with a production-grade app
*and* understand every part of it.

---

## 0. What's in this kit

```
MASTER_PROMPT.md            ← the master prompt (single entry point for Claude)
CLAUDE.md                   ← always-loaded project memory: golden rules + commands
docs/SPEC.md                ← every feature + acceptance criteria (AC ids) + milestones
docs/ARCHITECTURE.md        ← stack, schema SQL, export/import + merge, SMS engine, analytics, budgets
docs/DESIGN.md              ← design language + every screen (Android & web) + chart specs
docs/OPEN_QUESTIONS.md      ← what Claude must ask you in session 1
docs/PLAYBOOK.md            ← this file
docs/adr/                   ← decision records (template included)
packages/design-tokens/tokens.json  ← colors (validated chart palette), type, spacing, motion
.claude/settings.json       ← permissions + hooks (wired to the scripts below)
.claude/hooks/              ← guard-files (secrets, applied migrations, golden files),
                              money-guard (catches float money / sensitive logs right after edits),
                              format (ktlint/prettier), after-compact (re-injects rules)
.claude/rules/              ← path-scoped rules: android, web, contracts, sms, charts
.claude/agents/             ← subagents: android-engineer, web-engineer, data-engineer,
                              sms-parser-engineer, dataviz-engineer, code-reviewer,
                              perf-battery-auditor, design-qa
.claude/skills/             ← slash commands: /milestone, /new-screen, /add-sms-bank,
                              /schema-change, /analytics-module, /check-all, /release-check
.mcp.json                   ← Playwright MCP (lets Claude open and screenshot the web app)
.worktreeinclude            ← env files copied into parallel worktrees
.gitignore
```

How the pieces relate: `CLAUDE.md` is loaded every session (kept short on purpose).
`.claude/rules/*` load only when Claude touches matching paths. The big docs are read on demand.
Hooks are **deterministic** guarantees (CLAUDE.md is advice; hooks are law). Subagents keep
noisy work (reviews, audits, research) out of your main context. Skills are repeatable
procedures you trigger with `/name`.

---

## 1. One-time setup (Windows 11 — the owner's machine; see ADR 0011)

Install (PowerShell; `winget` ids shown — Linux equivalents in the note below):
1. **Claude Code** — native installer: `irm https://claude.ai/install.ps1 | iex`, then `claude`
   and log in. **Git for Windows** (`winget install Git.Git`) provides Git Bash, which Claude Code
   uses to run the bash hooks. Docs: https://code.claude.com/docs/en/setup
2. **JDK 21** (`winget install EclipseAdoptium.Temurin.21.JDK`) and **Android Studio**
   (`winget install Google.AndroidStudio`; SDK, platform-tools, an emulator image: Pixel 7,
   latest API). Set `ANDROID_HOME` (usually `%LOCALAPPDATA%\Android\Sdk`), put
   `%ANDROID_HOME%\platform-tools` on `PATH`, and add `sdk.dir=` (forward slashes or escaped
   backslashes) to `apps/android/local.properties`.
3. **Node 22 LTS** (`winget install OpenJS.NodeJS.LTS`) + pnpm (`corepack enable`).
4. *(No Docker or backend tools needed — zwallet is local-only, ADR 0012.)*
5. `gh` (`winget install GitHub.cli`, then `gh auth login`), `jq` (`winget install jqlang.jq` —
   hooks need it), `ktlint` (optional; Gradle runs it anyway).
6. **Your phone:** Developer options → Wireless debugging → `adb pair <ip:port>` then
   `adb connect <ip:port>`. Claude can now install builds and take screenshots of your real phone.

Windows notes: the repo path contains a space (`C:\Users\G Viswaz\…`) — always quote paths. Run
gates with `node scripts/verify.mjs all` (same command CI uses). Gradle: `.\gradlew.bat …` in
PowerShell, `./gradlew …` in Git Bash. Screenshots go to `$env:TEMP`, not `/tmp`.
On Linux the same steps apply with apt/brew packages and `./gradlew`.

Secrets (you do these by hand — Claude is blocked from reading keystores and `.env*`):
- **Release signing key** (needed by M7): create it with Android Studio → *Generate Signed
  Bundle/APK* or `keytool`, keep a safe offline copy, and add it to the repo's GitHub secrets
  (`RELEASE_KEYSTORE_BASE64`, `RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS`,
  `RELEASE_KEY_PASSWORD`). Losing it means users can't update in place.
- Enable **GitHub Pages** (Settings → Pages → Source: GitHub Actions) for the web app.
- Nothing else: no accounts, OAuth clients or backend projects.

Optional personal setting — desktop notification when Claude needs you. Add to
`~/.claude/settings.json`:
```json
{ "hooks": { "Notification": [ { "matcher": "", "hooks": [
  { "type": "command", "command": "powershell -NoProfile -Command \"[console]::beep(880,200)\"" } ] } ] } }
```
(For a real toast on Windows install the BurntToast module and use
`powershell -NoProfile -Command "New-BurntToastNotification -Text 'Claude Code','zwallet needs your attention'"`;
on Linux use `notify-send`.)

---

## 2. Bootstrap the repo

```bash
git clone git@github.com:Viswazgummadi/zwallet.git && cd zwallet
unzip ~/Downloads/zwallet-kit.zip -d .        # puts the kit at the repo root
# (no chmod needed on Windows: .gitattributes keeps *.sh LF; hooks run via Git Bash)
git add -A && git commit -m "chore: planning kit (spec, architecture, design, Claude Code config)"
git push -u origin main
claude                                         # accept the workspace trust prompt once
```
Inside Claude: run `/hooks` (you should see guard-files, money-guard, format, after-compact),
`/mcp` (playwright), and `/context` (CLAUDE.md loaded).

---

## 3. Session 1 — interview & lock the plan (≈ 1 hour, high leverage)

Start in plan mode: `claude --permission-mode plan` (or press `Shift+Tab` until it says plan mode).
Paste:

```text
Read MASTER_PROMPT.md and follow section 7. Interview me with AskUserQuestion about everything in
docs/OPEN_QUESTIONS.md and anything in SPEC/ARCHITECTURE/DESIGN you find ambiguous or risky.
Don't ask obvious questions — dig into the hard parts (SMS edge cases from my banks, merge
conflicts between phone and laptop edits, what "spend" should include, month cycles). Then update the docs with my answers,
write ADRs 0001–0008 from ARCHITECTURE §13, and present the M0 plan for approval.
```

Tips: answer precisely; if Claude proposes something you don't understand, ask `/btw why …?`
(side question that doesn't pollute context). Press `Ctrl+G` to edit the plan yourself before
approving. Commit the doc updates: `docs: answers from kickoff interview`.

---

## 4. M0 — Foundations (single session, sequential; everything else builds on it)

`/clear`, then:
```text
/milestone M0
```
The skill makes Claude plan, create a task list, scaffold the monorepo (Gradle modules, pnpm
workspaces, contracts package with the client schema, merge groups and `.zwallet` format +
test vectors, token generator, `scripts/verify.mjs`, CI workflows), and end with app shells that
show an empty Home in light/dark on both platforms — no sign-in, no network.

To keep it going unattended until done, after approving the plan:
```text
/goal M0 Definition of Done in SPEC §12 holds: node scripts/verify.mjs all exits 0 (show the output),
the merged Android manifest has no INTERNET permission, the Android debug build installs and shows Home (adb screenshot shown),
web Home renders light and dark (Playwright screenshot shown). Or stop after 40 turns.
```
Then review: `Use the code-reviewer subagent on everything since the kit commit.`
**You** should read: `client-schema.sql`, the merge groups, the `.zwallet` envelope schema,
`Money` and `Hlc` on both platforms, and `scripts/verify.mjs`. Ask Claude to walk you through
each (`explain the merge rule line by line`).

---

## 5. Parallel tracks (from M1 on)

After M0, `packages/contracts` is the only coupling between Android and web, so they
can run in parallel **in separate git worktrees** (isolated checkouts, no file collisions):

```bash
# terminal 1 — contracts lead (merges first; small sessions)
claude -w contracts
# terminal 2
claude -w android
# terminal 3
claude -w web
```
Each worktree lives under `.claude/worktrees/<name>/` on branch `worktree-<name>`; env files are
copied via `.worktreeinclude`. In each, start with `/milestone M1` and tell it which track it
owns, e.g.:
```text
/milestone M1
You own ONLY the android track of this milestone. Contracts are owned by the contracts session;
if you need a contract change, write it in docs/OPEN_QUESTIONS.md under "contract requests" and
stop that item. Open a PR per work item.
```
Merge order per milestone: **contracts → android & web** (rebase them on main after the
contracts PR merges). Keep the number of simultaneous sessions to what you can actually review —
3 is plenty.

Inside a single session, parallelism is via subagents, e.g.:
```text
In parallel, use the android-engineer subagent to build the Activity list (DESIGN §5.3) and the
web-engineer subagent to build the Transactions table (DESIGN §6). Then run the code-reviewer
subagent on both diffs.
```
And for wide mechanical changes, the bundled `/batch <instruction>` fans out across worktrees.

---

## 6. Milestone prompts (copy-paste)

Each milestone: `/clear` → `/milestone Mx` → approve plan → work → `/check-all` → reviewers →
merge. Add the extra instructions below to the milestone prompt.

**M1 — Ledger + transfer**
```text
Priorities: quick add must hit AC-4.2.1 (≤ 3 taps) and feel instant; search grammar shared by
both apps with one test-vector file in packages/contracts; .zwallet export/import with merge on
both apps, with merge property tests (ARCH §5.6) and Kotlin↔TS backup vectors in CI (AC-11.x).
Seed 50k synthetic transactions for perf tests.
```

**M2 — SMS engine** (Android track + sms-parser-engineer; web track can do paste-import UI)
```text
Build core/smsparser as pure Kotlin first with the fixture-driven test loop, then the receiver,
historical import worker and review inbox. Start with my banks from OPEN_QUESTIONS answers.
Before writing any template, build the debug fixture exporter (ARCH §6.6) so I can export
anonymized real SMS from my phone.
```
Your job here: export ~50–100 of your real (anonymized) SMS per bank. Real data is what makes the
parser good. Use `/add-sms-bank <bank>` per institution.

**M3 — People & lending**
```text
Golden tests must prove lending/splits never change Spend (SPEC §9.2, AC-8.1). Use the system
contact picker (no READ_CONTACTS). Build the UPI request link and WhatsApp share.
```

**M4 — Analyzer** (the big one — split into two or three sessions)
```text
First build the chart libraries (Android core/charts, web src/charts) as pure components with a
gallery screen (debug only) showing every chart with fixture data in light/dark — I will review
the gallery before any module is built. Then /analytics-module for A1, A2, A3, A4 first; then the rest.
```
Review the gallery yourself on the phone. This is where "god-tier" is won: insist on the motion,
the scrub haptics, the answer sentences, and the drill-downs.

**M5 — Budgets, recurring, accounts, widgets** · **M6 — Polish** (run `perf-battery-auditor` and
`design-qa`; fix every blocker; add Baseline Profiles) · **M7 — Release** (`/release-check`).

---

## 7. Verification toolkit (how you trust the output)

| Tool | Use |
|---|---|
| `/goal <condition>` | Keeps Claude working until a verifiable condition holds (state the command whose output proves it; add "or stop after N turns") |
| `/check-all` | Runs every gate and reports a pass/fail table with evidence |
| `code-reviewer` subagent | Fresh-context adversarial review of the diff vs the docs |
| `/code-review` (bundled) | Quick correctness review of the current diff |
| `design-qa` subagent | Screenshots (light/dark, font 2.0) vs DESIGN.md |
| `perf-battery-auditor` | Benchmarks + `dumpsys` checks vs ARCH §9 |
| Hooks | Block secrets/applied-migration edits; flag float money instantly |
| Your phone | Use the app daily from M1 on (dogfooding finds what tests can't) |

Rule of thumb: never accept "should work" — ask for the output, the screenshot, or the number.

---

## 8. Context hygiene (the #1 skill with Claude Code)

- `/clear` between unrelated tasks and between milestone items. Fresh context beats long context.
- After 2 failed corrections on the same thing: `/clear` and re-prompt with what you learned.
- `/rename android-m1` so you can `claude --resume` the right session later.
- `/compact keep: current task, files changed, failing tests, next step` when a session gets long
  (the after-compact hook re-injects the golden rules).
- `/btw <question>` for quick side questions that shouldn't enter history.
- `Esc` to stop and redirect; `Esc Esc` / `/rewind` to roll back code + conversation.
- Delegate exploration to subagents ("use a subagent to find how X works and summarize").
- Permission modes: auto mode for routine work, plan mode for anything touching > 3 files,
  never `--dangerously-skip-permissions` on your real machine.

---

## 9. Deep mastery loop (so you understand everything you ship)

After each milestone, spend 30 minutes on this:
1. `Explain <component> to me like a staff engineer onboarding a new hire: data flow, invariants,
   failure modes, and the 3 lines of code that matter most.` (merge engine, HLC, SMS dedup,
   daily_agg triggers, forecast bootstrap, Compose chart drawing)
2. `Quiz me with 5 hard questions about <component>; don't give answers until I reply.`
3. Implement one small piece yourself (e.g. the HLC, or one SMS template) and ask the
   code-reviewer subagent to review *your* code.
4. Read the ADRs Claude wrote and challenge one decision.

---

## 10. Weekly cadence (suggested)

| When | What |
|---|---|
| Start of session | `claude --continue` or a fresh session with `/milestone Mx` (it reads CHANGELOG + git log) |
| Each work item | plan → implement → `/check-all` → reviewer → PR → merge |
| Daily | Use the app on your phone; file bugs as GitHub issues; `Fix issue #N` sessions |
| End of milestone | auditors, design QA on device, CHANGELOG, tag, mastery loop |

Rough effort with evenings/weekends: M0 3–5 days · M1 1–2 weeks · M2 1–2 weeks · M3 1 week ·
M4 2–3 weeks · M5 1 week · M6 1 week · M7 2–3 days. The Analyzer and the SMS parser are where
quality comes from — don't rush them.

---

## 11. Troubleshooting & anti-patterns

- **Claude ignores a rule** → CLAUDE.md is too long or vague; prune it, or turn the rule into a hook.
- **Hooks don't fire** → `/hooks` to list; Git Bash + `jq` on PATH? (Linux: `chmod +x .claude/hooks/*.sh`)
- **Worktree session missing env** → add the file to `.worktreeinclude`.
- **Big-bang prompts** ("build the whole app") → always milestone → plan → items.
- **Accepting un-run code** → demand evidence; use `/goal` with an explicit check command.
- **Letting docs drift** → any behavior change updates SPEC/DESIGN in the same PR.
- **SMS parser tuned by guessing** → only real anonymized fixtures + the accuracy report.
- **Losing data** → no cloud copy exists by design. Export a `.zwallet` regularly (the app reminds
  you) and keep the password somewhere safe.
