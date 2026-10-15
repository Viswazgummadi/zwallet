# 0011 — Node-based cross-platform dev tooling (Windows 11 + Linux CI)

- Status: accepted
- Date: 2026-10-15

## Context
The owner develops on **Windows 11**, while CI runs on Linux. The planning kit assumed Linux
throughout: `./scripts/verify.sh`, `./gradlew`, `/tmp`, `chmod`. Git Bash and `jq` are available
on the owner's machine, and Claude Code runs hooks through Git Bash.

## Decision
- The canonical gate runner is **`node scripts/verify.mjs <all|android|web|db|contracts>`**. It
  uses Node 22 and has no dependencies, so it behaves the same on Windows and Linux.
  - It runs `gradlew.bat` on Windows and `./gradlew` elsewhere.
  - It writes temporary output under `os.tmpdir()`.
  - It prints a gate · result table and exits non-zero on any failure.
- Package scripts stay platform-neutral: no `rm -rf`, `cp` or env-var prefixes. Use Node
  equivalents or `cross-env`-free patterns.
- Claude Code hooks (`.claude/hooks/*.sh`) stay bash. `.gitattributes` pins LF for `*.sh`, so no
  `chmod` is needed on Windows.
- Docs show PowerShell forms where they differ (`.\gradlew.bat`, `$env:TEMP`). Device screenshots
  go to the OS temp directory or the Claude session scratchpad, not `/tmp`.
- CI keeps a small `windows-latest` smoke job (`node scripts/verify.mjs contracts web`) so the
  tooling stays portable.

## Consequences
- One script serves both the owner and CI. No twin `.sh`/`.ps1` files to keep in sync.
- Gradle and Supabase CLI calls must be quoted carefully: the repo path contains a space
  (`C:\Users\G Viswaz\…`). `verify.mjs` uses `spawn` with argument arrays, not shell strings.
- Local Supabase needs Docker Desktop with the WSL2 backend (ADR 0004).

## Alternatives considered
- **Bash and PowerShell twins.** Double maintenance, and they drift.
- **Bash only, run under Git Bash.** Works, but is brittle with `gradlew.bat`, paths and
  PowerShell users.
- **WSL2 as the main dev environment.** Viable, but slow file I/O across the Windows/WSL boundary
  for Gradle and the Android emulator, and the owner chose native Windows.
