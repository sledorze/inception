---
paths:
  - 'packages/host/**'
---

# Host package — operating constraints

You are inside the Host (`packages/host/`). Per `docs/SPEC.md` §10.1 + L2.14:

## Claude / Georges context boundary

`.claude/` is **Claude's domain** — patterns, rules, hooks, commands. Never encode Georges' behavioral constraints here.

- **Georges' operating context** → `src/bootstrap/agent.md` (injected as system prompt; maintained separately from `.claude/`).
- If you find yourself writing "Georges should…" anywhere under `.claude/`, stop — it belongs in `agent.md`.
- The inverse holds: `agent.md` must never reference `.claude/` paths, `docs/PAIN.md`, or Claude's meta-machinery. They share nothing.

## Port & adapter layout

- **Ports** live in `src/ports/driving/` (User/Claude calls in) and `src/ports/driven/` (Host calls out).
- **Adapters** live in `src/adapters/driving/` and `src/adapters/driven/`.
- **Application services** (`src/application/`) orchestrate via ports (`Effect.gen` + `yield* SomePort`) — they depend on ports, never adapters or runtime.
- **Pure domain** (`src/domain/`) holds schemas, value objects, and invariants — it depends on nothing inside `src/` except other `domain/` modules.
- **Runtime wiring** (`src/runtime/bind.ts`) is the only place adapters are imported; it is the composition root (`Layer.provide` chain, per SPEC §2.14).
- Driving adapters must not import from driven adapters.

## Mandatory test pairings

- Every Law in `docs/SPEC.md` §3 you touch needs a paired test in `tests/laws/<law-id>.spec.ts` that asserts the _if-absent_ failure mode is actually caught (L0.1 + §11). Mapping checks are necessary but not sufficient.
- Every port has a CSP-style protocol test in `tests/protocol/<port>.spec.ts` **parametrised over all bound adapters** (in-memory fake + production). Liskov substitution proven by test, not intent (§2.13). A new adapter fails CI until the protocol test passes against it.
- Every Supervisor signal you implement needs a paired Monitor recomputation (L3.7) and the test verifies a `SupervisorDivergence` event fires on injected disagreement.
- Every adapter swap emits `AdapterBound` before the application uses the new binding (L2.14).
- Every new `bin/<name>.ts` entry-point script → `tests/integration/<name>Bin.integration.test.ts` that exercises the observable behavior of the script's layer composition (spawn or in-process, whichever is practical).
- Every change to `runtime/bind.ts` (composition root) → `tests/integration/bootstrap.integration.test.ts` must remain green; if the change adds or removes a service, update the test to cover the new surface.
- Every PAIN item fix → an acceptance test (plain vitest or `@effect/vitest`) that **fails before the fix and passes after**. The test path is cited in the `PAIN-archive.md` closure line.

## Trust domain hygiene (L3.10)

Tier-1 laws need at least one enforcement point _outside_ the Host trust domain. When you add a Tier-1 enforcement module, declare its `trust_domain` in `laws.yaml`; at least one of the law's modules must live in `packages/monitor/` or a similar out-of-domain location. Sandbox boot refuses to start otherwise.

## Code-over-data wall (L1.3, L1.7)

`DataHandle.runScript` is the only way Georges-authored code touches real data. Aggregates are produced Host-side with **(ε=0.1, δ=1/10n)-DP** noise (Laplace for ℓ₁, Gaussian for ℓ₂). Sensitivity is declared per query and validated against the schema before noise calibration.

If you write code that holds raw bytes outside `runScript`, you are violating L1.3. Stop and rethink.

## Code economy (§2.13, AL.7)

- Don't pre-abstract. Factorise once ≥3 usage sites OR one clarifying use exists.
- Promote stable modules to libraries (`packages/<name>/`) with semver, owner, changelog when they reach 3 usage sites, become load-bearing for a §13 Tech Decision, or move to `kernel/`.
- Prefer (embedded) DSLs for domain grammars. Imperative is the last resort.
- Check existing modules + §13 + library ecosystem before writing new abstraction (AL.7).

## Naming conventions inherited from template

- Backend test files: `*.unit.test.ts` or `*.integration.test.ts` (never bare `*.test.ts`). Stryker excludes test files by pattern.
- Frontend test files: `*.test.ts` or `*.test.tsx`.
- Files under `src/` are TypeScript, strict mode.

## Effect over Promise (hard rule for `packages/host/src/`)

All async operations must be expressed in Effect, never plain Promises or `async`/`await`:

- **Wrapping Node.js / third-party async APIs**: use `Effect.tryPromise({ try: async () => ..., catch: e => new MyError({ cause: e }) })`. The `async () =>` callback is acceptable here — it is the bridge layer.
- **Never write a standalone `async` function** outside of an `Effect.tryPromise` / `Effect.promise` callback. If you find yourself writing `async function foo()`, convert the whole function to `Effect.fn("Module.foo")(function*() { ... })`.
- **Clock, not Date**: `Clock.currentTimeMillis` / `Clock.currentTimeNano` instead of `Date.now()` / `new Date()`. Pass the resolved `number` into `new Date(ms)` only for formatting. Enforced by `lefthook check-effect-patterns.sh`.
- **Tests use `it.effect`**: import `{ it }` from `@effect/vitest`; never `Effect.runPromise` in test bodies. Enforced by `lefthook check-effect-patterns.sh`.

Rationale: Effect enables `TestClock`, structured error channels, and deterministic tracing. Native Promises bypass all three.

## Consolidation patterns (apply before every commit)

Check your diff for these two failure modes before committing.

### Test layer compositions → `tests/helpers/`

The same `Layer.mergeAll(toolkitLayer, storeLayer, ...)` block in two or more test files is a
consolidation failure (PAIN P1). Extract immediately to `packages/host/tests/helpers/<name>.ts`
and import it. That helper is the single place that must change when `GeorgesToolkitLive` gains a
new dependency:

```ts
// packages/host/tests/helpers/toolkitLayer.ts
export const makeToolkitTestLayer = (tools: readonly ToolEntry[]) => {
  const storeLayer = InMemoryEventStore.layer
  const registryLayer = InMemoryToolRegistry.layer(tools)
  const workspaceLayer = InMemoryWorkspaceMount.layer()
  const handleRegLayer = InMemoryDataHandleRegistry.layer
  const toolkitLayer = GeorgesToolkitLive.pipe(
    Layer.provide(storeLayer),
    Layer.provide(registryLayer),
    Layer.provide(workspaceLayer),
    Layer.provide(handleRegLayer),
  )
  return Layer.mergeAll(toolkitLayer, storeLayer, workspaceLayer, handleRegLayer)
}
```

### Error `_tag` strings → exported const from port file

`Schema.TaggedErrorClass` sets `_tag` to the full `id` string (e.g. `'@app/host/HandleRevoked'`).
`Effect.catchTags` silently ignores keys that don't match exactly — no TypeScript error (PAIN P2).

Whenever a `_tag` string appears in both a port definition and a `catchTags` call site, export it
as a named constant from the port file:

```ts
// port file
export const HandleRevokedTag = '@app/host/HandleRevoked' as const
class HandleRevoked extends Schema.TaggedErrorClass<HandleRevoked>()(HandleRevokedTag, { ... }) {}

// call site — key derived from const, not string literal
Effect.catchTags({ [HandleRevokedTag]: e => ... })
```

### `Clock.currentTimeMillis` → `new Date(ms).toISOString()`

Using `new Date(ms)` where `ms` comes from `Clock.currentTimeMillis` is the correct pattern (PAIN
P8). The test-controllable invariant is the clock source, not the `Date` constructor. This is the
only acceptable use of `new Date()` in `packages/host/src/`.

### `correlationId` → `yield* CurrentCorrelationId` in adapters

Any `store.append(...)` call inside an adapter that emits an event tied to a user request must
inherit the correlation ID from the Effect context rather than generating a fresh UUID:

```ts
// WRONG — breaks the goal-level event chain (P8)
store.append({ correlationId: randomUUID(), ... })

// RIGHT — inherits the ID set by submitGoal via Effect.provideService
const correlationId = yield* CurrentCorrelationId  // from 'src/domain/tracing.ts'
store.append({ correlationId, ... })
```

The `check-effect-patterns.sh` pre-commit hook flags `correlationId: randomUUID()` in `src/`.
`CurrentCorrelationId` defaults to `'bootstrap'` so tests that don't go through `submitGoal` still
emit valid events.

## `@effect/platform-node` — always use subpath imports in test files

**Rule:** `packages/host/tests/**` enforces `no-restricted-imports` on `@effect/platform-node`.

The barrel `import { NodeFileSystem } from '@effect/platform-node'` transitively loads
`@effect/cluster/MessageStorage`, which calls `Effect.runSync` at module-load time.
That leaves a stale fiber in `currentFiber`, corrupting the `@effect/vitest` test scheduler
and causing all HTTP tests in the same file to fail with `TransportError`.

Always use subpath imports in test files:

```ts
// BAD — crashes @effect/vitest HTTP tests
import { NodeFileSystem, NodeServices } from '@effect/platform-node'

// GOOD — each subpath exports the same namespace members without side-effects
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodeServices from '@effect/platform-node/NodeServices'
// Usage is identical: NodeFileSystem.layer, NodeServices.layer, NodeRuntime.runMain(), etc.
```

Available subpaths (matching the barrel's `export * as X from './X'` exports):
`NodeFileSystem`, `NodePath`, `NodeServices`, `NodeStdio`, `NodeHttpServer`,
`NodeHttpClient`, `NodeRuntime`, `NodeSocket`, `NodeStream`, …

## Forbidden by inherited rules

- Importing Node.js built-ins (`node:fs`, etc.) from non-`packages/host/**` code (oxlint `import/no-nodejs-modules`).
- `@effect/platform-node` barrel import in `**/tests/**/*.ts` (oxlint `no-restricted-imports` in `packages/host/.oxlintrc.json`).
- Lowering coverage thresholds (L2.4 ratchet).
- `git push --no-verify` (Claude Code hook `block-no-verify.sh` rejects it).
