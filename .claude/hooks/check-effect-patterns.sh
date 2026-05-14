#!/usr/bin/env bash
# Guardrail: enforce Effect coding patterns in packages/host/
#
# Violations caught:
#   1. Date.now() / new Date() in src/ — use Clock.currentTimeMillis
#   2. Effect.runPromise in tests/   — use it.effect from @effect/vitest
#
# Triggered by: lefthook pre-commit (oxlint doesn't support no-restricted-syntax)

set -euo pipefail

FAIL=0

# ── 1. Date.now() / new Date() in src ─────────────────────────────────────────
# new Date() without args reads current wall time — breaks TestClock.
# new Date(n) is OK (converting a known timestamp for formatting).
while IFS= read -r file; do
  if grep -nE '\bDate\.now\(\)|\bnew Date\(\)' "$file" 2>/dev/null; then
    echo "ERROR $file: Date.now() / new Date() detected."
    echo "  → Use: const ms = yield* Clock.currentTimeMillis"
    echo "         then new Date(ms).toISOString() for formatting."
    FAIL=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACM | grep -E '^packages/host/src/.+\.ts$' || true)

# ── 2. Effect.runPromise in tests ─────────────────────────────────────────────
# Tests must use it.effect from @effect/vitest (provides TestClock, etc.).
while IFS= read -r file; do
  if grep -nE '\bEffect\.runPromise\b' "$file" 2>/dev/null; then
    echo "ERROR $file: Effect.runPromise detected in test file."
    echo "  → Use: import { it } from '@effect/vitest'"
    echo "         it.effect('name', () => Effect.gen(...))"
    FAIL=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACM | grep -E '^packages/host/tests/.+\.ts$' || true)

exit $FAIL
