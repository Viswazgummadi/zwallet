# 0004 — Supabase as the backend (Mumbai; local Docker for dev)

- Status: accepted
- Date: 2026-10-15

## Context
The backend only needs to authenticate, store rows with per-user isolation, order changes, and
run a few scheduled jobs. It should be SQL-native (the ledger is relational), cheap for one user,
and close to India.

## Decision
- **Supabase**: Postgres 16, Auth (Google + email OTP), RLS on every table, Postgres RPCs for
  sync, Realtime only as a change ping, and Edge Functions (Deno) for `delete_account` and
  `purge_tombstones`.
- **Environments** (decided in the kickoff interview):
  - **dev/test** is the local stack via `supabase start`. Docker Desktop with WSL2 on the owner's
    Windows 11 machine; CI on Linux runs the same.
  - **prod** is the owner's existing hosted project in **Mumbai (`ap-south-1`)**, free tier.
    Migrations reach prod only through an explicit, owner-approved `supabase db push` at release
    time (`db push` stays on Claude's deny list).
- The service-role key lives only in Edge Function secrets and GitHub secrets, never in the repo.

## Consequences
- pgTAP tests and `supabase db reset` run locally and in CI against an identical schema.
- Free-tier limits (pausing after inactivity, connection limits) apply to prod. That's fine for
  one user.
- Dev needs Docker running (about 4 GB RAM).

## Alternatives considered
- **Firebase.** NoSQL, weak for relational and analytics queries.
- **Custom server (Ktor/Node + Postgres).** Ops burden for no gain.
- **Hosted dev project instead of local Docker.** No offline resets, and it pushes `db push` into
  the daily loop.
