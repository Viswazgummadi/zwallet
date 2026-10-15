# 0014 — License GPL-3.0-only, contributions under the DCO, credit preserved

- Status: accepted
- Date: 2026-10-15

## Context
zwallet is published on GitHub so that anyone can download it, fork it, rebrand it and use it as
their own app. The owner, Viswaz Gummadi, wants the original authorship and credit to stay with
him in every copy, and doesn't want the work turned into a closed-source product. (This is an
engineering record, not legal advice. Get a legal review if commercial use or relicensing ever
matters.)

## Decision
- **License: GPL-3.0-only** (`LICENSE` holds the unmodified FSF text). Source files carry
  `SPDX-License-Identifier: GPL-3.0-only`.
  - Anyone may use, study, modify and redistribute the app.
  - Distributed modified versions must stay under GPL-3.0, ship their source, keep existing
    copyright and license notices, and mark that they were modified.
  - **-only** rather than **-or-later**, so future FSF license versions can't change the terms
    without the copyright holder's choice.
- **Credit:**
  - `NOTICE` states "zwallet — Copyright (C) 2026 Viswaz Gummadi", with the license.
  - `AUTHORS` lists the creator and maintainer and later contributors.
  - The app's About screen shows the same notice and a link to the source. GPL §5 and §7(b)
    allow keeping these "appropriate legal notices" and author attributions in modified
    versions.
  - The README's "Forking & rebranding" section explains that a fork may change the app name,
    package id and colours, but must keep `LICENSE`, `NOTICE`, the copyright lines and the About
    credit.
- **Contributions: Developer Certificate of Origin (DCO 1.1).**
  - Every commit is signed off (`git commit -s`), certifying the contributor has the right to
    submit it under the project license.
  - Contributors keep copyright of their own changes and are credited in `AUTHORS` and the git
    history.
  - A `dco.yml` workflow rejects PRs with unsigned commits.
- **Name:** the project name "zwallet" identifies the original. Forks that change behavior should
  use a different app name. This is a request in the README, not a registered trademark.

## Consequences
- Forks can't go closed-source, and must keep your copyright and credit lines.
- With the DCO (no CLA), you can't relicense the project later without every contributor's
  consent. You chose this trade-off for contributor-friendliness.
- GPL-3.0 is compatible with the planned dependencies (Apache-2.0, MIT, BSD). Any dependency
  with an incompatible license (e.g. GPL-2.0-only) must be rejected. The `code-reviewer` checks
  new dependencies.
- If the app is ever published on a store, the store build must also offer its source (GitHub
  satisfies this).

## Alternatives considered
- **MIT / Apache-2.0.** Permit closed-source forks. Apache's NOTICE does preserve credit.
- **GPL + CLA assigning broad rights to the owner.** Allows relicensing, but deters contributors
  and needs legal drafting.
- **Source-available (e.g. PolyForm Noncommercial).** Not open source. Fewer contributors.
