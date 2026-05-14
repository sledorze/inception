# PAIN Archive — Resolved Friction Items

Items are moved here verbatim when fixed. Active items stay in `docs/PAIN.md`.
Convention: fix → move (cut from PAIN.md, paste here in the same commit as the fix).

---

## P1 — Layer wiring fan-out

**FIXED 2026-05-14 in feat/1.3-user-gateway (this commit).**

**Severity:** blocks work.

**Symptom.** Adding a new dependency to `GeorgesToolkitLive` required manually updating every
test file that composes it. `L1.5.spec.ts` duplicated all five `Layer.provide` calls because it
needed an empty `PolicyGate` and the helper didn't support that.

**Fix.** Added optional `permittedTools?: readonly string[]` parameter to `makeToolkitComponents`
in `tests/helpers/toolkitLayer.ts`. Default remains `tools.map(t => t.name)`; passing `[]`
gives the empty-gate behavior. `L1.5.spec.ts` now uses the helper; only `toolkitLayer.ts` needs
to change when `GeorgesToolkitLive` gains a new dependency.

---

## P2 — `Effect.catchTags` key mismatch is a silent runtime failure

**FIXED 2026-05-14 in feat/1.3-user-gateway (this commit).**

**Severity:** blocks work.

**Symptom.** `Schema.TaggedErrorClass` sets `_tag` to the full namespaced ID (e.g.,
`'@app/host/HandleRevoked'`). A `catchTags` key mismatch (short name vs. full tag) can cause
errors to propagate uncaught. Note: TypeScript _does_ catch wrong keys (the handler type resolves
to `never`) — but only if the error channel retains the literal `_tag` type. The real risk is a
tag rename: changing the string inside the class definition silently diverges from all
`catchTags` call sites until the next typecheck run.

**Fix.** Exported `_tag` values as named constants from `DataHandle.ts` (`DataHandleErrorTag`,
`HandleRevokedTag`, `HandleExhaustedTag`, `SensitivityViolationTag`). `GeorgesToolkit.ts` now
uses `[HandleRevokedTag]: ...` computed keys in `catchTags`. A rename of any tag string now
produces a single-site change that the compiler propagates everywhere.

---

## P4 — `Tool.make` / `Toolkit` API underdocumented

**FIXED 2026-05-14 in cdee012.**

**Severity:** slows.

**Symptom.** `failureMode: 'return'`, `Toolkit.of`, `Toolkit.toLayer`, `Toolkit.make` patterns
were not in `vendor/effect-smol/ai-docs/`. Discovering the correct incantation required reading
`vendor/effect-smol/packages/effect/src/unstable/ai/` source directly.

**Encountered in.** Phase 2 setup (TODOs 2.1–2.3).

**Fix.** Created `vendor/effect-smol/ai-docs/src/71_ai/40_toolkit-hosted.md` — worked example
covering `Tool.make → Toolkit.make → toLayer → Toolkit.of → handler shape → failureMode:'return'`.

---

## P5 — Vitest must be run from repo root, not package

**FIXED 2026-05-14 in cdee012.**

**Severity:** annoys.

**Symptom.** `pnpm --filter @app/host test` and `cd packages/host && npx vitest run` both
produce no output or exit code 1 with "No test files found". The vitest config at repo root
controls all include patterns.

**Encountered in.** Every test run during Phase 2.

**Fix.** Added `"test": "cd ../.. && pnpm exec vitest run"` to `packages/host/package.json`.
`pnpm test` from the host package now works.

---

## P7 — No protocol test for `GeorgesToolkit` driving adapter

**FIXED 2026-05-14 in cdee012.**

**Severity:** slows.

**Symptom.** §2.13 + `CLAUDE.md` require every port to have a parametrised protocol-contract
test in `tests/protocol/<port>.spec.ts`. `GeorgesToolkit` is a driving adapter with no such
test. Each tool added to the toolkit grows the contract without structural enforcement.

**Encountered in.** Phase 2 (TODOs 2.1–2.3); the gap was noticed but not addressed during
feature work.

**Fix.** Created `packages/host/tests/protocol/GeorgesToolkit.spec.ts` — 14 tests covering
all 6 tools × success + failure paths. Extended `makeToolkitComponents` with optional
`initialFiles` parameter for workspace seeding.

---

## P8 — `Clock → new Date()` for ISO formatting is ambiguous

**FIXED 2026-05-14 in afa22fa (docs: consolidation guidance).**

**Severity:** annoys.

**Symptom.** The "no `new Date()`" rule in `CLAUDE.md` and `host-package.md` is violated in
letter (but not spirit) by `new Date(ms).toISOString()` where `ms = yield* Clock.currentTimeMillis`.
The construct is correct — `ms` is clock-sourced and `TestClock` controls it — but the rule text
didn't carve out this safe exception.

**Encountered in.** `emitCorroborator` helper in `GeorgesToolkit.ts`.

**Fix.** Added carve-out to `.claude/rules/host-package.md` under "Consolidation patterns":

> "Passing the resolved `ms: number` from `Clock.currentTimeMillis` into `new Date(ms)` for
> ISO-string formatting is acceptable — the test-controllable invariant is the clock."
