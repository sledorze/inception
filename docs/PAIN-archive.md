# PAIN Archive — Resolved Friction Items

Items are moved here verbatim when fixed. Active items stay in `docs/PAIN.md`.
Convention: fix → move (cut from PAIN.md, paste here in the same commit as the fix).

---

## P7 — Reasoning model final answer goes to `reasoning_content`, not `content` (severity: blocks demo)

**FIXED 2026-05-14 in main — fetch intercept in `OpenAiCompatLlmProvider.ts` + integration test.**

**Symptom.** `qwopus3.6-35b-a3b-v1` populates `content` on intermediate tool-calling turns
(e.g. planning text + `finish_reason: "tool_calls"`) but leaves `content` empty on the final
`finish_reason: "stop"` turn — the actual answer lands in `reasoning_content`.
`@effect/ai-openai-compat` reads only `content`, so `GoalCompleted.text` ended up as the
intermediate planning phrase rather than the real answer.

**Fix.** Added `reasoningAwareFetch` in `src/adapters/driven/OpenAiCompatLlmProvider.ts` that
intercepts every HTTP response, parses `choices[].message` via `Schema.decodeUnknownOption`,
and copies `reasoning_content → content` when `content` is blank. Paired with two integration
tests in `tests/integration/p7ReasoningContent.integration.test.ts` using curated fixture files
in `tests/fixtures/lmstudio/`. Shape-alerting (P10) deferred to EventStore integration work.

---

## P9 — syncpack drift undetected between package.json edits (severity: slows)

**FIXED 2026-05-14 in feat/1.3-user-gateway — cycle-hunt.**

**Symptom.** The syncpack pre-commit hook fires only when `**/package.json` is staged.
Pre-existing semver drift (e.g., `^0.86.1` in root devDeps violating the `range: ""` group)
survives silently across many commits until root `package.json` is next modified.
Concretely: `@effect/language-service` and `@effect/tsgo` had carets for 7+ commits.

**Fix.** Added `syncpack` command at `priority: 2` in the pre-push `piped` group in `lefthook.yml`,
running `pnpm syncpack:check:ci` unconditionally (no staging filter). Drift is now caught before
the expensive typecheck+test phase on every push.

---

## P8 — Test breakage detected at push, not commit (severity: slows)

**FIXED 2026-05-14 in feat/1.3-user-gateway — cycle-hunt.**

**Symptom.** A code change that breaks a test is only caught at pre-push
(`pnpm turbo run test:coverage:ci`), not at pre-commit. A commit can introduce
a test-breaking change and the developer only discovers it when the push hook
fires — by which point context has shifted and the failure is further from the cause.

**Fix.** Added `test-changed` command to `pre-commit` group in `lefthook.yml`:
`pnpm vitest run --changed HEAD --passWithNoTests` triggered on `packages/host/**/*.ts`.
Runs only tests related to staged host files; exits 0 when no matching tests exist.
Full suite stays at pre-push.

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

## P2 — `Effect.catchTags` key mismatch

**CLOSED (not-a-bug) 2026-05-14.**

**Symptom.** Concern that `catchTags` silently ignores keys not matching the exact `_tag`.

**Resolution.** TypeScript already enforces this: a wrong key resolves the handler type to `never`,
causing a compile error. No extra machinery needed. String literals in `catchTags` call sites are
sufficient; the type system catches mismatches at typecheck time. Exporting tag constants was
attempted and then reverted — unnecessary complexity.

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
