# zwallet

Personal finance for Android, with an offline web app for the big screen. It reads bank and UPI
SMS **on your phone**, tracks money lent and borrowed, and explains your spending with an Analyzer
where every number opens the exact transactions behind it.

**Nothing online.** No account, no server, no tracking. The Android app doesn't even have
internet permission. To look at your data on a laptop, export an encrypted `.zwallet` file
from the phone, open it in the web app (it runs entirely in your browser), and, if you edit
there, import the file back on the phone. Changes merge both ways.

> Status: M0 (foundations) — app shells, shared contracts and CI; no features yet. See
> `docs/CHANGELOG.md`.

## Install (once released)
- **Android:** download the APK from [GitHub Releases](../../releases) and install it. Or add
  this repo to [Obtainium](https://github.com/ImranR98/Obtainium) for updates.
- **Web:** open the GitHub Pages site for this repo and install it as an app. It works offline
  after the first visit, and your file is never uploaded.

⚠️ Backups are manual. Export a `.zwallet` file regularly and keep it somewhere safe. If you lose
your phone or the file's password, the data can't be recovered.

## Make it your own (forking & rebranding)
You're welcome to fork zwallet and turn it into your own app:
1. Fork the repo.
2. Edit `apps/android/branding.properties` (app name, `applicationId`) and the brand colour in
   `packages/design-tokens/tokens.json`.
3. Build it yourself, or tag a release so the `release.yml` workflow builds and signs your APK.

Under the GPL-3.0 your fork must stay open source, and you must **keep** `LICENSE`, `NOTICE`,
the copyright lines and the "Created by Viswaz Gummadi" credit on the About screen. Add your own
name alongside. If you change how the app behaves, please give it a different name so people
can tell it apart from the original.

## Contributing
Contributions are welcome. Read `CONTRIBUTING.md`. Every commit must be signed off
(`git commit -s`) under the Developer Certificate of Origin.

## Docs
- Product spec: `docs/SPEC.md`
- Architecture: `docs/ARCHITECTURE.md`
- Design: `docs/DESIGN.md`
- Decisions: `docs/adr/`
- How this repo is built with Claude Code: `docs/PLAYBOOK.md`

## License
Copyright (C) 2026 Viswaz Gummadi.

zwallet is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License, version 3 (GPL-3.0-only), as published by the Free Software Foundation.
It is distributed WITHOUT ANY WARRANTY. See `LICENSE` and `NOTICE`.
