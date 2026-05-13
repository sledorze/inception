#!/usr/bin/env bash
# Injects dynamic session context: date, branch, and uncommitted change summary

DATE=$(date '+%Y-%m-%d')
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
AHEAD=$(git rev-list @{u}..HEAD 2>/dev/null | wc -l | tr -d ' ')

STATUS=""
[ "$DIRTY" -gt 0 ] && STATUS="$DIRTY uncommitted change(s)"
[ "$AHEAD" -gt 0 ] && STATUS="${STATUS:+$STATUS, }$AHEAD unpushed commit(s)"
[ -z "$STATUS" ] && STATUS="clean"

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Session started: $DATE | Branch: $BRANCH | Status: $STATUS"
  }
}
EOF
