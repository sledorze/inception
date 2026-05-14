# Pattern: Effect tests use layer() + it.effect

**Enforced by:** `.claude/hooks/check-effect-patterns.sh` (pre-commit)  
**Why:** `Effect.runPromise` bypasses `TestClock`, structured error channels, and tracing. Tests using it can't inject fake time or assert on effect structure.

## The rule

```
packages/host/tests/**/*.ts  →  NO Effect.runPromise
packages/host/src/**/*.ts    →  NO Date.now() / new Date()  (use Clock.currentTimeMillis)
```

## Test pattern: layer() + it.effect

```ts
import { Effect, Layer } from 'effect'
import { expect, layer } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { MyService } from '../../src/application/myService.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

// Build the test layer once per suite
const testLayer = InMemoryEventStore.layer

// layer() wraps the suite and injects testLayer into every it.effect
layer(testLayer)('Suite name', it => {
  it.effect('does the thing', () =>
    Effect.gen(function* () {
      // Services are available via yield* — no runPromise needed
      const store = yield* EventStore
      yield* store.append({ ... })

      const result = yield* MyService.doThing(...)
      expect(result).toBe('expected')
    }),
  )
})
```

## What to do when a test needs to assert on an expected failure

Use `Effect.flip` to move the error into the success channel:

```ts
it.effect('fails with the right error', () =>
  Effect.gen(function* () {
    const error = yield* someEffect.pipe(Effect.flip)
    expect(error instanceof MyError).toBeTruthy()
  }),
)
```

## Multiple services in the test layer

```ts
const testLayer = Layer.merge(
  InMemoryEventStore.layer,
  InMemoryRoleRegistry.bootstrapLayer,
)

layer(testLayer)('Suite name', it => {
  it.effect('...', () => Effect.gen(function* () {
    const store = yield* EventStore      // ← from testLayer
    const registry = yield* RoleRegistry  // ← from testLayer
    ...
  }))
})
```

## ❌ Anti-pattern: Effect.runPromise in tests

```ts
// ❌ — bypasses TestClock, not detectable by vitest timeout, can hide error channels
const result = await Effect.runPromise(Effect.provide(myEffect, myLayer))
expect(result).toBe(...)

// ✅ — use it.effect + layer() instead (see above)
```

## State isolation between tests

`layer()` creates one layer instance per describe block. Tests that use unique IDs (e.g. `randomUUID()` for `sessionId`) are automatically isolated even within a shared in-memory store — they filter by ID so they don't see each other's data.

---

## Frontend test helpers: `Response.json()` not `new Response(JSON.stringify(...))`

When mocking `fetch` in frontend tests, create JSON responses with `Response.json(payload)` rather than
`new Response(JSON.stringify(payload), { status: 200 })`. oxlint's `prefer-response-static-json` rule
flags the verbose form and no auto-fix is available — it must be written correctly from the start.

```ts
// ❌ — oxlint flags this, no auto-fix
mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

// ✅ — use Response.json(); defaults to status 200 + application/json content-type
mockFetch.mockResolvedValueOnce(Response.json({ ok: true }))

// ✅ — for non-200 status, use Response with a string body (not JSON)
mockFetch.mockResolvedValueOnce(new Response('bad request', { status: 400 }))
```

---

## `it.fails` / `it.effect.fails` for intentional RED acceptance tests

RED tests (documenting a current gap that is expected to fail) must be marked with the `.fails`
modifier so the pre-commit `test-changed` hook doesn't block commits.

```ts
// Plain vitest RED test
it.fails('RED: P12 — integration tests import from bare vitest', () => {
  const violations = findBareVitestImports(integrationFiles)
  expect(violations).toHaveLength(0) // fails until P12 is fixed
})

// Effect-using RED test inside a layer() suite
layer(testLayer)('RED suite', it => {
  it.effect.fails('RED: P10 — UnknownShapeObserved not emitted', () =>
    Effect.gen(function* () {
      // ... assertions that currently fail
    }),
  )
})
```

vitest `.fails` semantics: the test is expected to throw/fail — if it unexpectedly _passes_,
vitest reports it as a test failure (catching regression). This is the correct idiom for
"a thing that doesn't work yet, proven broken by a test".
