---
name: milestone
description: Kick off or resume a zwallet milestone (M0–M7) with a plan, task list and parallel tracks.
argument-hint: "[M0..M7]"
disable-model-invocation: true
---

Start milestone **$ARGUMENTS** of zwallet.

1. Read `MASTER_PROMPT.md`, then the milestone row in `docs/SPEC.md §12` and every SPEC/ARCH/DESIGN
   section it touches. Read `docs/CHANGELOG.md` and `git log --oneline -20` to see where we are.
2. Check `docs/OPEN_QUESTIONS.md`; ask me (AskUserQuestion) anything that blocks this milestone.
3. In plan mode, produce the plan:
   - Work items grouped into **tracks** that can run in parallel (android / web / backend /
     sms / dataviz), with dependencies between items made explicit (contracts first).
   - For each item: files/modules, AC ids, tests to add, verification command.
   - Which items to delegate to which subagent in `.claude/agents/`, and which tracks deserve
     their own worktree session (`claude -w <track>`).
   - Risks and the order of merges.
4. After I approve: create the task list, then execute item by item. After each item run its
   verification and paste evidence. Commit per item (conventional commits).
5. At the end: run `./scripts/verify.sh all`, then the `code-reviewer`, `perf-battery-auditor`
   and `design-qa` subagents. Fix blockers, update `docs/CHANGELOG.md`, and report the milestone
   Definition of Done checklist with evidence.
