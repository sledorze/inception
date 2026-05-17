# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

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

---

## P41 — UI-state interpretation duplicated into presentation components (P36 regression)

**Severity:** slows

**Symptom:** The Atom migration deleted `useAsyncFetch` (which closed P36) and replaced it
with an inline `AsyncResult.isSuccess(result) ? result.value : null` /
`AsyncResult.isFailure(result) ? String(Cause.squash(result.cause)) : null` 2-liner plus 3
identical imports (`@effect/atom-react`, `effect/unstable/reactivity/AsyncResult`,
`effect/Cause`), duplicated verbatim across 5 migrated components (Metrics, PainBoard,
Patterns, Sessions, WorkBoard). State interpretation now lives in the presentation layer with
no machine boundary preventing further spread. The ~8 un-migrated backoffice components
(AgentMd, SessionDetail, Settings, Proposals, ListTools, ReadWorkspace, WriteWorkspace,
CallCapability, EventRow, FlagForm) and 3 app components (Conversation, Login, SubmitGoal)
still carry the older manual `useState(null)` + promise-chaining (`.then`) variant of the
same coupling. dep-cruiser's `no-frontend-component-api-import` (P36/P37) catches `api/`
imports but NOT result-state interpretation inside a component body.

**Candidate fix:** Derived view-model atoms in `packages/backoffice/src/atoms.ts` (and an
`app/atoms.ts` equivalent) via `Atom.map(srcAtom, AsyncResult.match({ onInitial, onFailure,
onSuccess }))` producing a discriminated union `{ _tag: 'Loading' | 'Error' | 'Ready'; ... }`.
Components consume the ready view-model via `useAtomValue` and render only — zero
`AsyncResult`/`Cause` imports in component files. Migrate the legacy components onto the same
atom + view-model layer (eliminating `.then(` from all component files). Add
`.claude/patterns/frontend-atoms.md` documenting the view-model-atom pattern, and a
machine-checked boundary (enforce-conventions assertion or dep-cruiser deny rule) forbidding
`AsyncResult`/`Cause` imports and `.then(` promise chains in
`packages/(app|backoffice)/src/components/`.

**Acceptance test.** `packages/host/tests/unit/enforce-conventions.unit.test.ts` —
"Frontend presentation components must not interpret async state (P41)"
