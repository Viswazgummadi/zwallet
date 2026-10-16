# 0018 — Merge input hardening and convergence of every column

- Status: accepted
- Date: 2026-10-16

## Context
The M0 review found ways a `.zwallet` file could make copies diverge, or make an import fail
partway through:

- **Malformed input.** The reference merge (the oracle behind `merge.json`), TS and Kotlin
  disagreed on malformed input: an empty `field_hlc`, a missing column, a non-hex stamp, or a group
  named `constructor`. The vectors could not catch it because the oracle was the loosest of the
  three.
- **Immutable columns.** Columns in no merge group were assumed "equal on every copy by
  construction". That is false for `transactions.external_ref`, which is parser output: two
  app versions can extract different references from the same SMS.
- **UNIQUE index.** `UNIQUE (external_ref, account_id)` can reject an otherwise valid file. Two
  different ids can share a reference (ADR 0010 expects exactly that for `sms:v1`/`v2` ids, and
  for manual rows with a typed reference). Inside one import transaction, that rejection blocks
  the whole file forever.
- **Large integers.** Integers above 2^53 are rounded by `JSON.parse` on the web but kept exact by
  Kotlin, so the two apps silently read different values.
- **Far-future clocks.** A single far-future HLC, from a device with a wrong clock or from a crafted
  file, wins every later merge. It also pushes the receiver's clock past its maximum, after which
  no local write can succeed.
- **Preview counts.** The import preview classified rows by comparing every column, including
  `created_at`/`updated_at`/stamps. The first phone↔web exchange would report all ~100 seeded
  categories as "updated".

## Decision
1. **Strict, identical validation in all three implementations.**
   - A `field_hlc` must be a JSON object, and each value must match exactly
     `^\d{13}-[0-9a-f]{4}-[0-9a-f]{8}$`. A missing group key still means `""` (ADR 0017).
   - A row missing a schema column is an error.
   - Unknown groups are looked up with own-property semantics, never via the prototype chain.
   - Error vectors (`expected: { error: … }`) in `merge.json` pin the behaviour. The reference
     implementation is at least as strict as the apps.
2. **`transactions.external_ref` joins a merge group `ref`** (LWW). A re-parse with newer rules,
   or a user correction, can then propagate.
3. **Every remaining `x-immutable` column converges deterministically.** If two copies differ, the
   merged value is the greater one under the merge tie-break order (null < integer < string; strings
   by UTF-16 code unit). This is commutative and idempotent, and it is not logged as a conflict.
4. **No UNIQUE index on user-data tables** except where the indexed columns fully determine the
   row's deterministic id (today only `transaction_tags (transaction_id, tag_id)`, which matches
   `tt:v1` ids). A meta-test enforces this. Duplicate references are an app-level dedup and Review
   concern, never a constraint that can block an import.
5. **Safe integers only.**
   - Every integer property in the row, payload and envelope schemas is bounded to
     ±(2^53 − 1).
   - The M1 payload codec additionally rejects non-plain-digit integers (`1.0`, `1e2`) before
     `JSON.parse` / `kotlinx.serialization` sees them.
6. **HLC hygiene.**
   - Row `hlc` and payload `max_hlc` carry the exact HLC pattern.
   - The importer derives the file's max stamp from the rows themselves and refuses a file whose
     `max_hlc` disagrees.
   - `receive()` refuses a remote wall clock more than **24 hours ahead** of the device's clock
     (`clock_ahead`). Import then shows: "This file was made on a device whose clock is ahead.
     Fix the date and time on that device and export again." Nothing changes.
   - Both platforms' `now()` fail closed past the maximum wall time.
7. **Outcomes reflect what the user would call a change.**
   - Merge results carry an outcome computed from merge-group values only:
     - `inserted`: a live row that is new locally;
     - `inserted_deleted`: a tombstone that is new locally. It is not shown as "new".
     - `updated`;
     - `deleted`;
     - `restored`;
     - `unchanged`.
   - A separate `write` flag tells the importer to persist stamp- or meta-only changes even when
     the outcome is `unchanged`.

## Consequences
- The vectors now also prove that bad input is rejected identically on both platforms. Any
  divergence between the oracle and an app fails CI.
- A file from a device with a badly wrong clock is refused with a clear message instead of
  silently "winning" forever. A clock up to 24 h ahead is tolerated, which is the normal HLC
  behaviour.
- Duplicate-reference handling moves to the SMS engine (M2) and the Review queue, where the user
  can see it.
- Schema v1 changed in place (ADR 0016): `ref` group, non-unique `transactions_external_ref`,
  integer bounds, and HLC/UUID/currency patterns.

## Alternatives considered
- **Keep immutables and trust construction.** Already false for `external_ref`, and a crafted
  file breaks it anyway.
- **Resolve a UNIQUE collision during merge (e.g. drop the newer row).** That hides data loss
  inside an import, and both copies would have to pick the same victim.
- **Clamp far-future stamps instead of refusing.** Clamping rewrites stamps, so different devices
  would clamp differently and convergence breaks.
