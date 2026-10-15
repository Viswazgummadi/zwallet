# Contributing to zwallet

Thanks for helping. zwallet is created and maintained by Viswaz Gummadi and licensed under
**GPL-3.0-only**. By contributing, you agree that your contribution is licensed under the same
terms.

## Sign off every commit (DCO)
We use the [Developer Certificate of Origin 1.1](https://developercertificate.org/). It's a short
statement that you wrote the change, or otherwise have the right to submit it under the
project's license. You agree to it by adding a `Signed-off-by` line to each commit:

```bash
git commit -s -m "feat(web): add category filter chip"
# → Signed-off-by: Your Name <you@example.com>
```

Use your real name and an email you control. A CI check (`dco.yml`) rejects pull requests that
contain unsigned commits. To fix one: `git commit --amend -s`, or `git rebase --signoff main`,
then force-push your branch.

You keep the copyright in your contribution. Add yourself to `AUTHORS` in your first PR.

## Ground rules
- Read `docs/SPEC.md`, `docs/ARCHITECTURE.md` and `docs/DESIGN.md` for the area you're changing.
  They're the source of truth.
- **Nothing online:** no network permissions, HTTP clients, remote assets, analytics or crash
  SDKs.
- Money is always integer minor units. Raw SMS never leaves the device or appears in logs or
  exports.
- New source files start with `// SPDX-License-Identifier: GPL-3.0-only` (or the comment syntax
  of the language).
- Dependencies must have GPL-3.0-compatible licenses (MIT, BSD, Apache-2.0, LGPL, MPL-2.0,
  GPL-3.0…). Anything over 500 KB needs an ADR in `docs/adr/`.
- Conventional commits (`feat(android): …`, `fix(web): …`), small PRs, tests and screenshots
  for UI states.
- Run `node scripts/verify.mjs all` before opening a PR.

## Forks
Forking is welcome (see README, "Make it your own"). Keep `LICENSE`, `NOTICE`, the source
copyright headers and the About-screen credit intact.
