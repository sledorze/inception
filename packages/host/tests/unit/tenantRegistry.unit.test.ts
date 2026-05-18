/**
 * Unit tests for tenant registry application services (Slice 11.3).
 * Covers: listTenants fold, createTenant idempotency, renameTenant, seedDefaultTenant.
 */
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { createTenant } from '../../src/application/createTenant.ts'
import { listTenants } from '../../src/application/listTenants.ts'
import { renameTenant } from '../../src/application/renameTenant.ts'
import { seedDefaultTenant } from '../../src/application/seedDefaultTenant.ts'
import type { EventStore } from '../../src/ports/driven/EventStore.ts'

const withStore = <A>(eff: Effect.Effect<A, unknown, EventStore>) => Effect.provide(eff, InMemoryEventStore.layer)

describe('tenant registry', () => {
  it.effect('listTenants returns empty array when no tenants exist', () =>
    withStore(
      Effect.gen(function* () {
        const tenants = yield* listTenants()
        expect(tenants).toHaveLength(0)
      }),
    ),
  )

  it.effect('createTenant makes a tenant visible via listTenants', () =>
    withStore(
      Effect.gen(function* () {
        yield* createTenant('acme', 'Acme Corp')
        const tenants = yield* listTenants()
        expect(tenants).toHaveLength(1)
        expect(tenants[0]?.id).toBe('acme')
        expect(tenants[0]?.name).toBe('Acme Corp')
      }),
    ),
  )

  it.effect('createTenant is idempotent — second call is a no-op (same contentHash)', () =>
    withStore(
      Effect.gen(function* () {
        yield* createTenant('acme', 'Acme Corp')
        yield* createTenant('acme', 'Acme Corp')
        const tenants = yield* listTenants()
        expect(tenants).toHaveLength(1)
      }),
    ),
  )

  it.effect('renameTenant updates the tenant name', () =>
    withStore(
      Effect.gen(function* () {
        yield* createTenant('acme', 'Acme Corp')
        yield* renameTenant('acme', 'Acme Inc')
        const tenants = yield* listTenants()
        expect(tenants.find(t => t.id === 'acme')?.name).toBe('Acme Inc')
      }),
    ),
  )

  it.effect('seedDefaultTenant creates the default tenant', () =>
    withStore(
      Effect.gen(function* () {
        yield* seedDefaultTenant()
        const tenants = yield* listTenants()
        expect(tenants.find(t => t.id === 'default')?.name).toBe('Default')
      }),
    ),
  )

  it.effect('seedDefaultTenant is idempotent — re-seeding is a no-op', () =>
    withStore(
      Effect.gen(function* () {
        yield* seedDefaultTenant()
        yield* seedDefaultTenant()
        const tenants = yield* listTenants()
        expect(tenants.filter(t => t.id === 'default')).toHaveLength(1)
      }),
    ),
  )
})
