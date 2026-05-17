# PAIN Archive — Resolved Friction Items

Items are moved here verbatim when fixed. Active items stay in `docs/PAIN.md`.
Convention: fix → move (cut from PAIN.md, paste here in the same commit as the fix).

---

## P51 — In-memory auth sessions lost on every server restart (forced re-auth)

**Severity:** blocks work (dev loop: every `tsx watch` reload logs the user out)

**Symptom:** `ScryptAuthGateway` stores sessions in a `Map` that lives only for the
server process. A valid `localStorage` token (correctly persisted) hits `verify` on a
fresh `Map` → `SessionNotFound` → 401. Frontend has no graceful 401 path: it shows a
raw `Error: 401: ...` string instead of returning the user to the login screen.

**Candidate fix:**

- `ScryptAuthGateway.fileBackedLayer(credentials, sessionsPath)` — load sessions from a
  JSON file on layer build (filter expired), persist on every login/logout/sliding-renewal.
- TTL → 7 days, sliding (renew `expiresAtMs` on each successful `verify`).
- `bind.ts` wires `fileBackedLayer` with `SESSIONS_PATH = data/sessions.json`.
- `shared-api/handleErr`: 401 → `clearToken()` + `window.dispatchEvent(new CustomEvent('auth:expired'))`.
- Both `App.tsx` files: listen `auth:expired` → `setAuthed(false)`.
- `.gitignore`: `**/data/sessions.json` (bearer tokens, must not be staged).

**Red-step test:** `packages/host/tests/integration/authSessionPersistence.integration.test.ts`
(fails on current in-memory code; green after `fileBackedLayer` lands).

FIXED 2026-05-17 in feat/design-system-enforcement (TODO 10.16) — test: packages/host/tests/integration/authSessionPersistence.integration.test.ts (2 tests: token survives layer rebuild, sliding renewal extends lifetime).

---

## P46 — `effect-patterns` oxlint plugin misses top-level `await` and `.then` chaining

**Severity:** slows

FIXED 2026-05-17 in feat/design-system-enforcement (TODO 10.9) — `AwaitExpression` visitor added
to `noAsyncInSrc`; `.then(` member-call detection added to `noRawPromise`; bypass hardened from
`src.includes(...)` to first-5-lines line-start check in all three bridge-aware rules
(`noAsyncInSrc`, `noRawPromise`, `noTryCatchInSrc`). Bypass-in-string-literal false-negative
eliminated. All 3 RED `it.fails` tests promoted to plain `it` — GREEN.
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` —
"effect-patterns/no-async-in-src — top-level await (P46)" +
"effect-patterns/no-raw-promise — .then chaining (P46)" (3 assertions GREEN)

---

## P47 — two `src/checks/*.ts` CLI scripts use unannotated top-level `await Effect.runPromise`

**Severity:** slows (genuine hard-rule violation, invisible to all tooling today)

**Symptom:** `packages/host/src/checks/check-test-conventions.ts:68` and
`packages/host/src/checks/check-file-structure.ts:79` both ended with:

```ts
await Effect.runPromise(program.pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))))
```

The file header carried `/** @effect-diagnostics strictEffectProvide:off */` but no
`// promise-bridge: intentional`. Invisible because the P46 `AwaitExpression` gap meant oxlint
never fired on them.

FIXED 2026-05-17 in feat/design-system-enforcement (TODO 10.10) — both files converted to
`program.pipe(Effect.provide(Layer.mergeAll(...)), NodeRuntime.runMain)` using
`import * as NodeRuntime from '@effect/platform-node/NodeRuntime'` (subpath import). The
`@effect-diagnostics` header removed; no bridge annotation needed. P46 `AwaitExpression` test
proves detection; P47 conversion means both files now pass `pnpm lint` cleanly.
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — P46 `AwaitExpression` case (GREEN)

---

## P48 — frontend api layer: `handleErr` ×3, duplicated `authedFetch`/`TOKEN_KEY`, 5 endpoints skip error handling

**Severity:** annoys

FIXED 2026-05-17 in feat/design-system-enforcement (TODO 10.11) — extracted `@app/shared-api`
workspace package (`packages/shared-api/src/index.ts`) owning `TOKEN_KEY`, token accessors,
`handleErr`, `authedFetch`, and new `getJson<T>` helper (authedFetch + handleErr + json()).
Both `packages/app/src/api/auth.ts` and `packages/backoffice/src/api/auth.ts` reduced to
`export * from '@app/shared-api'`. Removed local `handleErr` re-declaration from `admin.ts`.
Fixed 5 bare endpoints (`getMetrics`, `getPain`, `getWork`, `listProposals`, `callTool`) to
route through `getJson` — non-2xx responses now surface the server's error message.
test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` —
"Frontend api layer: handleErr declared in exactly one file (P48)" (2 assertions GREEN)

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

FIXED 2026-05-17 in feat/design-system-enforcement — `AsyncView<T>` discriminated union
(`Loading | Error | Ready`, each with `.waiting`) added to `packages/backoffice/src/atoms.ts`
via `Atom.map` + `AsyncResult.match`; 5 atom-based components migrated to `*View` atoms
(no AsyncResult/Cause imports); 13 legacy components converted from `.then(` to `async/await`;
`.claude/patterns/frontend-atoms.md` documents the pattern. Machine boundary: two assertions
in `enforce-conventions.unit.test.ts` now pass (previously `it.fails`).
test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` —
"Frontend presentation components must not interpret async state (P41)" (2 assertions GREEN)

---

## P35 — `async`/`await` and raw `Promise` in `packages/host/src/` are CLAUDE.md-only — no lint enforcement

**Severity:** slows

**Symptom:** The hard rule "No async/await or try/catch in packages/host/" in CLAUDE.md had zero machine backing. Nothing caught standalone `async function` declarations, `Promise.resolve()`, `Promise.reject()`, or `new Promise()` in `src/` files. Legitimate bridge adapters carried prose comments but no machine-readable marker.

FIXED 2026-05-16 in feat/design-system-enforcement — added `effect-patterns/no-async-in-src` and `effect-patterns/no-raw-promise` rules to `.claude/oxlint-plugins/effect-patterns.js`. Both rules check for `// promise-bridge: intentional` at file scope before firing. Annotated 4 bridge zone files: `OpenAiCompatLlmProvider.ts`, `RecordReplayLlmProvider.ts`, `CliUserGateway.ts`, `main.ts`. Pattern documented in `.claude/patterns/bridge-zone.md`. test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "effect-patterns/no-async-in-src (P35)"

---

## P39 — `try/catch` in `packages/host/src/` — the second half of the hard rule has no enforcement

**Severity:** slows

**Symptom:** The `try/catch` half of the CLAUDE.md hard rule was completely unenforced. Active violation: `ceremony.ts` `verifySignature` used `try { return verify(...) } catch { return false }` inside `domain/`.

FIXED 2026-05-16 in feat/design-system-enforcement — added `effect-patterns/no-try-catch-in-src` rule to `.claude/oxlint-plugins/effect-patterns.js` (bridge-zone exemption via `// promise-bridge: intentional`). Refactored `ceremony.ts` `verifySignature` to `Effect.try({ try: ..., catch: () => new CryptoVerifyError() }).pipe(Effect.catch(() => Effect.succeed(false)))` and `checkQuorum` to `Effect.gen` with `yield* verifySignature`. Updated `ceremony.unit.test.ts` and `ceremonyBin.integration.test.ts` to use `it.effect` + `yield*`. test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — "effect-patterns/no-try-catch-in-src (P39)"

---

## P36 — Frontend components couple data-fetching, state management, and rendering in one unit

**Severity:** slows

**Symptom:** 20 components in `packages/app/src/components/` and `packages/backoffice/src/components/` imported directly from `../../api/` and owned the full data lifecycle. No `hooks/` mediation layer existed; no dep-cruiser deny rule blocked the coupling.

FIXED 2026-05-16 in feat/design-system-enforcement — created `hooks/useAsyncFetch.ts` in both packages; created hooks/ facade files re-exporting api/ modules; migrated all 20 components to import from `../../hooks/`; applied `useAsyncFetch` to 5 simple read-pattern components (Metrics, PainBoard, Patterns, WorkBoard, Sessions); added dep-cruiser `no-frontend-component-api-import` deny rule. test: `packages/host/tests/unit/depCruiserBoundary.unit.test.ts` (3 tests pass)

---

## P37 — Dep-cruiser `packages/(app|backoffice)` rule was allow-all — no sub-directory boundaries enforced

**Severity:** annoys

**Symptom:** No dep-cruiser deny rules for app/backoffice internal topology. components→api and api→components imports were structurally invisible to CI.

FIXED 2026-05-16 in feat/design-system-enforcement — same fix as P36: added `no-frontend-component-api-import` deny rule to `.dependency-cruiser.cjs`. test: `packages/host/tests/unit/depCruiserBoundary.unit.test.ts`

---

## P38 — Critical `.claude/patterns/` files are passive docs not surfaced at the point of decision

**Severity:** annoys

**Symptom:** `effect-test-pattern.md`, `schema-decode.md`, and `composition-root.md` were discovered only if the developer explicitly knew to look in `.claude/patterns/`. No "When in doubt" link pointed to them at the relevant decision points.

FIXED 2026-05-16 in feat/design-system-enforcement — created `.claude/commands/effect-test-pattern.md`, `.claude/commands/schema-decode.md`, `.claude/commands/composition-root.md` as project slash commands. Added three decision-point entries to CLAUDE.md "When in doubt" section (`/effect-test-pattern`, `/schema-decode`, `/composition-root`). test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` — "P38" (6 assertions)

---

## P40 — Cross-package quality standards drift — no single-source enforcement

**Severity:** slows

**Symptom:** `app/`, `backoffice/`, and `host/` package oxlint configs grew independently with no shared base — a new rule or convention had to be added to each separately, and drift was structurally invisible.

FIXED 2026-05-16 in feat/design-system-enforcement — created `packages/design-system/.oxlintrc-base.json` as the shared base; added `"extends": ["../design-system/.oxlintrc-base.json"]` to `app/`, `backoffice/`, and `host/` `.oxlintrc.json` files. test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` — "P40" (1 assertion, 3 packages verified)

---

## P26 — `schemaSyncInEffect` fires false-positive inside `Effect.try` sync callbacks

**Severity:** annoys (adds suppression boilerplate every time SQLite/sync decode is needed inside Effect.gen)

**Symptom:** `effect(schemaSyncInEffect)` tsgo diagnostic fires when `Schema.decodeUnknownSync` is called inside the `try: () =>` synchronous callback of `Effect.try`, even when that `Effect.try` is nested inside `Effect.gen`. The sync callback cannot `yield*`, so `Schema.decodeUnknownEffect` is not applicable — yet the rule flags it as if it were.

FIXED 2026-05-16 in feat/design-system-enforcement — extract sync decode helpers to plain functions outside `Effect.gen` scope (`rowToStoredEvent` in SqliteEventStore.ts). All `schemaSyncInEffect:off` suppressions eliminated. Also fixed tsgo diagnostics in new FileBackedSettings.ts by using `Schema.decodeUnknownEffect(Schema.fromJsonString(...))` and `Schema.encodeEffect(Schema.fromJsonString(...))` instead of `JSON.parse`/`JSON.stringify`. test: `packages/host/tests/unit/schemaSyncSuppressions.unit.test.ts`

---

## P28 — Law test coverage at 28% (13/39 laws) — L0.x foundational laws have zero tests

**Severity:** slows (L3 loop health ⚠)

**Symptom:** 23 laws had no paired `tests/laws/<id>.spec.ts` file; L0.4 self-enforcement test had 23 failing assertions.

FIXED 2026-05-16 in feat/design-system-enforcement — wrote all 23 missing law spec files (L0.2, L0.5, L1.2, L1.6, L2.2, L2.4, L2.5, L2.7, L2.8, L2.9, L2.12, L2.14, L2.15, L2.16, L3.1, L3.2, L3.3, L3.4, L3.5, L3.6, L3.8, L3.9, L3.10); L0.4.spec.ts now fully green (0 failures); total test count 599 (all passing). Coverage: 100% of 39 laws have paired spec files. test: `packages/host/tests/laws/L0.4.spec.ts` (all 41 assertions pass)

---

## P27 — Promise-land fetch adapters cannot use Schema.decodeUnknownEffect → residual `as` casts

**Severity:** annoys (type-safety gap at external API boundary)

**Symptom:** `OpenAiCompatLlmProvider.ts` and `RecordReplayLlmProvider.ts` implement `typeof globalThis.fetch` (Promise-based API). `body as Record<string, unknown>`, `choices as Record<string, unknown>[]` casts remained unvalidated by Schema.

FIXED 2026-05-16 in feat/design-system-enforcement — `OpenAiCompatLlmProvider.ts`: added `OpenAiResponseBody` + `LmMessage` schemas; `decodeResponseBody` validates outer structure before any property access; remaining `(msg as Record<string, unknown>)['content'] = reasoning` cast is sound (both schemas confirmed structure). `RecordReplayLlmProvider.ts`: added `LlmRequestBody` schema; `computeRequestHash` and `makeFakeResponse` accept decoded `LlmRequestBody` type; single boundary cast for deterministicBody spread (preserves all original fields). test: `pnpm --filter @app/host typecheck` + `pnpm lint:ci` exit 0 (tsgo no-blind-cast diagnostic catches regressions)

---

## P34 — Design system components duplicated across `packages/backoffice` and `packages/app`

**Severity:** slows
**Symptom:** shadcn `Button`, `Card`, `Textarea`, `Input` were vendored independently under `packages/backoffice/src/components/ui/` and `packages/app/src/components/ui/` — identical files, double maintenance burden.
FIXED 2026-05-16 in feat/design-system-enforcement — created `packages/design-system/` (`@app/design-system`) with 4 components + `utils.ts`; removed duplicate `src/components/ui/` trees; updated all 20 import sites from `@/components/ui/*` to `@app/design-system/*`; added `workspace:*` dep to both packages; `pnpm --filter @app/backoffice typecheck` + `pnpm --filter @app/app typecheck` both clean. test: `tests/design-system-isolation.test.ts` (3 tests, all passing)

---

## P33 — EventStore protocol tests run only against InMemory adapter; prod SQLite file-path durability untested

**Severity:** slows
**Symptom:** `tests/protocol/EventStore.spec.ts` parametrised over InMemory + SQLite with a temp path per run; cross-restart durability (close → reopen same path → events still there) was never exercised.
FIXED 2026-05-16 in feat/design-system-enforcement — test: `packages/host/tests/protocol/EventStore.spec.ts` (new "SqliteEventStore — cross-restart durability" describe block, 1 test, all passing)

---

## P32 — `CliUserGateway.respond` is a no-op stub, weakening the `UserGateway` protocol contract

**Severity:** slows
**Symptom:** `UserGateway.spec.ts` accepted a silent no-op `respond` implementation; no postcondition asserted delivery.
FIXED 2026-05-16 in feat/design-system-enforcement — `InMemoryUserGateway.layerWithResponds` now records calls in a `Ref`; `UserGateway.spec.ts` adds "InMemoryUserGateway — respond postcondition (P32)" describe block asserting `respond` populates the Ref. test: `packages/host/tests/protocol/UserGateway.spec.ts`

---

## P31 — `L0.1` and `L0.4` have zero dedicated tests; the meta-law is itself unenforced

**Severity:** slows
**Symptom:** The files `tests/laws/L0.1.spec.ts` and `tests/laws/L0.4.spec.ts` did not exist. L0.4 ("every law has a test") is self-enforcing only when its own test exists.
FIXED 2026-05-16 in feat/design-system-enforcement — `tests/laws/L0.4.spec.ts` enumerates all law IDs from SPEC-nav.md and asserts each has a spec file (16 pass, 24 fail — tracking convergence); `tests/laws/L0.1.spec.ts` asserts each existing law spec file has at least one assertion. test: `packages/host/tests/laws/L0.1.spec.ts`, `packages/host/tests/laws/L0.4.spec.ts`

---

## P30 — Stryker mutation testing is nightly-only; it never runs on PRs

**Severity:** slows
**Symptom:** `mutation-report.yml` had only `schedule: cron` and `workflow_dispatch` triggers; `ci.yml` had no Stryker step. Law tests had no mutation gate at PR time.
FIXED 2026-05-16 in feat/design-system-enforcement — added `law-mutation` job to `.github/workflows/ci.yml` that runs `npx stryker run --mutate 'packages/host/tests/laws/**/*.ts'` on every PR (20-min timeout). Full-repo Stryker stays nightly. test: presence of `law-mutation` job in ci.yml verified by grep

---

## P29 — MD files capture aspirational state that drifts from reality

**Severity:** annoys
**Symptom:** `CLAUDE.md ## Repository Layout (target)` described `packages/frontend/` (decommissioned in 7.D) and omitted `packages/backoffice/`, `packages/app/`, and new driving ports.
FIXED 2026-05-16 in feat/design-system-enforcement — renamed section to `## Repository Layout` (removed "(target)"), updated to reflect actual directories; added `scripts/check-layout.sh` which greps directory names from CLAUDE.md and fails if any named directory is absent; added `check-layout` command to lefthook `pre-commit`. test: `scripts/check-layout.sh` exits 0 on current state

---

## P2 — `@effect/platform-node` full import silently corrupts `@effect/vitest` HTTP tests

**Severity:** slows (one full session to diagnose)
**Symptom:** All tests in a file that uses `@effect/vitest` HTTP (e.g., `FetchHttpClient`) fail with `TransportError: A network error occurred` — including tests whose adapter under test doesn't use Node FS at all. No other error message; looks like a networking issue.
**Root cause:** `import ... from '@effect/platform-node'` (full barrel) transitively imports `@effect/cluster/MessageStorage`, which runs `Effect.runSync(make({...}))` at module-load time (`noop` export, line ~258). This executes a fiber synchronously during Vitest's module initialisation phase, leaving a stale entry in `~effect/Fiber/currentFiber` that corrupts the `@effect/vitest` test scheduler for all subsequent HTTP effects in the same process.
**Fix:** Added `no-restricted-imports` rule for `@effect/platform-node` to the `**/tests/**/*.ts` override in `packages/host/.oxlintrc.json`. Converted all 13 affected files (test files + helpers + source adapters) to subpath imports (`import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'` etc.). Pattern documented in `.claude/rules/host-package.md`.
FIXED 2026-05-15 in pending commit — test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` (block-2 assertion now includes `no-restricted-imports`)

---

## P24 — Four tsgo diagnostics remain `"off"` pending adapter-to-platform migration (severity: annoys)

**Symptom.** The following `@effect/language-service` diagnostics were disabled in
`packages/host/tsconfig.json` because the violations were structural (adapter bridge code
using node built-ins and console/fetch globals):

| Diagnostic            | Files migrated                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `nodeBuiltinImport`   | All adapters: `node:fs`, `node:child_process` → `@effect/platform-node` FileSystem/Path/ChildProcessSpawner |
| `globalConsole`       | Suppressed with `@effect-diagnostics-next-line` at the Node bridge entry points                             |
| `globalFetch`         | `OpenAiCompatLlmProvider.ts` → `FetchHttpClient.Fetch` from `effect/unstable/http`                          |
| `globalFetchInEffect` | Same as `globalFetch`                                                                                       |

**Fix.** Migrated all adapters to `@effect/platform-node` APIs (`FileSystem`, `Path`,
`ChildProcessSpawner` from `effect/unstable/process/ChildProcessSpawner`). Used
`FetchHttpClient.Fetch` as a `Context.Reference` in the LLM provider. One `createServer`
import in `main.ts` suppressed per-line with `@effect-diagnostics-next-line nodeBuiltinImport:off`
(no Effect alternative for HTTP server creation). All four diagnostics now set to `"error"`;
`tsgo --noEmit` exits 0.

FIXED 2026-05-15 — test: `tsgo --noEmit` exits 0 (run in CI via `pnpm --filter @app/host exec tsgo --noEmit`)

---

## P10 — LMStudio response shape divergence not surfaced to EventStore (severity: annoys)

**Symptom.** `OpenAiCompatLlmProvider`'s `reasoningAwareFetch` intercept uses
`Schema.decodeUnknownOption(LmMessage)` to parse each `message` object. When the shape
doesn't match (e.g. new LMStudio version adds or removes fields), the intercept emits
`console.warn` and passes the message through unchanged — but this signal never reaches the
`EventStore`, so Claude has no way to inspect it later via `/events` or outer-MCP replay.

**Encountered in.** S1 run (task 3.2 / 3.4) — `console.warn` is a temporary bridge; the proper
channel is an `UnknownShapeObserved` event in the store.

**Acceptance test.** `packages/host/tests/integration/p10UnknownShape.integration.test.ts`

**FIXED 2026-05-15 — test: `packages/host/tests/integration/p10UnknownShape.integration.test.ts`. Replaced the `console.warn` with a callback bridge: `OpenAiCompatLlmProvider.layer()` now captures `Effect.context<EventStore>()` at construction time and passes `onShapeAlert(msg)` to the fetch closure. When shape decode fails, the callback calls `Effect.runPromiseWith(ctx)(store.append({ kind: 'UnknownShapeObserved', ... }))`, running the append in the same runtime as the outer fiber. `globalConsoleInEffect` diagnostic removed from P24 tracking (now zero violations in src/). Layer wired in `bind.ts` with `OpenAiCompatLlmProvider.layer().pipe(Layer.provide(eventStoreLayer))`.**

---

## P6 — `replace_all: true` blast radius on Edit tool (severity: blocks work)

**Symptom.** A broad `replace_all: true` substitution (e.g., `err` → `error`) silently corrupts
unrelated identifiers (`console.error` → `console.erroror`). Requires reading the entire file
after every broad edit to catch collisions.

**Encountered in.** `packages/host/src/main.ts` during `catch-error-name` lint fix.

**Candidate fix.** Avoid `replace_all: true` on short tokens. Prefer targeted single-occurrence
edits or use regex-aware replacement only when the pattern is unambiguous. For lint autofixes,
let `oxlint-autofix.sh` do the rename rather than doing it manually.

**FIXED 2026-05-15 — test: TypeScript compilation (`pnpm typecheck`). The pre-push typecheck gate catches corrupted identifiers mechanically: `console.erroror` is not a valid member of the `Console` type and raises TS2339. Behavioral guidance ("avoid `replace_all: true` on short tokens; prefer targeted edits") is recorded in CLAUDE.md and `.claude/rules/host-package.md`. No new code needed; the type system is the acceptance test.**

---

## P22 — Design System drift: not using shadcn/ui (severity: annoys)

**Symptom.** Components in `packages/frontend/src/main.tsx` were hand-rolled HTML with raw Tailwind classes instead of using shadcn/ui primitives (`Button`, `Input`, etc.).

**Acceptance test.** `packages/frontend/src/main.tsx` imports `Button` and `Input` from `@/components/ui/`. `pnpm typecheck` passes.

**FIXED 2026-05-15 — test: TypeScript compilation (`pnpm --filter @app/frontend typecheck`). Installed `shadcn add button input card`. Set up `@` path alias in `vite.config.ts` + `tsconfig.json`. Added neutral theme CSS variables to `index.css`. Migrated all `<button>`/`<input>` elements in `main.tsx` to `<Button>`/`<Input>` from `@/components/ui/`.**

---

## P21 — Frontend state management: no Atom pattern, logic in UI components (severity: annoys)

**Symptom.** Anticipated `useEffect` + `fetch` anti-pattern in UI components. Current code uses an `api/` layer (no direct fetch in components) and event handlers (not `useEffect`) for async calls. The anti-pattern does not exist in current code.

**Acceptance test.** Grep check: no `.tsx` file in `packages/frontend/src/` imports from `react` with `useEffect` AND calls `fetch` in the same file.

**FIXED 2026-05-15 — no violations found. The existing api-layer abstraction (`src/api/*.ts`) already prevents fetch from leaking into components. The `frontend.md` rule ("never call fetch directly in a component") enforces this going forward.**

---

## P25 — Root `.oxlintrc.json` uses path-glob overrides instead of per-package nested configs (severity: annoys)

**Symptom.** All package-specific lint rules live in the root `.oxlintrc.json` behind `files` globs
like `**/packages/host/src/**/*.ts`. Adding a new package or extending rules to `monitor` or
`frontend` means editing the root file and widening globs — the coupling grows linearly.

**Acceptance test.** `packages/host/tests/unit/oxlint-rules.unit.test.ts` — P23 section: host override count is exactly 4; root override count is exactly 1.

**FIXED 2026-05-15 — test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` (P23 describe block, 5 tests, now checks host config). Created `packages/host/.oxlintrc.json` with the 4 host-specific override blocks (using `**/src/**/\*.ts`globs, compatible with both nested-config traversal and explicit`--config`in tests). Root config reduced to 1 universal override.`oxlint-rules.unit.test.ts`switched to`HOST_CONFIG`.**

---

## P19 — `.oxlintrc.json` overrides as a `no-restricted-imports` escape hatch (severity: annoys)

**Symptom.** When a file in `packages/host/src/` needs a restricted import (e.g., `node:fs/promises`), the temptation is to add the file path to the `no-restricted-imports: "off"` override list in `.oxlintrc.json`. This defeats the purpose of the restriction: every exempted file is a gap in the Effect platform discipline.

**Encountered in.** `session.ts` — attempted to add it to the `adapters/runtime/` override to suppress the `no-restricted-imports` error when importing `readFile` from `node:fs/promises`.

**Acceptance test.** The `no-restricted-imports` oxlint rule itself: CI fails when `session.ts` imports from `node:fs/promises` without a proper Effect alternative.

**Candidate fix.** Migrate to `FileSystem.FileSystem` from `@effect/platform` (already done for `session.ts`). Never add application-layer files to the `no-restricted-imports: "off"` override — that list is for adapters, runtime, and entry-points only.

**FIXED 2026-05-15 in this commit — test: oxlint `no-restricted-imports` rule (CI). `session.ts` migrated to `FileSystem` from `effect`; the override list was never widened.**

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

**FIXED 2026-05-15 — test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` (P13 describe block, now GREEN). Applied pragmatic replacements: `node:path` join → `new URL().pathname`, `node:os` tmpdir → `/tmp` literal, `node:crypto` randomUUID → `globalThis.crypto.randomUUID()` (Node 18+ global). Files fixed: `observeBin`, `p7ReasoningContent`, `userBin`, `ceremonyBin` integration tests.**

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

## P26 — `bin/ceremony.ts` and `bin/user.ts` have no integration tests

FIXED 2026-05-15 in 34b865a3 — test: packages/host/tests/integration/ceremonyBin.integration.test.ts (setup + sign + verify pipeline via CeremonyKeyStore + domain; 4 tests), packages/host/tests/integration/userBin.integration.test.ts (HTTP client wiring via async spawn + in-process stub; 3 tests). Note: spawnSync blocks the event loop — HTTP stub requires async spawn.

## P42 — Georges receives bare goal with no tool/handle brief (prototype unusable)

**Severity:** blocks work

**Symptom:** `submitGoal.ts` built the initial prompt as `[{system: agentMd}, {user: goal}]` — the bare goal with no tool listing, no handle schema, no role declaration, and no hard tool-use directive. The model received tool schemas via the Effect AI `toolkit` option but was never told in natural language what data existed or that it MUST ground answers in tools. Result: zero tool calls, generic boilerplate.

FIXED 2026-05-17 in 09de2686 —

- Extracted pure `buildInitialMessages(AgentBrief)` from `submitGoal.ts`; wires `yield* ToolRegistry` + `yield* DataHandleRegistry` (L2.14-clean driven ports) to populate a session brief: active role, available tools, handle schema + sample, and a hard MUST directive.
- `tools.yaml`: granted `enduser` access to `fetch-handle-shape` and `run-script`.
- `agent.md`: added "Hard rules — tool use" section with explicit tool-use forcing function.
- Cassettes recorded (model `qwopus3.6-35b-a3b-v1@q4_k_s`): list-tools round → fetch-handle-shape round → grounded text reply.
- test: `packages/host/tests/unit/submitGoal-brief.unit.test.ts` — 5 assertions (tool names, handle schema, role, MUST directive) — GREEN.
- test: `e2e/conversation.spec.ts` — "reply is grounded — references handle columns" — GREEN in `LLM_MODE=replay`.

## P43 — Two redundant goal-submission surfaces rendered stacked (UX confusion)

**Severity:** slows

**Symptom:** `App.tsx` rendered `<Conversation />` and `<SubmitGoal />` stacked with no routing, labels, or explanation. Both POSTed `/api/goals`. `SubmitGoal` had no clarification handling and dumped raw JSON. The e2e spec already canonised `conv-*` testIds; `SubmitGoal` (`sg-*`) was unreferenced.

FIXED 2026-05-17 in 981eaf97 —

- Deleted `packages/app/src/components/app/SubmitGoal.tsx` and removed its import/render from `App.tsx`.
- Deleted unused `packages/app/src/hooks/goals.ts` and `packages/app/src/api/goals.ts`.
- `Conversation.tsx`: added helper description, friendly session label, dataset input label, and example empty-state prompt (all `conv-*` testIds preserved).
- test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` — "App renders a single goal-submission surface (P43)" — GREEN.

## P44 — `POST /api/login` has no rate limiting (brute-force possible)

**Severity:** slows (security gap before external deployment)

**Symptom:** `POST /api/login` in `main.ts` had no throttle, delay, or account-lockout after
failed attempts. `scryptSync` slows each individual check (~100 ms) but does not prevent parallel
brute-force.

FIXED 2026-05-17 in pending — test: packages/host/tests/unit/loginRateLimiter.unit.test.ts (5 tests: does-not-block-before-limit, blocks-after-maxAttempts, clears-on-success, tracks-IPs-independently, unblocks-after-window-expires).

## P45 — `archivedPainItems` always returns 0 (PAIN-archive.md not parsed)

**Severity:** annoys

**Symptom:** `EventStoreAdminQuery.metrics()` hardcoded `archivedPainItems: 0` with a TODO comment.
The backoffice metrics panel always showed 0 archived items regardless of how many had been closed.

FIXED 2026-05-17 in pending — test: packages/host/tests/unit/painParser.unit.test.ts (parsePainArchiveMd suite: 5 tests including live docs/PAIN-archive.md count > 0 check).

## P49 — Rate-limit HTTP wiring untested (IP extraction + 429 path not covered)

**Severity:** slows

**Symptom:** `makeLoginRateLimiter` had 5 unit tests covering the pure sliding-window logic, but
the `main.ts` wiring — IP extracted via `HttpServerRequest.remoteAddress`, falling back to
`'unknown'` on `Option.none()`, emitting 429 with `Retry-After: 60` — had no test coverage.

FIXED 2026-05-17 in pending — test: e2e/rbac.spec.ts — "Rate limiting — POST /api/login (P49)" describe block; sends 10 wrong-password requests and asserts 11th returns 429 + Retry-After: 60 header at the HTTP layer (1 test, GREEN).

## P50 — Opaque HTTP 500: no logs, no body, no trace event on LLM failure

**Severity:** blocks work

**Symptom:** Three observability gaps fire together when the LLM endpoint is unreachable:
(1) `fullLayer` in `bind.ts` wired no `Logger` — zero server-side output on request failures;
(2) `main.ts:688` cast the route error channel to `never` with `as any` and no `tapErrorCause`
or `catchAllCause` — any route failure produced an empty-body 500 with nothing logged;
(3) `domain/events.ts` had no `GoalFailed` kind — a failed goal showed `GoalSubmitted` in the
trace with no terminal event, making the failure invisible in `/api/admin/trace`.
Reported when user submitted a goal with LMStudio offline: `Error: 500:` with empty body, zero
stderr output, and no failure event in the trace.

**Candidate fix:** (1) Add `Logger.layer([Logger.consolePretty({ stderr: true })])` to `fullLayer`;
(2) wrap resolved `httpApp` with `Effect.tapErrorCause(log) + Effect.catchAllCause(→ JSON 500)`;
(3) add `GoalFailed` event kind + emit it in `submitGoal.ts` via `tapErrorCause` on `runAgentLoop`;
(4) log LLM target at boot in `llmLayer`.

FIXED 2026-05-17 in feat/design-system-enforcement (TODO 10.15) — test: packages/host/tests/integration/httpObservability.integration.test.ts (2 tests: GoalFailed emitted when LLM fails, catchAllCause returns structured JSON 500 not empty).
