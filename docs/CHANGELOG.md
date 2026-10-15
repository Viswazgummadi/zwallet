# Changelog

## Unreleased

### M0 — Foundations (2026-10-15)
- **Monorepo:** pnpm workspaces + Turborepo, Gradle 9.8 / AGP 9.4 / Kotlin 2.4 with convention
  plugins, and `node scripts/verify.mjs all|contracts|web|android` as the single gate runner for
  Windows and CI (ADR 0011).
- **Contracts:** canonical SQLite schema v1 for all 16 user-data tables plus the device-local
  tables; row JSON schemas with merge groups; the `.zwallet` envelope and payload schemas; codegen
  to Kotlin and TypeScript; seeded categories (SPEC §6.1) and system tags with fixed ids.
- **Shared vectors:** money (parse, Indian grouping, K/L/Cr, exact quick-add maths), HLC,
  UUIDv7/v8 + SMS ids, and 26 merge cases. A reference implementation, Kotlin and TypeScript all
  pass them, plus property tests (convergence, idempotence, commutativity, no resurrection).
- **Merge conflicts** are logged only when the winning side hadn't seen the losing edit (ADR 0017).
- **Design tokens:** `tokens.json` → Compose, CSS/Tailwind and TS; M3 roles from the brand seed;
  category glyphs auto-adjusted to ≥ 3:1 on their containers; WCAG contrast tests; bundled Inter
  subset (ADR 0015) and Material Symbols Rounded icons.
- **Android shell:** theme (light/dark/AMOLED), adaptive navigation (bottom bar / rail), empty
  Home with loading skeleton, placeholder tabs; no network permissions (CI check), no cloud
  backup; 30 Roborazzi screenshots (light/dark, font 1.0/2.0, rail). Release APK 1.3 MB.
- **Web shell:** offline PWA with strict CSP, sidebar / rail / bottom nav, first-run "Open your
  zwallet file", theme toggle; Playwright proves zero off-origin requests, CSP blocking and
  offline use. Initial JS 115 KB gzip.
- **CI:** contracts (+ Windows smoke), android, web, GitHub Pages deploy, DCO and Dependabot.
- Schema v1 stays editable until the first release (ADR 0016).

### Before M0
- **Local-only redesign:** no backend, accounts or network. Android ships without INTERNET
  permission, and the web app is an offline PWA on GitHub Pages. Phone ↔ web via encrypted
  `.zwallet` export/import with per-field merge (ADR 0012, 0013). Supabase/OAuth plans dropped.
  ADRs 0002/0004/0005 superseded.
- License: GPL-3.0-only with NOTICE/AUTHORS crediting Viswaz Gummadi; contributions under DCO
  (ADR 0014).
- Kickoff interview decisions recorded across SPEC/ARCHITECTURE/DESIGN; OPEN_QUESTIONS 1–12 answered.
- ADRs 0001–0014.
- Windows 11 development support in docs and Claude Code kit.
- Planning kit: master prompt, spec, architecture, design system, Claude Code configuration.
