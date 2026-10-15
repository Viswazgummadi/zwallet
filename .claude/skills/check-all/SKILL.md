---
name: check-all
description: Run every zwallet quality gate and summarize pass/fail with evidence. Use before declaring work done or opening a PR.
---

1. Run `node scripts/verify.mjs all` (if it doesn't exist yet, run each track's lint/typecheck/test/build
   commands from CLAUDE.md). Capture the summary lines, not full logs.
2. If a device is attached: install the sms debug build and run a smoke flow (open app, quick-add
   ₹1, delete it) via adb; screenshot Home.
3. Report a table: gate · result · evidence. For failures, show the first failing assertion and the
   likely cause. Do not claim success for anything you didn't run.
