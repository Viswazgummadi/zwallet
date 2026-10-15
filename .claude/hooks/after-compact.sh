#!/usr/bin/env bash
# SessionStart (compact): re-inject the rules that matter most after context compaction.
cat <<'TXT'
zwallet reminders after compaction:
- Money = integer minor units + currency. No floats. Raw SMS never leaves device or hits logs.
- Local-only, nothing online (no INTERNET permission). Writes stamp HLCs per merge group; phone<->web via encrypted .zwallet import/export.
- Every Analyzer number drills down to its transactions. Tokens only, no hardcoded styles.
- Migrations are append-only. Verify with node scripts/verify.mjs before claiming done; show evidence.
- Source of truth: docs/SPEC.md, docs/ARCHITECTURE.md, docs/DESIGN.md. Re-read the section you're working on.
TXT
echo "Current branch: $(git branch --show-current 2>/dev/null)"
echo "Recent commits:"; git log --oneline -5 2>/dev/null
exit 0
