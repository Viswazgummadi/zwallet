---
paths:
  - "apps/android/core/smsparser/**"
  - "apps/android/feature/sms/**"
  - "packages/sms-rules/**"
---

# SMS engine rules

- Parser is pure Kotlin, deterministic, no I/O. Templates are data in `packages/sms-rules`.
- Every new or changed template ships with ≥ 3 anonymized fixtures (positive) and ≥ 1 negative
  (OTP/promo/failed lookalike). Run the accuracy report; it must not drop for any institution.
- Regexes must be bounded (no nested unbounded quantifiers); input capped at 2,000 chars.
- Amount parsing: string → `BigDecimal` → minor-unit `Long`. Never `toDouble()`.
- Fixtures must contain no real names, account digits, refs, or VPAs (use the anonymizer).
- Live receiver path does zero work for non-financial senders and finishes in ≤ 50 ms.
