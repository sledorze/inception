# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

---

## P1 — Layer wiring fan-out (severity: blocks work)

**Symptom.** Adding a new dependency to `GeorgesToolkitLive` (e.g., `DataHandleRegistry`) requires
manually updating every test file that composes it. Failure is a runtime "Service not found:
@app/host/DataHandleRegistry" with no compile-time signal.

**Encountered in.** L1.1.spec.ts, L2.1.spec.ts after TODO 2.3 added `DataHandleRegistry` to
`GeorgesToolkitLive`.

**Candidate fix.** Export a single `GeorgesToolkitTestLayer` from
`packages/host/tests/helpers/toolkitLayer.ts` that composes all required layers. Test files
import it once; only that file needs updating when dependencies change. Alternatively: Effect
`Layer.provide` could be made to type-error on missing requirements — check if a newer v4 beta
does this.

---

## P2 — `Effect.catchTags` key mismatch is a silent runtime failure (severity: blocks work)

**Symptom.** `Schema.TaggedErrorClass` sets `_tag` to the full namespaced ID (e.g.,
`'@app/host/HandleRevoked'`). `Effect.catchTags({...})` silently ignores keys that don't match
the exact `_tag`. No TypeScript error; the unhandled branch propagates as a defect.

**Encountered in.** `run-script` handler; initial `catchTags` used short names
(`'HandleRevoked'`), causing the error to leak uncaught.

**Candidate fix.** oxlint custom rule (or ESLint plugin) that asserts `catchTags` keys match a
known registry of `_tag` values. Short-term: add a comment convention
`// _tag: '@app/host/HandleRevoked'` next to each `TaggedErrorClass` definition so the mapping
is visually obvious. Consider a shared `ErrorTags` const object to avoid string duplication.

---

## P3 — `sort-keys` lint rule on handler objects (severity: annoys)

**Symptom.** `Toolkit.of({...})` and any multi-key object literal requires alphabetically sorted
keys. Easy to add a new tool handler in the "logical" order (read → write → run) rather than
lexicographic order; discovered only on `pnpm lint`.

**Encountered in.** `GeorgesToolkit.ts` after adding `run-script` after `write-workspace`.

**Candidate fix.** The auto-fix for `sort-keys` is safe — enable it in `oxlint-autofix.sh` so
the lefthook pre-commit pass corrects it automatically instead of blocking. Check oxlint docs for
`--fix` support on `sort-keys`.

---

## P4 — `Tool.make` / `Toolkit` API underdocumented (severity: slows)

**Symptom.** `failureMode: 'return'`, `Toolkit.of`, `Toolkit.toLayer`, `Toolkit.make` patterns
are not in `vendor/effect-smol/ai-docs/`. Discovering the correct incantation required reading
`vendor/effect-smol/packages/effect/src/unstable/ai/` source directly.

**Encountered in.** Phase 2 setup (TODOs 2.1–2.3).

**Candidate fix.** Write `vendor/effect-smol/ai-docs/toolkit.md` — a minimal worked example
covering `Tool.make → Toolkit.make → toLayer → Toolkit.of → handler shape → failureMode`.
This lives in the vendor reference so future Claude invocations find it in the standard lookup
path (`ai-docs/`).

---

## P5 — Vitest must be run from repo root, not package (severity: annoys)

**Status: FIXED.** Added `"test": "cd ../.. && pnpm exec vitest run"` to
`packages/host/package.json`. `pnpm test` from the host package now works.

---

## P6 — `replace_all: true` blast radius on Edit tool (severity: blocks work)

**Symptom.** A broad `replace_all: true` substitution (e.g., `err` → `error`) silently corrupts
unrelated identifiers (`console.error` → `console.erroror`). Requires reading the entire file
after every broad edit to catch collisions.

**Encountered in.** `packages/host/src/main.ts` during `catch-error-name` lint fix.

**Candidate fix.** Avoid `replace_all: true` on short tokens. Prefer targeted single-occurrence
edits or use regex-aware replacement only when the pattern is unambiguous (e.g., whole-word
match). For lint autofixes, let oxlint-autofix.sh do the rename rather than doing it manually.

---

## P7 — No protocol test for `GeorgesToolkit` driving adapter (severity: slows)

**Status: FIXED.** `packages/host/tests/protocol/GeorgesToolkit.spec.ts` created (14 tests).
Covers all 6 tools × success + failure paths. `makeToolkitComponents` extended with optional
`initialFiles` param for workspace seeding.

---

## P8 — `Clock → new Date()` for ISO formatting is ambiguous (severity: annoys)

**Symptom.** The "no `new Date()`" rule in `CLAUDE.md` and `host-package.md` is violated in
letter (but not spirit) by `new Date(ms).toISOString()` where `ms = yield* Clock.currentTimeMillis`.
The construct is correct — `ms` is clock-sourced and `TestClock` controls it — but the rule text
doesn't carve out this safe exception.

**Encountered in.** `emitCorroborator` helper in `GeorgesToolkit.ts`.

**Candidate fix.** Add one sentence to `.claude/rules/host-package.md`:

> "Passing the resolved `ms: number` from `Clock.currentTimeMillis` into `new Date(ms)` for
> ISO-string formatting is acceptable — the test-controllable invariant is the clock, not the
> `Date` constructor."
