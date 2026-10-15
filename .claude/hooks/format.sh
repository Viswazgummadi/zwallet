#!/usr/bin/env bash
# PostToolUse (Edit|Write): format the edited file with the project's formatter if installed.
# Never blocks; silently skips when tools aren't available yet (e.g. before M0 scaffolding).
command -v jq >/dev/null 2>&1 || exit 0
FILE=$(jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$FILE" in
  *.kt|*.kts)
    if command -v ktlint >/dev/null 2>&1; then ktlint -F "$FILE" >/dev/null 2>&1 || true; fi ;;
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.yml|*.yaml)
    if [ -x "$ROOT/node_modules/.bin/prettier" ]; then
      "$ROOT/node_modules/.bin/prettier" --write --log-level silent "$FILE" >/dev/null 2>&1 || true
    fi ;;
esac
exit 0
