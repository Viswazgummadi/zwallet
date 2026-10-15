# Open questions for the owner

Claude: ask these in the first session (AskUserQuestion), record answers in the relevant doc,
then strike them here. Append new questions whenever a costly-to-reverse choice comes up.

1. **Banks & apps you actually use** (for SMS fixtures priority): e.g. HDFC, SBI, ICICI, Axis,
   Kotak, IDFC, PNB, Canara; GPay, PhonePe, Paytm, CRED, Amazon Pay; credit cards?
2. **Fixture corpus:** OK to build a dev-only "export anonymized SMS" screen (redacts names,
   account digits, refs, VPAs locally) so you can generate real test fixtures from your phone?
3. **Month start day:** calendar month, or salary cycle (which day)?
4. **Investments (SIP/FD):** count as *savings* (excluded from spend) — confirm.
5. **Auto-confirm high-confidence SMS** by default, or always land in review first?
6. **Keep raw SMS text locally** (useful for re-parsing after parser upgrades) — default on/off?
7. **Domain & hosting** for the web app (Vercel / Cloudflare Pages / Netlify; custom domain?).
8. **Supabase region:** Mumbai (`ap-south-1`) — confirm. Free tier is enough to start.
9. **App name, package id** (`in.zwallet.app`?) and **brand color** preference (DESIGN.md
   proposes one).
10. **Play Store:** go for the SMS permission declaration, or ship `lite` on Play and sideload
    `sms` for yourself?
11. **App lock** on by default?
12. **Historical data:** any existing spreadsheets/exports to import (format)?
