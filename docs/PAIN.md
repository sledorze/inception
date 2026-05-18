# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

<!-- Hunt log 2026-05-17
Triggers that fired: explicit /hunt invocation + 5 open PAIN items (≥3 threshold)
Hunt start time: 13:58

Candidates:
  1. Target: bridge-zone.md — "Current bridge zones" table lists 3 files and says "when TODO 10.1
     lands", but TODO 10.1 IS done and 4 files are annotated (CliUserGateway.ts missing from table)
     | Heuristic: #6 stale doc | Output channel: .claude/patterns/bridge-zone.md (table fixed)
  2. Target: enforce-conventions.unit.test.ts line 143 — comment says "RED: both assertions fail on
     current code. Remove .fails when green cycle lands." but P41 is already GREEN (it.fails removed)
     | Heuristic: #6 stale doc | Output channel: enforce-conventions.unit.test.ts (comment updated)
  3. Target: bridge-zone.md not in CLAUDE.md "When in doubt" — relevant whenever an agent encounters
     a Promise/async in src/ and needs to know if it's a legitimate bridge; not discoverable without
     browsing patterns/ manually; P46/P47 both hinge on this annotation mechanism
     | Heuristic: #5 pattern absence + #8 context-priming | Output channel: CLAUDE.md (new entry)

Stopped because: 3 candidates surfaced and landed.
All three resolved in one commit. No new PAIN items (these were direct inline fixes).
-->

<!-- Hunt log 2026-05-15 (third pass)
Triggers that fired: explicit /hunt invocation
Hunt start time: 23:45

Candidates:
  1. Target: tsgo-effect-check.sh grep-whole-file policy → every edit to main.ts / SqliteEventStore.ts
     raises false-positive suppression block (pre-existing legitimate directives)
     | Heuristic: #7 asymmetric feedback + #1 detection-stage drift (check became noise, ignored)
     | Output channel: .claude/hooks/tsgo-effect-check.sh (switched to git diff added-lines only)
     | Bonus: SqliteEventStore.ts schemaSyncInEffect:off suppressions replaced with better-sqlite3
       generic typing — suppressions eliminated rather than whitelisted
  2. Target: No .claude/patterns/schema-decode.md — three-way decode API decision (decodeUnknownEffect /
     decodeUnknownResult / decodeUnknownSync) re-derived each session; this session cost 3 typecheck
     cycles to discover the correct API
     | Heuristic: #5 pattern absence
     | Output channel: .claude/patterns/schema-decode.md (new pattern file)
  3. Target: Law test coverage at 28% (13/39 laws) — pnpm loop:health L3 ⚠ signal; L0.x laws
     (including L0.1 "every law has a test") have zero coverage
     | Heuristic: #9 meta-loop health
     | Output channel: docs/PAIN.md (new item P28; fix > 30 min)

Stopped because: 3 candidates surfaced and landed.
All three resolved: hook fixed inline, pattern created, PAIN item filed as P28.
-->

<!-- Hunt log 2026-05-15 (second pass)
Triggers that fired: explicit /hunt invocation
Hunt start time: 17:20

Candidates:
  1. Target: loop-health.sh — grep -c double-output arithmetic errors + [in-progress] blind spot
     | Heuristic: #9 meta-loop + #6 stale | Output channel: scripts/loop-health.sh (fixed inline)
  2. Target: CLAUDE.md rituals reference [todo] only — misses in-progress item 4.3
     | Heuristic: #6 stale doc + #8 priming | Output channel: CLAUDE.md (2 lines updated)
  3. Target: check-test-conventions.ts runs only in CI — test naming violation invisible until PR
     | Heuristic: #1 detection-stage drift | Output channel: lefthook.yml (conventions step at pre-push)

Stopped because: 3 candidates surfaced and mechanized.
All resolved in commit 24a1c979. No open PAIN items added.
-->

<!-- Hunt log 2026-05-15
Triggers that fired: explicit /hunt invocation
Hunt start time: 17:10

Candidates:
  1. Target: oxlint-check.sh PostToolUse uses root config for frontend files → design-system plugin silently skipped at edit time
     | Heuristic: #1 detection-stage drift | Output channel: .claude/hooks/oxlint-check.sh (fixed inline)
  2. Target: session-context.sh grep [todo] misses [in-progress] items → TODO 4.3 invisible to session hook
     | Heuristic: #6/#8 stale doc + priming | Output channel: .claude/hooks/session-context.sh (fixed inline)
  3. Target: design-system rule extension cycle applied 3× with no pattern reference
     | Heuristic: #5 pattern absence | Output channel: .claude/patterns/frontend-design-system.md (new file)

Stopped because: 3 candidates surfaced and mechanized.
All three findings resolved in commit 5030e00c — no open PAIN items added.
-->

<!-- Hunt log 2026-05-17 (second pass)
Triggers that fired: explicit /hunt invocation
Hunt start time: 16:05

Candidates:
  1. Target: session-context.sh — when PAIN.md and TODO.md are both empty the hook emits only
     date/branch/status with no orientation; loop-health L6 warning confirms the gap
     | Heuristic: #8 context-priming | Output channel: .claude/hooks/session-context.sh (fallback line added)
  2. Target: @effect-diagnostics strictEffectProvide:off — caused a two-commit round-trip this
     session (removed in 9fd1ca98, restored in c3233cdf); pattern undocumented; tsgo suppression
     distinct from promise-bridge annotation but absent from bridge-zone.md
     | Heuristic: #5 pattern absence | Output channel: .claude/patterns/bridge-zone.md (new section added)
  3. Target: P44 rate-limit HTTP wiring — unit tests prove rate-limiter logic but the wiring in
     main.ts (IP from HttpServerRequest.remoteAddress, 429 + Retry-After header) has no test coverage;
     review flagged; IP fallback to 'unknown' under a proxy would gate all traffic
     | Heuristic: #1 detection-stage drift | Output channel: docs/PAIN.md (new item P49)

Stopped because: 3 candidates surfaced and landed.
-->
