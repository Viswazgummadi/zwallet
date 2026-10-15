# 0005 — Android product flavors for the SMS permission policy

- Status: superseded by 0012 (single build distributed via GitHub Releases; no Google Play)
- Date: 2026-10-15

## Context
Google Play restricts `READ_SMS`/`RECEIVE_SMS`. "SMS-based money management" is an exception
that Play reviews case by case, and approval is uncertain and slow. SMS parsing is the core value
for the owner.

## Decision
- One codebase, two flavors:
  - `sms` (`in.zwallet.app.sms`) includes `feature/sms` and the SMS permissions.
  - `lite` (`in.zwallet.app`) has no SMS permissions. It offers manual entry and paste-to-import.
- **Distribution (kickoff decision):** `lite` ships on Play. `sms` is installed on the owner's
  phone by sideload or the Play internal testing track, without a public permissions declaration.
  We can apply for the declaration later if others want the sms build.
- `feature/sms` compiles only into the `sms` flavor. `lite` must not reference it, and CI
  assembles both.

## Consequences
- No Play-review risk for the public build.
- Different application ids mean separate installs with separate local databases. Sync makes
  them consistent.
- Every SMS-dependent UI entry point must be flavor-gated (review inbox badge, onboarding step).

## Alternatives considered
- **Apply for the SMS declaration now.** Weeks of review, possible rejection, and a privacy
  policy URL and demo video needed before M7.
- **NotificationListener ingestion.** Parked (SPEC §14). Fragile per UPI app.
