# Pattern: Hex architecture dependency boundaries

**Enforced by:** `.dependency-cruiser.cjs` rules `host-no-adapter-import`, `host-domain-pure`, `host-application-pure`  
**Law:** L2.14 (Ports over Implementations)

## The layer stack (outermost → innermost)

```
runtime/bind.ts        ← ONLY place that imports adapters (composition root)
  ↓ provides Layer to
adapters/driving/      ← implements driving ports; imports driven ports only
adapters/driven/       ← implements driven ports; imports nothing from host
  ↓ bound via Layer to
application/           ← Effect.gen orchestrations; imports ports only, never adapters
ports/driving/         ← driving port interfaces (Tags + schemas)
ports/driven/          ← driven port interfaces (Tags + schemas)
  ↑ referenced by
domain/                ← pure leaf: schemas, value objects, invariants. No imports from src/.
```

## What triggers each rule

### `host-no-adapter-import`

Any file outside `runtime/` and `adapters/` importing from `src/adapters/`.

```ts
// ❌ WRONG — in application/myService.ts or domain/foo.ts or ports/driven/Foo.ts
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'

// ✅ CORRECT — adapters are only referenced in runtime/bind.ts
// application/ and domain/ import the PORT, not the adapter:
import { EventStore } from '../ports/driven/EventStore.ts'
```

### `host-domain-pure`

Any file under `domain/` importing from `ports/`, `adapters/`, `runtime/`, or `application/`.

```ts
// ❌ WRONG — domain files must not consume port Tags
// domain/myDomain.ts
import { EventStore } from '../ports/driven/EventStore.ts'  // banned
const store = yield* EventStore  // this IS an application service, not domain

// ✅ CORRECT — domain exports pure types/functions; application/ uses them
// domain/myDomain.ts — pure data
export interface MyValue { readonly id: string }
export const validate = (v: unknown): MyValue => ...

// application/myService.ts — orchestration that uses ports + domain types
import { EventStore } from '../ports/driven/EventStore.ts'
import type { MyValue } from '../domain/myDomain.ts'
```

### `host-application-pure`

Any file under `application/` importing from `adapters/` or `runtime/`.

```ts
// ❌ WRONG
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'

// ✅ CORRECT — application/ only needs the port interface
import { EventStore } from '../ports/driven/EventStore.ts'
```

## Decision: is this code domain/ or application/?

| Code characteristic                             | Layer             |
| ----------------------------------------------- | ----------------- |
| Pure function, no Effect context, no port Tags  | `domain/`         |
| Schema / value object / type alias              | `domain/`         |
| `Effect.gen` with `yield* SomePort`             | `application/`    |
| Use-case orchestration (sequence of port calls) | `application/`    |
| `Layer.provide(...)` chain                      | `runtime/bind.ts` |

## How runtime/bind.ts works

```ts
// packages/host/src/runtime/bind.ts — the ONLY file that imports adapters
import { GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'
// ... other adapter imports

export const appLayer = GeorgesToolkitLive.pipe(
  Layer.provide(InMemoryEventStore.layer),
  // ...
)
export type AppServices = Layer.Success<typeof appLayer> // derived, never hand-maintained
```

`main.ts` only imports from `runtime/bind.ts`:

```ts
import { appLayer, GeorgesToolkit } from './runtime/bind.ts'
```
