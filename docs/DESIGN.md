# zwallet — Design Specification

The look, feel, and behavior of every surface. Tokens live in
`packages/design-tokens/tokens.json` (single source; generated into Compose and CSS — never
hardcode a color, size, or duration). This doc explains how to use them.

---

## 1. Principles

1. **Calm money.** Spending is not an error: ordinary expenses are ink, not red. Color is spent on
   meaning (income, alerts, data), never decoration. Lots of air.
2. **Instant.** Every interaction responds in the same frame (optimistic local writes). No
   spinners for local data — skeletons only on first launch.
3. **Answer first.** Every screen leads with the one sentence/number that matters, then detail.
4. **Forgiving.** Everything is undoable; destructive actions say exactly what will happen.
5. **Thumb-first, keyboard-first.** On phone, primary actions live in the bottom third. On web,
   every action has a shortcut.
6. **Traceable.** Every aggregate opens its transactions.
7. **Accessible by construction.** Never color-only meaning; 48dp targets; TalkBack narrates
   charts; 200% font scale doesn't break layouts.

Voice: plain, warm, brief, second person, no jargon or exclamation marks. "You spent ₹18,240 this
month" not "Total expenditure: INR 18240.00". Errors say what happened and what to do.

---

## 2. Foundations

### 2.1 Color
- **Brand seed** Teal `#0B6E69` → Material 3 tonal palette (TonalSpot). Used for primary actions,
  selection, focus, the FAB. Dynamic color is an opt-in setting (off by default).
- **Neutrals** (warm grays) carry 90% of the UI: `page`, `surface`, `surfaceRaised`,
  `surfaceSunken`, `inkPrimary/Secondary/Muted`, `hairline`. Dark mode is designed, not inverted
  (dark surface `#121417`, raised `#1A1D21`); optional AMOLED black.
- **Money semantics:** income amounts in `amountIncome` with a leading `+`; expenses in ink with
  `−`; transfers in secondary ink with `⇄`. Lending: "owes you" uses `amountIncome`, "you owe" uses
  ink + label — never red.
- **Status** (`good/warning/serious/critical`) only for budget states, sync errors, anomalies —
  always with an icon and a label.
- **Data colors:** see §7.2. Data colors never appear on text.

### 2.2 Typography
Inter (variable), bundled. Scale in tokens: `display 44`, `headline 28`, `title 20`,
`titleSm 16`, `body 16`, `bodySm 14`, `label 14`, `labelSm 12`, `amountLg 34`, `amountRow 16`.
- Amounts in lists and tables: `tnum` (tabular) so columns align. Hero amounts: proportional.
- Currency symbol at 0.7× size, baseline-aligned, secondary ink in hero amounts (`₹` then number).
- Indian grouping for INR: `1,23,456.78`. Compact for charts/axes: `950`, `9.5K`, `1.2L`, `3.4Cr`.
- Never truncate an amount; truncate the merchant name instead (ellipsis, 1 line).

### 2.3 Space, shape, elevation
4-pt grid (`space` tokens). Screen gutters 16 (compact) / 24 (medium+). Card radius `lg 16`,
sheets `xxl 28` top corners, chips `full`, inputs `md 12`, bars in charts `xs 4` data-end only.
Elevation is tonal (`surfaceRaised`); shadows only on FAB, menus, dragged items.

### 2.4 Iconography
Material Symbols **Rounded**, weight 400, grade 0, optical size 24; filled variant for selected
nav items. Category icons sit in a 40dp circular container (identity color at 16% alpha, glyph
at full strength). Merchant avatars: bundled vector logo set for top ~150 merchants (monochrome
glyph on identity container); fallback = 1–2 letter monogram.

### 2.5 Motion (Material 3 Expressive springs; tokens `motion.*`)
| Interaction | Spec |
|---|---|
| Screen push (list → detail) | Shared element: avatar + amount morph; content fades/rises 16dp, `spatialDefault` |
| Bottom sheet | `spatialDefault` up; scrim fade `effectsDefault` |
| FAB → Quick add | Container transform from FAB to full sheet, 300 ms emphasized |
| Save transaction | Sheet collapses into the new list row (row slides in with `spatialFast`, 1 haptic `CONFIRM`) |
| Delete / swipe | Row height collapses `spatialFast`; snackbar with Undo |
| Number changes (KPIs, totals) | Rolling digit ticker 300 ms; no ticker for values the user typed |
| Chart enter | Bars grow from baseline, 18 ms stagger, `emphasizedDecel` 450 ms; lines draw left→right 450 ms; never re-animate on scroll |
| Chart period change | Morph marks to new values (keyed by entity), axes cross-fade 200 ms |
| Chip select | `bouncy` scale 0.96 → 1 |
- Reduced motion (system setting): springs become 120 ms crossfades; tickers off; charts fade.
- Haptics (Android): `CONFIRM` on save, `CLOCK_TICK` while scrubbing charts (per data point),
  `REJECT` on validation error, `LONG_PRESS` on multi-select. Respect system haptics off.

---

## 3. Layout & navigation

### 3.1 Android (window size classes)
- **Compact (phones):** bottom navigation with 4 destinations — **Home**, **Activity**,
  **Insights**, **People** — plus a FAB (Quick add) above the nav on Home and Activity.
  Accounts, Budgets, Recurring, Settings are reached from Home sections and the avatar menu
  (top-right).
- **Medium/Expanded (foldables/tablets):** navigation rail; Activity becomes list-detail
  (two panes); Insights becomes a two-column card grid.
- Edge-to-edge, predictive back, top app bar collapses on scroll (large title → small).

### 3.2 Web
- **≥ 1200 px:** left sidebar (Home, Transactions, Insights, People, Accounts, Budgets,
  Recurring, Review, Settings) + content (max width 1440) + optional right detail panel.
- **840–1199:** collapsible icon sidebar. **< 840:** bottom nav like Android (PWA on phones).
- Global top bar: search (opens command palette), period switcher (on Insights), sync status,
  "New" button (`N`).

---

## 4. Components (build once in `core/designsystem` and `apps/web/src/ui`)

| Component | Spec |
|---|---|
| **AmountText** | Formats `Money` per locale; variants hero/row/compact; sign + color by type; `tnum` option; content description reads "minus 1,240 rupees" |
| **MoneyKeypad** | 4×4 keys (72dp), digits, `.`, `00`, `⌫` (long-press clears), `+ − ×`, `=`; expression line above amount; haptic tick per key; hardware keyboard supported |
| **TransactionRow** | 64dp; avatar · title (merchant/note) · meta (category · account · time) · amount; badges as 16dp icons with labels for a11y; swipe actions; selected state |
| **DayHeader** | Sticky; "Today", "Yesterday", "Mon, 13 Oct"; right side day net (secondary ink) |
| **CategoryChip / CategoryPicker** | Chip: icon + name; picker = bottom sheet with search, recents row, grouped grid (4 cols) |
| **FilterBar** | Horizontally scrolling chips: period, account, category, more; active filters as removable chips; "Clear" when ≥ 2 |
| **SearchField** | Tokenizes grammar (`cat:food` becomes a chip as you type); suggestions list for tokens |
| **KpiTile** | label · value · delta vs named period (signed, icon ↑↓, "vs typical") · optional sparkline |
| **InsightCard** | Icon, one-line finding (bold the number), mini-chart (sparkline/bar), action link, dismiss (×) |
| **ReviewCard** | Parsed fields + highlighted source snippet; 1-tap actions; swipe right confirm / left ignore |
| **PersonRow** | Avatar (photo or monogram) · name · last activity · BalancePill |
| **BalancePill** | "owes you ₹1,200" (income color) / "you owe ₹800" (ink) / "settled" (muted) |
| **PeriodSwitcher** | `‹ October 2026 ›` with tap → preset sheet; swipe to step |
| **SyncBanner** | Offline / sync error / update required; dismissible except update-required |
| **EmptyState** | Illustration (simple line art, brand teal), one sentence, primary CTA |
| **Skeleton** | Shimmer-free pulsing blocks (respects reduced motion), shapes match final layout |
| **Snackbar** | Message + Undo; 5 s; stacks replace |
| **ConfirmDialog** | Title states the outcome ("Delete 3 transactions?"), body states consequences, destructive button in `critical` text |

Every component: light/dark, disabled, pressed, focused (2dp focus ring `focusRing`), error, RTL-safe.

---

## 5. Android screens

Notation per screen: **Purpose · Layout (top→bottom) · Interactions · States · a11y/motion notes.**

### 5.1 Onboarding (4 steps, skippable after step 2)
1. **Welcome** — headline "See where your money goes. Automatically." Hero: animated mini Pace
   chart (sample data). CTA "Get started".
2. **Sign in** — Google button (Credential Manager one-tap) + "Use email" (OTP). Explains sync in
   one line. Offline-only mode link ("Skip — keep data on this phone").
3. **SMS (sms flavor)** — sample parsed SMS → transaction animation; three privacy bullets
   (on-device, only amounts/merchants sync, personal messages never read); "Allow SMS access" →
   system dialog; "Not now". On grant → **Import range** chooser (3/6/12 months/all) → progress
   screen with live counters and "Continue in background".
4. **Make it yours** — month start day (default "1st — calendar month"), app lock toggle
   (**default on**, lock after 5 min; biometrics with PIN fallback), notification preference.
   Done → Home with a one-time coach mark on the FAB.
- Signing in after using offline-only mode: a one-time sheet "Merged 214 transactions from this
  phone into your account" (+ "View" → Activity filtered to merged rows). No choice dialog —
  merge is automatic (SPEC §11).

### 5.2 Home
**Purpose:** "How am I doing right now?" in one glance; launchpad.
```
┌────────────────────────────────────┐
│ Good evening, Viswaz          (VG) │  ← avatar menu: Accounts, Budgets, Recurring, Settings
│ October · spent                    │
│ ₹18,240                            │  ← AmountLg hero, ticker
│ ▼ 12% vs typical · ₹640/day left   │  ← delta chip + safe-to-spend
│ ┌──────── Pace mini chart ───────┐ │  ← A2 compact (tap → Insights)
│ └────────────────────────────────┘ │
│ [ 3 to review › ]                  │  ← only if review inbox > 0 (sms flavor)
│ Insights                           │
│ ┌ Food delivery +₹2,140 … ×  ┐     │  ← up to 3 InsightCards (horizontal pager)
│ Budgets          (bullet bars ×3)  │
│ Upcoming         (next 3 bills)    │
│ People   owed ₹4,350 · owe ₹800 ›  │
│ Recent           (last 5 rows) ›   │
└──────────────────────────(+)───────┘
```
- Pull to refresh = force sync. Privacy mode blurs amounts (tap & hold to peek).
- States: first-run empty ("Add your first expense" + import CTA), offline banner, loading
  skeleton only before first local data.

### 5.3 Activity (transactions)
- Large title "Activity"; SearchField; FilterBar; result summary line when filtered
  ("42 transactions · ₹12,480 · avg ₹297" + "Analyze ›").
- Paged list with DayHeaders. Swipe right: recategorize sheet; swipe left: delete.
  Long-press: multi-select mode (top bar shows count + actions: Category, Tags, Account,
  Reviewed, Delete, More → Merge).
- Empty filter result: "No transactions match" + clear filters.
- Medium/expanded: list-detail panes.

### 5.4 Transaction detail / edit
- Hero: avatar, merchant (editable), AmountLg (tap to edit with keypad), type segmented control.
- Field list (each a row with icon; tap to edit inline/sheet): Category, Account, Date & time,
  Payment method, Note, Tags, People (split/loan), Attachments, Recurring.
- Source card: "From HDFC Bank SMS · matched rule hdfc.upi.debit.v3 · confidence 97%"
  (+ "Show message" if raw stored; highlighted spans).
- "Similar" section: last 5 from this merchant + total this month.
- Actions (bottom bar): Split · Loan · Rule · More (Duplicate, Link refund, Delete).
- Recategorize prompt (AC-4.3.2) appears as a bottom sheet after category change.

### 5.5 Quick add (sheet; also standalone activity for widget/QS tile)
```
┌────────────────────────────────────┐
│ Expense ▾        Cash ▾   Today ▾  │  ← type / account / date chips
│                         120 + 45   │  ← expression line
│                          ₹165      │  ← live result (AmountLg)
│ [🍔 Food] [🛒 Groceries] [🚕 Cab]…  │  ← 8 smart chips + More
│ Note…                         📎   │
│  7   8   9   ⌫                     │
│  4   5   6   +                     │
│  1   2   3   −                     │
│  .   0   00  ✓ Save                │  ← Save enabled when amount > 0
└────────────────────────────────────┘
```
- Selecting a category chip when amount is valid can auto-save (setting "Save on category tap",
  default on) → fastest path is amount + 1 tap.
- Type "Lent/Borrowed" swaps the category row for a person row (recents + picker).

### 5.6 Review inbox
- Header: "12 to review" + "Confirm 8 confident". Card stack (one at a time, next card peeks).
- Card: amount, direction, merchant guess, category guess (chips with alternates), account,
  time; source snippet with highlighted extracted spans; footer actions: Ignore · Loan ·
  Transfer · ✓ Confirm. Swipe right = confirm, left = ignore (with undo).
- After 2 identical corrections → rule suggestion sheet.
- Empty: "All caught up" with a subtle check animation.

### 5.7 Insights (Analyzer)
- Top: PeriodSwitcher + filter chips (accounts, categories, tags, include lending/savings
  toggles). Cross-filter chips appear here when you tap a chart element.
- Tabs (scrollable): **Overview** (A1 Pulse, A2 Pace, insight cards, A3, A4) ·
  **Spending** (A3, A6, A8, A15) · **Cash flow** (A5, A11, A14) · **Patterns** (A7, A10, A9) ·
  **People** (A13). Each module is a card with: title · answer sentence · chart · footer
  ("View 42 transactions ›").
- Long-press/scrub on any chart shows a tooltip card pinned above the finger; release hides;
  tap drills down. TalkBack: each chart is one focusable node with summary + "swipe up/down to
  explore data points" custom actions.

### 5.8 Category / merchant drill page
Header with icon, name, period total, Δ vs typical; 12-month trend bars (current highlighted);
breakdown (subcategories or merchants) bars; rhythm mini-heatmap; filtered transaction list;
actions: Set budget, Create rule, Rename/Merge (merchant).

### 5.9 People
Summary header "You're owed ₹4,350 · You owe ₹800"; segmented filter (All / Owes you / You owe /
Settled); PersonRows; FAB → "Add person" or quick "Lent/Borrowed". Empty state explains splits
and loans with an illustration.

### 5.10 Person ledger
Hero: avatar, name, BalancePill large, "since 12 Aug" aging chip. Actions row: Lent · Borrowed
· Settle up · Remind · Split. Timeline grouped by month: entries (icon by kind) and linked
transactions; running balance on the right. Overflow: edit person, link contact, set VPA,
merge, delete (only if settled).

### 5.11 Split expense (full-screen sheet)
Amount + who paid (Me / person); participants chips (recent people + picker; "Me" always);
mode tabs: Equally · Amounts · Shares · % ; live per-person list with remainder indicator
("₹0.01 left to assign" until exact); Save creates transaction + ledger entries atomically.

### 5.12 Accounts
Net position header; grouped list (Bank, Cards, Cash & wallets) with balance + "as of" source;
card rows show cycle spend + due date + utilization meter. Account detail: balance history
(A14 single), transactions, settings (name, color, type, last4, cycle, opening balance, archive, merge).

### 5.13 Budgets
Overall budget card (bullet bar + pace marker + forecast) and per-category bullet bars; "Add
budget" sheet with suggested amount (typical spend rounded). Over-budget uses `serious/critical`
with icon + label.

### 5.14 Recurring & upcoming
Upcoming timeline (next 60 days) grouped by week; monthly committed total; series list with
logo, cadence, next date, amount, price-change flag; detected-but-unconfirmed section with
Confirm / Not recurring.

### 5.15 Settings
Grouped list per SPEC §13. Privacy & data page explicitly lists "On this device only" vs
"Synced". Sync page: status, last sync, pending count, force sync, conflict log (advanced) —
each entry names the transaction and the **field** that lost ("Note on 'Swiggy ₹420' — kept web
edit from 9:41 pm") with "Use this value" to re-apply it.

### 5.16 App lock
Full-screen brand surface, BiometricPrompt auto-shown, PIN fallback; recents thumbnail blurred
when `FLAG_SECURE` is on.

### 5.17 Widgets & tiles (Glance)
- **Month at a glance (4×2):** spent this month, delta vs typical, mini pace line, "+" button.
- **Quick add (2×1):** opens Quick add directly.
- **QS tile:** "Add expense". App shortcuts: Add expense, Review, Insights.

---

## 6. Web screens (differences from Android; same components & states)

| Screen | Web layout |
|---|---|
| Home | 12-col grid: hero + pace (8 cols) · insights stack (4 cols); budgets/upcoming/people/recent as cards below |
| Transactions | Virtualized **table**: checkbox · date · merchant · category · account · method · tags · amount (right-aligned, tnum) · source badges. Inline cell editing (Enter to edit, Tab to next). Column chooser, density toggle, sticky header with filtered totals. Right **detail panel** on row select. Bulk bar on selection. |
| Quick add | `N` opens a centered dialog: amount field with expression support, category combobox (type to search), account, date, note; `⌘↵` saves; stays open with "Add another" (`⌘⇧↵`) |
| Review | Two-pane: queue list left, card right; `Y` confirm, `X` ignore, `1–8` pick category, `J/K` next/prev |
| Insights | Dashboard grid (2–3 columns by width) of module cards; global filter bar sticky; cross-filter by clicking marks; every card has "⋯ → View data table / Download CSV / Open transactions" |
| People / Person | List left, ledger right |
| Import | CSV wizard: upload → column mapping (auto-detect) → preview with parse errors → dedup report → import |
| Settings | Left sub-nav |

### 6.1 Keyboard map (web)
`⌘K` command palette (search transactions, jump to pages, run actions) · `/` focus search ·
`N` new transaction · `G H/T/I/P` go to Home/Transactions/Insights/People · `J/K` move ·
`E` edit · `C` change category · `#` tags · `⌫` delete (with undo) · `[` `]` previous/next period ·
`?` shortcut help. All shortcuts listed in the palette.

---

## 7. Chart system (the Analyzer's visual language)

### 7.1 Anatomy (every chart)
Title (titleSm) · answer sentence (bodySm, number in semibold) · plot · footer link. Axes:
hairline baseline, muted labels (labelSm, `tnum`), at most 4–5 ticks with clean compact values
(`0 · 5K · 10K · 15K`). Gridlines: horizontal only, 1px hairline, solid. No chart borders, no
3D, no pies/donuts (bars instead), **never two y-axes**.

### 7.2 Color use
- Single-series charts (most of ours): `dataviz.single` blue; comparison marks in `ghost`;
  highlighted/selected mark at full strength, others at 40% when something is selected.
- Multi-series (stacked, small multiples, Sankey groups): categorical slots in fixed order by
  stable entity assignment (`categoryIdentity`), max 7 + Other. A filter never repaints
  survivors (color follows the entity).
- Magnitude (heatmaps, calendar): sequential blue `100 → 700`, zero = `sequential.zero`.
- Deltas vs typical: diverging blue (less) ↔ red (more) with sign and label; neutral gray at 0.
- Light-mode slots 3/4/5 are below 3:1 on the surface → **relief rule**: those charts always
  have direct labels or the data-table view.
- Text never uses data colors.

### 7.3 Marks
Bars ≤ 24dp thick, 4dp rounded data-end, square at baseline, 2dp surface gap between adjacent
or stacked segments. Lines 2dp, round caps/joins. Markers ≥ 8dp with 2dp surface ring. Area
washes at 10% opacity. Forecast cone = `band` fill, no outline. Hit targets ≥ 44dp (expanded
invisibly beyond the mark).

### 7.4 Interaction
- **Android:** touch & drag = scrub (crosshair + tooltip card, haptic tick per point); tap =
  select & drill; pinch disabled; horizontal swipe on the card body = change period only when
  not scrubbing (scrub starts after 150 ms hold to disambiguate).
- **Web:** hover = crosshair/tooltip; click = drill; shift-click = add to cross-filter;
  keyboard: focus chart → arrows move between points, Enter drills.
- Tooltip content: label (date/category), value (AmountText), comparison ("vs ₹1,320 typical"),
  count ("14 transactions"). Never covers the pointed mark.
- Every chart has a **table view** toggle (web) / "Data" sheet (Android) and CSV export (web).

### 7.5 Module visual specs
| Module | Visual details |
|---|---|
| **A1 Pulse** | 4 KpiTiles in a 2×2 (phone) / 1×4 (web). Spend tile is the hero (amountLg). Delta: "▼ 12% vs typical" — down = good for spend (income color + ↓ icon), up = ink + ↑ icon (not red). Savings rate shown as % with mini meter. |
| **A2 Pace** | X = day of period (fraction-based), Y = cumulative ₹. Series: this period (single blue 2dp, end-dot + direct label "₹18.2K today"), last period (ghost, label "Sep"), typical band (band fill between P25–P75 of last 3 periods), forecast cone from today to period end (band) with the P50 as a thin solid line in blue at 50% opacity, budget as a horizontal hairline with label at right. |
| **A3 Where it went** | Horizontal bars sorted desc; label left (icon + name), value right of bar end; thin ghost marker at "typical" for each category; Δ text (+₹2.1K) in secondary ink. Tap group → expands subcategory bars inline (accordion). Toggle "Treemap" on web only (squarified, labels inside if they fit else hidden + tooltip). Max 10 rows + "Show all". |
| **A4 What changed** | Waterfall: first bar = last period total (ghost), floating steps per category Δ (diverging: increases red, decreases blue, labels with sign), last bar = this period total (blue). Steps sorted by |Δ|, top 6 + Others. Tap step → merchant waterfall for that category. |
| **A5 Cash flow** | Sankey (d3-sankey on web; custom Canvas on Android): left = income sources (max 4 + Other), right = Spend groups (top 7 + Other), Savings, Lending, Unallocated. Links tinted with destination group color at 35% opacity; nodes 8dp wide, labels outside with values. Phone: vertical orientation (sources top → destinations bottom). |
| **A6 Calendar** | Month: 7-col grid of rounded cells (radius sm), sequential color by day spend, day number inside (white or ink by luminance), outlier days get a 2dp ink ring. Year (web): 53×7 strip, month labels on top. Legend: 5-step scale with compact values. |
| **A7 Rhythm** | 7 rows (Mon–Sun) × 24 cols (hours, labeled every 6h) heatmap, sequential; phone shows 7×8 (3-hour buckets). Side bars: weekday totals. Answer: "You spend most on Saturday evenings". |
| **A8 Merchants** | Ranked list rows: rank · avatar · name · sparkline (6 months, single blue, current month dot) · total · count/avg in secondary. Sort by total/count/avg/Δ. |
| **A9 Recurring** | Timeline strip of next 30/60 days with markers (avatar circles) at due dates, today line; list below with "₹649/mo ↑ from ₹499" flags (icon + label, `serious`). Monthly committed total in the answer line. |
| **A10 Unusual** | Per merchant/category row: typical range (P25–P75) as a ghost capsule; dots for this period's transactions; flagged dots in blue full strength with ring + label ("₹4,200 · 3.9× usual"). Max 3 series of dots per row. |
| **A11 Income vs spend** | 12 months: income bars up (categorical slot 3) and spend bars down (slot 1) from a shared zero baseline — one axis, legend + direct labels on the latest month; savings rate shown as a separate small line chart below (never dual-axis). |
| **A12 Budgets** | Bullet bars: track = sequential 100, fill = single blue until 80%, then `warning`, >100% `critical` with icon; pace marker = vertical ink tick "today's fair share"; forecast marker hollow. |
| **A13 Lending** | Area (wash) of net receivable over 12 months; aging stacked bar (0–30 / 31–90 / 90+ in sequential steps 300/500/700 with labels); top people list. |
| **A14 Accounts** | Small multiples, one per account, shared x, independent y labeled; payment method mix as a 100% stacked bar (UPI/card/cash/other, ≤ 4 slots). |
| **A15 Category trends** | Small multiples grid (2 cols phone, 4 web), 12 monthly bars each, current month in blue, others ghost; toggle shared y-scale. |

### 7.6 Empty & sparse data
< 2 periods of history: hide comparisons and say why ("Comparisons appear after your second
month"). < 8 samples: no anomaly flags. No data in period: muted "No spending in this period".

### 7.7 Accessibility
Each chart: `contentDescription`/`aria-label` summary ("Pace chart. ₹18,240 spent by day 15,
12% below typical. Forecast ₹34,000 to ₹38,000."), traversable data points (custom actions on
Android, arrow keys on web with live region), table view, forced-colors/print texture fill
(45°/135° lines) as backup identity channel.

---

## 8. Microcopy
| Situation | Copy |
|---|---|
| Empty Activity | "Nothing here yet. Add an expense, or import from SMS." |
| Saved | "Added ₹165 · Food" [Undo] |
| Deleted | "Deleted 3 transactions" [Undo] |
| Offline | "You're offline. Changes are saved and will sync later." |
| Sync error | "Couldn't sync. We'll retry automatically." [Retry] |
| SMS rationale | "zwallet reads bank and UPI messages on this phone to log transactions for you. Messages never leave your phone — only the amount, merchant and date are synced." |
| Reminder share | "Hi Rahul, just a reminder about the ₹1,200 for the Goa trip. You can pay here: <UPI link>. Thanks!" |
| Budget 80% | "You've used 80% of your Food budget with 9 days left." |

Numbers: always include the currency symbol; relative dates for < 7 days ("Yesterday, 9:40 pm"),
absolute otherwise ("Mon, 13 Oct").

---

## 9. Design QA checklist (run per screen before Done)
- [ ] Matches the screen spec above (layout order, components, copy)
- [ ] Light, dark (and AMOLED) correct; no hardcoded colors (lint)
- [ ] Font scale 2.0: nothing clipped or overlapping; amounts never truncated
- [ ] TalkBack/VoiceOver: logical order, labels, chart summaries, actions announced
- [ ] Touch targets ≥ 48dp; focus rings visible (web keyboard)
- [ ] All states: loading (skeleton), empty, error, offline, populated, very long text, huge
      amounts (₹12,34,56,789.00)
- [ ] Motion per §2.5; reduced motion respected
- [ ] Screenshot tests updated (Roborazzi / Playwright)
