# 0010 — Deterministic ids for SMS-sourced transactions

- Status: accepted (still required under local-only, ADR 0012)
- Date: 2026-10-15

## Context
The same bank SMS can be ingested more than once:
- after a reinstall followed by a fresh historical import
- after restoring from a `.zwallet` file and then re-running the SMS import
- on a second phone whose data is later merged by file (ADR 0013)
- after an SMS-backup restore on a new phone

With random UUIDv7 ids, each ingestion creates a distinct row, and merging those copies would
show the same payment twice. Dedup heuristics (reference number, then account + amount
+ ±10 min) are fuzzy and can't safely run across merges.

## Decision
- A transaction created from an SMS gets a **UUIDv8** derived from
  `SHA-256("sms:v1|" + normalizedSender + "|" + hex(SHA-256(normalizedBody)) + "|" + date_sent_epoch_seconds)`.
  Take the first 128 bits, set version 8 and the RFC 9562 variant.
  - `normalizedSender` strips the DLT operator prefix and the `-S/-T/-P` suffix and upper-cases
    the result.
  - `normalizedBody` trims and collapses whitespace.
  - `date_sent` is the SMS's sent timestamp (preserved by SMS backup/restore), falling back to the
    received time.
- The same SMS on any device or install produces the same id, so a file import merges it into
  one row (field-group LWW, ADR 0009) instead of duplicating it.
- `sms_index` (device-local) stores the same fingerprint, which also makes historical import
  idempotent (AC-5.2.2).
- Manually created rows keep UUIDv7. Seeded rows use the same UUIDv8 scheme with a `seed:v1|`
  prefix (ADR 0013).
- The scheme carries a version prefix (`sms:v1`). If normalization ever changes, old ids stay
  valid. New ones use `v2`, and dedup still catches cross-version duplicates by reference number.

## Consequences
- No duplicates across reinstalls, restores or merged copies, without fuzzy matching.
- The id embeds no readable data. It is a one-way hash of content that stays on the device, and
  `.zwallet` files never contain the SMS body.
- Unit tests pin the derivation with shared vectors in `packages/contracts/fixtures/uuid.json`, so
  Kotlin and any later JS parser agree.

## Alternatives considered
- **UUIDv7 plus fuzzy dedup at merge time.** Ambiguous for legitimate repeats (two coffees at the
  same café).
- **Including an install id in the hash.** That would defeat the purpose (same SMS, different
  installs).
