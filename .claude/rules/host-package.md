---
paths:
  - 'packages/host/**'
---

# Host package — operating constraints

You are inside the Host (`packages/host/`). Per `docs/SPEC.md` §10.1 + L2.14:

## Port & adapter layout

- **Ports** live in `src/ports/driving/` (User/Claude calls in) and `src/ports/driven/` (Host calls out).
- **Adapters** live in `src/adapters/driving/` and `src/adapters/driven/`.
- Application code (services, domain logic) depends on **ports**, never adapters.
- Driving adapters must not import from driven adapters.

## Mandatory test pairings

- Every Law in `docs/SPEC.md` §3 you touch needs a paired test in `tests/laws/<law-id>.spec.ts` that asserts the _if-absent_ failure mode is actually caught (L0.1 + §11). Mapping checks are necessary but not sufficient.
- Every port has a CSP-style protocol test in `tests/protocol/<port>.spec.ts` **parametrised over all bound adapters** (in-memory fake + production). Liskov substitution proven by test, not intent (§2.13). A new adapter fails CI until the protocol test passes against it.
- Every Supervisor signal you implement needs a paired Monitor recomputation (L3.7) and the test verifies a `SupervisorDivergence` event fires on injected disagreement.
- Every adapter swap emits `AdapterBound` before the application uses the new binding (L2.14).

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

## Forbidden by inherited rules

- Importing Node.js built-ins (`node:fs`, etc.) from non-`packages/host/**` code (oxlint `import/no-nodejs-modules`).
- Lowering coverage thresholds (L2.4 ratchet).
- `git push --no-verify` (Claude Code hook `block-no-verify.sh` rejects it).
