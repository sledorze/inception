#!/usr/bin/env bash
# Claude Code PostToolUse hook: run tsgo on the just-edited file's project and
# report only Effect-specific diagnostics (6-digit TS codes, e.g. TS377057).
# Standard TypeScript errors (4-digit codes) are ignored — those belong to the
# pre-push typecheck, not the per-edit feedback loop.
#
# Also blocks @effect-diagnostics disable directives (e.g. nodeBuiltinImport:off).
# Suppressing Effect diagnostics is forbidden — fix the violation instead.
#
# Exits 1 if any Effect diagnostics are found OR if a suppression directive exists.

set -uo pipefail

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
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

if [ ! -f "$file_path" ]; then
  exit 0
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
tsgo="$repo_root/node_modules/.bin/tsgo"

if [ ! -x "$tsgo" ]; then
  exit 0
fi

# Pick tsconfig based on which package the file belongs to.
tsconfig=""
case "$file_path" in
  "$repo_root/packages/host/"*)     tsconfig="$repo_root/packages/host/tsconfig.json" ;;
  "$repo_root/packages/frontend/"*) tsconfig="$repo_root/packages/frontend/tsconfig.json" ;;
  *) exit 0 ;;
esac

rel_path="${file_path#"$repo_root"/}"
exit_code=0

# 1. Block newly-added @effect-diagnostics suppression directives (e.g. `nodeBuiltinImport:off`).
#    Suppressing Effect diagnostics is forbidden — the underlying violation must be fixed.
#    Check only lines added in the current edit (git diff HEAD) to avoid flagging pre-existing
#    legitimate suppressions that are already part of the repo history.
suppress_lines=$(cd "$repo_root" && git diff HEAD -- "$rel_path" 2>/dev/null \
  | grep -E "^\+" \
  | grep -v "^+++" \
  | grep -E "@effect-diagnostics[^:]*:[[:space:]]*off" || true)
if [ -n "$suppress_lines" ]; then
  printf '\n[tsgo] @effect-diagnostics suppression is forbidden in %s — fix the violation instead:\n%s\n' \
    "$rel_path" "$suppress_lines"
  exit_code=1
fi

# 2. Run tsgo, filter to Effect-specific diagnostics (6-digit TS codes) for this file.
#    All severities (error + warning) are treated as errors — warnings mean a suppression
#    directive was attempted but had no effect, which is equally actionable.
raw_output=$("$tsgo" --noEmit -p "$tsconfig" 2>&1 || true)

effect_diags=$(printf '%s\n' "$raw_output" \
  | grep -F "$rel_path" \
  | grep -E "TS[0-9]{6}" || true)

if [ -n "$effect_diags" ]; then
  printf '\n[tsgo] Effect diagnostics in %s:\n%s\n' "$rel_path" "$effect_diags"
  exit_code=1
fi

exit $exit_code
