#!/usr/bin/env bash
# Claude Code PreToolUse hook: block --no-verify in Bash commands
# Prevents AI agents from skipping pre-push hooks.

set -euo pipefail

# Read tool input from stdin
input=$(cat)

# Extract the command field from the JSON input
command=$(echo "$input" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Check if the command contains --no-verify
if echo "$command" | grep -q -- '--no-verify'; then
  cat <<'EOF'
{"decision":"block","reason":"--no-verify is not allowed. Pre-push hooks (typecheck, tests) must run before every push. Fix any failing checks instead of skipping them."}
EOF
  exit 0
fi

# Allow all other commands — exit 0 with no output
exit 0
