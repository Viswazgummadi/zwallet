# 0003 — Money as integer minor units + ISO currency

- Status: accepted
- Date: 2026-10-15

## Context
Binary floating point can't represent 0.1 exactly, and sums drift. Analytics must be identical
byte for byte across Kotlin, TypeScript and SQL (golden fixtures, ADR 0007).

## Decision
Every amount is stored and computed as an integer number of minor units (paise for INR), with an
ISO-4217 currency code:
- `bigint` in Postgres
- `Long` in Kotlin
- a safe-integer `number`, branded `Minor`, in TypeScript (`bigint` where a sum could exceed 2^53)

Parsing goes `BigDecimal` → `Long` on Android and goes through the `Money` helpers on web.
Formatting happens only at the display edge. Expressions in quick-add are evaluated in minor
units. Foreign-currency card spends keep `original_amount_minor` and `original_currency`.

## Consequences
- Sums are exact, and parity tests are possible.
- Hooks (`money-guard.sh`) and lint reject `Double`/`Float`/`parseFloat`/`toFixed` on money.
- Percentages and ratios (savings rate, z-scores) are derived values, computed from integers at
  the final step.
- Currencies with 0 or 3 minor digits need an exponent table in `Money`.

## Alternatives considered
- **Decimal types (`numeric`, `BigDecimal` everywhere).** Slower, and JS has no native decimal,
  so parity is harder.
- **Floats with rounding.** Rejected outright.
