/**
 * Performance benchmarks for EventStore adapters.
 * §13 constraint: per-event write < 1 ms.
 *
 * Run with: pnpm vitest bench packages/host/tests/perf/
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Effect, ManagedRuntime } from 'effect'
import { bench, describe } from 'vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { SqliteEventStore } from '../../src/adapters/driven/SqliteEventStore.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'

const newEvent = (sessionId: string): NewEvent => ({
  actor: 'host',
  correlationId: randomUUID(),
  kind: 'GoalSubmitted',
  occurredAt: new Date().toISOString(),
  payload: { goal: 'benchmark' },
  schemaV: 1,
  sessionId,
  storyRef: 'S1',
})

const appendEffect = (event: NewEvent) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.append(event)
  })

describe('EventStore — append throughput (§13: < 1 ms per event)', () => {
  describe(InMemoryEventStore, () => {
    const rt = ManagedRuntime.make(InMemoryEventStore.layer)
    const session = randomUUID()

    bench('single append', async () => {
      await rt.runPromise(appendEffect(newEvent(session)))
    })
  })

  describe(SqliteEventStore, () => {
    const file = join(tmpdir(), `event-store-bench-${randomUUID()}.db`)
    const rt = ManagedRuntime.make(SqliteEventStore.layer(file))
    const session = randomUUID()

    bench('single append', async () => {
      await rt.runPromise(appendEffect(newEvent(session)))
    })
  })
})
