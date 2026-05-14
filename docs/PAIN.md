# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

---

## P6 — `replace_all: true` blast radius on Edit tool (severity: blocks work)

**Symptom.** A broad `replace_all: true` substitution (e.g., `err` → `error`) silently corrupts
unrelated identifiers (`console.error` → `console.erroror`). Requires reading the entire file
after every broad edit to catch collisions.

**Encountered in.** `packages/host/src/main.ts` during `catch-error-name` lint fix.

**Candidate fix.** Avoid `replace_all: true` on short tokens. Prefer targeted single-occurrence
edits or use regex-aware replacement only when the pattern is unambiguous. For lint autofixes,
let `oxlint-autofix.sh` do the rename rather than doing it manually.

---

## P10 — LMStudio response shape divergence not surfaced to EventStore (severity: annoys)

**Symptom.** `OpenAiCompatLlmProvider`'s `reasoningAwareFetch` intercept uses
`Schema.decodeUnknownOption(LmMessage)` to parse each `message` object. When the shape
doesn't match (e.g. new LMStudio version adds or removes fields), the intercept emits
`console.warn` and passes the message through unchanged — but this signal never reaches the
`EventStore`, so Claude has no way to inspect it later via `/events` or outer-MCP replay.

**Encountered in.** S1 run (task 3.2 / 3.4) — `console.warn` is a temporary bridge; the proper
channel is an `UnknownShapeObserved` event in the store.

**Acceptance test.** `packages/host/tests/integration/p10UnknownShape.integration.test.ts` — RED.
Proves 0 `UnknownShapeObserved` events reach `EventStore` on current code.

**Candidate fix.** Promote the warn to a structured `UnknownShapeObserved` event appended to
`EventStore`. Requires bridging the fetch intercept (Promise territory) back to the Effect runtime
— probably done via a shared `Queue` injected at boot, similar to how `CliUserGateway` bridges
HTTP callbacks.

---

## P12 — bare `vitest` imports in Effect-using test files (severity: annoys)

**Symptom.** Several integration-test files import `describe`, `expect`, `beforeAll`, `afterAll`,
and `it` from `'vitest'` directly, even though `@effect/vitest` re-exports all of them (via
`export * from "vitest"`) and adds Effect-specific runners (`it.effect`, `layer`). Mixing import
sources fragments the test surface: Effect-enhanced error reporting applies only to `it.effect`,
but `describe`/`expect` from bare vitest don't benefit from Effect's structured error formatting.

**Encountered in.** `p7ReasoningContent.integration.test.ts`, `observeBin.integration.test.ts`,
`correlationIdPropagation.integration.test.ts`, `submitGoal.integration.test.ts`.

**Acceptance test.** `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "P12" describe block.
RED: grep finds integration test files that import from bare `'vitest'`.

**Candidate fix.** Replace all `from 'vitest'` with `from '@effect/vitest'` in integration test
files. Possibly add an oxlint `no-restricted-imports` override scoped to `*.integration.test.ts`
that forbids `'vitest'` in favour of `'@effect/vitest'`.

---

## P13 — Node.js built-in imports in test files instead of Effect alternatives (severity: annoys)

**Symptom.** Integration-test helpers and test files import `tmpdir` from `'node:os'`,
`join` from `'node:path'`, and `randomUUID` from `'node:crypto'` — the three built-ins that
have direct Effect / `@effect/platform` equivalents (`FileSystem.tempDirectory`, `Path.join`,
`Random`). Using Node.js APIs directly in tests that already depend on the Effect runtime is
inconsistent and blocks `TestClock`-style determinism for path/random operations.

**Encountered in.** `tests/integration/observeBin.integration.test.ts`, `fakeLmstudioServer.ts`
helper, `correlationIdPropagation.integration.test.ts`.

**Acceptance test.** `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "P13" describe block.
RED: grep finds integration test files importing from `node:os`, `node:path`, or `node:crypto`.

**Candidate fix.** Replace with `@effect/platform`'s `FileSystem` / `Path` services and
Effect's `Random` module where tests already have an Effect runtime in scope. Refactor
`fakeLmstudioServer.ts` to accept a pre-resolved path string (keeping node:path out of helpers).

---

## P17 — `ceremony.ts` key-I/O functions are standalone `async` in `domain/` (severity: annoys)

**Symptom.** `writeKeypair`, `readPublicKey`, `readPrivateKey` in `src/domain/ceremony.ts` are
standalone `async` functions (not wrapped in Effect). They import `node:fs/promises` and
`node:path` directly inside `domain/`, which should be a pure layer with no I/O dependencies.
The imports are suppressed with `// oxlint-disable-line` comments that pre-date the
`block-oxlint-disable.sh` hook (so they remain, but no new ones can be added).

**Encountered in.** Async-violation cleanup session (2026-05-14) — fixing all standalone async
functions in `packages/host/src/`.

**Acceptance test.** None yet — add one that greps `src/domain/` for `async` keyword and fails
if found, OR after the fix verify `ceremony.ts` has no `async` keyword.

**Candidate fix.** Extract `writeKeypair`, `readPublicKey`, `readPrivateKey` out of `domain/`
into a new adapter `adapters/driven/CeremonyKeyStore.ts` that uses `FileSystem.FileSystem` +
`Path.Path`. Keep `domain/ceremony.ts` pure (key generation, signing, verification only).
