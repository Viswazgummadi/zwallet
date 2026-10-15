# 0006 — No third-party SDKs that phone home

- Status: accepted
- Date: 2026-10-15

## Context
zwallet's privacy promise is: raw SMS never leaves the device, no trackers, no ads. Crash and
analytics SDKs send device and usage data to third parties and add startup cost.

## Decision
- No analytics, crash-reporting, attribution or ads SDKs on any client. Network egress goes only
  to our Supabase project and to Google sign-in.
- Crash insight comes from Play vitals plus a local, redacted log export the user can share
  manually.
- Merchant logos are bundled vectors. No network logo services.
- Any dependency over 500 KB, or any dependency that makes network calls, needs an ADR.

## Consequences
- Less telemetry. Bugs are found through tests, Play vitals and owner reports.
- The Privacy screen can list every outbound destination exactly.

## Alternatives considered
- **Crashlytics / Sentry SaaS.** Third-party data egress.
- **Self-hosted Sentry.** Possible later (SPEC M7). Ops burden for now.
