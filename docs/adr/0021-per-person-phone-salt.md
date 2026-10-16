# 0021 — Per-person salt for phone hashes

- Status: accepted (resolves OPEN_QUESTIONS #21)
- Date: 2026-10-16

## Context
People are matched to contacts and UPI counterparties by phone number, stored only as a salted
SHA-256 hash. The salt lived in `profile.phone_hash_salt`. Two fresh installs (the phone, or a web
"Start fresh") each create a different salt. After the first file exchange, `profile` keeps one
salt by LWW, so every phone hash from the other copy stops matching. Rehashing is impossible
because the plain numbers are not stored.

## Decision
- Remove `profile.phone_hash_salt`.
- `people.phone_hash` carries its own salt: `v1:<salt, 32 lowercase hex>:<sha256, 64 lowercase hex>`,
  where `sha256 = SHA-256(salt bytes || normalized E.164 number as UTF-8)`. The schema pins the
  pattern.
- To match a number, hash it with each person's salt. That is a few hundred SHA-256 calls at most,
  which is negligible.

## Consequences
- Phone hashes survive any merge order, and no profile field needs special merge rules.
- The salt only prevents precomputed tables across users. A 10-digit number space can still be
  brute-forced per row, so the real protection for a leaked file remains its encryption (ADR 0013).
  ARCHITECTURE §10 says so plainly.
- Schema v1 changed in place (ADR 0016).

## Alternatives considered
- **Deterministic global salt (constant).** Hashes would match across copies, but would also be
  precomputable for every zwallet user.
- **Pick the salt by a deterministic rule on merge and rehash.** Impossible: the plain numbers
  are not stored.
- **HMAC with a device key.** Not shareable across copies without exporting the key.
