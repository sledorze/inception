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
