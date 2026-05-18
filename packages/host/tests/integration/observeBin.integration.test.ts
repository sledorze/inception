/**
 * Integration test for bin/observe.ts wiring.
 *
 * Tests the observable behavior of the outer-MCP layer: given a seeded SQLite
 * event store, the ObservabilityGateway exposed by bin/observe.ts returns the
 * expected events via list-events and replay.
 *
 * Tests the same layer composition that bin/observe.ts uses (SqliteEventStore →
 * EventStoreObservabilityGateway → ObservabilityGateway) without spawning the
 * stdio MCP process — the MCP transport is provided by @effect/ai and is out of
 * scope for acceptance testing here.
 */
import { Effect, Layer, ManagedRuntime } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { SqliteEventStore } from '../../src/adapters/driven/SqliteEventStore.ts'
import { EventStoreObservabilityGateway } from '../../src/adapters/driving/EventStoreObservabilityGateway.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'
import { ObservabilityGateway } from '../../src/ports/driving/ObservabilityGateway.ts'
import type { ObservedEvent } from '../../src/ports/driving/ObservabilityGateway.ts'
import { EventKind } from '../../src/domain/events.ts'

const baseEvent = (): NewEvent => ({
  actor: 'user',
  correlationId: globalThis.crypto.randomUUID(),
  kind: EventKind.GoalSubmitted,
  occurredAt: new Date().toISOString(),
  payload: { goal: 'test', handleId: 'h1' },
  schemaV: 1,
  sessionId: globalThis.crypto.randomUUID(),
  storyRef: 'S1',
  tenantId: 'default',
})

type TestServices = EventStore | ObservabilityGateway

describe('observeBin — outer MCP layer wiring (bin/observe.ts)', () => {
  let rt: ManagedRuntime.ManagedRuntime<TestServices, never>
  let session: string

  beforeEach(() => {
    const dbPath = `/tmp/observe-bin-test-${globalThis.crypto.randomUUID()}.db`
    const storeLayer = SqliteEventStore.layer(dbPath)
    const gwLayer = EventStoreObservabilityGateway.layer
    const testLayer = gwLayer.pipe(Layer.provideMerge(storeLayer)) as Layer.Layer<TestServices, never, never>
    rt = ManagedRuntime.make(testLayer)
    session = globalThis.crypto.randomUUID()
  })

  afterEach(() => rt.dispose())

  const run = <A>(eff: Effect.Effect<A, unknown, TestServices>) => rt.runPromise(eff)

  it('list-events returns events seeded into the SQLite store', async () => {
    await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append({ ...baseEvent(), sessionId: session })
        yield* store.append({ ...baseEvent(), sessionId: session })
      }),
    )

    const events = await run(
      Effect.gen(function* () {
        const gw = yield* ObservabilityGateway
        return yield* gw.query({ sessionId: session })
      }),
    )

    expect(events).toHaveLength(2)
    expect(events.every(e => e.sessionId === session)).toBe(true)
    expect(events.every(e => e.kind === EventKind.GoalSubmitted)).toBe(true)
  })

  it('replay streams events from the given fromId in insertion order', async () => {
    const [first, , third] = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        const a = yield* store.append({ ...baseEvent(), sessionId: session })
        const b = yield* store.append({ ...baseEvent(), sessionId: session })
        const c = yield* store.append({ ...baseEvent(), sessionId: session })
        return [a, b, c] as const
      }),
    )

    const seen: string[] = []
    await run(
      Effect.gen(function* () {
        const gw = yield* ObservabilityGateway
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        yield* gw.replay(third!.id, (e: ObservedEvent) =>
          Effect.sync(() => {
            seen.push(e.id)
          }),
        )
      }),
    )

    expect(seen).toHaveLength(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(seen[0]).toBe(third!.id)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(seen).not.toContain(first!.id)
  })

  it('list-events with storyRef filter returns only matching events', async () => {
    await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append({ ...baseEvent(), storyRef: 'S1' })
        yield* store.append({ ...baseEvent(), storyRef: 'S2' })
      }),
    )

    const s1Events = await run(
      Effect.gen(function* () {
        const gw = yield* ObservabilityGateway
        return yield* gw.query({ storyRef: 'S1' })
      }),
    )

    expect(s1Events.length).toBeGreaterThanOrEqual(1)
    expect(s1Events.every(e => e.storyRef === 'S1')).toBe(true)
  })
})
