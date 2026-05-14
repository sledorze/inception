#!/usr/bin/env bash
# Injects dynamic session context: date, branch, uncommitted change summary,
# top open PAIN item, and next TODO item.

DATE=$(date '+%Y-%m-%d')
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
AHEAD=$(git rev-list @{u}..HEAD 2>/dev/null | wc -l | tr -d ' ')

STATUS=""
[ "$DIRTY" -gt 0 ] && STATUS="$DIRTY uncommitted change(s)"
[ "$AHEAD" -gt 0 ] && STATUS="${STATUS:+$STATUS, }$AHEAD unpushed commit(s)"
[ -z "$STATUS" ] && STATUS="clean"

# Top open PAIN item — first ## P heading in docs/PAIN.md
PAIN_TOP=$(grep -m1 "^## P[0-9]" docs/PAIN.md 2>/dev/null | sed 's/^## //')
PAIN_COUNT=$(grep -c "^## P[0-9]" docs/PAIN.md 2>/dev/null || echo 0)

# Next TODO item — first [todo] line in docs/TODO.md
TODO_NEXT=$(grep -m1 "\[todo\]" docs/TODO.md 2>/dev/null | sed 's/.*\[todo\] *//' | cut -c1-80)

CONTEXT="Session started: $DATE | Branch: $BRANCH | Status: $STATUS"
[ -n "$PAIN_TOP" ] && CONTEXT="$CONTEXT | Top PAIN: $PAIN_TOP"
[ -n "$TODO_NEXT" ] && CONTEXT="$CONTEXT | Next TODO: $TODO_NEXT"
[ "$PAIN_COUNT" -ge 3 ] && CONTEXT="$CONTEXT | ($PAIN_COUNT PAIN items open — consider /hunt)"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$CONTEXT"
  }
}
EOF
