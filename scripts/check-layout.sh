#!/usr/bin/env bash
# check-layout.sh — guard against CLAUDE.md repository layout section drifting from reality.
# Parses directory names mentioned in CLAUDE.md's layout block and fails if any named
# directory does not exist under packages/ or at the repo root.
# Fixes P29: "(target)" sections drift silently.
set -euo pipefail

# Resolve the git root robustly: works in regular clones and git worktrees alike.
# Worktrees have a .git FILE (not dir) so dirname-based lookup can resolve to the
# main worktree instead; `git rev-parse --show-toplevel` in the CWD is always correct.
ROOT="$(git rev-parse --show-toplevel)"
CLAUDE_MD="$ROOT/CLAUDE.md"

errors=0

check_dir() {
  local dir="$1"
  if [ ! -d "$ROOT/$dir" ]; then
    echo "LAYOUT DRIFT: '$dir' is referenced in CLAUDE.md but does not exist" >&2
    errors=$((errors + 1))
  fi
}

# Extract directory entries from the layout section (lines like "  packages/foo/" or "kernel/").
# Match lines with a path followed by spaces and a description.
while IFS= read -r line; do
  # Match: optional leading spaces, then a path ending with / (e.g. "  packages/host/" or "kernel/")
  if [[ "$line" =~ ^[[:space:]]*(packages/[a-z_-]+|kernel|formal|docs|\.claude)/ ]]; then
    dir="${BASH_REMATCH[1]}"
    # Skip sub-paths like packages/host/src/ — only check top-level package dirs
    if [[ "$dir" =~ ^packages/([a-z_-]+)$ ]]; then
      check_dir "$dir"
    elif [[ "$dir" =~ ^(kernel|formal|docs|\.claude)$ ]]; then
      check_dir "$dir"
    fi
  fi
done < "$CLAUDE_MD"

if [ "$errors" -gt 0 ]; then
  echo "" >&2
  echo "Fix: update CLAUDE.md to reflect the actual repository layout." >&2
  exit 1
fi

echo "Layout check passed."
