# 0008 — System contact picker over READ_CONTACTS

- Status: accepted
- Date: 2026-10-15

## Context
People and lending link to phone contacts. `READ_CONTACTS` is a sensitive, broad permission. The
app only needs the contacts the user explicitly chooses.

## Decision
- Use the system contact picker (`ACTION_PICK` / `ActivityResultContracts.PickContact`). It
  grants access to the one selected contact, with no permission needed.
- Store the display name, photo URI, contact lookup key, and a **salted SHA-256 of the E.164
  phone number** (salt per user, in profile prefs). Never the raw number.
- Full-contacts search sits behind an explicit opt-in that requests `READ_CONTACTS` only then.

## Consequences
- No contacts permission by default, which keeps onboarding to one permission (SMS).
- The phone hash lets people match across devices without syncing raw numbers.
- No "type to search all contacts" unless the user opts in.

## Alternatives considered
- **`READ_CONTACTS` up front.** Over-broad, and it hurts trust and Play review.
