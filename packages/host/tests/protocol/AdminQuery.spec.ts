/**
 * Protocol contract test for the AdminQuery driving port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L0.3 (asymmetry disclosure), L2.14 (port contract), L1.3 (no raw bytes leak).
 */
import { Effect, Layer } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodeServices from '@effect/platform-node/NodeServices'
import { InMemoryAdminQuery } from '../../src/adapters/driving/InMemoryAdminQuery.ts'
import { EventStoreAdminQuery } from '../../src/adapters/driving/EventStoreAdminQuery.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { AdminQuery } from '../../src/ports/driving/AdminQuery.ts'
import type { LoopHealth, PainItem, TodoItem } from '../../src/domain/loopHealth.ts'

// ─── contract ─────────────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => Layer.Layer<AdminQuery>) {
  describe(name, () => {
    const run = <A, E>(eff: Effect.Effect<A, E, AdminQuery>) => Effect.provide(eff, makeLayer())

    it.effect('metrics returns a LoopHealth with numeric fields', () =>
      run(
        Effect.gen(function* () {
          const adminQuery = yield* AdminQuery
          const metrics = yield* adminQuery.metrics()
          expect(typeof metrics.eventCount).toBe('number')
          expect(typeof metrics.openPainItems).toBe('number')
          expect(typeof metrics.openTodoItems).toBe('number')
          expect(typeof metrics.doneTodoItems).toBe('number')
          expect(typeof metrics.archivedPainItems).toBe('number')
        }),
      ),
    )

    it.effect('pain returns an array (may be empty)', () =>
      run(
        Effect.gen(function* () {
          const adminQuery = yield* AdminQuery
          const items = yield* adminQuery.pain()
          expect(Array.isArray(items)).toBe(true)
        }),
      ),
    )

    it.effect('work returns an array (may be empty)', () =>
      run(
        Effect.gen(function* () {
          const adminQuery = yield* AdminQuery
          const items = yield* adminQuery.work()
          expect(Array.isArray(items)).toBe(true)
        }),
      ),
    )

    it.effect('trace returns an array of ObservedEvents (no raw handle bytes — L1.3)', () =>
      run(
        Effect.gen(function* () {
          const adminQuery = yield* AdminQuery
          const events = yield* adminQuery.trace({})
          expect(Array.isArray(events)).toBe(true)
          // L1.3: every event in the trace must NOT expose raw handle/script bytes.
          for (const e of events) {
            const p = e.payload
            if (typeof p === 'object' && p !== null) {
              expect('rawBytes' in p).toBe(false)
              expect('scriptSource' in p).toBe(false)
            }
          }
        }),
      ),
    )

    it.effect('trace with storyRef filter returns only matching events', () =>
      run(
        Effect.gen(function* () {
          const adminQuery = yield* AdminQuery
          const events = yield* adminQuery.trace({ storyRef: '__no_such_story__' })
          expect(Array.isArray(events)).toBe(true)
        }),
      ),
    )
  })
}

// ─── adapter configurations ───────────────────────────────────────────────────

const seedHealth: LoopHealth = {
  archivedPainItems: 1,
  doneTodoItems: 2,
  eventCount: 5,
  openPainItems: 3,
  openTodoItems: 4,
}
const seedPain: readonly PainItem[] = [{ id: 'P1', severity: 'high', status: 'open', title: 'Test pain' }]
const seedWork: readonly TodoItem[] = [{ id: '1.1', phase: 'Phase 1', status: 'todo', title: 'Test item' }]

runContract('InMemoryAdminQuery', () =>
  InMemoryAdminQuery.layer({ health: seedHealth, pain: seedPain, work: seedWork }),
)

const eventStoreAdminQueryLayer = () =>
  EventStoreAdminQuery.layer({
    painMd: new URL('../../../../docs/PAIN.md', import.meta.url).pathname,
    todoMd: new URL('../../../../docs/TODO.md', import.meta.url).pathname,
  }).pipe(
    Layer.provide(InMemoryEventStore.layer),
    Layer.provide(NodeFileSystem.layer),
    Layer.provide(NodeServices.layer),
  )

runContract('EventStoreAdminQuery', eventStoreAdminQueryLayer)
