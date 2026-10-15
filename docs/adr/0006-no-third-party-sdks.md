# 0006 — No third-party SDKs that phone home

- Status: accepted
- Date: 2026-10-15

## Context
zwallet's privacy promise is: raw SMS never leaves the device, no trackers, no ads. Crash and
analytics SDKs send device and usage data to third parties and add startup cost.

## Decision
- No analytics, crash-reporting, attribution or ads SDKs on any client. There is no network
  egress at all: the Android app has no INTERNET permission, and the web app only loads its own
  static files (strengthened by ADR 0012).
- Crash insight comes from a local, redacted log export the user can attach to a GitHub issue
  manually.
- Merchant logos are bundled vectors. No network logo services.
- Any dependency over 500 KB, or any dependency that makes network calls, needs an ADR.

## Consequences
- No telemetry. Bugs are found through tests and user-filed issues.
- The Privacy screen can truthfully say "zwallet never connects to the internet".

## Alternatives considered
- **Crashlytics / Sentry SaaS.** Third-party data egress.
- **Self-hosted Sentry.** Possible later (SPEC M7). Ops burden for now.
