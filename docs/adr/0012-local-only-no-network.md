# 0012 — Local-only: no backend, no accounts, no network

- Status: accepted (supersedes 0004 and 0005; replaces the sync parts of 0002)
- Date: 2026-10-15

## Context
The original plan synced Android and web through Supabase, with Google/email sign-in. After the
kickoff, the owner redefined the product: a **personal** app that anyone can download from
GitHub and make their own, works offline, and keeps **nothing online**. Device-to-device sync
isn't needed. The owner still wants a bigger-screen web UI on the laptop, fed by moving data
across manually (ADR 0013).

## Decision
- **No server of any kind.** Drop Supabase (Auth, Postgres, RLS, sync RPCs, Edge Functions,
  Realtime, Storage) and Google OAuth.
- **Android ships without the INTERNET permission.** It's the strongest privacy guarantee
  available: the OS itself prevents any network egress. CI fails the build if the merged
  manifest contains `INTERNET` or `ACCESS_NETWORK_STATE`.
- **The web app is a static PWA** hosted on GitHub Pages. After the first load it works fully
  offline. A strict CSP (`connect-src 'self'`) forbids talking to anything but its own origin,
  and user data stays in the browser's OPFS.
- **Single Android build** (no `sms`/`lite` flavors). Distribution is a signed APK on GitHub
  Releases, compatible with Obtainium. No Google Play, so its SMS-permission policy no longer
  applies.
- **Backups are manual exports only** (owner's choice). Android cloud backup and device-transfer
  backup are disabled (`allowBackup=false`) so data never reaches Google Drive implicitly.
- **No `user_id` columns.** Each install is one person's book.

## Consequences
- Removed from the plan: `supabase/`, the `db` verify track, Docker as a dev requirement, sign-in
  screens, sync status UI, the periodic sync job, OAuth setup, and the hosted Supabase project
  (the owner can delete it).
- A lost phone without a recent export means lost data. The app shows an optional, dismissible
  "export reminder" (DESIGN §8), and the README says so plainly.
- No automatic update check, because no network. Users update through GitHub Releases or
  Obtainium.
- No crash reporting at all. Bugs come from tests and from users filing GitHub issues.
- Battery story improves: background work is limited to the SMS receiver, user-started SMS
  import, and local reminders.
- Multi-user cloud features (shared household books) are out of reach without revisiting this
  ADR.

## Alternatives considered
- **Keep Supabase (ADR 0004).** Contradicts "nothing online". Every fork would need its own
  project and keys.
- **Optional self-hosted sync server.** Possible later as a separate ADR. It would require the
  INTERNET permission, so it would be an opt-in build variant.
- **LAN / Wi-Fi Direct transfer between phone and laptop.** Needs network permissions and
  pairing UX. A file is simpler and auditable.
