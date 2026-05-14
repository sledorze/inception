# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

---

## P19 — `.oxlintrc.json` overrides as a `no-restricted-imports` escape hatch (severity: annoys)

**Symptom.** When a file in `packages/host/src/` needs a restricted import (e.g., `node:fs/promises`), the temptation is to add the file path to the `no-restricted-imports: "off"` override list in `.oxlintrc.json`. This defeats the purpose of the restriction: every exempted file is a gap in the Effect platform discipline.

**Encountered in.** `session.ts` — attempted to add it to the `adapters/runtime/` override to suppress the `no-restricted-imports` error when importing `readFile` from `node:fs/promises`.

**Acceptance test.** The `no-restricted-imports` oxlint rule itself: CI fails when `session.ts` imports from `node:fs/promises` without a proper Effect alternative.

**Candidate fix.** Migrate to `FileSystem.FileSystem` from `@effect/platform` (already done for `session.ts`). Never add application-layer files to the `no-restricted-imports: "off"` override — that list is for adapters, runtime, and entry-points only.

---

## P20 — `process.env` used directly instead of Effect `Config` (severity: annoys)

**Symptom.** `OpenAiCompatLlmProvider.ts`, `bind.ts`, `main.ts`, and other files read `process.env['KEY']` directly (module-level, not in Effect context). This bypasses Effect's `Config` system: no structured error on missing config, no test-controllable config injection, no type-safe defaults with description.

**Encountered in.** `OpenAiCompatLlmProvider.ts` (`LLM_BASE_URL`, `LLM_MODEL`), `bind.ts` (`EVENT_STORE_PATH`), `main.ts` (`PORT`).

**Acceptance test.** None yet — add a grep check that fails if `process.env[` appears in `packages/host/src/` outside of `main.ts` and `runtime/`.

**Candidate fix.** Replace `process.env['KEY'] ?? default` with `Config.withDefault(Config.string("KEY"), default)` yielded inside Effect. Provide at the composition root (`fullLayer`) via `Layer.setConfigProvider(ConfigProvider.fromEnv())`. Config errors surface as typed `ConfigError` rather than silent `undefined`.

---

## P21 — Frontend state management: no Atom pattern, logic in UI components (severity: annoys)

**Symptom.** Frontend components (e.g., `GoalPanel`, `ProposalsPanel`) hold fetched data and async logic directly in local `useState` + `useEffect`. This violates the single-responsibility principle: UI components should be pure render functions; async orchestration and derived state should live in atoms or stores.

**Encountered in.** `packages/frontend/src/` — all three panels mix fetch logic with render logic.

**Acceptance test.** None yet — add a check that fails if `useEffect` + `fetch` appear together in a component file.

**Candidate fix.** Consult experts (Jotai/Zustand/TanStack Query). Recommended pattern: Jotai atoms for server-state (async atoms with `atomWithQuery` or manual `atomWithFetch`); components only call `useAtomValue`/`useSetAtom`. No async logic in `useEffect` inside components. Possibly use TanStack Query for cache invalidation.

---

## P22 — Design System drift: not using shadcn/ui (severity: annoys)

**Symptom.** The project was set up with shadcn/ui as the component library, but current UI components are hand-rolled HTML with Tailwind classes instead of using shadcn/ui primitives (Button, Card, Input, etc.). This causes inconsistency and duplicated effort.

**5-whys:**

1. **Why are components hand-rolled?** Fast-path: skipped the shadcn/ui setup step during Phase 3 UI work.
2. **Why was shadcn/ui setup skipped?** The scaffold was added to the template but `npx shadcn-ui@latest init` was never run to generate the component library.
3. **Why wasn't it run?** No hard enforcement — only a soft recommendation in `packages/frontend/package.json`.
4. **Why no enforcement?** The component library check was not added to the CI pipeline or pre-commit hooks.
5. **Why not?** shadcn/ui components are generated into the source tree; there is no runtime import check to enforce their use.

**Expert advice.** shadcn/ui components (built on Radix UI primitives) provide: accessible ARIA patterns, consistent Tailwind token usage, and keyboard navigation out of the box. Hand-rolling bypasses all three. Use `Button`, `Card`, `Input`, `Dialog`, `Badge` for the current panels before adding any new UI.

**Acceptance test.** None yet — could check that at least one import from `@/components/ui/` exists per panel file.

**Candidate fix.** Run `npx shadcn-ui@latest init` if not done; then replace hand-rolled elements in `GoalPanel`, `ProposalsPanel`, `CallCapabilityPanel` with shadcn/ui primitives. Add a CI check that fails if a panel file has zero `@/components/ui/` imports.

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
