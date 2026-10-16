# Changelog

## Unreleased

### M0 review round (2026-10-16)
- **Fixed:** a money expression ending in two operators (`120++`) crashed quick add on both apps.
- **Fixed:** the Android debug build crashed on rotation or theme change (StrictMode explicit-GC
  detection); EmojiCompat's downloadable-font initializer removed.
- **Merge hardening (ADR 0018):** identical strict validation and error vectors in the reference,
  web and Android merges; `external_ref` merges by LWW; every column converges; no UNIQUE index
  can block an import; safe-integer bounds; files from a clock > 24 h ahead are refused; import
  preview counts real changes only.
- **Tombstone compaction** specified (ADR 0019); **per-person phone salt** (ADR 0021).
- **Web:** works at 200% text with no sideways scrolling; phone menu reaches every destination;
  "Activity" naming on both apps; shared-origin warning (ADR 0020); stricter CSP and a CSP test
  that can fail; faster cold load (inline theme script by hash, eager Home, font preload);
  web-vitals e2e gate.
- **Android:** visible, announced loading skeleton; live reduced-motion; outline-token button
  borders; empty-state actions and a People FAB; nav labels that fit at font 2.0 on 360dp;
  medium-width gutters; Compose stability fixes; `:benchmark` startup harness.
- **Licensing:** Material Symbols files are marked Apache-2.0 and both apps bundle
  `third_party_notices.txt` (Inter OFL + Material Symbols Apache-2.0).

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
