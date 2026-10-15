---
name: release-check
description: Pre-release checklist for an Android/web release of zwallet (GitHub Releases APK + GitHub Pages).
disable-model-invocation: true
---

Run the release checklist:
1. `node scripts/verify.mjs all` green; `perf-battery-auditor` and `design-qa` subagents with no blockers.
2. Version bumped (versionCode/versionName, web package version), CHANGELOG updated.
3. Release APK assembled and signed by `release.yml` (keystore from GitHub secrets); R8 mapping
   archived; APK size within budget; SHA-256 checksum attached.
4. Room schema JSON committed; migration tests from every released version pass; `.zwallet`
   files from every released `schema_version` still import (backup vectors).
5. Privacy: merged release manifest has **no INTERNET / network permissions**; grep release log
   statements for sensitive data; web build's CSP is `connect-src 'self'` and the Playwright
   zero-egress test passes.
6. License: `LICENSE`, `NOTICE`, `AUTHORS` present; About screen shows the credit, license and
   source link; dependency licenses are GPL-3.0-compatible (list them).
7. Web: production build, bundle budget, Lighthouse, offline (precache) works, Pages deploy.
8. Produce release notes (user-facing, plain language, including "export a backup before
   updating") and a rollback plan (previous APK stays on the Releases page).
