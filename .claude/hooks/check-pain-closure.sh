#!/usr/bin/env bash
# check-pain-closure.sh — Claude Code hook
#
# Fires when a file is written (PostToolUse: Write/Edit).
# If the diff adds a new FIXED entry to docs/PAIN-archive.md, checks that the
# same Claude Code session also touched at least one test file.
#
# This converts the PAIN closure convention (B1 in the 5-whys remediation) from
# prose-only to a soft enforcement: the hook emits a warning (not a hard block)
# so the author can consciously override it if the test lives in a different
# commit.
#
# Limitation: only checks within the current session's file writes, not the
# full git diff. Hard enforcement is done at pre-push time via lefthook if desired.

set -euo pipefail

# Read file path from Claude Code PostToolUse stdin JSON (same pattern as check-effect-patterns.sh).
input=""
if [ ! -t 0 ]; then
  input=$(cat)
fi
FILE_PATH=""
if [ -n "$input" ]; then
  FILE_PATH=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")
fi

# Only relevant when editing PAIN-archive.md
if [[ "$FILE_PATH" != *"PAIN-archive.md" ]]; then
  exit 0
fi

# Check if a FIXED entry was added (grep for the marker in the file)
if ! grep -q "^FIXED " "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

# Check if any test file was written/edited in this session.
# CLAUDE_WRITTEN_FILES is a colon-separated list provided by the Claude Code harness
# when available. Fall back to grepping git status.
TEST_TOUCHED=false

if [[ -n "${CLAUDE_WRITTEN_FILES:-}" ]]; then
  IFS=':' read -ra FILES <<< "$CLAUDE_WRITTEN_FILES"
  for f in "${FILES[@]}"; do
    if [[ "$f" == *".spec.ts" || "$f" == *".test.ts" || "$f" == *".test.tsx" ]]; then
      TEST_TOUCHED=true
      break
    fi
  done
else
  # Fallback: check git status for staged/unstaged test files
  if git status --short 2>/dev/null | grep -qE '\.(spec|test)\.(ts|tsx)$'; then
    TEST_TOUCHED=true
  fi
fi

if [[ "$TEST_TOUCHED" == "false" ]]; then
  echo "WARNING: PAIN-archive.md was updated with a FIXED entry but no test file was" >&2
  echo "         touched in this session. Per convention (CLAUDE.md 'Log friction'), a" >&2
  echo "         PAIN closure must cite a passing acceptance test. Add the test first," >&2
  echo "         then update PAIN-archive.md with the test path in the FIXED line." >&2
  # Exit 0 (warning, not hard block) — author can consciously proceed.
fi

exit 0
