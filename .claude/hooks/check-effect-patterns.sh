#!/usr/bin/env bash
# Guardrail: enforce Effect coding patterns in packages/host/
#
# Violations caught:
#   1. Date.now() / new Date() in src/ — use Clock.currentTimeMillis
#   2. Effect.runPromise in tests/    — use it.effect from @effect/vitest
#   3. Effect.gen in test without @effect/vitest import — link usage enforced
#
# Dual-mode:
#   Claude Code PostToolUse[Edit|Write]: reads file_path from stdin JSON.
#     Gives the AI immediate programmatic feedback after every file write.
#   lefthook pre-commit: checks all staged packages/host/ TypeScript files.
#
# Adding PostToolUse wiring closes the "silent violation" gap where the AI
# only discovered pattern errors at lefthook pre-commit time (i.e. too late).

set -uo pipefail

FAIL=0

# ── Detect mode and collect files to check ────────────────────────────────────

SRC_FILES=()
TEST_FILES=()

# Try to read Claude Code tool-input JSON from stdin.
# Guard: only read if stdin is a pipe (PostToolUse). In lefthook context stdin is
# a tty — cat would block forever waiting for keyboard input.
input=""
if [ ! -t 0 ]; then
  input=$(cat)
fi
claude_file=""
if [ -n "$input" ]; then
  claude_file=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")
fi

if [ -n "$claude_file" ]; then
  # Claude Code mode: check the single file that was just written.
  # Note: in bash case, * matches any chars including /, so no ** needed.
  case "$claude_file" in
    packages/host/src/*.ts)
      SRC_FILES=("$claude_file") ;;
    packages/host/tests/*.ts)
      TEST_FILES=("$claude_file") ;;
    *)
      exit 0 ;;
  esac
else
  # lefthook mode: check all staged host TypeScript files.
  while IFS= read -r f; do
    case "$f" in
      packages/host/src/*.ts) SRC_FILES+=("$f") ;;
      packages/host/tests/*.ts) TEST_FILES+=("$f") ;;
    esac
  done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '^packages/host/.+\.ts$' || true)
fi

# ── 1. Date.now() / new Date() in src ─────────────────────────────────────────
for file in "${SRC_FILES[@]+"${SRC_FILES[@]}"}"; do
  if grep -nE '\bDate\.now\(\)|\bnew Date\(\)' "$file" 2>/dev/null; then
    echo "ERROR $file: Date.now() / new Date() detected."
    echo "  → Use: const ms = yield* Clock.currentTimeMillis"
    echo "         then new Date(ms).toISOString() for formatting."
    FAIL=1
  fi
done

# ── 2. Effect.runPromise in tests ─────────────────────────────────────────────
for file in "${TEST_FILES[@]+"${TEST_FILES[@]}"}"; do
  if grep -nE '\bEffect\.runPromise\b' "$file" 2>/dev/null; then
    echo "ERROR $file: Effect.runPromise detected in test file."
    echo "  → Use: import { it } from '@effect/vitest'"
    echo "         it.effect('name', () => Effect.gen(...))"
    FAIL=1
  fi
done

# ── 3. Effect.gen in test without @effect/vitest import ───────────────────────
# Tests that use Effect.gen must import from '@effect/vitest', or explicitly
# bridge via ManagedRuntime.runPromise / rt.runPromise (Promise-side caller).
# Rationale: Effect.gen without @effect/vitest runs outside the Effect runtime
# managed by the test harness — no TestClock, no structured error channel.
for file in "${TEST_FILES[@]+"${TEST_FILES[@]}"}"; do
  if grep -q 'Effect\.gen' "$file" 2>/dev/null; then
    if ! grep -q "@effect/vitest" "$file" 2>/dev/null; then
      if ! grep -q 'runPromise' "$file" 2>/dev/null; then
        echo "ERROR $file: uses Effect.gen without importing from '@effect/vitest'."
        echo "  → Use: import { it } from '@effect/vitest'"
        echo "         it.effect('name', () => Effect.gen(...))"
        echo "  If bridging via ManagedRuntime.runPromise that's exempt (add runPromise)."
        FAIL=1
      fi
    fi
  fi
done


# ── 4. correlationId: randomUUID() inside an adapter ─────────────────────────
# Adapters that call store.append must inherit the request's correlation ID
# via `yield* CurrentCorrelationId` from 'src/domain/tracing.ts'.
# Generating a fresh UUID inline breaks the goal-level correlation chain (P8).
for file in "${SRC_FILES[@]+"${SRC_FILES[@]}"}"; do
  if grep -nE "correlationId:[[:space:]]*randomUUID\(\)" "$file" 2>/dev/null; then
    echo "ERROR $file: correlationId: randomUUID() detected."
    echo "  → Use: const correlationId = yield* CurrentCorrelationId"
    echo "         (import CurrentCorrelationId from 'src/domain/tracing.ts')"
    echo "         randomUUID() generates a fresh ID, breaking goal-level correlation."
    FAIL=1
  fi
done

exit $FAIL
