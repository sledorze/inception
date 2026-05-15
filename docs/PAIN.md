# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

## P25 — Root `.oxlintrc.json` uses path-glob overrides instead of per-package nested configs (severity: annoys)

**Symptom.** All package-specific lint rules live in the root `.oxlintrc.json` behind `files` globs
like `**/packages/host/src/**/*.ts`. Adding a new package or extending rules to `monitor` or
`frontend` means editing the root file and widening globs — the coupling grows linearly. The
`oxlint-rules` acceptance test only covers host because the rules only exist in the root file
under host-scoped globs; monitor and frontend have no analogous enforcement.

**Encountered in.** 5-whys on why `packages/monitor/tests/unit/oxlint-rules.unit.test.ts` doesn't
exist — root cause is the config isn't factorised per package.

**Why it's fixable.** oxlint supports nested config files (the `--disable-nested-config` flag
suppresses them, confirming they load automatically). A per-package `.oxlintrc.json` inherits the
root config and adds only the rules relevant to that package, without path globs.

**Candidate fix.**

1. Move host-specific overrides (Effect rules, `no-restricted-imports` for `node:*`, adapter
   escape-hatch list) out of root `.oxlintrc.json` into `packages/host/.oxlintrc.json`.
2. Create `packages/monitor/.oxlintrc.json` with monitor-appropriate rules (e.g. the
   `no-effect-gen-without-vitest` rule once monitor uses Effect).
3. Root config keeps only truly universal rules (no path globs).
4. Each package can then have its own `oxlint-rules.unit.test.ts` probing its own config.

**Acceptance test.** A per-package `oxlint-rules.unit.test.ts` that fires against that package's
own `.oxlintrc.json`. The test for host already exists; adding one per package that probes the
relevant rules is the closure condition.

---

## P24 — Five tsgo diagnostics remain `"off"` pending adapter-to-platform migration (severity: annoys)

**Symptom.** The following `@effect/language-service` diagnostics are disabled in
`packages/host/tsconfig.json` because the violations are structural (adapter bridge code
using node built-ins and console/fetch globals):

| Diagnostic              | Files                                                                                             | Blocker                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `nodeBuiltinImport`     | All adapters (`node:fs`, `node:child_process`, etc.) + `EventStore.ts` (`createHash`) + `main.ts` | @effect/platform-node migration (P13)                            |
| `globalConsole`         | `main.ts` (startup log + SIGTERM handler) + `checks/check-test-conventions.ts` (CLI output)       | main.ts is the Node bridge; CLI scripts legitimately use console |
| `globalConsoleInEffect` | `OpenAiCompatLlmProvider.ts` (P10 shape-alert `console.warn`)                                     | Promote to EventStore event per P10                              |
| `globalFetch`           | `OpenAiCompatLlmProvider.ts` (`reasoningAwareFetch` intercept)                                    | Replace with `@effect/platform` HttpClient (P10)                 |
| `globalFetchInEffect`   | Same                                                                                              | Same as `globalFetch`                                            |

**Acceptance test.** This PAIN entry IS the tracking mechanism. When each diagnostic is
re-enabled as `"error"` and tsgo passes, that diagnostic's entry above is struck and the
commit is cited. P24 is closed when all five are "error".

**Candidate fix (priority order):**

1. `globalConsoleInEffect` + `globalFetch`/`globalFetchInEffect` → close via P10 (promote
   shape-alert to EventStore event; replace fetch intercept with HttpClient middleware).
2. `globalConsole` in `main.ts` → accept console in the Node entry-point bridge (the
   override list already grants this escape); OR wrap server startup in `Effect.runFork`
   and use `Effect.logInfo`.
3. `nodeBuiltinImport` → close via P13 (migrate adapters to `@effect/platform-node`
   `FileSystem`, `Path`, `CommandExecutor`). `EventStore.ts`'s `createHash` needs a
   synchronous SHA-256 that doesn't import `node:crypto` — consider vendoring a 50-line
   pure-JS SHA-256 or accepting this specific import as a domain invariant.

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
