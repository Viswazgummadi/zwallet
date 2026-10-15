# 0010 — Deterministic ids for SMS-sourced transactions

- Status: accepted
- Date: 2026-10-15

## Context
The same bank SMS can be ingested more than once:
- on two phones running zwallet
- after a reinstall followed by a fresh historical import
- after a SIM or SMS-backup migration to a new phone

With random UUIDv7 ids, each ingestion creates a distinct row. Dedup heuristics (reference
number, then account + amount + ±10 min) run only against rows a device already has locally, so
duplicates created before a sync would both reach the server.

## Decision
- A transaction created from an SMS gets a **UUIDv8** derived from
  `SHA-256("sms:v1|" + normalizedSender + "|" + hex(SHA-256(normalizedBody)) + "|" + date_sent_epoch_seconds)`.
  Take the first 128 bits, set version 8 and the RFC 9562 variant.
  - `normalizedSender` strips the DLT operator prefix and the `-S/-T/-P` suffix and upper-cases
    the result.
  - `normalizedBody` trims and collapses whitespace.
  - `date_sent` is the SMS's sent timestamp (preserved by SMS backup/restore), falling back to the
    received time.
- The same SMS on any device produces the same id, so sync merges it as one row (field-group LWW,
  ADR 0009) instead of duplicating it.
- `sms_index` (local only) stores the same fingerprint, which also makes historical import
  idempotent (AC-5.2.2).
- Manually created and imported rows keep UUIDv7.
- The scheme carries a version prefix (`sms:v1`). If normalization ever changes, old ids stay
  valid. New ones use `v2`, and dedup still catches cross-version duplicates by reference number.

## Consequences
- No duplicates across devices or reinstalls, without any server-side dedup logic.
- The id embeds no user data. It is a one-way hash of content that already stays on the device.
- **Cross-user collision** would need two users with an identical sender, a byte-identical body
  (including a 12-digit RRN and account last-4) and the same second. We accept that as negligible.
  If it ever happens, RLS makes the upsert fail. `sync_push` reports it in `rejected` and never
  overwrites.
- Unit tests pin the derivation with shared vectors in `packages/contracts/fixtures/uuid.json`, so
  Kotlin and any later JS parser agree.

## Alternatives considered
- **UUIDv7 plus server-side fuzzy dedup.** Ambiguous for legitimate repeats (two coffees), and it
  puts parsing semantics on the server.
- **Include `user_id` in the hash.** Unavailable in offline-only mode before sign-in, so rows
  would need re-keying at merge time.
