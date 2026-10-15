#!/usr/bin/env bash
# PostToolUse (Edit|Write): catch floating-point money and sensitive logging right after an edit.
# Exit 2 sends the message back to Claude so it fixes the code immediately.
command -v jq >/dev/null 2>&1 || exit 0
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0

problems=""
add() { problems+="  - $1"$'\n'; }

case "$FILE" in
  *.kt|*.kts)
    # geometry names (totalWidthPx, amountFraction, …) are allowed to be Float in chart code
    if grep -niE '\b(amount|balance|price|total|money|minor|paise|spend|income)[A-Za-z_]*\s*:\s*(Double|Float)\b' "$FILE" \
       | grep -viE '(px|dp|width|height|fraction|ratio|alpha|progress|percent|offset|scale|angle|radius)[A-Za-z_]*\s*:' >/dev/null; then
      add "Kotlin money field typed Double/Float. Use Long minor units / Money."; fi
    if grep -nE '\.toDouble\(\)|\.toFloat\(\)' "$FILE" | grep -iE 'amount|balance|price|total|money' >/dev/null; then
      add "toDouble()/toFloat() on a money value. Parse via BigDecimal → Long minor units."; fi
    if grep -nE 'Log\.(d|i|w|e|v)\(' "$FILE" | grep -iE 'sms|body|amount|vpa|phone' >/dev/null; then
      add "android.util.Log with possibly sensitive data. Use ZwLog with redaction."; fi
    ;;
  *.ts|*.tsx)
    case "$FILE" in */lib/money*|*/lib/format*|*.test.ts|*.spec.ts) ;; *)
      if grep -nE 'parseFloat\(|\.toFixed\(' "$FILE" | grep -iE 'amount|balance|price|total|money|minor' >/dev/null; then
        add "parseFloat/toFixed on money outside src/lib/money. Use Money helpers."; fi
      if grep -nE '(amount|balance|total)[A-Za-z]*\s*(\*|/)\s*100\b' "$FILE" >/dev/null; then
        add "Manual ×/÷100 conversion. Use toMinor()/fromMinor() in src/lib/money."; fi
      if grep -nE 'console\.(log|info|debug)\(' "$FILE" | grep -iE 'sms|amount|vpa|phone' >/dev/null; then
        add "console logging of possibly sensitive data."; fi
    ;; esac
    ;;
  *.sql)
    if grep -niE '(amount|balance|limit|price)[a-z_]*\s+(numeric|decimal|real|double precision|float)' "$FILE" >/dev/null; then
      add "Money column declared as numeric/float. Use bigint minor units."; fi
    ;;
esac

if [ -n "$problems" ]; then
  printf 'money-guard found issues in %s:\n%sFix them (see CLAUDE.md golden rules), or explain why this is not money.\n' "$FILE" "$problems" >&2
  exit 2
fi
exit 0
