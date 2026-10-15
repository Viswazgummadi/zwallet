# 0013 — File-based transfer: the encrypted `.zwallet` format and merge-on-import

- Status: accepted
- Date: 2026-10-15

## Context
With no server (ADR 0012), the owner wants to export data from the phone, open it in the web
UI on a laptop, analyze and **edit** it there, then bring those edits back to the phone. The
file will sit in Downloads, travel over USB or a messenger, and maybe land in a personal cloud
drive, so it must be protected. Edits can happen on both sides between transfers.

## Decision
- **One file type, `.zwallet`**, used for both backup and transfer. It holds a full snapshot of
  every user-data table, **including tombstones**. It never contains raw SMS text, `sms_index`,
  undo history, conflict logs, caches or device preferences. Format: ARCHITECTURE §5.3.
- **Encryption is mandatory:**
  - Key derivation: PBKDF2-HMAC-SHA256, 600,000 iterations, a random 16-byte salt per file.
  - Cipher: AES-256-GCM with a random 12-byte IV.
  - The JSON envelope (format, KDF and cipher parameters, app version) is bound as AAD, so any
    tampering fails authentication.
  - The payload is gzip-compressed JSON.

  Everything uses platform crypto only (`javax.crypto` on Android, WebCrypto in the browser).
  Passwords must be at least 10 characters. There is no recovery.
- **Import is a merge, not a restore.** Rows merge per field group by HLC (ADR 0009). Tombstones
  are sticky. Local clocks advance past the file's `max_hlc`. The import runs in one transaction,
  preceded by:
  - a dry-run preview: new, updated, deleted, conflicts;
  - a DB snapshot, so **Undo import** works.

  The same code path serves phone→laptop, laptop→phone, and restoring onto a fresh install.
- **Tombstones are never purged.** After the 30-day Trash window they are compacted (payload
  cleared; id, clocks and `deleted_at` kept), so an old file can't resurrect deleted rows.
- **Seeded rows have fixed ids** (categories, merchants, system tags), so independently seeded
  copies merge cleanly.
- **Versioned:** `format_version` covers the envelope and `schema_version` the data. Newer files
  are refused with "update the app"; older files are upgraded in memory.
- **Cross-platform vectors:** `packages/contracts/fixtures/backup/*.zwallet` and `merge.json`
  are checked by both Kotlin and TypeScript test suites in CI.

## Consequences
- Laptop edits are first-class, and the conflict semantics are exactly those of the earlier sync
  design. ADR 0009 and 0010 are kept as-is; only their transport changed.
- The user must move files and remember the password. If the same field is edited on both sides
  between transfers, the later edit wins and the other value goes to the conflict log ("Use this
  value").
- Export and import must stream to stay within the memory budget at 50k transactions
  (ARCHITECTURE §9).
- Files are full snapshots, not deltas. That's simpler and self-contained. Size is roughly 3–5 MB
  compressed for 50k transactions, which is acceptable.
- PBKDF2 rather than Argon2: Argon2 would need a WASM or native library on both platforms (a
  dependency, and its own ADR). PBKDF2 at 600k iterations meets OWASP 2023 guidance. We can
  revisit with `format_version: 2`.

## Alternatives considered
- **Read-only web viewer.** Simpler, but the owner wants to edit on the laptop.
- **Delta/changes-since files.** Smaller, but fragile (missing files break the chain) and they
  need per-peer cursors.
- **Plain SQLite DB file copy.** Can't merge, and isn't encrypted.
- **Optional encryption.** One unencrypted export in Downloads is a full financial history leak.
  CSV export still exists for spreadsheets, with a warning.
