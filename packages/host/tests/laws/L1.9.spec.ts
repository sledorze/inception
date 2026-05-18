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
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
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
})
