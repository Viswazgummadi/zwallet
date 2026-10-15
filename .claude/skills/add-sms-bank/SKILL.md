---
name: add-sms-bank
description: Add or improve SMS parsing support for a bank, card, wallet or UPI app, with fixtures and accuracy report.
argument-hint: "<institution name>"
---

Add/improve SMS support for: $ARGUMENTS

1. Look in `packages/sms-rules/` for existing senders/templates for this institution.
2. Gather fixtures: ask me to export anonymized samples with the debug fixture exporter
   (ARCH §6.6) if we have fewer than 3 per message kind. Cover: debit (UPI, card, netbanking,
   auto-debit), credit, refund/reversal, failed/declined, OTP, promo, mandate "will be debited",
   card statement/bill due, balance-only.
3. Add sender ids to `senders.json`; write templates in `templates/<institution>.json` with named
   groups; bump the file version.
4. Add fixtures to `fixtures/<institution>.jsonl` including negatives.
5. Run `./gradlew :core:smsparser:test` (`.\gradlew.bat` in PowerShell) and `pnpm --filter @zwallet/sms-rules report`. Paste the
   before/after accuracy table. 100% on the new institution's fixtures; no regressions elsewhere.
6. Add merchant/VPA mappings discovered to `packages/contracts/seed/merchants.json` if generic.
