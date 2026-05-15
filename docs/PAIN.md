# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

## P28 — Law test coverage at 28% (13/39 laws) — L0.x foundational laws have zero tests

**Severity:** slows (L3 loop health ⚠; 26 laws can drift without automated detection)

**Symptom:** `pnpm loop:health` reports `⚠ Law test coverage: 28% (13/46 laws)`. Existing tests cover: L1.1, L1.3–L1.5, L1.7–L1.8, L2.1, L2.3, L2.6, L2.10–L2.11, L2.13, L3.7. Missing entirely: all L0.x (L0.1–L0.5), L1.2, L1.6, L2.2, L2.4–L2.5, L2.7–L2.9, L2.12, L2.14–L2.16, L3.1–L3.6, L3.8–L3.10. L0.1 ("every law has a test") is particularly ironic — it mandates the very tests that it lacks.

**Candidate fix:** Start with the highest-impact missing laws per phase. L0.4 ("law test existence check") is self-enforcing — a test that fails if any law in SPEC-nav.md lacks a file in `tests/laws/`. Writing L0.4 alone would catch all future regressions automatically. Then add L2.2 (role-scoped mutability), L2.4 (coverage ratchet), L2.14 (hex boundary) which are active in current phases.

**Acceptance test:** Add `tests/laws/L0.4.spec.ts` that enumerates all law IDs from SPEC-nav.md and asserts each has a corresponding spec file in `tests/laws/`. This test currently fails (38 laws have no file) and will pass as coverage grows.

---

## P26 — `schemaSyncInEffect` fires false-positive inside `Effect.try` sync callbacks

**Severity:** annoys (adds suppression boilerplate every time SQLite/sync decode is needed inside Effect.gen)

**Symptom:** `effect(schemaSyncInEffect)` tsgo diagnostic fires when `Schema.decodeUnknownSync` is called inside the `try: () =>` synchronous callback of `Effect.try`, even when that `Effect.try` is nested inside `Effect.gen`. The sync callback cannot `yield*`, so `Schema.decodeUnknownEffect` is not applicable — yet the rule flags it as if it were. Requires `@effect-diagnostics-next-line schemaSyncInEffect:off` on each affected line.

**Candidate fix:** Suppress only the specific sites that are genuinely in sync callbacks (as done). Long-term: open a tsgo issue requesting the rule distinguish between `Effect.gen` body scope and sync sub-callbacks. Alternatively, extract sync decode helpers that run outside any `Effect.gen` scope.

**Affected files:** `packages/host/src/adapters/driven/SqliteEventStore.ts` (2 suppression sites)

---

## P27 — Promise-land fetch adapters cannot use Schema.decodeUnknownEffect → residual `as` casts

**Severity:** annoys (type-safety gap at external API boundary, not caught by tsgo)

**Symptom:** `OpenAiCompatLlmProvider.ts` and `RecordReplayLlmProvider.ts` implement `typeof globalThis.fetch` (Promise-based API). This forces all response body parsing into Promise `.then()` chains where Effect operations cannot be `yield*`. Consequence: `body as Record<string, unknown>`, `choices as Record<string, unknown>[]` casts remain unvalidated by Schema.

**Candidate fix:** Define a `parseOpenAiResponse` helper using `Schema.decodeUnknownOption` (synchronous) over a partial `OpenAiResponseBody` schema. Validates the outer structure (`choices[].message`) before any property access, eliminating the `as` casts. The helper runs synchronously inside `.then()` without needing Effect context.

**Affected files:** `packages/host/src/adapters/driven/OpenAiCompatLlmProvider.ts:38,41,57`, `packages/host/src/adapters/driven/RecordReplayLlmProvider.ts:101,128`

---

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
