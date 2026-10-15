# zwallet — Architecture

How the system is built. The *what* lives in `SPEC.md`; the *look* in `DESIGN.md`.

---

## 1. System overview

```
 ┌──────────────── Android (Kotlin/Compose) ────────────────┐      ┌──────── Web (React/Vite PWA) ────────┐
 │ SMS receiver ─► smsparser (pure Kotlin) ─┐               │      │ UI (routes) ◄─► TanStack Query       │
 │ Quick add / UI ─► ViewModels ─► Repos ───┼─► Room/SQLite │      │            ▲                         │
 │ Glance widgets, QS tile                  │   + FTS5      │      │            │ Comlink                 │
 │ WorkManager: sync, reminders, import     │   + aggregates│      │  Web Worker: SQLite-WASM (OPFS)      │
 │                       SyncEngine ◄───────┘               │      │            + same analytics SQL      │
 └──────────────┬───────────────────────────────────────────┘      │  SyncEngine (TS)                     │
                │  HTTPS: sync_push / sync_pull RPC                 └───────────────┬─────────────────────┘
                │  Realtime: "ping" on change (foreground only)                     │
                ▼                                                                   ▼
         ┌───────────────────────── Supabase ─────────────────────────────────────────────┐
         │ Auth (Google, email OTP) · Postgres 16 + RLS · RPC: sync_pull, sync_push        │
         │ Triggers: server_version, updated_at · Realtime channel per user · Storage      │
         │ Edge Functions (Deno): delete_account, purge_tombstones (cron)                   │
         └─────────────────────────────────────────────────────────────────────────────────┘
 Shared repo packages: contracts (schemas, analytics SQL, golden fixtures, seeds) · design-tokens · sms-rules
```

Key idea: **two local-first clients on SQLite, one dumb-but-correct sync server.** The server
stores rows and orders changes; clients own the UX, parsing, and analytics.

---

## 2. Stack decisions (summaries — full ADRs in `docs/adr/`)

| Decision | Why | Rejected |
|---|---|---|
| Native Kotlin + Compose for Android | Best battery/perf, first-class SMS/WorkManager/Glance/Baseline Profiles, "Google-tier" feel with Material 3 Expressive | Flutter / React Native (extra runtime, weaker SMS/background story); KMP-everything (web UI still separate; adds build complexity) |
| Vite + React SPA (PWA) for web | Authenticated app, no SEO need; instant dev loop; small bundle; easy static hosting | Next.js (SSR unused, heavier) |
| SQLite on both clients (Room / SQLite-WASM on OPFS) | Write analytics SQL once; FTS5 everywhere; 50k-row aggregations in ms | IndexedDB/Dexie (no SQL, analytics duplicated) |
| Supabase | Postgres + Auth + RLS + Realtime + Edge Functions, generous free tier, SQL-native | Firebase (NoSQL, weak for analytics/relational ledger); custom server (ops burden) |
| Custom pull/push sync over RPC | Full understanding & control, tiny surface, testable; fits single-user multi-device | PowerSync/ElectricSQL (great, but another moving part — revisit if sync gets complex) |
| UUIDv7 client-generated ids | Offline creation, time-ordered, index-friendly | Server serial ids |
| Integers for money | Exactness | Decimal floats |
| No crash/analytics SDKs | Privacy promise | Crashlytics, Sentry SaaS (use Play vitals + local log export) |

---

## 3. Repository layout

```
zwallet/
├─ MASTER_PROMPT.md  CLAUDE.md  README.md
├─ docs/  SPEC.md ARCHITECTURE.md DESIGN.md PLAYBOOK.md OPEN_QUESTIONS.md CHANGELOG.md adr/
├─ apps/
│  ├─ android/
│  │  ├─ settings.gradle.kts  gradle/libs.versions.toml  build-logic/ (convention plugins)
│  │  ├─ app/                     # flavors: sms, lite
│  │  ├─ core/model               # pure Kotlin: Money, ids, HLC, domain types
│  │  ├─ core/database            # Room, DAOs, FTS, aggregates triggers, migrations
│  │  ├─ core/data                # repositories, rule engine, use cases
│  │  ├─ core/sync                # SyncEngine, Supabase client, WorkManager jobs
│  │  ├─ core/smsparser           # pure Kotlin (KMP-ready: jvm + js), rules loader, engine
│  │  ├─ core/analytics           # runs contracts SQL, forecast/bootstrap, insights rules
│  │  ├─ core/designsystem        # generated tokens, theme, components
│  │  ├─ core/charts              # Compose Canvas chart library
│  │  ├─ core/testing             # fakes, fixtures loaders
│  │  ├─ feature/{onboarding,home,transactions,quickadd,review,insights,people,accounts,budgets,recurring,settings}
│  │  ├─ feature/sms              # receiver + import worker (only in `sms` flavor)
│  │  ├─ widget/                  # Glance widgets + QS tile
│  │  ├─ benchmark/  baselineprofile/
│  └─ web/
│     ├─ src/app (routes)  src/features/*  src/db (worker, migrations, queries)
│     ├─ src/sync  src/charts  src/ui (design system)  src/lib (money, hlc, search grammar)
│     └─ e2e/ (Playwright)
├─ supabase/
│  ├─ migrations/  (append-only)   seed.sql   functions/   tests/ (pgTAP)
├─ packages/
│  ├─ contracts/   schema/*.json  sql/analytics/*.sql  sql/client-schema.sql
│  │               fixtures/  expected/  seed/{categories,merchants}.json  search-grammar.md
│  ├─ design-tokens/  tokens.json  build.ts → generates Kotlin + CSS
│  └─ sms-rules/      senders.json  templates/*.json  merchants-vpa.json  fixtures/*.jsonl  report.ts
├─ .github/workflows/  android.yml web.yml supabase.yml contracts.yml
└─ .claude/  (agents, skills, rules, hooks, settings.json)
```

---

## 4. Data model

### 4.1 Conventions (all synced tables)
| Column | Type (PG / SQLite) | Notes |
|---|---|---|
| `id` | `uuid` / `TEXT` | UUIDv7, generated on client |
| `user_id` | `uuid` / `TEXT` | `auth.uid()`; RLS key |
| `hlc` | `text` / `TEXT` | Hybrid logical clock of last client write — LWW key |
| `created_at`, `updated_at` | `timestamptz` / `INTEGER` (epoch ms) | `updated_at` set by server trigger |
| `deleted_at` | `timestamptz null` / `INTEGER null` | Tombstone |
| `server_version` | `bigint` / `INTEGER` | From global sequence, set by trigger on every write |
| (client only) `dirty` | — / `INTEGER` 0/1 | Pending push |

Money: `amount_minor bigint not null check (amount_minor > 0)`, `currency char(3) default 'INR'`.

### 4.2 Canonical Postgres schema (first migration, abridged — implement fully in M0)

```sql
create extension if not exists pgcrypto;
create sequence sync_version_seq;

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text, default_currency char(3) not null default 'INR',
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  my_vpa text, prefs jsonb not null default '{}',
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);

create table accounts (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  name text not null, kind text not null check (kind in ('bank','credit_card','cash','wallet','upi_lite','other')),
  institution text, last4 text, color_token text, opening_balance_minor bigint not null default 0,
  currency char(3) not null default 'INR', card_cycle_day smallint, card_due_day smallint,
  credit_limit_minor bigint, balance_snapshot_minor bigint, balance_snapshot_at timestamptz,
  archived boolean not null default false,
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);

create table categories (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  parent_id uuid references categories, name text not null, icon text not null, color_token text not null,
  counts_as text not null check (counts_as in ('spend','savings','income','excluded')),
  sort_order int not null default 0, archived boolean not null default false, system_key text,
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);

create table merchants (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  name text not null, logo_key text, default_category_id uuid references categories,
  aliases text[] not null default '{}', vpa_patterns text[] not null default '{}',
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);

create table transactions (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('expense','income','transfer','refund')),
  amount_minor bigint not null check (amount_minor > 0), currency char(3) not null default 'INR',
  original_amount_minor bigint, original_currency char(3),
  occurred_at timestamptz not null, occurred_tz text not null default 'Asia/Kolkata',
  account_id uuid references accounts, category_id uuid references categories,
  merchant_id uuid references merchants, counterparty_raw text, note text check (char_length(note) <= 500),
  payment_method text not null default 'other', source text not null default 'manual',
  review_state text not null default 'confirmed' check (review_state in ('confirmed','needs_review')),
  external_ref text, refund_of_id uuid references transactions, transfer_peer_id uuid references transactions,
  split_group_id uuid, my_share_minor bigint, recurring_series_id uuid,
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);
create index on transactions (user_id, occurred_at desc) where deleted_at is null;
create index on transactions (user_id, server_version);
create unique index on transactions (user_id, external_ref, account_id) where external_ref is not null and deleted_at is null;

create table tags (id uuid primary key, user_id uuid not null, name text not null, color_token text, /* sync cols */ hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq'));
create table transaction_tags (id uuid primary key, user_id uuid not null, transaction_id uuid not null references transactions, tag_id uuid not null references tags, /* sync cols */ hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq'));

create table people (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  display_name text not null, phone_hash text, vpa text, contact_lookup_key text, avatar_color_token text,
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);

create table ledger_entries (
  id uuid primary key, user_id uuid not null references auth.users on delete cascade,
  person_id uuid not null references people,
  kind text not null check (kind in ('lent','borrowed','repaid_to_me','repaid_by_me')),
  amount_minor bigint not null check (amount_minor > 0), currency char(3) not null default 'INR',
  occurred_at timestamptz not null, due_on date, note text, transaction_id uuid references transactions,
  split_group_id uuid,
  hlc text not null, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, server_version bigint not null default nextval('sync_version_seq')
);

-- also: rules, budgets, recurring_series, upcoming_items, saved_filters, insight_dismissals,
-- attachments — same sync columns. Define them in M0 even if features land later.

-- One trigger function for every synced table:
create function touch_sync_cols() returns trigger language plpgsql as $$
begin
  new.server_version := nextval('sync_version_seq');
  new.updated_at := now();
  return new;
end $$;
-- create trigger trg_<t>_sync before insert or update on <t> for each row execute function touch_sync_cols();

-- RLS (repeat per table):
alter table transactions enable row level security;
create policy own_rows on transactions using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 4.3 Client SQLite schema
`packages/contracts/sql/client-schema.sql` is the canonical client schema (same columns; epoch-ms
integers for timestamps; `dirty` column). Room entities are generated/handwritten to match and a
test diffs Room's exported schema JSON against it. Client-only tables:

| Table | Purpose |
|---|---|
| `sync_state(key, value)` | `since_version`, last sync times, device node id |
| `op_log` | Undo stack: `(op_id, ts, label, inverse_ops_json)` |
| `transactions_fts` (FTS5, external content) | Search over merchant name, note, counterparty, tags |
| `daily_agg(day, account_id, category_id, merchant_id, type, counts_as, sum_minor, n)` | Analytics cache, maintained by triggers |
| `sms_index` (Android) | `(sms_id, body_hash, received_at, status, kind, confidence, parsed_json, raw_body NULL, transaction_id)` — **never synced** |
| `conflict_log` | Rows that lost LWW, for debugging |

---

## 5. Sync protocol

### 5.1 Clocks
**HLC** string `"{wall_ms:013d}-{counter:04x}-{node:8 hex}"` — lexicographic order = causal-ish
order. `now()`: `wall = max(local_ms, last.wall)`; if equal increment counter. On receiving a
row, `last = max(last, row.hlc)` (advance). Node id = random per install, stored in `sync_state`.

### 5.2 RPCs (Postgres functions, `security invoker`, RLS applies)
```
sync_push(p_changes jsonb) returns jsonb
  -- p_changes: [{ "table": "transactions", "row": {...full row incl. hlc, deleted_at} }, ...] (≤ 500)
  -- For each: upsert where (existing is null) or (incoming.hlc > existing.hlc).
  -- Returns: { "applied": [ids], "stale": [{table, row: current_server_row}] , "server_now": ts }

sync_pull(p_since bigint, p_limit int default 1000) returns jsonb
  -- Returns rows from all synced tables with server_version > p_since ordered by server_version,
  -- { "changes": [{table, row}], "next_since": bigint, "has_more": bool, "min_client_version": int }
```
Table allowlist in the function; unknown tables rejected. Row JSON validated against
`packages/contracts/schema/<table>.json` (CI test runs the same schemas on clients).

### 5.3 Client loop (identical on Android and web)
1. **Push:** select `dirty=1` rows in batches of 500 ordered by hlc → `sync_push` → mark applied
   rows clean; for `stale` rows, apply server row locally (log to `conflict_log`) and clear dirty.
2. **Pull:** loop `sync_pull(since)` until `has_more=false`; apply each batch in **one SQLite
   transaction** using the same LWW rule (incoming.hlc > local.hlc, unless local is dirty with a
   greater hlc); update `since`.
3. Rebuild affected `daily_agg` days (triggers handle it) and emit change notifications.
4. Errors: exponential backoff with jitter (2 s → 5 min); auth errors pause sync and surface a
   banner; never lose dirty rows.

**Triggers:** app/tab foreground; 2 s debounce after local writes (foreground only); connectivity
regained; Realtime `postgres_changes` on `sync_cursors` (a 1-row-per-user table bumped by a
statement trigger after pushes) while foregrounded; Android periodic WorkManager job every 12 h
with constraints `CONNECTED` + `BATTERY_NOT_LOW` (no background realtime socket).

**Tombstones** are purged server-side after 90 days by a scheduled Edge Function; a client whose
`since` is older than the purge horizon receives `resync_required` and does a full pull.

**Versioning:** payloads carry `schema_version`; server returns `min_client_version`; outdated
clients show "Update required" and stop pushing (pull continues read-only).

### 5.4 Invariants (property-tested)
- Convergence: any interleaving of pushes/pulls from N devices ends with identical rows.
- Idempotence: replaying a push or pull batch changes nothing.
- No lost writes: a dirty row is never cleared unless the server acknowledged ≥ its hlc.

---

## 6. SMS engine (Android)

### 6.1 Modules
- `core/smsparser`: **pure Kotlin**, no Android imports (runs on JVM in unit tests; KMP-ready for a
  JS build later). Input `RawSms(sender, body, receivedAt)` → `ParseResult`.
- `feature/sms`: `SmsReceiver` (manifest, `RECEIVE_SMS`), `HistoricalImportWorker`
  (`READ_SMS`, `Telephony.Sms.Inbox` cursor, batches of 500, checkpointed), `SmsIngestor`
  (persist + dedup + categorize), review inbox UI. Only compiled into the `sms` flavor.

### 6.2 Rules as data (`packages/sms-rules`)
```jsonc
// senders.json
{ "HDFCBK": { "bank": "HDFC Bank", "kind": "bank" }, "SBIUPI": { "bank": "SBI", "kind": "bank" }, ... }

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
Then in `SmsIngestor`: dedup (ref, then account+amount+±10 min+direction) → rules engine → upsert
→ `sms_index` update. All in one Room transaction.

### 6.4 Performance
Regexes compiled once (lazy, per sender group). Target ≤ 1 ms parse per SMS on device; live path
≤ 50 ms total including DB write; historical import streams the cursor (no list materialization).

### 6.5 Privacy
Raw body stored only if the user enabled it (default from OPEN_QUESTIONS #6) and never synced.
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
   attributed to the original's day (by default).
2. **Queries:** `packages/contracts/sql/analytics/<module>.sql` with named parameters
   (`:from_day`, `:to_day`, `:account_ids`, …). Android runs them via `SupportSQLiteDatabase`
   (results mapped by a small row mapper); web runs them in the worker. Each module returns a
   typed DTO defined in `packages/contracts/schema/analytics/<module>.json`.
3. **Computed in code** (both platforms, mirrored): forecast bootstrap (seeded RNG for
   determinism in tests), anomaly z-scores, recurring detection, insight rules.
4. **Golden tests:** `fixtures/dataset_*.json` (synthetic, 18 months, ~20k txns, generated by a
   seeded script) → `expected/<module>__<params>.json`. Both clients must produce byte-identical
   JSON (stable key order, minor-unit integers).
5. **Caching:** module results memoized by `(module, params, data_version)` where `data_version`
   increments on any write; recomputation is off the main thread and cancellable.

---

## 8. Client architecture

### 8.1 Android
- UDF: `Screen (Compose) ← UiState (StateFlow) ← ViewModel ← UseCases ← Repositories ← Room/Sync`.
- Navigation Compose with type-safe routes; predictive back; shared-element transitions
  (list row → detail amount/avatar).
- Lists: Paging 3 over Room; stable keys; `contentType`; immutable UI models (`@Immutable`).
- DI: Hilt. Startup: nothing heavy in `Application`; WorkManager on-demand init; Supabase client
  lazily created on first sync.
- Images: Coil 3 (merchant logos from a bundled sprite/vector set — no network logos).
- Widgets: Glance (Month spend + Quick add; Today list). QS tile → quick add activity
  (`excludeFromRecents`, translucent theme, opens in < 300 ms).
- Security: BiometricPrompt app lock (`androidx.biometric`), `FLAG_SECURE` toggle, data
  extraction rules exclude DB from cloud backup (sync is the backup).
- Strict mode in debug; `detekt` + custom lint: no `Double`/`Float` in money packages, no
  `Log.*` with sensitive types.

### 8.2 Web
- All DB work in a **Web Worker** running SQLite-WASM with the `opfs-sahpool` VFS (works without
  cross-origin isolation); exposed via Comlink; TanStack Query wraps worker calls; a
  `BroadcastChannel` invalidates queries across tabs and only one tab (Web Locks API leader)
  runs sync.
- Routes code-split; charts and Sankey lazy-loaded; table virtualized (TanStack Virtual).
- Keyboard-first: command palette (`⌘K`), shortcuts (DESIGN §6.1).
- PWA: installable, offline shell, update prompt.

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
| Background | No wakelocks; periodic sync ≤ 2/day; 0 alarms when nothing scheduled | `dumpsys batterystats`, `dumpsys jobscheduler` review in M6 |
| APK (per ABI, sms flavor) | ≤ 12 MB | CI size check |
| Web initial JS | ≤ 180 KB gzip | CI bundle check |
| Web LCP / INP | ≤ 1.2 s / ≤ 100 ms (mid laptop, warm cache) | Lighthouse CI |
| Web table (50k) | 60 fps scroll | Playwright trace |

---

## 10. Security & privacy
- RLS on every table (`user_id = auth.uid()`), pgTAP tests for cross-user isolation and for RPCs.
- Supabase anon key in clients; **service role key only in Edge Functions** (never in repo; GitHub
  secrets). `.env*` files are gitignored and blocked from Claude reads/edits by hooks.
- Phone numbers stored only as salted SHA-256 hash (salt per user in profile prefs).
- Threat model notes: lost phone (app lock + FBE), malicious SMS (regex timeouts via bounded
  patterns, input length caps, no code execution), XSS on web (no `dangerouslySetInnerHTML`,
  CSP), token theft (short-lived JWT, refresh rotation by Supabase).

---

## 11. Testing strategy

| Layer | Tooling | Must cover |
|---|---|---|
| Money/HLC/grammar | JUnit5 + Kotest property tests; Vitest + fast-check | exact arithmetic, parsing, ordering |
| SMS parser | JVM unit tests over `sms-rules/fixtures` | ≥ 98% field accuracy, all §5.6 edge cases |
| DB | Room in-memory tests, migration tests (`MigrationTestHelper`); web worker tests | triggers keep `daily_agg` exact |
| Sync | Simulated multi-device property tests against a local Supabase (`supabase start`) | §5.4 invariants |
| Analytics | Golden fixtures on both clients | byte-identical outputs |
| UI | Roborazzi screenshot tests (light/dark, 1.0/2.0 font), Compose UI tests; Playwright e2e + screenshots | every screen state |
| Perf | Macrobenchmark, Lighthouse CI | §9 budgets |
| Server | pgTAP | RLS, RPC behavior |

---

## 12. CI/CD (GitHub Actions)
- `android.yml`: ktlint, detekt, unit tests, Roborazzi verify, assemble both flavors, APK size
  check; nightly: Macrobenchmark on emulator (indicative) + manual device run before releases.
- `web.yml`: tsc, eslint, vitest, build, bundle-size check, Playwright, Lighthouse CI.
- `supabase.yml`: `supabase start`, apply migrations, pgTAP, `supabase db lint`.
- `contracts.yml`: JSON schema validation, golden fixtures regenerated-and-diffed, sms-rules report.
- Release: tag → signed AABs to Play internal track (Gradle Play Publisher), web to hosting.

---

## 13. ADRs to write in M0
0001 local-first with SQLite on both clients · 0002 custom sync protocol (HLC LWW) · 0003 money as
minor units · 0004 Supabase · 0005 Android flavors for SMS policy · 0006 no third-party SDKs ·
0007 analytics SQL shared via contracts · 0008 contact picker over READ_CONTACTS.
