# Changelog

## Unreleased
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
