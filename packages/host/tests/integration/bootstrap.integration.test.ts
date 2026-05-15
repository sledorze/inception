/**
 * Smoke test for runtime/bind.ts — the as-shipped composition root.
 *
 * The pairing matrix covers Laws and Ports but not bind.ts, which silently
 * swapped from InMemoryEventStore to SqliteEventStore in 3.3. This is the
 * first test consumer of appLayer; it proves the as-shipped wiring actually
 * constructs without error.
 *
 * Uses @effect/vitest layer() helper so all assertions stay inside it.effect,
 * consistent with the Effect-test-pattern (check-effect-patterns.sh rule 3).
 * DB_PATH is evaluated at bind.ts module-import time — this test uses the
 * default data/events.db and only reads, never writes.
 */
import { Effect } from 'effect'
import { expect, layer } from '@effect/vitest'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { appLayer } from '../../src/runtime/bind.ts'

layer(appLayer)('bootstrap — appLayer composition root (bind.ts)', it => {
  it.effect('resolves EventStore and accepts a query without throwing', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const events = yield* store.query({ limit: 1 })
      expect(Array.isArray(events)).toBe(true)
    }),
  )

  it.effect('resolves GeorgesToolkit — full service graph builds', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      expect(toolkit).toBeDefined()
      expect(typeof toolkit.handle).toBe('function')
    }),
  )

  it.effect('toolkit can list-tools (WorkspaceMount + ToolRegistry + PolicyGate wired)', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const stream = yield* toolkit.handle('list-tools', { role: 'Architect' })
      expect(stream).toBeDefined()
    }),
  )
})
