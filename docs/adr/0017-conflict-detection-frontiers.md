# 0017 — Telling real merge conflicts from ordinary updates (per-node frontiers)

- Status: accepted
- Date: 2026-10-15

## Context

ADR 0009 merges per field group by HLC. Losing values go to the conflict log ("Use this value",
AC-11.3). An import alone can't tell two situations apart:

1. **An ordinary update.** The laptop received the phone's note, then edited it. The phone later
   imports the laptop's file. Its older note loses, but nobody's edit was lost.
2. **A real conflict.** The phone and the laptop both edited the note between exchanges. One
   edit is silently lost unless it is logged.

In both cases the local stamp is older than the incoming one and the values differ. Logging both
cases floods the conflict log with false alarms. Logging neither breaks AC-11.3.

## Decision

- A side's **frontier** maps each node id to the highest HLC from that node appearing in any
  `field_hlc` stamp of that side's rows. For a file, it is computed over the whole payload. For
  the local DB, it is maintained in `device_state`.
- When a group's values differ, the losing stamp `h` becomes a conflict only if the
  **winning side had not seen it**: `h > winnerFrontier[node(h)]`. An empty stamp (`""`) never
  conflicts.
- A conflict entry records the group, the losing side, the losing values, and both stamps.
- Equal-stamp ties pick the larger value. Values are ordered null < integer < string; strings
  compare by UTF-16 code unit. This keeps merges commutative even for cloned installs that share
  a node id.
- **Exception (2026-10-16):** when both copies have the row deleted, a differing `deleted` group
  (`deleted_at` times) is never a conflict: nothing is left for the user to choose.
- The rule changes only **what is logged**, never the merged values. The reference
  implementation is `packages/contracts/lib/merge-reference.mjs`, and `fixtures/merge.json` is
  generated from it.

## Consequences

- Case 1 isn't logged, and case 2 is, as long as the winner's edits don't hide the stamps it had
  seen. A false positive is possible: if the winner later overwrote _every_ group stamped by our
  node, the frontier underestimates what it saw. That only adds an entry to the conflict log.
  No data is lost.
- Import must compute the file's frontier in a first pass (cheap; the preview does a dry run
  anyway).
- Both apps implement the same rule and are tested against `merge.json`.

## Alternatives considered

- **Log every losing value.** Every routine phone ↔ laptop round trip would produce "conflicts".
- **Log nothing.** Violates AC-11.3.
- **Full version vectors per row.** Exact, but adds bytes to every row and to the format, for a
  UX-only benefit.
- **Base values (three-way merge) kept per peer.** Needs per-peer snapshots. Files are full
  snapshots from unknown peers.
