# zwallet — Product Specification

Version 1.0 · Owner: Viswaz · Status: approved for build
Read with: `ARCHITECTURE.md` (how), `DESIGN.md` (look & feel). Acceptance criteria are tagged
`AC-x.y` so tests and PRs can reference them.

---

## 1. Goals and non-goals

**Goals**
1. Capture every rupee with near-zero effort: automatic on Android (SMS), 3-second manual entry
   everywhere.
2. Make correcting data trivially easy (edit, recategorize, split, merge, undo) — data quality is
   the product.
3. Track money lent/borrowed per person with contact linking, reminders, and settle-up.
4. An Analyzer that answers, at a glance: *Where did my money go? Am I on pace? What changed?
   What's recurring? What's unusual? Who owes me?* — with every number traceable.
5. Phone, web, and multiple devices always consistent; works fully offline.

**Non-goals (v1)**
- Bank account aggregation via APIs/Account Aggregator, investment portfolio tracking, tax filing,
  bill payment, any money movement. zwallet observes and records; it never moves money.
- Multi-user shared household books (data model must not preclude it; see ARCH §4).
- iOS native app (web works on iOS Safari as a PWA).
- LLM features. All "smart" behavior is deterministic and explainable in v1.

---

## 2. Users and jobs-to-be-done

| JTBD | Where | Frequency |
|---|---|---|
| "I just paid — log it" (cash/anything SMS missed) | Phone, quick-add | Daily |
| "Fix what the SMS parser got wrong" | Phone review inbox, web table | Daily/weekly |
| "How am I doing this month?" | Home | Daily |
| "Where is my money going / what changed?" | Analyzer | Weekly |
| "Who owes me and how much?" | People | Weekly |
| "Bulk clean-up, import old data, deep analysis" | Web | Monthly |
| "Remind Rahul about the ₹1,200" | Person ledger → share | As needed |

---

## 3. Core concepts (glossary)

| Concept | Definition |
|---|---|
| **Transaction** | A single movement of money touching one of the user's accounts: `expense`, `income`, `transfer` (between own accounts), or `refund` (reverses part/all of an expense) |
| **Account** | Where money lives: `bank`, `credit_card`, `cash`, `wallet`, `upi_lite`, `other`. Identified in SMS by bank + last 4 digits |
| **Category** | Two-level taxonomy (group → category). Each transaction has exactly one category (splits aside) |
| **Merchant** | Normalized counterparty (e.g., `SWIGGY*BLR 0923`, `swiggy@icici`, `Bundl Technologies` → **Swiggy**) |
| **Person** | A human counterparty (friend/family), optionally linked to a phone contact |
| **Ledger entry** | A lending event with a person: `lent`, `borrowed`, `repaid_to_me`, `repaid_by_me`. May link to a transaction |
| **Split** | A transaction divided into shares; the user's share counts as their spend; others' shares become receivables (ledger entries) |
| **Rule** | User- or system-created mapping: "merchant/pattern → category/tags/account/ignore" |
| **Recurring series** | Detected or user-declared repeating payment (subscription, rent, EMI, SIP) |
| **Budget** | Monthly limit for total spend and/or per category |
| **Source** | How a transaction entered: `manual`, `sms`, `paste`, `csv_import`, `recurring_auto` |
| **Review state** | `confirmed` or `needs_review` (low-confidence parse or user hasn't seen it) |

---

## 4. Transactions

### 4.1 Fields
`id (uuidv7)`, `type`, `amount_minor (>0)`, `currency`, `occurred_at (timestamptz)` +
`occurred_tz` (IANA, for day bucketing), `account_id`, `category_id`, `merchant_id?`,
`counterparty_raw?` (VPA/name as seen), `note?` (≤ 500 chars), `tags[]`, `payment_method`
(`upi`, `card`, `netbanking`, `cash`, `atm`, `wallet`, `auto_debit`, `other`), `source`,
`review_state`, `external_ref?` (UPI RRN / txn ref), `linked_refund_of?`, `transfer_peer_id?`
(other leg of a transfer), `split_group_id?`, `attachments[]`, `location?` (opt-in, coarse),
`created_at`, `updated_at`, `deleted_at?`.

Amount display: `₹1,23,456.78` (Indian digit grouping for INR), sign by type (− expense,
+ income, ⇄ transfer). Paise hidden when `.00` in lists, shown in detail.

### 4.2 Quick add (the 3-second entry) — AC-4.2.x
- Opens from FAB, home-screen widget, Quick Settings tile, app shortcut, web `N`.
- Layout: big amount display + custom numeric keypad (with `+ − ×` for quick math, e.g.
  `120+45`), category chips (top 8 by recency×frequency, then "More"), account defaults to last
  used, date defaults to now, optional note.
- AC-4.2.1: From cold app launch via widget, a cash expense can be saved in ≤ 3 taps after typing
  the amount (amount → category chip → Save).
- AC-4.2.2: Typing a note that matches a known merchant suggests its category (rule engine).
- AC-4.2.3: Save is instant (local write); a snackbar offers **Undo** for 5 s.
- AC-4.2.4: Expression input evaluates exactly in minor units (no float). `0.1+0.2` → `₹0.30`.
- Type switcher: Expense (default) / Income / Transfer / Lent / Borrowed. "Lent"/"Borrowed"
  routes to the ledger flow with a person picker.

### 4.3 List, grouping, and detail
- Reverse-chronological, grouped by day with sticky day headers showing the day's net.
- Row: merchant logo/avatar (category-colored monogram fallback), merchant/title, category ·
  account · time, amount (tabular figures), badges: `SMS`, `Needs review`, `Split`, `Recurring`,
  `Refunded`.
- Swipe actions (Android): right = recategorize sheet, left = delete (undo). Long-press = multi-select.
- Detail screen: all fields editable inline; "Similar transactions" (same merchant) with total;
  source evidence (for SMS: parsed fields + which rule matched; raw text only if the user enabled
  keeping it); actions: Split, Mark as loan, Link refund, Make recurring, Create rule from this,
  Duplicate, Delete.
- AC-4.3.1: List of 50,000 transactions scrolls without jank (see ARCH §9).
- AC-4.3.2: Editing a category offers "Apply to all N past & future from <merchant>?" which
  creates a rule and bulk-updates in one undoable operation.

### 4.4 Search and filters — AC-4.4.x
- Free text over merchant, note, counterparty, tags, amount.
- Structured tokens (typed or via filter sheet; identical semantics on web & Android):
  `cat:food` `group:transport` `merchant:swiggy` `acct:hdfc-1234` `type:income` `>500` `<2000`
  `500..2000` `on:yesterday` `from:2026-09-01` `to:2026-09-30` `month:2026-09` `tag:trip`
  `person:rahul` `source:sms` `method:upi` `is:review` `is:split` `is:recurring` `has:note`
- Filters compose with AND; multiple values in one token are OR (`cat:food,groceries`).
- Result header shows count, total, and average; "Analyze these" opens the Analyzer pre-filtered.
- Saved filters (pinned views), e.g. "Goa trip", "Office reimbursements".
- AC-4.4.1: Any Analyzer drill-down produces a filter expressible in this grammar (traceability).
- AC-4.4.2: Search over 50k rows returns in < 100 ms on device (FTS5 index).

### 4.5 Edit, delete, undo, bulk
- Every mutation is undoable within the session (operation log); delete is soft (`deleted_at`)
  and recoverable from Settings → Trash for 30 days.
- Bulk (multi-select on Android, table selection on web): recategorize, retag, change account,
  mark reviewed, delete, merge duplicates.
- Merge duplicates: keep the richer record, union tags/notes, re-point links.

### 4.6 Transfers and refunds
- A transfer is stored as two rows (outflow leg on the source account, inflow leg on the
  destination) pointing at each other via `transfer_peer_id`; the UI shows them as one item.
  Excluded from spend/income everywhere. If only one leg is known (e.g. only the debit SMS
  arrived), the other account is `null` until the user picks it.
- ATM withdrawal → transfer bank → cash account.
- Credit-card bill payment → transfer bank → card (prevents double-counting card spends).
- Refund links to an expense; analytics nets it against the original's category and month of the
  **original** expense (toggle: "by refund date").

### 4.7 Attachments
- Receipt photos (camera/gallery) stored locally, compressed (WebP, ≤ 300 KB), optional sync to
  Supabase Storage (private bucket). Not in v1 critical path (M5).

---

## 5. SMS ingestion (Android `sms` flavor)

### 5.1 Permission flow — AC-5.1.x
1. Onboarding explains value with a concrete preview ("We found transactions like these…" uses a
   bundled sample, not the user's data, before permission).
2. Rationale screen states: parsing is on-device; only amounts/merchants/dates sync; raw SMS
   never leaves the phone; personal messages are never read (sender filter happens first).
3. Request `RECEIVE_SMS` + `READ_SMS`. If denied: app works fully in manual mode; a gentle,
   dismissible card in Settings offers it again. Never nag more than once per 30 days.
- AC-5.1.1: Denying permission never blocks any other feature.

### 5.2 Historical import
- User picks range: last 3 / 6 / 12 months / all. Default 6.
- Runs as a user-initiated long-running WorkManager job with a progress notification; resumable;
  processes in batches of 500 with checkpoints. Shows live counts: scanned, transactions found,
  needs review, ignored.
- AC-5.2.1: 10,000 SMS processed in < 20 s on a mid-range device; memory < 64 MB extra.
- AC-5.2.2: Re-running import is idempotent (same SMS → same transaction; keyed by SMS
  `_id` + date + body hash).

### 5.3 Live ingestion
- Manifest `BroadcastReceiver` for `SMS_RECEIVED`; `goAsync()`; sender pre-filter in < 1 ms;
  candidate messages parsed inline (< 50 ms) and written to Room; a notification is posted only
  if the user enabled "Notify on new transaction" (default: on, silent channel, grouped).
- Notification actions: **Categorize** (opens chips), **Not mine/ignore**, **It's a loan**.
- AC-5.3.1: No background work is scheduled for non-financial SMS.

### 5.4 Parsing pipeline (details in ARCH §6)
0. **Owner's institutions (fixture priority):** SBI, Axis Bank, Paytm (wallet + UPI Lite); UPI via
   GPay/PhonePe (bank SMS only). No credit cards today — card templates stay lower priority but
   still get fixtures for the M2 breadth target.
1. **Sender filter:** Indian DLT headers (`XX-HDFCBK`, `VM-SBIUPI-S`, …) matched against
   `packages/sms-rules/senders.json`; unknown senders with financial keywords → low-confidence path.
2. **Classify** message kind: `debit`, `credit`, `refund/reversal`, `failed/declined`,
   `otp`, `promo`, `balance_only`, `mandate_upcoming` (autopay "will be debited"),
   `card_statement/bill_due`, `emi_due`, `cash_withdrawal`, `self_transfer`, `wallet_load`
   (UPI Lite / Paytm wallet top-up), `wallet_spend` (payment funded from a wallet/UPI Lite),
   `unknown`.
3. **Extract** with templates (data, versioned): amount, currency, direction, account last4,
   card last4, counterparty (VPA / merchant / name), reference number (UPI RRN), available
   balance, date/time (SMS timestamp fallback), channel.
4. **Normalize merchant** (dictionary + rules + VPA handle heuristics, e.g. `swiggy.stores@axl`).
5. **Dedup** against existing transactions: exact `external_ref` match; else same account, same
   amount, |Δt| ≤ 10 min, compatible direction (handles bank SMS + UPI-app SMS for one payment).
6. **Auto-categorize** (rule priority: user rule > merchant default > VPA pattern > MCC-like
   keyword map > `Uncategorized`).
7. **Confidence score** (0–1). ≥ 0.85 and known template → `confirmed` (if user enabled
   auto-confirm; **default on** — confirmed in kickoff); else `needs_review`.
8. Side effects: `balance_only` updates account balance snapshot; `mandate_upcoming` and
   `card_statement` create **upcoming items** (not transactions); `failed` creates nothing
   (but cancels a pending matching debit if one exists); `refund` tries to link the original.
9. **Wallets / UPI Lite (kickoff decision):** individual UPI Lite and wallet payments usually
   produce no SMS, so a `wallet_load` (top-up debited from a bank account) is recorded as an
   **expense** in the system category *Small UPI payments* (`counts_as: spend`; recategorizable,
   rules apply). Any `wallet_spend` SMS that does arrive is **ignored** (counted in "ignored") so the
   same money is never counted twice.
10. **Deterministic ids:** every SMS-sourced transaction's id is derived from the SMS fingerprint
    (sender + body hash + sent time), so the same SMS ingested on two devices or after a reinstall
    becomes the same row (ADR 0010).

### 5.5 Review inbox — AC-5.5.x
- Badge count on Home; a card-stack UI: each card shows parsed fields + highlighted spans of the
  source text (on-device only), with 1-tap actions: ✓ Confirm, category chips, ✗ Ignore, "Loan",
  "Transfer", "Split".
- "Confirm all high-confidence" bulk action.
- Learning: corrections create/upgrade rules ("Always categorize `rahul.k@okaxis` as Lent →
  Rahul?" prompt after 2 identical corrections).
- AC-5.5.1: Reviewing 20 items takes < 60 s for a practiced user (≤ 1 tap each when the guess is right).

### 5.6 Must-handle edge cases (each has fixtures in `packages/sms-rules/fixtures/`)
OTPs and "do not share" messages; promotional offers with amounts ("Get ₹500 cashback");
failed/declined; reversals and refunds (link original); "will be debited" mandates; credit card
spends vs card bill payments; ATM withdrawals; own-account transfers (both legs seen);
UPI Lite top-ups and wallet loads (→ spend, see §5.4 step 9); wallet-funded payment SMS (ignored); NEFT/IMPS/RTGS credits incl. salary; interest credits;
foreign-currency card spends (store original currency + INR if both present); amounts with/
without decimals, "Rs", "INR", "₹", commas, lakh grouping; truncated/multipart SMS; duplicate
deliveries; SMS whose timestamp is delayed; same amount same merchant twice legitimately (two
coffees) — dedup must use time window and ref numbers, not just amount.

### 5.7 Paste-to-import (both flavors, web too)
Paste one or many SMS texts → same parser (Kotlin on Android; on web, v1.1 via a TS port or WASM
— see ARCH §6.7) → review inbox. Lets `lite` users and web users import.

---

## 6. Categories, merchants, rules, tags

### 6.1 Default taxonomy (India-first; user can rename, recolor, reorder, add, archive, merge)
- **Food & Dining:** Restaurants, Food delivery, Cafés & snacks
- **Groceries:** Groceries, Quick commerce
- **Transport:** Fuel, Cab & auto, Metro & bus, Train, Parking & tolls, Vehicle service
- **Housing:** Rent / PG, Maintenance, Furniture & home
- **Bills & Utilities:** Electricity, Mobile recharge, Internet, DTH/OTT, Gas, Water
- **Shopping:** Online shopping, Clothing, Electronics, Personal items, Small UPI payments
  (UPI Lite / wallet top-ups, §5.4 step 9)
- **Health:** Pharmacy, Doctor & lab, Fitness & gym
- **Entertainment:** Movies & events, Subscriptions, Games
- **Travel:** Flights, Hotels, Trips
- **Education:** Courses, Books
- **Personal care**
- **Family & gifts:** Family support (`excluded`), Gifts, Donations
- **Finance:** EMI & loans (`excluded` — whole EMI, principal and interest), Insurance, Fees &
  charges, Taxes
- **Investments:** SIP / mutual funds, Stocks, FD / RD (counted as *savings*, not spend; toggle)
- **Income:** Salary, Freelance, Interest, Cashback & rewards, Reimbursement (`excluded` — nets
  reimbursable spend, see §9.2), Other income
- **System:** Uncategorized, Transfer (hidden from spend), Refund (nets), Lending (`excluded`)

System tag **`reimbursable`** (seeded, `system_key = 'reimbursable'`): marks work expenses the
user expects to get back; they keep their real category but are excluded from Spend (§9.2).

Kickoff decisions (2026-10-15): investments, reimbursable work expenses, family support, and
EMI/loan repayments are all **outside Spend**. The user can change any category's `counts_as`.

Each category: name, group, icon (Material Symbols Rounded), color (from DESIGN category palette),
`counts_as`: `spend | savings | income | excluded`.

### 6.2 Merchants
Seeded dictionary (`packages/contracts/seed/merchants.json`, ~300 common Indian merchants with
aliases, VPA patterns, default category, logo key). Users can rename/merge merchants; merges
create alias rules.

### 6.3 Rules
`match` (merchant id | VPA regex | text contains | amount range | account) → `actions` (set
category, tags, account, type=transfer, ignore, link person). Ordered; first match wins per field.
UI shows "This rule affected N transactions" with preview before saving.

### 6.4 Tags
Free-form, multi; used for trips/projects/reimbursables. Tag views appear as saved filters.

---

## 7. Accounts
- Auto-created from SMS (bank + last4) with a friendly default name ("HDFC ••1234"); user can
  rename, set type, color, opening balance, archive, merge.
- Balance: latest balance SMS snapshot when available, else opening balance + Σ transactions.
  Shows "as of <time>, from SMS" vs "calculated".
- Credit cards: billing cycle day, due day, limit (optional) → utilization, current cycle spend,
  due reminders.
- Net position = Σ bank + cash + wallet − Σ card outstanding (shown on Accounts, not as "net worth").

---

## 8. People and lending

### 8.1 People
- Create from contact picker (stores display name, photo URI, contact lookup key, and a
  **hashed** E.164 phone for matching across devices), or by name only.
- Optional UPI VPA per person (enables "Request via UPI" links and SMS matching).
- Merge duplicates.

### 8.2 Ledger entries
| Type | Meaning | Effect on balance (positive = they owe you) |
|---|---|---|
| `lent` | You gave money | + amount |
| `borrowed` | You received money | − amount |
| `repaid_to_me` | They paid you back | − amount |
| `repaid_by_me` | You paid them back | + amount |

Fields: person, type, amount, date, note, due date (optional), linked transaction (optional),
split_group (optional). Balance(person) = Σ effects. A person is **settled** at 0.

### 8.3 Flows — AC-8.x
- From a transaction (manual or SMS UPI to a person): "Mark as loan to…" → creates `lent` linked
  to the transaction; the transaction's category becomes **Lending** (`counts_as: excluded`) so it
  doesn't inflate spend.
- Smart suggestion: outgoing UPI to a VPA/name matching a person → review card suggests "Lent to
  Rahul?"; incoming from that person while they owe you → "Repayment from Rahul?".
- Split expense: amount, participants (people + me), split equally / by amount / by shares /
  by percent; your share = spend in its category; others' shares = `lent` entries. Paid by
  someone else → your share is `borrowed`.
- Settle up: one tap records the balancing repayment (full or partial).
- Reminders: per-person or per-entry due date → local notification on the due date at 10:00;
  "Remind" action opens share sheet / WhatsApp with a prefilled polite message and, if the user
  set their own VPA, a `upi://pay?pa=<my-vpa>&pn=<my-name>&am=<amount>&cu=INR&tn=<note>` link.
- AC-8.1: Lending never affects spend/income analytics unless the user toggles
  "Include lending in cash flow".
- AC-8.2: Person balance updates instantly and is identical on all devices after sync.

### 8.4 People screens
List sorted by |balance| with sections "Owes you" / "You owe" / "Settled"; totals at top
("You're owed ₹4,350 · You owe ₹800"). Person detail: balance hero, timeline of entries and
linked transactions, aging (0–30, 31–90, 90+ days), actions: Lent, Borrowed, Settle, Remind, Split.

---

## 9. Analyzer (centerpiece)

### 9.1 Principles
1. **Answer first, chart second:** every module leads with a one-line answer in plain language
   ("You've spent ₹18,240 — 12% less than this point last month").
2. **Traceable:** every mark drills to its transactions (AC-4.4.1).
3. **Cross-filtering:** a global filter bar (period, accounts, categories, tags, people,
   include/exclude toggles) applies to every module; tapping a category in one chart filters the
   rest (chip appears in the bar; tap × to clear).
4. **Comparisons are built in:** each module shows its comparison (previous period / typical).
5. **Honest math:** definitions below are canonical; implemented once in
   `packages/contracts/sql/analytics/*.sql` with golden tests.

### 9.2 Canonical metric definitions
- **Spend** = Σ amount of `expense` transactions whose category `counts_as = spend`, minus linked
  refunds (attributed to the original expense's date by default), using only the user's share for
  splits. Excludes transfers, lending, `savings`/`excluded` categories (incl. Family support and
  EMI & loans), and any transaction tagged `reimbursable`. Refunds landing after a period has
  closed still reduce the **original** period (confirmed in kickoff); the Analyzer marks such a
  period "updated <date>" so a changed past total is never silent.
- **Income** = Σ `income` with category `counts_as = income`.
- **Savings** = Σ transactions in `counts_as = savings` categories (SIP, FD, …).
- **Net cash flow** = Income − Spend − Savings (+ lending flows if toggle on).
- **Savings rate** = (Income − Spend) / Income, shown only when Income > 0.
- **Typical** = median of the same metric over the previous 3 complete periods (robust to outliers).
- **Pace** = cumulative spend at fraction *f* of the current month vs cumulative spend at the same
  *f* of last month and of "typical". (Fraction-based so 28/31-day months compare fairly.)
- **Forecast (EOM)** = spend so far + known upcoming recurring before month end + Σ over remaining
  days of discretionary daily spend, where daily spend is bootstrapped (200 resamples) from the
  last 90 days' non-recurring daily totals → report P50 and the P20–P80 band.
- **Safe to spend per day** = (Monthly budget − Spend − upcoming recurring before EOM) / days left;
  hidden if no budget.
- **Anomaly** (per transaction): robust z = 0.6745·(x − median)/MAD over the same merchant (or
  category if < 8 merchant samples) in the last 180 days; flag if z > 3.5 and x ≥ ₹500
  (configurable). Also flag: possible duplicate (same merchant & amount within 10 min, distinct
  refs), first-time merchant with x ≥ ₹2,000, price change on a recurring series (> 5%).
- **Recurring detection:** group by merchant (+ amount bucket ±10%); ≥ 3 occurrences; median
  interval ∈ {7±1, 14±2, 28–31, 90±7, 365±10} days; coefficient of variation of intervals < 0.25 →
  series with predicted next date and expected amount. User can confirm/dismiss/edit.

### 9.3 Module catalog (each is a card on the Analyzer; full visual specs in DESIGN §7)

| # | Module | Question it answers | Visual | Drill-down |
|---|---|---|---|---|
| A1 | **Pulse** | How am I doing this month? | KPI hero: Spend, Income, Net, Savings rate with deltas vs typical; safe-to-spend | KPI → filtered list |
| A2 | **Pace** | Am I on track? | Cumulative line: this month (solid), last month (dashed), typical (band), forecast cone to EOM, budget line | Day point → that day's txns |
| A3 | **Where it went** | Which categories? | Sorted horizontal bars (group → expand to subcategories) with Δ vs typical as a ghost bar; toggle to treemap | Bar → category drill page |
| A4 | **What changed** | Why is this month different? | Waterfall: last month total → category deltas (top 6 + Others) → this month total; each step expands to merchant contributions | Step → merchant/txns |
| A5 | **Cash flow** | Where does income go? | Sankey: income sources → (spend groups, savings, lending, unallocated) for the period | Link → filtered list |
| A6 | **Calendar** | Which days were heavy? | Calendar heatmap (month grid, or 53-week year strip), sequential scale, outlier days ringed | Day → list |
| A7 | **Rhythm** | When do I spend? | Day-of-week × hour heatmap (7×24), plus weekday vs weekend split | Cell → list |
| A8 | **Merchants** | Who gets my money? | Leaderboard: rank, logo, total, count, avg ticket, 6-month sparkline, Δ | Row → merchant page |
| A9 | **Recurring** | What am I committed to? | Timeline of upcoming 30/60 days + monthly committed total; list with price-change flags | Item → series page |
| A10 | **Unusual** | Anything odd? | Strip/dot plot of transactions vs typical range per merchant/category; flagged dots labeled | Dot → transaction |
| A11 | **Income vs spend** | Am I saving? | 12-month diverging bars (income up, spend down) + savings-rate line | Month → that month |
| A12 | **Budgets** | Within limits? | Bullet bars per budget (spent, pace marker, limit) | Bar → category |
| A13 | **Lending** | Who owes me? | Net receivable over time (area) + aging stacked bar + top people | Person → ledger |
| A14 | **Accounts** | Where is money? | Balances over time (small multiples per account) + payment method mix | Account → list |
| A15 | **Category trends** | Is X growing? | Small multiples: 12-month bars per category, shared y-scale option | Category page |

**Insight cards** (Home + top of Analyzer): deterministic rules emit at most 3 ranked cards, each
with a one-line finding, a supporting mini-chart, and a deep link. Examples:
"Food delivery is up ₹2,140 vs typical — mostly Swiggy (+₹1,600)", "Netflix went from ₹499 to
₹649", "Rahul's ₹1,200 is 45 days old", "3 transactions need review", "You're on pace to finish
the month ₹4,000 under budget". Each rule has an ID, threshold, cool-down, and dismiss memory.

### 9.4 Period controls
Presets: This month (default), Last month, Last 3/6/12 months, This year, Custom; and
**cycle-aware months**: default is the **calendar month** (start day 1, owner's choice); the user
may set a fixed start day 1–28 in Settings. No salary-credit detection (cycle boundaries never
depend on data).
Swipe left/right on Android, `[`/`]` on web to step periods.

### 9.5 Category / merchant drill pages
Header: total, count, avg, Δ vs typical; trend chart (12 months); breakdown by subcategory or
merchant; day-of-week rhythm; transaction list (filtered). Actions: set budget, create rule,
rename/merge (merchant).

---

## 10. Budgets, recurring, upcoming, notifications

- **Budgets:** monthly overall + per category/group; rollover option; alerts at 80% and 100%
  (once each per period), and "on pace to exceed" alert when forecast P50 > limit after day 10.
- **Recurring series:** detected (§9.2) or manual. Upcoming list merges recurring predictions,
  `mandate_upcoming` SMS, card bill dues, and loan due dates. Optional reminder 1 day before.
- **Notifications** (all channels user-configurable; all local, no push server needed in v1):
  new SMS transaction (silent, grouped), review reminder (weekly, only if items pending),
  budget alerts, bill/EMI due, lending due, monthly recap (1st of month, opens Analyzer).
- AC-10.1: All reminders are scheduled with WorkManager/AlarmManager inexact windows; no
  exact-alarm permission required.

---

## 11. Sync, accounts, data ownership

- Sign in: Google (Credential Manager on Android, OAuth on web) or email OTP. Data is per user.
- Works offline indefinitely; sync on app foreground, after local writes (debounced 2 s while
  foregrounded), on connectivity regain, and a constrained periodic job (ARCH §5, §9).
- Conflict policy: last-writer-wins **per field group** by hybrid logical clock (ADR 0009) —
  concurrent edits to different fields of the same row both survive; tombstones are sticky (a
  later field edit doesn't undelete; only Restore does); losing groups are kept in a local
  conflict log (Settings → Advanced).
- Offline-only mode ("Skip — keep data on this phone"): on later sign-in, local data is merged
  into the account automatically (deterministic SMS ids + dedup prevent duplicates) and a one-time
  summary shows what merged.
- AC-11.1: Two devices editing different fields of different rows offline converge after sync.
- AC-11.3: Two devices editing *different fields of the same row* offline both keep their edits
  after sync; the same field resolves to the later HLC on every device.
- AC-11.2: An edit made on web appears on the phone within 5 s while the app is foregrounded
  (Realtime ping → pull), and on next foreground otherwise.
- Export: CSV (transactions, ledger) and full JSON backup; Import: CSV with column mapping
  wizard (web), zwallet JSON restore.
- Delete account: wipes server data (Edge Function), local DB, and signs out; requires typing
  "DELETE".
- Privacy screen lists exactly what syncs and what stays on device.

---

## 12. Milestones and acceptance

| M | Scope | Exit criteria (all DoD items in MASTER_PROMPT §6 plus) |
|---|---|---|
| **M0** Foundations | Monorepo, CI, Supabase schema + RLS + sync RPCs, contracts package, design-token pipeline, empty app shells (Android + web) with theme, nav, auth | CI green on all three tracks; pgTAP RLS tests pass; Android & web sign in and show an empty Home in light/dark |
| **M1** Ledger + sync | Local DB both clients, quick add, list, detail/edit, search & filters (grammar), undo, trash, categories CRUD, accounts basic, two-way sync | AC-4.x, AC-11.1/11.2 pass; 50k-row perf tests pass |
| **M2** SMS engine | `sms-rules` package, parser + classifier + dedup + merchant normalization, historical import, live receiver, review inbox, rules learning, flavors | ≥ 300 fixture SMS across ≥ 12 banks/apps at ≥ 98% field accuracy; AC-5.x pass; battery check (ARCH §9) |
| **M3** People & lending | People, contact picker, ledger, splits, settle, reminders, UPI request link, smart suggestions | AC-8.x pass; spend unaffected by lending (golden tests) |
| **M4** Analyzer | Analytics SQL + golden fixtures, chart library (both platforms), modules A1–A15, insight cards, cross-filter, drill-downs | Every module traceable; parity tests pass; Insights first render ≤ 300 ms @ 50k txns |
| **M5** Budgets, recurring, accounts, widgets | Budgets & alerts, recurring detection & upcoming, card cycles, Glance widgets, QS tile, attachments, CSV import/export | AC-10.x pass |
| **M6** Polish | Motion pass, empty/error states, a11y audit, Baseline Profiles, perf & battery audit, onboarding polish | All budgets green; a11y audit clean; design QA sign-off against DESIGN.md |
| **M7** Release | Signing, Play: `lite` public, `sms` internal track / sideload only (ADR 0005), privacy policy, web deploy to Cloudflare Pages + custom domain, backups, crash reporting (self-hosted or none) | `sms` build installed on owner's phone; `lite` on Play; web live |

---

## 13. Settings (complete list)
Profile & sign-in · Sync status (last sync, pending changes, force sync) · Appearance (system /
light / dark, dynamic color on/off, amoled black, density) · Currency & locale (default INR,
number grouping) · Month start day (default 1) · SMS (enable, auto-confirm threshold — default on,
keep raw text locally — default on, with "Delete stored messages", re-run import, sender
allow/block list) · Notifications (per channel) · Categories ·
Rules · Tags · Accounts · My UPI ID (for reminders) · Security (app lock with biometrics/PIN —
offered in onboarding, default on, lock after N minutes — default 5, hide amounts on recents / `FLAG_SECURE`, "privacy mode" blur amounts on
Home) · Data (export, import, trash, delete account) · About (version, licenses, privacy).

---

## 14. Out of scope for v1 (parking lot)
Notification-listener ingestion from UPI apps; email statement parsing; PDF bank statement import;
on-device LLM explanations; shared household books; investments tracking; iOS app; Wear OS tile.
