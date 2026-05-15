# PAIN Archive — Resolved Friction Items

Items are moved here verbatim when fixed. Active items stay in `docs/PAIN.md`.
Convention: fix → move (cut from PAIN.md, paste here in the same commit as the fix).

---

## P17 — `ceremony.ts` key-I/O functions are standalone `async` in `domain/` (severity: annoys)

**FIXED 2026-05-14 — I/O functions extracted to `CeremonyKeyStore.ts` adapter; `domain/ceremony.ts` is now pure.**
test: `packages/host/tests/unit/ceremony.unit.test.ts` — "Ceremony — key-store I/O" describe block (uses `it.effect`).

**Symptom.** `writeKeypair`, `readPublicKey`, `readPrivateKey` in `src/domain/ceremony.ts` were
standalone `async` functions importing `node:fs/promises` and `node:path` directly inside `domain/`,
which should be a pure layer with no I/O dependencies.

**Fix.** Moved all three to `src/adapters/driven/CeremonyKeyStore.ts` as `Effect.fn` functions.
`domain/ceremony.ts` now contains only pure logic (key generation, signing, verification, quorum).
Test updated to import from the adapter and use `it.effect`. `bin/ceremony.ts` updated to call
`Effect.runPromise(writeKeypair(...))`.

---

## P20 — `process.env` used directly instead of Effect `Config` (severity: annoys)

**FIXED 2026-05-14 — all 6 reads migrated to `Config.int`/`Config.string`/`Config.option` with `ConfigProvider.fromEnv()` at composition root.**
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "P20" describe block (grep check).

**Symptom.** `OpenAiCompatLlmProvider.ts`, `bind.ts`, `main.ts`, `CliUserGateway.ts`, and `GitWorkspaceMount.ts` read
`process.env['KEY']` at module level. Bypassed Effect's `Config` system: no structured error on missing config,
no test-controllable injection, no typed defaults.

**Fix.** Replaced all 6 reads:

- `LLM_BASE_URL`, `LLM_MODEL` → `Config.string(...)` inside `Layer.unwrap(Effect.gen(...))` in `OpenAiCompatLlmProvider.layer()`
- `USER_GATEWAY_PORT` → `Config.int(...)` inside `Layer.unwrap(Effect.gen(...))` in `CliUserGateway.layer()`
- `WORKSPACE_PATH` → `Config.option(Config.string(...))` inside `Layer.unwrap(Effect.gen(...))` in `GitWorkspaceMount.layer()`
- `EVENT_STORE_PATH` → `Config.string(...)` inside `Layer.unwrap(Effect.gen(...))` in `eventStoreLayer`
- `PORT` → `await rt.runPromise(Config.int('PORT').pipe(Config.withDefault(3000)))` in `main.ts`

Added `ConfigProvider.layer(ConfigProvider.fromEnv())` provided to `fullLayer` via `.pipe(Layer.provide(...))`.

---

## P23 — `.oxlintrc.json` `no-restricted-imports: "off"` override list was not enforced by a test (severity: annoys)

**FIXED 2026-05-14 in 149f2623 (Phase 1 commit) — acceptance test added.**
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "P23" describe block.

**Symptom.** The `no-restricted-imports: "off"` override that carves out adapters/runtime/checks/main.ts
was the only sanctioned escape hatch from Effect platform discipline. Nothing prevented a future
change from silently appending an application-layer file, re-introducing the P19 anti-pattern.
Discipline alone is fragile.

**Encountered in.** P19 closure session (2026-05-14) — the original anti-pattern was reaching for the
override list to silence the `node:fs/promises` import in `session.ts`. Closure relied on review
discipline, not code.

**Fix.** Added acceptance test that parses `.oxlintrc.json` at test time, finds the override where
`no-restricted-imports === "off"`, and asserts its `files` array equals exactly the canonical
allow-list: `src/adapters/**`, `src/checks/**`, `src/runtime/**`, `src/main.ts`. Any addition to
that list breaks CI immediately.

---

## P18 — `@effect/vitest` `layer()` doesn't compose with file-level `beforeAll`/`afterAll` (severity: blocks work)

**FIXED 2026-05-14 — Effect-native stub server via `NodeHttpServer.layerTest` + `noContentLengthFetchLayer`.**
test: `packages/host/tests/integration/submitGoal.integration.test.ts`, `correlationIdPropagation.integration.test.ts`, `georgesCapabilityFlow.integration.test.ts`

Root cause 1 (timing): `layer()` builds the Layer BEFORE `beforeAll` resolves, so a manually-created HTTP server wasn't listening yet. Fix: moved the fake OpenAI server into `FakeOpenAiStubLive` (an Effect `Layer`) using `NodeHttpServer.layerTest` — server lifecycle is now managed by Effect's Scope.

Root cause 2 (content-length): `HttpClientRequest.setBody` sets `content-length` in request headers; Node.js `fetch` ALSO computes it from the body; WHATWG Headers joins the two as `"N, M"` (comma-joined); undici@8.2.0 rejects the combined value as invalid. Fix: `noContentLengthFetchLayer` wraps `FetchHttpClient.layer` with an `HttpClient.mapRequest` that strips `content-length` before `fetch` is called.

Consolidated the repeated `llmLayer` pattern across 3 integration tests into `makeLlmStubLayer` in `tests/helpers/fakeOpenAiStub.ts`.

---

## P12 — bare `vitest` imports in Effect-using test files (severity: annoys)

**FIXED 2026-05-14 — all test files migrated to `@effect/vitest`; acceptance test green.**
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "P12" describe block

Replaced `from 'vitest'` with `from '@effect/vitest'` across all test files in `packages/host/tests/`. The `@effect/vitest` package re-exports everything from `vitest` (via `export * from "vitest"`) so no behaviour changes — only import source is different. Fixed split-import lint errors (duplicate `@effect/vitest` imports merged).

---

## P11 — Effect pattern guards live in a bash hook, not oxlint (severity: slows)

**FIXED 2026-05-14 in main — oxlint JS plugin + PostToolUse hook replacement.**
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts`

**Symptom.** `check-effect-patterns.sh` detected `Date.now()`, `Effect.runPromise`, and
`correlationId: randomUUID()` via `grep`. Hook was untestable, fragile (stdin/tty blocking bug),
and duplicated work oxlint already did on the same files.

**Fix.** Authored oxlint JS plugin `.claude/oxlint-plugins/effect-patterns.js` (ESLint v9-compatible)
with 4 AST-based rules: `no-date-clock`, `no-runpromise-in-tests`, `no-effect-gen-without-vitest`,
`no-inline-correlation-id`. Rules are TDD-tested, wired in `.oxlintrc.json` via `jsPlugins` +
path-scoped `overrides`. Also added `no-restricted-imports` for node:\* built-ins (mapped to Effect
alternatives). Replaced `check-effect-patterns.sh` PostToolUse entry with `oxlint-check.sh` that
runs the full config on each edited file. Removed the `effect-patterns` lefthook command (now
handled by the `oxlint` command). Migrated 5 test files that were using `Effect.runPromise` to
`it.effect` / `Effect.runSync` patterns to bring existing code into compliance.

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

## P8 — `ToolResultObserved` correlationId drift (severity: slows)

**FIXED 2026-05-14 in main — `CurrentCorrelationId` Context.Reference threaded from `submitGoal` → `emitCorroborator`. Test: `packages/host/tests/integration/correlationIdPropagation.integration.test.ts`.**

**Symptom.** `ToolResultObserved` events carried a fresh UUID instead of the goal's correlationId,
breaking the goal-level correlation chain. Makes it impossible to join tool events to their parent
goal without a secondary key.

**Encountered in.** S1 trace inspection — `ToolResultObserved.correlationId` ≠ `GoalSubmitted.correlationId`.

**Fix.** Created `src/domain/tracing.ts` with `CurrentCorrelationId = Context.Reference<string>` (default `'bootstrap'`).
In `submitGoal.ts`, wraps `LanguageModel.generateText` with `Effect.provideService(CurrentCorrelationId, correlationId)`.
In `GeorgesToolkit.ts`, `emitCorroborator` now `yield* CurrentCorrelationId` instead of `randomUUID()`.
The acceptance test fails on pre-fix code and passes post-fix.

---

## P3 — `sort-keys` lint rule on handler objects (severity: annoys)

**FIXED 2026-05-14 in feat/phase-3-s1-demo — nondestructive-fix PostToolUse hook + pre-commit oxlint --fix.**
test: N/A (predates the acceptance-test convention; covered by oxlint integration run).

**Symptom.** `Toolkit.of({...})` and any multi-key object literal requires alphabetically sorted
keys. Easy to add a new tool handler in the "logical" order (read → write → run) rather than
lexicographic order; discovered only on `pnpm lint`.

**Encountered in.** `GeorgesToolkit.ts` after adding `run-script` after `write-workspace`.

**Fix.** Two-layer auto-fix pipeline:

1. PostToolUse hook (`.claude/hooks/oxlint-check.sh`) runs `oxlint --fix --config
.oxlintrc-nondestructive-fix.json` on every edited file — fixes `sort-keys` silently before
   the full lint check. The nondestructive config enables only `sort-keys` to avoid removing
   in-flight content.
2. Pre-commit hook already runs `pnpm oxlint --fix {staged_files}`, which also fixes sort-keys
   using the main config. Stage-fixed files are re-added automatically via `stage_fixed: true`.
   `sort-keys` violations no longer block commits.

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

---

## P14 — RED acceptance tests block pre-commit without `it.fails` marker (severity: annoys)

**FIXED 2026-05-14 in feat/phase-3-s1-demo — pattern documented; `it.fails` / `it.effect.fails` applied to all RED tests.**
test: N/A — workflow pattern, not a code bug.

**Symptom.** The lefthook `test-changed` pre-commit hook runs all tests related to staged files,
including intentional RED acceptance tests (tests that document current gaps and are expected to
fail). Without the `it.fails` / `it.effect.fails` marker, every commit made while a RED test
exists fails the pre-commit hook.

**Encountered in.** Adding P10/P12/P13 RED tests — commit blocked until each was marked with
the correct vitest fails modifier.

**Fix.** Use `it.fails('RED: ...', () => ...)` for plain vitest RED tests; use
`it.effect.fails('RED: ...', () => Effect.gen(...))` inside `layer()` callbacks.
vitest treats `.fails` tests as: "expected to fail — if unexpectedly passes, report as a failure."
Pattern documented in `.claude/patterns/effect-test-pattern.md`.

---

## P15 — tsgo TS377074 fires when `Effect.runPromise` is used inside an Effect generator (severity: annoys)

**FIXED 2026-05-14 in feat/phase-3-s1-demo — `runPromiseWith(ctx)` + `return yield* forever`.**
test: `pnpm exec tsgo --noEmit -p packages/host/tsconfig.json` exits 0 (typecheck clean).

**Symptom.** The tsgo Effect plugin raises `effect(runEffectInsideEffect)` (TS377074) when
`Effect.runPromise(...)` is called inside a function typed as `Effect.Effect<..., ..., R>`, even
when the inner effect has `never` requirements. A second rule, `effect(missingReturnYieldStar)`
(TS377006), flags `yield* Effect.forever(...)` without a leading `return`.

**Encountered in.** `CliUserGateway.ts`.

**Fix.** TS377074: capture `const ctx = yield* Effect.context<R>()` at the top of the generator,
then use `Effect.runPromiseWith(ctx)(...)` in callbacks. TS377006: write
`return yield* Effect.forever(...)` so the generator exits cleanly.

---

## P16 — `content_hash UNIQUE` constraint fails on repeated tool calls in bootstrap context (severity: blocks work)

**FIXED 2026-05-14 in a7cf9a1c — `INSERT OR IGNORE INTO` + idempotent return of existing row.**
test: `packages/host/tests/protocol/EventStore.spec.ts` — "duplicate append is idempotent" test (GREEN).

**Symptom.** `SqliteEventStore.append` throws `EventStoreError` when the same tool is called
twice in the default (bootstrap) correlation context. After the P8 `correlationId` fix, repeated
`ToolResultObserved` events for the same tool produce identical content hashes, violating the
`UNIQUE` constraint on `content_hash`.

**Encountered in.** e2e tests failing after a manual server start-and-kill left events in `events.db`.

**Fix.** Changed `INSERT INTO` → `INSERT OR IGNORE INTO` in `SqliteEventStore.ts`. If no row is
inserted (duplicate), query and return the already-stored event. Applied same idempotency to
`InMemoryEventStore`. `append` is now a true idempotent upsert.
