#!/usr/bin/env bash
# loop-health.sh — objective loop health metrics computed from repo artifacts.
#
# Each check produces a concrete number from code/git/files — not from doc-reading.
# Exit 0 if all green or only warnings; non-zero (1) if any red signal detected.
#
# Usage: pnpm loop:health
# Spec:  docs/META-LOOPS.md

FAIL=0
WARN=0

pass()    { echo "  ✅ $1"; }
fail()    { echo "  ❌ $1"; FAIL=1; }
warn()    { echo "  ⚠  $1"; WARN=1; }
info()    { echo "  ℹ  $1"; }
pending() { echo "  ⏸ $1 (pending: requires $2)"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║          Meta-loop health — $(date '+%Y-%m-%d')          ║"
echo "╚══════════════════════════════════════════════════╝"

# ── L1: Friction → Fix ────────────────────────────────────────────────────────
echo ""
echo "L1  Friction → Fix"

# Use grep+wc -l (not grep -c) to avoid the "0\n0" double-output when grep
# exits 1 on no matches, which breaks arithmetic expansion on line below.
PAIN_OPEN=$(grep "^## P[0-9]" docs/PAIN.md 2>/dev/null | wc -l | tr -d ' ')
PAIN_ARCHIVED=$(grep "^## P[0-9]" docs/PAIN-archive.md 2>/dev/null | wc -l | tr -d ' ')
PAIN_TOTAL=$(( PAIN_OPEN + PAIN_ARCHIVED ))

if   [ "$PAIN_OPEN" -gt 4 ]; then
  fail "PAIN backlog: $PAIN_OPEN open (target ≤4) — loop not closing"
elif [ "$PAIN_OPEN" -gt 2 ]; then
  warn "PAIN backlog: $PAIN_OPEN open (watch)"
else
  pass "PAIN backlog: $PAIN_OPEN open"
fi

if [ "$PAIN_TOTAL" -gt 0 ]; then
  ARCHIVE_PCT=$(( PAIN_ARCHIVED * 100 / PAIN_TOTAL ))
  if [ "$ARCHIVE_PCT" -lt 30 ]; then
    warn "Archive rate: ${ARCHIVE_PCT}% (${PAIN_ARCHIVED}/${PAIN_TOTAL}) — most items never close"
  else
    pass "Archive rate: ${ARCHIVE_PCT}% (${PAIN_ARCHIVED}/${PAIN_TOTAL})"
  fi
fi

pending "Detection stage at fix" "structured created-at + stage fields in PAIN items"

# ── L2: Cycle-Hunt ────────────────────────────────────────────────────────────
echo ""
echo "L2  Cycle-Hunt"

LAST_HUNT_DATE=$(git log --format="%cd" --date=short --grep="hunt" --max-count=1 2>/dev/null || echo "")
LAST_HUNT_UNIX=$(git log --format="%cd" --date=unix  --grep="hunt" --max-count=1 2>/dev/null || echo "")

if [ -n "$LAST_HUNT_UNIX" ] && [ "$LAST_HUNT_UNIX" -gt 0 ] 2>/dev/null; then
  NOW_UNIX=$(date +%s)
  DAYS_AGO=$(( (NOW_UNIX - LAST_HUNT_UNIX) / 86400 ))
  if [ "$DAYS_AGO" -gt 14 ]; then
    fail "Last hunt: ${DAYS_AGO} days ago (${LAST_HUNT_DATE}) — target ≤14 days"
  else
    pass "Last hunt: ${DAYS_AGO} days ago (${LAST_HUNT_DATE})"
  fi
else
  warn "No hunt commits found in git log"
fi

pending "Output channel quality (hook+pattern vs PAIN-only ratio)" "structured hunt log"

# ── L3: Assessment Frame → Test → Coverage ───────────────────────────────────
echo ""
echo "L3  Assessment Frame → Test → Coverage"

LAW_SPEC_COUNT=$(grep -c "^| L[0-9]\." docs/SPEC-nav.md 2>/dev/null || echo 0)
LAW_TEST_COUNT=$(ls packages/host/tests/laws/*.spec.ts 2>/dev/null | wc -l | tr -d ' ')

if [ "$LAW_SPEC_COUNT" -gt 0 ]; then
  COV_PCT=$(( LAW_TEST_COUNT * 100 / LAW_SPEC_COUNT ))
  if   [ "$COV_PCT" -lt 50 ]; then
    warn "Law test coverage: ${COV_PCT}% (${LAW_TEST_COUNT}/${LAW_SPEC_COUNT} laws)"
  elif [ "$COV_PCT" -lt 80 ]; then
    warn "Law test coverage: ${COV_PCT}% (${LAW_TEST_COUNT}/${LAW_SPEC_COUNT} laws) — growing"
  else
    pass "Law test coverage: ${COV_PCT}% (${LAW_TEST_COUNT}/${LAW_SPEC_COUNT} laws)"
  fi
else
  warn "Could not count laws from docs/SPEC-nav.md"
fi

if pnpm deps:check 2>&1 | grep -q "no dependency violations found" 2>/dev/null; then
  pass "Dep boundaries: 0 violations"
else
  DEP_OUTPUT=$(pnpm deps:check 2>&1 || true)
  if echo "$DEP_OUTPUT" | grep -q "no dependency violations"; then
    pass "Dep boundaries: 0 violations"
  else
    # Run it for real and capture result
    if pnpm deps:check > /dev/null 2>&1; then
      pass "Dep boundaries: 0 violations"
    else
      fail "Dep boundaries: violations — run pnpm deps:check for details"
    fi
  fi
fi

info "Code coverage: enforced by CI ratchet — run pnpm test:coverage:ci for report"

# ── L4: Supervisor → Monitor → Divergence ────────────────────────────────────
echo ""
echo "L4  Supervisor → Monitor → Divergence"

pending "Signal coverage, divergence rate, resolution time" "production event store traffic"

# ── L5: Capability Proposal → Promotion ──────────────────────────────────────
echo ""
echo "L5  Capability Proposal → Promotion"

info "N/A — Phase 4 not yet started"

# ── L6: Session Context → Orientation ────────────────────────────────────────
echo ""
echo "L6  Session Context → Orientation"

PAIN_TOP=$(grep -m1 "^## P[0-9]" docs/PAIN.md 2>/dev/null | sed 's/^## //' || echo "")
if [ -n "$PAIN_TOP" ]; then
  pass "Top PAIN surfaceable: '${PAIN_TOP}'"
else
  warn "PAIN.md has no open items — session hook surfaces nothing"
fi

TODO_LINE=$(grep -m1 "\[todo\]\|\[in-progress\]" docs/TODO.md 2>/dev/null || echo "")
if [ -n "$TODO_LINE" ]; then
  TODO_LABEL=$(echo "$TODO_LINE" | sed 's/.*\(\[todo\]\|\[in-progress\]\) *//' | cut -c1-60)
  pass "Next TODO/in-progress: '${TODO_LABEL}'"
else
  warn "No [todo] or [in-progress] items found in docs/TODO.md"
fi

pending "Priming token cost per session" "session token instrumentation"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────"
if [ "$FAIL" -eq 1 ]; then
  echo "  RESULT  ❌  Red signals — action required"
  echo "          Apply judgement: is this a real problem or a metric artifact?"
  exit 1
elif [ "$WARN" -eq 1 ]; then
  echo "  RESULT  ⚠   Warnings — review and apply judgement"
  exit 0
else
  echo "  RESULT  ✅  All green"
  exit 0
fi
