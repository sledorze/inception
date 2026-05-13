#!/usr/bin/env bash
# Run Stryker mutation testing only on source files changed vs origin/main.
# Used by the pre-push hook and CI for fast, scoped mutation testing.
#
# Usage:
#   bash scripts/stryker-changed.sh            # both backend + frontend (local)
#   bash scripts/stryker-changed.sh backend     # backend only (CI job)
#   bash scripts/stryker-changed.sh frontend    # frontend only (CI job)
#
# Detects three kinds of changes:
#   1. Committed changes on the branch (merge-base..HEAD)
#   2. Staged but uncommitted changes (HEAD vs index)
#   3. Unstaged working tree changes (index vs worktree)
# This ensures fresh branches (where HEAD == origin/main) still pick up
# uncommitted work.
#
# Runs backend and frontend Stryker separately so each mutant only triggers
# relevant tests.

set -euo pipefail

MODE="${1:-all}"

# Determine the base commit to diff against.
MERGE_BASE=$(git rev-parse origin/main 2>/dev/null || echo "HEAD~1")

# CI-specific flags (GitHub Actions sets CI=true)
CI_ARGS=""
if [ "${CI:-}" = "true" ]; then
  CI_ARGS="--logLevel warn --reporters progress,html"
fi

# --- Backend ---
if [[ "$MODE" == "all" || "$MODE" == "backend" ]]; then
  BACKEND_COMMITTED=$(git diff --name-only "$MERGE_BASE" HEAD -- 'packages/backend/src/**/*.ts' || true)
  BACKEND_UNCOMMITTED=$(git diff --name-only HEAD -- 'packages/backend/src/**/*.ts' || true)

  BACKEND_CHANGED=$(printf '%s\n%s' "$BACKEND_COMMITTED" "$BACKEND_UNCOMMITTED" \
    | sort -u \
    | grep -v '\.test\.ts$' \
    | grep -v '\.spec\.ts$' \
    | grep -v '\.d\.ts$' \
    | grep -v 'packages/backend/src/main\.ts' \
    | grep -v '^$' || true)

  if [ -n "$BACKEND_CHANGED" ]; then
    MUTATE_ARG=$(echo "$BACKEND_CHANGED" | paste -sd ',' -)
    echo "Running Stryker (backend) on changed files: $MUTATE_ARG"
    # shellcheck disable=SC2086
    npx stryker run $CI_ARGS --mutate "$MUTATE_ARG"
  else
    echo "No backend source files changed — skipping backend Stryker."
  fi
fi

# --- Frontend ---
if [[ "$MODE" == "all" || "$MODE" == "frontend" ]]; then
  FRONTEND_COMMITTED=$(git diff --name-only "$MERGE_BASE" HEAD -- 'packages/frontend/src/**/*.ts' 'packages/frontend/src/**/*.tsx' || true)
  FRONTEND_UNCOMMITTED=$(git diff --name-only HEAD -- 'packages/frontend/src/**/*.ts' 'packages/frontend/src/**/*.tsx' || true)

  FRONTEND_CHANGED=$(printf '%s\n%s' "$FRONTEND_COMMITTED" "$FRONTEND_UNCOMMITTED" \
    | sort -u \
    | grep -v '\.test\.\(ts\|tsx\)$' \
    | grep -v 'packages/frontend/src/main\.tsx' \
    | grep -v '^$' || true)

  if [ -n "$FRONTEND_CHANGED" ]; then
    MUTATE_ARG=$(echo "$FRONTEND_CHANGED" | paste -sd ',' -)
    echo "Running Stryker (frontend) on changed files: $MUTATE_ARG"
    # shellcheck disable=SC2086
    npx stryker run stryker.frontend.config.json $CI_ARGS --mutate "$MUTATE_ARG"
  else
    echo "No frontend source files changed — skipping frontend Stryker."
  fi
fi
