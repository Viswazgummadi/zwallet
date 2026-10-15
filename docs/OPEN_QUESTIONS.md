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

13. **Custom domain** for the web app (optional; GitHub Pages URL works without one).
14. **EMI interest:** EMIs are wholly `excluded` today. Should the interest part later count as
    spend (needs principal/interest split per EMI)?
15. **Paytm sender headers:** confirm exact DLT headers for Paytm wallet / UPI Lite messages from
    the first exported fixtures (M2).
16. **Release signing key:** you generate the release keystore yourself and store it in GitHub
    secrets (M7). Forks sign with their own key, so a fork's APK can't install over yours.
17. **Legal review** of NOTICE's GPL §7(b) attribution term, if credit or commercial use ever
    becomes important.
