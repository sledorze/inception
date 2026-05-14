# Pattern: runtime/bind.ts is the composition root

**Enforced by:** `host-no-adapter-import` dep-cruiser rule  
**Law:** L2.14 — "the service registry bind.ts is Layer.merge(...)" (SPEC §2.14, verbatim)

## Rule

`packages/host/src/runtime/bind.ts` is the **only** file that may import from `packages/host/src/adapters/`.

Every other file in `packages/host/src/` works with port Tags — never with adapter implementations.

## What bind.ts looks like

```ts
// packages/host/src/runtime/bind.ts
import { Layer } from 'effect'
// ── adapter imports (ONLY allowed here) ────────────────────────────────────
import { GeorgesToolkit, GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'
import { InMemoryPolicyGate } from '../adapters/driven/InMemoryPolicyGate.ts'
// ... other adapters ...

// ── composition ─────────────────────────────────────────────────────────────
export const appLayer = GeorgesToolkitLive.pipe(
  Layer.provide(InMemoryEventStore.layer),
  Layer.provide(InMemoryPolicyGate.layer(BOOTSTRAP_TOOLS)),
  // ...
)

// ── derived type (never hand-maintain this) ─────────────────────────────────
export type AppServices = Layer.Success<typeof appLayer>

// ── re-export Tags that main.ts needs to access services ────────────────────
export { GeorgesToolkit }
```

## What main.ts looks like (thin entrypoint)

```ts
// packages/host/src/main.ts
import { ManagedRuntime } from 'effect'
import { GeorgesToolkit, appLayer } from './runtime/bind.ts' // ← only runtime/ import

const rt = ManagedRuntime.make(appLayer)

// ... HTTP server that uses rt.runPromise and yield* GeorgesToolkit ...
```

## AppServices type: always derive, never hand-maintain

```ts
// ❌ WRONG — hand-maintained union drifts from reality as adapters are added/removed
export type AppServices =
  | UserGateway
  | EventStore
  | LanguageModel.LanguageModel  // listed but never provided → lies
  // PolicyGate missing → also lies

// ✅ CORRECT — derive from the actual layer; TypeScript enforces correctness
export const appLayer = GeorgesToolkitLive.pipe(...)
export type AppServices = Layer.Success<typeof appLayer>
```

## When you add a new adapter

1. Add the adapter import to `runtime/bind.ts`
2. Add `Layer.provide(NewAdapter.layer)` to the `appLayer` pipe chain
3. `AppServices` updates automatically (it's derived)
4. `main.ts` needs no changes (it imports `appLayer` generically)

## ❌ Anti-pattern: adapter imports in main.ts

```ts
// ❌ main.ts importing adapters — violates host-no-adapter-import
import { InMemoryEventStore } from './adapters/driven/InMemoryEventStore.ts'
import { InMemoryPolicyGate } from './adapters/driven/InMemoryPolicyGate.ts'

const appLayer = SomeToolkit.pipe(
  Layer.provide(InMemoryEventStore.layer),  // this all belongs in bind.ts
  Layer.provide(InMemoryPolicyGate.layer(...)),
)
```
