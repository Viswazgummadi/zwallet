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
6. ~~**Keep raw SMS text locally**~~ → **On by default**, purgeable. → ARCH §6.5, SPEC §13.
7. ~~**Domain & hosting**~~ → **Cloudflare Pages**; custom domain decided at M7 (see below).
   → ARCH §12.
8. ~~**Supabase region**~~ → Existing hosted project is **Mumbai** and is **prod**; dev/test on
   local Docker. → ADR 0004, ARCH §10.
9. ~~**App name, package id, brand color**~~ → **zwallet**, `in.zwallet.app` (lite) /
   `in.zwallet.app.sms`, teal `#0B6E69`. → ADR 0005, DESIGN §2.1.
10. ~~**Play Store**~~ → **`lite` on Play; `sms` sideload / internal track.** → ADR 0005, SPEC §12.
11. ~~**App lock on by default?**~~ → Offered in onboarding, **default on**, 5 min. → DESIGN §5.1.
12. ~~**Historical data import**~~ → **None**; fresh start + SMS backfill.

Also decided (raised during the interview):
- Sync conflicts → **per-field-group LWW** (ADR 0009, SPEC §11 AC-11.3).
- Same SMS on several devices / reinstall → **deterministic SMS ids** (ADR 0010).
- UPI Lite / Paytm wallet top-ups → **counted as spend** ("Small UPI payments"); wallet-funded
  payment SMS ignored. (SPEC §5.4 step 9)
- Refunds → reduce the **original** expense's month (SPEC §9.2).
- Offline-only data at sign-in → **merged automatically** with a summary (SPEC §11).
- Windows 11 dev machine → Node-based tooling, Docker Desktop/WSL2 (ADR 0011).

## Open

13. **Custom domain** for the web app (needed by M7; also the privacy-policy URL).
14. **EMI interest:** EMIs are wholly `excluded` today. Should the interest part later count as
    spend (needs principal/interest split per EMI)?
15. **Paytm sender headers:** confirm exact DLT headers for Paytm wallet / UPI Lite messages from
    the first exported fixtures (M2).
