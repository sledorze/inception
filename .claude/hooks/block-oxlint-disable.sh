#!/usr/bin/env bash
# Claude Code PreToolUse hook: prevent writing '// oxlint-disable' or '/* oxlint-disable */'
# comments into .ts / .tsx files. Disable comments mask real violations — fix the code instead.
#
# Checks:
#   Edit tool  → new_string (the content being inserted/replaced)
#   Write tool → content (the full file being written)
# Exits 1 when a disable comment is detected, blocking the tool call.

set -uo pipefail

input=""
if [ ! -t 0 ]; then
  input=$(cat)
fi

if [ -z "$input" ]; then
  exit 0
fi

tool_name=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(d.get('tool_name', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

file_path=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Extract the content being written (new_string for Edit, content for Write)
content=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  inp = d.get('tool_input', {})
  # Edit tool uses new_string; Write tool uses content
  print(inp.get('new_string', inp.get('content', '')))
except Exception:
  print('')
" 2>/dev/null || echo "")

if printf '%s' "$content" | grep -qE 'oxlint-disable'; then
  echo "BLOCKED: oxlint-disable comments are not allowed in .ts/.tsx files."
  echo "Fix the underlying violation instead of suppressing the lint rule."
  echo "  → Remove the 'oxlint-disable' from the content you are writing."
  exit 1
fi

exit 0
