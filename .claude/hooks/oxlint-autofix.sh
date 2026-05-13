#!/usr/bin/env bash
# Claude Code PostToolUse hook: auto-fix safe cosmetic oxlint violations
# Runs after Edit/Write on .ts/.tsx/.js/.jsx files only.
# Uses a restricted config that excludes destructive rules (no-unused-vars, etc.)

set -uo pipefail

# Read tool input from stdin
input=$(cat)

# Extract file_path from the tool input JSON
file_path=$(echo "$input" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null || echo "")

# Skip if no file path extracted
if [ -z "$file_path" ]; then
  exit 0
fi

# Skip non-JS/TS files
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# Skip if file doesn't exist (e.g. write failed)
if [ ! -f "$file_path" ]; then
  exit 0
fi

# Find the repo root and config
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$script_dir/../.."
config="$script_dir/oxlintrc-autofix.json"
oxlint="$repo_root/node_modules/.bin/oxlint"

# Skip if oxlint binary not found (e.g. node_modules not installed)
if [ ! -x "$oxlint" ]; then
  exit 0
fi

# Run oxlint --fix-dangerously with restricted safe-rules-only config
# --fix-dangerously is safe here because the config only enables cosmetic rules
# (curly, eqeqeq, no-unneeded-ternary, etc.) — no destructive rules like no-unused-vars
# Always exit 0 — hook must never block the edit
"$oxlint" --fix-dangerously -c "$config" "$file_path" >/dev/null 2>&1 || true

exit 0
