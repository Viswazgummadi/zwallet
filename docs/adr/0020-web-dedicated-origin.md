# 0020 — The web app must run on a dedicated origin

- Status: accepted (deployment target pending owner action, OPEN_QUESTIONS #13)
- Date: 2026-10-16

## Context
The web app stores the whole book in the browser (OPFS SQLite, IndexedDB, localStorage). Browsers
isolate that storage **per origin** (scheme + host + port), not per path.

GitHub Pages serves every project site of an account from one origin, `https://<user>.github.io/`.
Any other project site under that account runs same-origin with zwallet: its scripts can read and
modify the user's entire financial database, and so can a site added later or a compromised
dependency of another project. `connect-src 'self'` does not help, because "self" is that shared
origin.

## Decision
- **Dedicated origin required.** Production zwallet web is served from an origin used **only** by
  zwallet. It is served at the root path (`ZW_BASE=/`) from either:
  - a custom domain (CNAME on GitHub Pages); or
  - a GitHub organisation or user that hosts nothing else, using its root user site
    (`https://<org>.github.io/`).
- **Runtime guard.** The app detects a shared origin: the hostname ends with `.github.io` and the
  base path is not `/`. In that case it shows a persistent warning on Home:
  > This copy runs on a shared web address. Other sites on <host> could read data you save here.
  > Use zwallet from its own address.

  From M1, the first write of user data also requires an explicit "I understand" on such an
  origin.
- **Forks.** The README's fork instructions tell forks to deploy the same way.

## Consequences
- The owner must create the organisation or point a domain at Pages before real data goes into the
  web app (OPEN_QUESTIONS #13). Until then, the current `/zwallet/` deployment is for testing and
  shows the warning.
- `vite.config.ts` keeps `ZW_BASE` configurable. Production builds use `/`.

## Alternatives considered
- **Keep `<user>.github.io/zwallet/`.** Any other Pages project of the account could read the
  data.
- **Encrypt data at rest in the browser with a key held in the page.** The same-origin attacker
  runs in the same context and gets the key too.
- **Self-host only.** Possible for forks, but GitHub Pages on a dedicated origin keeps the
  no-server promise at no cost.
