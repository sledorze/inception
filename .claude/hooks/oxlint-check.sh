#!/usr/bin/env bash
# Claude Code PostToolUse hook: run full oxlint on the just-edited file.
# Exits 1 on error-severity violations — gives immediate feedback on custom
# rules (effect-patterns/*) and other hard errors.
# Warnings (node:* import debt) exit 0 so they surface as advice, not blocks.
#
# Replaces check-effect-patterns.sh: pattern detection now lives in the
# effect-patterns oxlint plugin (.claude/oxlint-plugins/effect-patterns.js).

set -uo pipefail

# Read tool input from stdin (Claude Code PostToolUse always provides it)
input=""
if [ ! -t 0 ]; then
  input=$(cat)
fi

file_path=""
if [ -n "$input" ]; then
  file_path=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")
fi

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

if [ ! -f "$file_path" ]; then
  exit 0
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$script_dir/../.."
oxlint="$repo_root/node_modules/.bin/oxlint"

if [ ! -x "$oxlint" ]; then
  exit 0
fi

# 1. Auto-fix non-destructive violations (sort-keys only) in-place.
#    The nondestructive-fix config disables all categories; only sort-keys is enabled.
#    Runs silently — exit code ignored because --fix exits 1 when it finds+fixes violations.
"$oxlint" --fix --config "$repo_root/.oxlintrc-nondestructive-fix.json" "$file_path" >/dev/null 2>&1 || true

# 2. Full lint — exits 1 on errors, 0 on warnings-only or clean.
# Pick the tightest config that covers the file: packages/app/ and packages/backoffice/
# each have their own config that loads the design-system jsPlugin. Forcing the root
# config silently bypasses that plugin (see hunt 2026-05-15).
lint_config="$repo_root/.oxlintrc.json"
case "$file_path" in
  "$repo_root/packages/app/"*)        lint_config="$repo_root/packages/app/.oxlintrc.json" ;;
  "$repo_root/packages/backoffice/"*) lint_config="$repo_root/packages/backoffice/.oxlintrc.json" ;;
esac
"$oxlint" --config "$lint_config" "$file_path"
