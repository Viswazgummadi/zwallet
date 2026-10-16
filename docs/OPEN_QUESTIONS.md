# Open questions for the owner

Claude: ask these in the first session (AskUserQuestion), record answers in the relevant doc,
then strike them here. Append new questions whenever a costly-to-reverse choice comes up.

## Answered in the kickoff interview (2026-10-15)

1. ~~**Banks & apps you actually use**~~ → **SBI, Axis**; UPI via GPay/PhonePe (bank SMS) and
   **Paytm incl. wallet + UPI Lite**; no credit cards. → SPEC §5.4 step 0, ARCH §6.3.
2. ~~**Fixture corpus:** dev-only anonymized SMS exporter?~~ → **Yes**, debug builds only; owner
   reviews each `.jsonl` before commit. → ARCH §6.6.
3. ~~**Month start day**~~ → **Calendar month** (default 1; fixed day 1–28 configurable, no
   salary detection). → SPEC §9.4.
4. ~~**Investments (SIP/FD) as savings**~~ → **Confirmed.** Also excluded from spend:
   reimbursable work expenses (tag), family support, EMI & loan repayments. → SPEC §6.1, §9.2.
5. ~~**Auto-confirm high-confidence SMS**~~ → **On by default.** → SPEC §5.4 step 7.
6. ~~**Keep raw SMS text locally**~~ → **On by default**, purgeable, never exported. → ARCH §6.5.
7. ~~**Domain & hosting**~~ → Web app on **GitHub Pages** (static, offline PWA). → ARCH §12.
8. ~~**Supabase region**~~ → **Moot: no backend** (ADR 0012). The hosted Supabase project can be
   deleted.
9. ~~**App name, package id, brand color**~~ → **zwallet**, `in.zwallet.app`, teal `#0B6E69`;
   forks change them in `branding.properties` / tokens. → ADR 0014, DESIGN §2.1.
10. ~~**Play Store**~~ → **No Play.** Single build, signed APK on GitHub Releases. → ADR 0012.
11. ~~**App lock on by default?**~~ → Offered in onboarding, **default on**, 5 min. → DESIGN §5.1.
12. ~~**Historical data import**~~ → **None**; fresh start + SMS backfill.

Also decided:
- **Local-only, nothing online, no accounts, no sync** (ADR 0012). Android has no INTERNET
  permission.
- **Phone ↔ web by encrypted `.zwallet` files**, editable on both sides, merged on import with
  per-field-group LWW (ADR 0009, 0013). Password-encrypted (AES-256-GCM + PBKDF2).
- **Backups: manual export only** (+ optional reminder). Android cloud backup disabled.
- **Deterministic SMS ids** (ADR 0010); seeded rows have fixed ids.
- **License GPL-3.0-only + DCO, credit preserved via NOTICE/About** (ADR 0014).
- UPI Lite / Paytm wallet top-ups → **counted as spend** ("Small UPI payments"); wallet-funded
  payment SMS ignored (SPEC §5.4 step 9). Refunds reduce the **original** month (SPEC §9.2).
- Windows 11 dev machine → Node-based tooling (ADR 0011); Docker no longer needed.

## Open

13. **Dedicated web origin — needed before real data goes into the web app (ADR 0020).** Browser
    storage is per origin, and every Pages site of one account shares `<user>.github.io`. Pick
    one: a custom domain (CNAME on Pages), or a GitHub organisation used only for zwallet whose
    root site serves the app (`https://<org>.github.io/`, `ZW_BASE=/`). Until then the current
    deployment shows a shared-origin warning.
14. **EMI interest:** EMIs are wholly `excluded` today. Should the interest part later count as
    spend (needs principal/interest split per EMI)?
15. **Paytm sender headers:** confirm exact DLT headers for Paytm wallet / UPI Lite messages from
    the first exported fixtures (M2).
16. **Release signing key:** you generate the release keystore yourself and store it in GitHub
    secrets (M7). Forks sign with their own key, so a fork's APK can't install over yours.
17. **Legal review** of NOTICE's GPL §7(b) attribution term, if credit or commercial use ever
    becomes important.

## Raised during M0 (2026-10-15)

18. **detekt:** no stable detekt release supports Kotlin 2.4 yet (1.23.8 targets Kotlin 2.0), so
    M0 ships ktlint only. Add detekt (with the "no Double/Float in money packages" rule) once a
    compatible release is out, or treat money-guard + ktlint as enough?
19. **Room vs canonical CHECKs (M1):** Room creates tables from entities, which can't declare the
    CHECK constraints in `client-schema.sql`. Proposal: create tables from the canonical SQL in
    Room's `onCreate` and let Room validate the columns. Confirm before M1 starts.
20. **SQLite on Android (M1):** the framework SQLite on API 26 lacks FTS5. Proposal:
    `androidx.sqlite:sqlite-bundled` (Apache-2.0, ~1–2 MB per ABI) — over 500 KB, so it needs
    your OK and an ADR.
21. ~~**phone_hash_salt (M3)**~~ → per-person salt inside `people.phone_hash`;
    `profile.phone_hash_salt` removed (ADR 0021).
22. **Pixel baselines:** web screenshots are compared only on your Windows machine; Roborazzi
    allows ≤ 1% pixel drift between Windows goldens and Linux CI. Revisit if CI flakes.
23. **Transfer sign ⇄:** Inter has no U+21C4, so it renders from the system font (ADR 0015).
    Keep it, or draw the `sync_alt` icon instead?
24. **Merchant dictionary:** the ~300-merchant seed (SPEC §6.2) moves to M2 with the SMS engine.
25. **PWA updates:** M0 auto-updates the service worker; DESIGN wants an update prompt (M6).
26. **Emulator cold start:** a debug build took ~26–29 s to first frame on the software-rendered
    Pixel_7 emulator. Not representative; M6 Macrobenchmark on a release build is the real gate.

## Decided in the M0 review round (2026-10-16)

Owner asked Claude to decide; recorded here for traceability.
- Merge hardening: strict inputs with error vectors, `external_ref` in a `ref` group, immutables
  converge by tie-break order, no UNIQUE index that could block an import, safe-integer bounds,
  24 h clock-ahead limit, value-based import outcomes (ADR 0018).
- Tombstone compaction re-stamps payload groups to `x-compact` placeholders (ADR 0019).
- Web app on a dedicated origin + shared-origin warning (ADR 0020; owner action in #13).
- The main list tab is **Activity** on both platforms; People gets a FAB ("Add person").
- Pre-release stub actions stay enabled and announce "<Feature> arrives in the next update."
- Web performance gate: a Playwright web-vitals spec instead of a Lighthouse CI dependency.
- A minimal `:benchmark` StartupBenchmark module exists from M0; Baseline Profiles stay M6.
- Material Symbols ship with an Apache-2.0 notice; `third_party_notices.txt` is bundled in both
  apps for the M7 About screen.
