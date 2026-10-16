# zwallet — Architecture

How the system is built. The *what* lives in `SPEC.md`; the *look* in `DESIGN.md`.

> **2026-10-15 — local-only redesign (ADR 0012, 0013).** zwallet has **no backend, no accounts and
> no network access**. The Android app is the primary device; the web app is a static, offline
> PWA. Data moves between them only through an **encrypted `.zwallet` file** that the user
> exports and imports, and import merges with the same per-field rules that a sync server
> would have used (ADR 0009).

---

## 1. System overview

```
 ┌──────────────── Android (Kotlin/Compose) — no INTERNET permission ────────┐
 │ SMS receiver ─► smsparser (pure Kotlin) ─┐                                 │
 │ Quick add / UI ─► ViewModels ─► Repos ───┼─► Room/SQLite + FTS5 + daily_agg│
 │ Glance widgets, QS tile                  │                                 │
 │ WorkManager: reminders, SMS import       │                                 │
 │ TransferEngine: export ▸ encrypt ▸ file  │   import ▸ decrypt ▸ merge      │
 └───────────────────────────┬──────────────────────────────────────────────┘
                             │  zwallet-2026-10-15.zwallet  (user moves it: USB, Nearby Share,
                             │  their own cloud drive… zwallet itself never uploads anything)
                             ▼
 ┌──────── Web (React/Vite PWA on GitHub Pages; offline after first load) ───┐
 │ UI (routes) ◄─► TanStack Query ◄─ Comlink ─► Web Worker: SQLite-WASM (OPFS)│
 │                                              + same analytics SQL          │
 │ TransferEngine (TS): import ▸ decrypt ▸ merge · export ▸ encrypt ▸ download│
 └───────────────────────────────────────────────────────────────────────────┘
 Shared repo packages: contracts (client schema, backup format, merge/crypto/money vectors,
 analytics SQL, golden fixtures, seeds) · design-tokens · sms-rules
```

Key idea: **two independent local apps on the same SQLite schema, joined by a file.** Each
device is complete on its own; a `.zwallet` file is a full snapshot that can be merged into any
other copy any number of times, in any order, and every copy converges.

---

## 2. Stack decisions (summaries — full ADRs in `docs/adr/`)

| Decision | Why | Rejected |
|---|---|---|
| Native Kotlin + Compose for Android | Best battery/perf, first-class SMS/WorkManager/Glance/Baseline Profiles, Material 3 Expressive | Flutter / React Native (extra runtime, weaker SMS/background story) |
| Local-only, no backend (ADR 0012) | Strongest privacy promise (OS-enforced: no INTERNET permission); zero ops; anyone can fork and run it | Supabase sync (ADR 0004, superseded); self-hosted server |
| File-based transfer with merge (ADR 0013) | Laptop analysis + edits without a server; reuses per-field LWW (ADR 0009) | Read-only viewer (no laptop edits); LAN sync (needs network permission) |
| Vite + React SPA (PWA) on GitHub Pages | Static, free, offline after first load; data never leaves the browser | Next.js (SSR unused); Electron (heavy) |
| SQLite on both apps (Room / SQLite-WASM on OPFS) | Analytics SQL written once; FTS5 everywhere; 50k-row aggregations in ms | IndexedDB/Dexie (no SQL) |
| UUIDv7 ids; UUIDv8 for SMS rows (ADR 0010) | Offline creation; idempotent SMS re-import and cross-file merge | Integer autoincrement (collides across copies) |
| Integers for money (ADR 0003) | Exactness | Decimal floats |
| No third-party SDKs (ADR 0006) | Privacy promise | Crashlytics, Sentry SaaS |
| GPL-3.0-only + DCO (ADR 0014) | Forks stay open and keep the author's credit | MIT/Apache (closed forks allowed) |

---

## 3. Repository layout

```
zwallet/
├─ MASTER_PROMPT.md  CLAUDE.md  README.md  LICENSE  NOTICE  AUTHORS  CONTRIBUTING.md
├─ docs/  SPEC.md ARCHITECTURE.md DESIGN.md PLAYBOOK.md OPEN_QUESTIONS.md CHANGELOG.md adr/
├─ apps/
│  ├─ android/
│  │  ├─ settings.gradle.kts  gradle/libs.versions.toml  build-logic/ (convention plugins)
│  │  ├─ branding.properties      # app name, applicationId, brand seed — the one file a fork edits
│  │  ├─ app/                     # single build (no flavors), no INTERNET permission
│  │  ├─ core/model               # pure Kotlin: Money, ids, HLC, domain types
│  │  ├─ core/database            # Room, DAOs, FTS, aggregates triggers, migrations
│  │  ├─ core/data                # repositories (stamp HLCs), rule engine, use cases
│  │  ├─ core/transfer            # backup format, crypto, export/import, merge (pure Kotlin + Room adapter)
│  │  ├─ core/smsparser           # pure Kotlin (KMP-ready: jvm + js), rules loader, engine
│  │  ├─ core/analytics           # runs contracts SQL, forecast/bootstrap, insights rules
│  │  ├─ core/designsystem        # generated tokens, theme, components
│  │  ├─ core/charts              # Compose Canvas chart library
│  │  ├─ core/testing             # fakes, fixtures loaders
│  │  ├─ feature/{onboarding,home,transactions,quickadd,review,insights,people,accounts,budgets,recurring,settings,transfer}
│  │  ├─ feature/sms              # receiver + import worker
│  │  ├─ widget/                  # Glance widgets + QS tile
│  │  ├─ benchmark/  baselineprofile/
│  └─ web/
│     ├─ src/app (routes)  src/features/*  src/db (worker, migrations, queries)
│     ├─ src/transfer  src/charts  src/ui (design system)  src/lib (money, hlc, search grammar)
│     └─ e2e/ (Playwright)
├─ packages/
│  ├─ contracts/   sql/client-schema.sql  sql/analytics/*.sql  schema/*.json (rows + backup envelope)
│  │               fixtures/ (money, hlc, uuid, merge, backup/*.zwallet)  expected/
│  │               seed/{categories,merchants}.json  search-grammar.md
│  ├─ design-tokens/  tokens.json  build.ts → generates Kotlin + CSS
│  └─ sms-rules/      senders.json  templates/*.json  merchants-vpa.json  fixtures/*.jsonl  report.ts
├─ scripts/verify.mjs
├─ .github/workflows/  android.yml web.yml contracts.yml pages.yml release.yml dco.yml
└─ .claude/  (agents, skills, rules, hooks, settings.json)
```

---

## 4. Data model

### 4.1 Conventions (every user-data table)
`packages/contracts/sql/client-schema.sql` is the **canonical schema** (SQLite). Room entities
match it (a test diffs Room's exported schema JSON against it); the web worker applies it as-is.

| Column | SQLite type | Notes |
|---|---|---|
| `id` | `TEXT` | UUIDv7 (client-generated); UUIDv8 from the SMS fingerprint for SMS rows (ADR 0010) |
| `hlc` | `TEXT` | Hybrid logical clock of the last write = max over `field_hlc` |
| `field_hlc` | `TEXT` (JSON) | `{merge_group: hlc}` — per-field-group LWW key (ADR 0009) |
| `created_at`, `updated_at` | `INTEGER` | epoch ms, set locally |
| `deleted_at` | `INTEGER NULL` | Tombstone. **Never purged** — compacted (payload re-stamped to `x-compact` values) once out of Trash (§5.5, ADR 0019) |

There is no `user_id`: each install is one person's book. Integers are bounded to ±(2^53 − 1) in
every row schema so web and Android read identical values (ADR 0018). Money: `amount_minor INTEGER NOT NULL
CHECK (amount_minor > 0)`, `currency TEXT NOT NULL DEFAULT 'INR'` (ISO-4217).

### 4.2 Canonical schema (abridged — implement fully in M0)

```sql
-- every table below also has: id TEXT PRIMARY KEY, hlc TEXT NOT NULL,
-- field_hlc TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
-- deleted_at INTEGER

profile(            -- single row, id = 'me'
  display_name TEXT, default_currency TEXT NOT NULL DEFAULT 'INR',
  month_start_day INTEGER NOT NULL DEFAULT 1 CHECK (month_start_day BETWEEN 1 AND 28),
  my_vpa TEXT, prefs TEXT NOT NULL DEFAULT '{}')

accounts(name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bank','credit_card','cash','wallet','upi_lite','other')),
  institution TEXT, last4 TEXT, color_token TEXT, opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR', card_cycle_day INTEGER, card_due_day INTEGER,
  credit_limit_minor INTEGER, balance_snapshot_minor INTEGER, balance_snapshot_at INTEGER,
  archived INTEGER NOT NULL DEFAULT 0)

categories(parent_id TEXT REFERENCES categories, name TEXT NOT NULL, icon TEXT NOT NULL,
  color_token TEXT NOT NULL,
  counts_as TEXT NOT NULL CHECK (counts_as IN ('spend','savings','income','excluded')),
  sort_order INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, system_key TEXT)

merchants(name TEXT NOT NULL, logo_key TEXT, default_category_id TEXT REFERENCES categories,
  aliases TEXT NOT NULL DEFAULT '[]', vpa_patterns TEXT NOT NULL DEFAULT '[]')

transactions(
  type TEXT NOT NULL CHECK (type IN ('expense','income','transfer','refund')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), currency TEXT NOT NULL DEFAULT 'INR',
  original_amount_minor INTEGER, original_currency TEXT,
  occurred_at INTEGER NOT NULL, occurred_tz TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  account_id TEXT REFERENCES accounts, category_id TEXT REFERENCES categories,
  merchant_id TEXT REFERENCES merchants, counterparty_raw TEXT,
  note TEXT CHECK (length(note) <= 500),
  payment_method TEXT NOT NULL DEFAULT 'other', source TEXT NOT NULL DEFAULT 'manual',
  review_state TEXT NOT NULL DEFAULT 'confirmed' CHECK (review_state IN ('confirmed','needs_review')),
  external_ref TEXT, refund_of_id TEXT REFERENCES transactions,
  transfer_peer_id TEXT REFERENCES transactions,
  split_group_id TEXT, my_share_minor INTEGER, recurring_series_id TEXT)
-- indexes: (occurred_at DESC) WHERE deleted_at IS NULL;
--          (external_ref, account_id) WHERE external_ref IS NOT NULL AND deleted_at IS NULL
--          (not UNIQUE: user-data tables have no UNIQUE index unless it matches a deterministic id,
--          so a valid file can always be imported — ADR 0018)

tags(name TEXT NOT NULL, color_token TEXT, system_key TEXT /* e.g. 'reimbursable' */)
transaction_tags(transaction_id TEXT NOT NULL REFERENCES transactions, tag_id TEXT NOT NULL REFERENCES tags)

people(display_name TEXT NOT NULL,
  phone_hash TEXT /* 'v1:<salt hex32>:<sha256 hex64>', per-person salt (ADR 0021) */,
  vpa TEXT, contact_lookup_key TEXT, avatar_color_token TEXT)

ledger_entries(person_id TEXT NOT NULL REFERENCES people,
  kind TEXT NOT NULL CHECK (kind IN ('lent','borrowed','repaid_to_me','repaid_by_me')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0), currency TEXT NOT NULL DEFAULT 'INR',
  occurred_at INTEGER NOT NULL, due_on TEXT, note TEXT, transaction_id TEXT REFERENCES transactions,
  split_group_id TEXT)

-- also: rules, budgets, recurring_series, upcoming_items, saved_filters, insight_dismissals,
-- attachments — same conventions. Define them in M0 even if features land later.
```

**Seeded rows have fixed ids.** Default categories, merchants and system tags come from
`packages/contracts/seed/*.json` with ids committed in the seed file (UUIDv8 of
`"seed:v1|" + system_key`), so two copies that were each seeded independently merge into one row
per category instead of duplicating. The `profile` row always has `id = 'me'`.

Foreign keys are **not enforced on import order** (`PRAGMA defer_foreign_keys = ON` inside the
import transaction) so a file can be applied table by table.

### 4.3 Device-local tables (never exported)

| Table | Purpose |
|---|---|
| `device_state(key, value)` | HLC node id, last HLC, last export/import times, schema version |
| `op_log` | Undo stack: `(op_id, ts, label, inverse_ops_json)` |
| `transactions_fts` (FTS5, external content) | Search over merchant name, note, counterparty, tags |
| `daily_agg(day, account_id, category_id, merchant_id, type, counts_as, sum_minor, n)` | Analytics cache, maintained by triggers; rebuilt after import |
| `sms_index` (Android) | `(sms_id, fingerprint, received_at, status, kind, confidence, parsed_json, raw_body NULL, transaction_id)` |
| `conflict_log` | Field groups that lost a merge, with the losing values, for "Use this value" |
| `import_log` | Each import: file id, exported_at, source node, counts, snapshot path (for Undo import) |

---

## 5. Transfer: export, import, merge (ADR 0013)

### 5.1 Clocks
**HLC** string `"{wall_ms:013d}-{counter:04x}-{node:8 hex}"` — lexicographic order = causal-ish
order. `now()`: `wall = max(local_ms, last.wall)`; if equal increment counter. After an import,
`last = max(last, max hlc seen in the file)`, so later local edits always sort after what was
imported. Node id = random per install, stored in `device_state`.

### 5.2 Local writes
The repository layer (never UI) stamps a fresh HLC on every **merge group** it touches and sets
`hlc = max(field_hlc)`. Merge groups per table are declared once in
`packages/contracts/schema/<table>.json` (`x-merge-groups`); e.g. `transactions`:
`amount{amount_minor,currency,original_amount_minor,original_currency}`, `type`,
`when{occurred_at,occurred_tz}`, `account`, `category`, `merchant{merchant_id,counterparty_raw}`,
`note`, `method`, `review`, `ref{external_ref}`,
`links{refund_of_id,transfer_peer_id,split_group_id,my_share_minor}`, `recurring`, `deleted`.
Columns in no group (`id`, `created_at`, `x-immutable` such as `source`) never change locally; if
two copies disagree, the merge keeps the greater value under the tie-break order so copies still
converge (ADR 0018). Codegen turns the JSON into Kotlin and TS constants.

### 5.3 The `.zwallet` file
```
envelope (UTF-8 JSON, not secret):
{ "format": "zwallet-backup", "format_version": 1,
  "kdf": { "name": "PBKDF2-HMAC-SHA256", "iterations": 600000, "salt": "<b64 16B>" },
  "cipher": { "name": "AES-256-GCM", "iv": "<b64 12B>" },
  "created_by": { "app": "zwallet-android|zwallet-web", "app_version": "1.2.0" },
  "ciphertext": "<b64>" }               -- AAD = canonical JSON of every envelope field above

plaintext = gzip(JSON):
{ "schema_version": 1, "exported_at": <epoch ms>, "source_node": "<hlc node>",
  "max_hlc": "<hlc>", "tables": { "<table>": [ {row}, ... ], ... } }
```
- **Contents:** every user-data table (§4.2), tombstones included. **Never** `sms_index`, raw SMS
  text, `op_log`, `conflict_log`, `daily_agg`, or device prefs (app lock, notification settings).
  Receipt images only if the user ticks "Include receipt photos" (then base64 in an
  `attachments_blobs` table inside the same encrypted payload).
- **Crypto:** PBKDF2-HMAC-SHA256 (600k iterations, per-file random salt) → AES-256-GCM. Both are
  native on Android (`javax.crypto`) and in browsers (WebCrypto) — no crypto dependency.
  Password ≥ 10 characters with a strength hint; there is no recovery.
- **Limits:** reject files > 200 MB or plaintext > 1 GB decompressed (zip-bomb guard); validate
  every row against `packages/contracts/schema/<table>.json` before touching the DB. Integers must
  be plain digits within ±(2^53 − 1); every `hlc`/`field_hlc` stamp must match the exact HLC
  pattern; `max_hlc` must equal the max stamp in the rows (ADR 0018).
- **Versioning:** a file with `schema_version` newer than the app's is refused ("Update zwallet to
  open this file"); older ones are upgraded in memory by the same migration steps as the DB.
- Shared vectors `packages/contracts/fixtures/backup/*.zwallet` (known password) prove that a file
  written by Kotlin decrypts and merges identically in TS and vice versa.

### 5.4 Import = merge
1. Decrypt (wrong password / tampering → GCM auth failure → nothing changes), validate, upgrade.
   A file whose clock is more than 24 h ahead of this device is refused (`clock_ahead`, ADR 0018).
2. **Preview** (dry run in memory): counts of new rows, updated rows, rows deleted by the file,
   field conflicts, and rows unchanged. Outcomes come from merge-group values only, so stamp- or
   meta-only differences count as unchanged and tombstones new to this device are not "new"
   (`inserted | inserted_deleted | updated | deleted | restored | unchanged` + a `write` flag).
   User confirms.
3. **Snapshot** the DB (`VACUUM INTO` a file in app-private storage; web: an OPFS copy) → enables
   **Undo import** (kept until the next import or 7 days).
4. In **one SQLite transaction**, for each incoming row:
   - absent locally → insert;
   - present → for each merge group `g`: take incoming values iff
     `incoming.field_hlc[g] > local.field_hlc[g]` (missing = `''`); losers go to `conflict_log`;
     `field_hlc` = per-group max; `hlc` = max of that.
   - **Tombstones are sticky:** only the `deleted` group can change `deleted_at`, so a later field
     edit never resurrects a deleted row; Restore from Trash writes the `deleted` group.
5. Advance the local HLC past `max_hlc`; rebuild `daily_agg` for affected days; refresh FTS.
6. Show the summary with **Undo import**.

A losing group is logged as a conflict only if the winning side had not already seen the losing
stamp (per-node frontiers, ADR 0017); equal stamps break ties by the larger value. Reference
implementation: `packages/contracts/lib/merge-reference.mjs`.

The merge function lives in `core/transfer` (pure Kotlin) and `src/transfer` (TS) and is tested
against `packages/contracts/fixtures/merge.json`.

### 5.5 Trash and tombstones
Deleted rows stay recoverable in Trash for 30 days, then are **compacted** (ADR 0019): every payload
group is re-stamped with one fresh HLC and set to its compacted value (NULL, the SQL default, or
the table's `x-compact` placeholder), while `id`, stamps and `deleted_at` remain forever. The fresh
stamps beat any older copy, so an old file imported months later neither resurrects the row nor
brings its payload back; the job re-runs after each import for rows a newer edit touched.

### 5.6 Invariants (property-tested, both platforms)
- **Convergence:** devices that exchange files in any order and any number of times end with
  identical user-data tables (and identical analytics goldens).
- **Idempotence:** importing the same file twice changes nothing the second time.
- **Field preservation:** concurrent edits to different merge groups of one row both survive.
- **No resurrection:** a deletion carried by any file is never undone by an older edit.
- **Atomicity:** a failed or cancelled import leaves the DB byte-identical to before.

---

## 6. SMS engine (Android)

### 6.1 Modules
- `core/smsparser`: **pure Kotlin**, no Android imports (runs on JVM in unit tests; KMP-ready for a
  JS build later). Input `RawSms(sender, body, receivedAt)` → `ParseResult`.
- `feature/sms`: `SmsReceiver` (manifest, `RECEIVE_SMS`), `HistoricalImportWorker`
  (`READ_SMS`, `Telephony.Sms.Inbox` cursor, batches of 500, checkpointed), `SmsIngestor`
  (persist + dedup + categorize), review inbox UI. Single build — if the user denies SMS
  permission the app runs in manual + paste mode.

### 6.2 Rules as data (`packages/sms-rules`)
```jsonc
// senders.json
{ "SBIUPI": { "bank": "SBI", "kind": "bank" }, "AXISBK": { "bank": "Axis Bank", "kind": "bank" }, ... }

// templates/hdfc.json (one file per institution; versioned)
{
  "institution": "HDFC Bank", "version": 7,
  "templates": [
    {
      "id": "hdfc.upi.debit.v3",
      "kind": "debit",
      "senders": ["HDFCBK"],
      "pattern": "(?i)Sent\\s+(?:Rs\\.?|INR|₹)\\s*(?<amount>[\\d,]+(?:\\.\\d{1,2})?)\\s+From\\s+HDFC Bank A/C\\s+\\*?(?<acct>\\d{4})\\s+To\\s+(?<cp>.+?)\\s+On\\s+(?<date>\\d{2}/\\d{2}/\\d{2})\\s+Ref\\s+(?<ref>\\d{12})",
      "date_format": "dd/MM/yy",
      "fields": { "payment_method": "upi" },
      "confidence": 0.97
    }
  ]
}
```
Fixtures: `fixtures/<institution>.jsonl`, one anonymized SMS per line with `expected` fields.
`report.ts` prints per-institution precision/recall and fails CI below 98% field accuracy.

### 6.3 Engine stages
`SenderFilter` (strip `XX-` prefix and `-S/-T/-P` suffix; DLT suffix `-P` = promotional → drop) →
`Classifier` (keyword + negative-keyword scoring: OTP, "will be debited", "declined",
"reversed", "statement", "cashback offer"…) → `TemplateMatcher` (precompiled regexes grouped by
sender; first high-confidence hit) → `GenericExtractor` fallback (amount/acct/ref/VPA regexes,
lower confidence) → `Normalizer` (amount → minor units via `BigDecimal`→`Long`; dates in
`Asia/Kolkata`; VPA lowercase) → `MerchantResolver` → result.
Then in `SmsIngestor`: derive the deterministic id (ADR 0010:
`UUIDv8(SHA-256("sms:v1|" + sender + "|" + sha256(body) + "|" + date_sent_s))`) → dedup (same id,
then ref, then account+amount+±10 min+direction) → rules engine → upsert → `sms_index` update.
All in one Room transaction.

Wallet handling (SPEC §5.4 step 9): `wallet_load` (UPI Lite / Paytm wallet top-up from a bank
account) → expense, system category *Small UPI payments*; `wallet_spend` → ignored.

Priority institutions for templates/fixtures: **SBI** (`SBIINB`, `SBIUPI`, `ATMSBI`, `CBSSBI`),
**Axis** (`AXISBK`), **Paytm** (`PAYTM`, `iPaytm`) — confirm exact headers from the owner's
exported fixtures (§6.6).

### 6.4 Performance
Regexes compiled once (lazy, per sender group). Target ≤ 1 ms parse per SMS on device; live path
≤ 50 ms total including DB write; historical import streams the cursor (no list materialization).

### 6.5 Privacy
Raw body stored locally **by default (on)** — enables re-parsing after parser upgrades and "Show
message"; the user can turn it off and purge stored bodies in Settings → SMS. Raw bodies are
**never written to a `.zwallet` export** and never logged.
Logs never include SMS bodies, amounts, VPAs, or names (a `Redact` helper + lint rule).

### 6.6 Dev-only fixture exporter
Debug build screen: select SMS → anonymize (replace digits in account/ref with random digits of
the same length, VPAs/names with placeholders, keep structure) → share `.jsonl`. Not in release.

### 6.7 Web parsing (later)
Build `core/smsparser` with Kotlin Multiplatform `js(IR)` target → `packages/sms-parser-js` so
web paste-to-import uses the exact same engine. Stretch goal of M2; otherwise M5.

---

## 7. Analytics engine

1. **Aggregates:** `daily_agg` keyed by local day (`occurred_at` converted with `occurred_tz`),
   account, category, merchant, type, counts_as — maintained by SQLite triggers on insert/update/
   delete of transactions (subtract old, add new). Splits use `my_share_minor`; refunds are
   attributed to the original's day (by default). Rebuilt for affected days after an import.
2. **Queries:** `packages/contracts/sql/analytics/<module>.sql` with named parameters
   (`:from_day`, `:to_day`, `:account_ids`, …). Android runs them via `SupportSQLiteDatabase`
   (results mapped by a small row mapper); web runs them in the worker. Each module returns a
   typed DTO defined in `packages/contracts/schema/analytics/<module>.json`.
3. **Computed in code** (both platforms, mirrored): forecast bootstrap (seeded RNG for
   determinism in tests), anomaly z-scores, recurring detection, insight rules.
4. **Golden tests:** `fixtures/dataset_*.json` (synthetic, 18 months, ~20k txns, generated by a
   seeded script) → `expected/<module>__<params>.json`. Both apps must produce byte-identical
   JSON (stable key order, minor-unit integers).
5. **Caching:** module results memoized by `(module, params, data_version)` where `data_version`
   increments on any write; recomputation is off the main thread and cancellable.

---

## 8. Client architecture

### 8.1 Android
- UDF: `Screen (Compose) ← UiState (StateFlow) ← ViewModel ← UseCases ← Repositories ← Room`.
- Navigation Compose with type-safe routes; predictive back; shared-element transitions
  (list row → detail amount/avatar).
- Lists: Paging 3 over Room; stable keys; `contentType`; immutable UI models (`@Immutable`).
- DI: Hilt. Startup: nothing heavy in `Application`; WorkManager on-demand init.
- **No network:** the merged manifest must not contain `android.permission.INTERNET` (or
  `ACCESS_NETWORK_STATE`); any library that adds it is removed with `tools:node="remove"` and a CI
  check fails the build if it reappears. No HTTP client, no image loader with a network module —
  merchant logos are bundled vectors.
- Files: export/import via the Storage Access Framework (`ACTION_CREATE_DOCUMENT` /
  `ACTION_OPEN_DOCUMENT`, MIME `application/octet-stream`, extension `.zwallet`) and the share
  sheet; no storage permission needed.
- Widgets: Glance (Month spend + Quick add; Today list). QS tile → quick add activity
  (`excludeFromRecents`, translucent theme, opens in < 300 ms).
- Security: BiometricPrompt app lock (`androidx.biometric`), `FLAG_SECURE` toggle;
  `allowBackup=false` and data-extraction rules exclude everything from Google cloud backup and
  device transfer (the `.zwallet` export is the only backup — owner's choice).
- Branding: `branding.properties` (app name, `applicationId`) feeds Gradle; the brand colour is
  `brand.seed` in `packages/design-tokens/tokens.json` (README "Make it your own"), so a fork
  rebrands by editing those two files. Kotlin packages are `dev.zwallet.*` (`in` is a keyword).
- Strict mode in debug; `detekt` + custom lint: no `Double`/`Float` in money packages, no
  `Log.*` with sensitive types.

### 8.2 Web
- All DB work in a **Web Worker** running SQLite-WASM with the `opfs-sahpool` VFS (works without
  cross-origin isolation, so GitHub Pages is fine); exposed via Comlink; TanStack Query wraps
  worker calls; a `BroadcastChannel` invalidates queries across tabs and only one tab (Web Locks
  leader) may write.
- Data lives in the browser's OPFS between visits. First run: "Open a .zwallet file" or "Start
  fresh". Import/merge/export run in the worker (`src/transfer`), files read with `<input
  type=file>`/drag-and-drop and saved via a download (File System Access API when available).
- **No network beyond its own static files:** CSP via `<meta http-equiv>` (GitHub Pages can't set
  headers): `default-src 'self'; connect-src 'self'; script-src 'self' 'wasm-unsafe-eval';
  img-src 'self' data: blob:; style-src 'self'; object-src 'none'; base-uri 'none'`.
- Routes code-split; charts and Sankey lazy-loaded; table virtualized (TanStack Virtual).
- Keyboard-first: command palette (`⌘K` / `Ctrl+K`), shortcuts (DESIGN §6.1).
- PWA: installable, fully offline after first load (precached), update prompt.

---

## 9. Performance & battery budgets (release-blocking)

| Metric | Budget | How measured |
|---|---|---|
| Android cold start (TTID) | ≤ 500 ms P50 on Pixel 6a-class | Macrobenchmark `StartupBenchmark` with Baseline Profile |
| Quick-add from widget to visible | ≤ 300 ms | Macrobenchmark |
| List scroll (50k txns) | P90 frame ≤ 12 ms; 0 frames > 32 ms | `FrameTimingMetric` |
| Insights first render (50k) | ≤ 300 ms to first module, ≤ 800 ms all visible modules | trace sections |
| Search (50k) | ≤ 100 ms | unit perf test on device |
| SMS live path | ≤ 50 ms per SMS, no work for non-financial SMS | trace + test |
| Historical import | 10k SMS ≤ 20 s, ≤ 64 MB extra heap | benchmark |
| Export (50k txns) | ≤ 5 s incl. encryption, ≤ 128 MB peak heap (streamed JSON) | benchmark |
| Import + merge (50k txns into 50k) | ≤ 10 s incl. preview, ≤ 128 MB peak heap | benchmark |
| Background | No wakelocks; 0 periodic jobs; 0 alarms when nothing scheduled | `dumpsys batterystats`, `dumpsys jobscheduler` review in M6 |
| APK (per ABI) | ≤ 12 MB | CI size check |
| Web initial JS | ≤ 180 KB gzip | CI bundle check |
| Web LCP / INP | ≤ 1.2 s / ≤ 100 ms (mid laptop, warm cache) | Playwright web-vitals spec |
| Web table (50k) | 60 fps scroll | Playwright trace |
| Web import (50k) | ≤ 8 s in the worker, UI stays responsive | Playwright trace |

---

## 10. Security & privacy
- **Nothing online:** Android has no INTERNET permission (OS-enforced); the web app is static and
  its CSP forbids any connection but its own origin. No accounts, no server, no telemetry.
- Phone numbers stored only as a salted SHA-256 hash with a per-person salt (ADR 0021). This keeps
  plain numbers out of the DB and exports; it is not strong protection against brute force of a
  10-digit space, so a leaked file still relies on its encryption.
- **Web origin isolation:** browser storage is per origin, so the web app must be served from an
  origin used only by zwallet (custom domain or a dedicated org's root site), never a sub-path of a
  shared `<user>.github.io`. The app warns when it detects a shared origin (ADR 0020).
- Web CSP (meta): `default-src 'self'`, `connect-src 'self'`, `form-action 'none'`,
  `base-uri 'none'`, `object-src 'none'`. `frame-ancestors` can't be set from a meta tag, so
  clickjacking protection depends on the host; the app has no one-click destructive actions.
- Export files: AES-256-GCM, PBKDF2-HMAC-SHA256 600k; the password is never stored; the envelope
  is authenticated (AAD) so a tampered header fails.
- Threat model notes:
  - lost phone → app lock + file-based encryption; no cloud copy exists to leak;
  - leaked export file → only as strong as the password (enforce ≥ 10 chars, strength hint);
  - malicious import file → size/decompression caps, schema validation of every row, no code
    execution, single transaction (all or nothing), snapshot + Undo;
  - malicious SMS → bounded regexes, input length caps, no code execution;
  - XSS on web → no `dangerouslySetInnerHTML`, strict CSP;
  - supply chain → pinned dependencies, lockfiles, Dependabot alerts, no new network-capable deps
    without an ADR.
- Secrets in the repo: only the release keystore, which lives in GitHub secrets (never committed;
  hooks block Claude from reading `*.jks`/`keystore.properties`).

---

## 11. Testing strategy

| Layer | Tooling | Must cover |
|---|---|---|
| Money/HLC/grammar | JUnit5 + Kotest property tests; Vitest + fast-check | exact arithmetic, parsing, ordering |
| SMS parser | JVM unit tests over `sms-rules/fixtures` | ≥ 98% field accuracy, all SPEC §5.6 edge cases |
| DB | Room in-memory tests, migration tests (`MigrationTestHelper`); web worker tests | triggers keep `daily_agg` exact |
| Transfer | Kotest/fast-check property tests over random multi-copy edit/exchange histories; shared `merge.json` and `backup/*.zwallet` vectors on both platforms | §5.6 invariants; Kotlin↔TS file compatibility; wrong password/tampered/oversized/newer-schema files rejected without changes |
| Analytics | Golden fixtures on both apps | byte-identical outputs |
| UI | Roborazzi screenshot tests (light/dark, 1.0/2.0 font), Compose UI tests; Playwright e2e + screenshots | every screen state |
| Perf | Macrobenchmark (`:benchmark` StartupBenchmark), Playwright web-vitals spec (cold LCP, max event duration) | §9 budgets |
| Privacy | CI manifest check (no INTERNET); web CSP test; Playwright asserts zero non-origin requests | §10 |

---

## 12. CI/CD (GitHub Actions)
Every workflow invokes `node scripts/verify.mjs <track>` (ADR 0011) so local (Windows) and CI
(Linux) run identical gates; a `windows-latest` smoke job runs `contracts web` to keep it portable.
- `android.yml`: ktlint, detekt, unit tests, Roborazzi verify, assemble debug + release, APK size
  check, **merged-manifest permission check**; nightly: Macrobenchmark on emulator (indicative).
- `web.yml`: tsc, eslint, vitest, build, bundle-size check, Playwright (incl. zero-egress check,
  CSP violation events, and a web-vitals spec for LCP/INP; no Lighthouse dependency).
- `contracts.yml`: JSON schema validation, merge-groups codegen up to date, golden fixtures
  regenerated-and-diffed, cross-platform backup vectors, sms-rules report.
- `pages.yml`: on push to `main`, build `apps/web` and deploy to **GitHub Pages**.
- `release.yml`: on tag `v*`, build the signed release APK (keystore from GitHub secrets), attach
  it with its SHA-256 checksum to a **GitHub Release** (works with Obtainium); attach the web build
  as a zip for self-hosting.
- `dco.yml`: every PR commit must carry `Signed-off-by:` (ADR 0014).

---

## 13. ADRs
0001 local-first with SQLite on both apps · 0002 custom sync protocol *(superseded by 0012/0013)* ·
0003 money as minor units · 0004 Supabase *(superseded by 0012)* · 0005 Android flavors for SMS
policy *(superseded by 0012)* · 0006 no third-party SDKs · 0007 analytics SQL shared via contracts ·
0008 contact picker over READ_CONTACTS · 0009 per-field LWW merge · 0010 deterministic SMS ids ·
0011 cross-platform tooling · 0012 local-only, no network · 0013 file-based transfer & `.zwallet`
format · 0014 GPL-3.0-only + DCO · 0015 bundled Inter subset · 0016 schema v1 editable until
the first release · 0017 conflict detection by per-node frontiers · 0018 merge input hardening ·
0019 tombstone compaction · 0020 web app on a dedicated origin · 0021 per-person phone salt.
