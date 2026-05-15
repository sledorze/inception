#!/usr/bin/env bash
# Claude Code PreToolUse hook: when a Read targets the pnpm-store copy of the
# effect package, suggest .repos/effect instead.
# node_modules/.pnpm/effect@* is minified/bundled — .repos/effect is the
# full source with ai-docs, AGENTS.md, and proper symbol navigation.
# Advisory only (exit 0) — the Read is not blocked.

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

# Match pnpm virtual store paths for the effect package.
case "$file_path" in
  */node_modules/.pnpm/effect@*|*/node_modules/.pnpm/effect/*|*/node_modules/effect/*)
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    repo_root="$(cd "$script_dir/../.." && pwd)"
    printf '\n[hint] Reading effect source from node_modules — prefer .repos/effect instead.\n'
    printf '       Full source + ai-docs + AGENTS.md: %s/.repos/effect/\n' "$repo_root"
    printf '       Vendor snapshot (read-only):        %s/vendor/effect-smol/\n\n' "$repo_root"
    ;;
esac

exit 0
