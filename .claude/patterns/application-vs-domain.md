# Pattern: application/ vs domain/ split

**Enforced by:** `host-domain-pure` dep-cruiser rule  
**Why:** "Domain is pure" (Cockburn/Evans/Wlaschin). Pure domain is testable with zero infrastructure. Application services orchestrate; domain invariants validate.

## Decision rule

**Ask:** does this code `yield*` a port Tag (`EventStore`, `RoleRegistry`, etc.) or call `Effect.gen` that depends on a service?

- **Yes** → `packages/host/src/application/`
- **No** → `packages/host/src/domain/`

## domain/ — pure leaf

Only pure TypeScript: types, schemas (Schema.Struct etc.), value objects, pure functions.

```ts
// packages/host/src/domain/roleVersion.ts ✅
export interface RoleDescriptor {
  readonly name: string
  readonly version: string
  readonly tools: readonly string[]
}

export const isCompatible = (a: RoleDescriptor, b: RoleDescriptor): boolean => a.version === b.version
```

No imports from `ports/`, `adapters/`, `runtime/`, or `application/`. Domain is a dependency leaf — everything else can depend on it; it depends on nothing.

## application/ — use-case orchestration

Effect.gen functions that consume port Tags to orchestrate a use case.

```ts
// packages/host/src/application/roleSwitch.ts ✅
import { Effect } from 'effect'
import { EventStore } from '../ports/driven/EventStore.ts'    // port Tag — OK
import { RoleRegistry } from '../ports/driven/RoleRegistry.ts' // port Tag — OK

export const switchRole = (
  from: string,
  to: string,
  ctx: RoleSwitchContext,
): Effect.Effect<RoleDescriptor, RoleNotFound | EventStoreError, RoleRegistry | EventStore> =>
  Effect.gen(function* () {
    const registry = yield* RoleRegistry   // consumes port Tag
    const next = yield* registry.getRole(to)
    const store = yield* EventStore        // consumes port Tag
    yield* store.append({ kind: 'RoleSwitched', ... })
    return next
  })
```

## Common misplacements

| File characteristic                  | Actual layer                         |
| ------------------------------------ | ------------------------------------ |
| Has `yield* SomePort`                | `application/` not `domain/`         |
| Returns `Effect<..., ..., SomePort>` | `application/` not `domain/`         |
| Only pure data/schema types          | `domain/` not `application/`         |
| `Layer.provide(...)` chain           | `runtime/bind.ts` not `application/` |

## Import direction

```
application/ → ports/driven/, ports/driving/, domain/   ✅
domain/      → (nothing inside src/)                     ✅
application/ → adapters/                                  ❌  (use port, not adapter)
domain/      → ports/, adapters/, application/            ❌  (domain is a pure leaf)
```
