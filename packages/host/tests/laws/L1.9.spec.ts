/**
 * Law L1.9 — Tenant Isolation.
 * "Every persisted event and every query is scoped to exactly one tenant.
 *  A principal may only access tenants it is entitled to; cross-tenant read
 *  or write is forbidden." (§3, L1.9)
 *
 * If-absent failure mode: without the tenantId filter on EventStore.query,
 * a query scoped to tenant A would return events from tenant B — cross-tenant
 * data leakage. The third test below proves this: removing the filter from
 * EventStore.query makes the cross-tenant assertion fail (red).
 *
 * Tests:
 *  1. Events carry the tenantId supplied at write time.
 *  2. Tenant-scoped query hides cross-tenant events (if-absent: red without filter).
 *  3. The unscoped query returns all tenants — proving the filter is the guard.
 */
import { randomUUID } from 'node:crypto'
import { DateTime, Effect, Layer } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { createTenant } from '../../src/application/createTenant.ts'
import { listSessions } from '../../src/application/listSessions.ts'
import { listTenants } from '../../src/application/listTenants.ts'
import { renameTenant } from '../../src/application/renameTenant.ts'
import { seedDefaultTenant } from '../../src/application/seedDefaultTenant.ts'
import { CurrentTenantId } from '../../src/domain/tracing.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'
import { EventKind } from '../../src/domain/events.ts'

const makeEvent = (tenantId: string): NewEvent => ({
  actor: 'user',
  correlationId: randomUUID(),
  kind: EventKind.GoalSubmitted,
  occurredAt: new Date().toISOString(),
  payload: { goal: 'test' },
  schemaV: 1,
  sessionId: randomUUID(),
  storyRef: 'S1',
  tenantId,
})

const withStore = <A>(eff: Effect.Effect<A, unknown, EventStore>) => Effect.provide(eff, InMemoryEventStore.layer)

const withDateTimeStore = <A>(eff: Effect.Effect<A, unknown, EventStore | DateTime.CurrentTimeZone>) =>
  Effect.provide(
    eff,
    InMemoryEventStore.layer.pipe(
      Layer.provideMerge(DateTime.layerCurrentZoneLocal as Layer.Layer<DateTime.CurrentTimeZone>),
    ),
  )

describe('L1.9 — Tenant Isolation', () => {
  it.effect('stored event carries the tenantId supplied at write time', () =>
    withStore(
      Effect.gen(function* () {
        const store = yield* EventStore
        const ev = yield* store.append(makeEvent('acme'))
        expect(ev.tenantId).toBe('acme')
      }),
    ),
  )

  it.effect(
    'tenant-scoped query hides cross-tenant events (if-absent: this fails red without the tenantId filter)',
    () =>
      withStore(
        Effect.gen(function* () {
          const store = yield* EventStore
          const acmeEvent = yield* store.append(makeEvent('acme'))
          const defaultEvent = yield* store.append(makeEvent('default'))

          const acmeResults = yield* store.query({ tenantId: 'acme' })
          const defaultResults = yield* store.query({ tenantId: 'default' })

          // Cross-tenant events must not appear in scoped queries.
          // Removing the tenantId filter from EventStore.query would expose the
          // other tenant's events here, turning these assertions red (L1.9 if-absent).
          expect(acmeResults.some(e => e.id === defaultEvent.id)).toBe(false)
          expect(defaultResults.some(e => e.id === acmeEvent.id)).toBe(false)
          expect(acmeResults.every(e => e.tenantId === 'acme')).toBe(true)
          expect(defaultResults.every(e => e.tenantId === 'default')).toBe(true)
        }),
      ),
  )

  it.effect('unscoped query returns all tenants — proving the filter is the enforcement boundary', () =>
    withStore(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(makeEvent('acme'))
        yield* store.append(makeEvent('default'))

        const all = yield* store.query({})
        // Without a tenantId filter, events from all tenants are returned.
        // This confirms the filter is the only guard: bypassing it leaks data.
        expect(all.some(e => e.tenantId === 'acme')).toBe(true)
        expect(all.some(e => e.tenantId === 'default')).toBe(true)
      }),
    ),
  )

  it.effect('seedDefaultTenant is idempotent — default appears exactly once in listTenants', () =>
    withDateTimeStore(
      Effect.gen(function* () {
        yield* seedDefaultTenant()
        yield* seedDefaultTenant()
        const tenants = yield* listTenants()
        const defaults = tenants.filter(t => t.id === 'default')
        expect(defaults).toHaveLength(1)
        expect(defaults[0]?.name).toBe('Default')
      }),
    ),
  )

  it.effect('createTenant persists a new tenant visible in listTenants', () =>
    withDateTimeStore(
      Effect.gen(function* () {
        yield* createTenant('acme', 'Acme Corp')
        const tenants = yield* listTenants()
        const acme = tenants.find(t => t.id === 'acme')
        expect(acme).toBeDefined()
        expect(acme?.name).toBe('Acme Corp')
      }),
    ),
  )

  it.effect('renameTenant updates the tenant name — listTenants projection reflects it (L1.9 registry integrity)', () =>
    withDateTimeStore(
      Effect.gen(function* () {
        yield* createTenant('acme', 'Acme')
        yield* renameTenant('acme', 'Acme Corp')
        const tenants = yield* listTenants()
        const acme = tenants.find(t => t.id === 'acme')
        expect(acme?.name).toBe('Acme Corp')
      }),
    ),
  )

  it.effect('listSessions returns only sessions for the active tenant (application-layer isolation, L1.9)', () =>
    withStore(
      Effect.gen(function* () {
        const store = yield* EventStore
        const acmeSession = randomUUID()
        const defaultSession = randomUUID()
        yield* store.append({ ...makeEvent('acme'), sessionId: acmeSession })
        yield* store.append({ ...makeEvent('default'), sessionId: defaultSession })

        const acmeSessions = yield* Effect.provideService(listSessions, CurrentTenantId, 'acme')
        const defaultSessions = yield* Effect.provideService(listSessions, CurrentTenantId, 'default')

        expect(acmeSessions.some(s => s.sessionId === acmeSession)).toBe(true)
        expect(acmeSessions.some(s => s.sessionId === defaultSession)).toBe(false)
        expect(defaultSessions.some(s => s.sessionId === defaultSession)).toBe(true)
        expect(defaultSessions.some(s => s.sessionId === acmeSession)).toBe(false)
      }),
    ),
  )
})
