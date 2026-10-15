---
name: release-check
description: Pre-release checklist for an Android/web release of zwallet.
disable-model-invocation: true
---

Run the release checklist:
1. `node scripts/verify.mjs all` green; `perf-battery-auditor` and `design-qa` subagents with no blockers.
2. Version bumped (versionCode/versionName, web package version), CHANGELOG updated.
3. Both flavors assembled as signed release AABs; R8 mapping archived; APK size within budget.
4. Room schema JSON committed; migration tests from every released version pass.
5. Supabase migrations applied to staging; pgTAP green on staging.
6. Privacy check: grep the release build's log statements for sensitive data; confirm no new
   network hosts (list all hosts the app contacts).
7. Web: production build, bundle budget, Lighthouse, CSP headers.
8. Produce release notes (user-facing, plain language) and a rollback plan.
