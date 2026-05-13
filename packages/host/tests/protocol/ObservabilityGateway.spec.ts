/**
 * Protocol contract test for the ObservabilityGateway driving port.
 * Parametrised over all bound backing layers — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L1.4 (events queryable via outer observer), L2.14 (port contract).
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EventStoreObservabilityGateway } from '../../src/adapters/driving/EventStoreObservabilityGateway.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { SqliteEventStore } from '../../src/adapters/driven/SqliteEventStore.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'
import { ObservabilityGateway } from '../../src/ports/driving/ObservabilityGateway.ts'
import type { ObservedEvent, TraceQuery } from '../../src/ports/driving/ObservabilityGateway.ts'

const baseEvent = (): NewEvent => ({
  actor: 'user',
  correlationId: randomUUID(),
  kind: 'GoalSubmitted',
  occurredAt: new Date().toISOString(),
  payload: { goal: 'test goal' },
  schemaV: 1,
  sessionId: randomUUID(),
  storyRef: 'S1',
})

// Helpers that avoid false-positive lint rules (react-hooks, unicorn/no-array-method-this-argument).
const append = (event: NewEvent) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.append(event)
  })

const query = (q: TraceQuery) =>
  Effect.gen(function* () {
    const gw = yield* ObservabilityGateway
    return yield* gw.query(q)
  })

const replay = (fromId: string, onEvent: (e: ObservedEvent) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    const gw = yield* ObservabilityGateway
    return yield* gw.replay(fromId, onEvent)
  })

// ─── shared contract ─────────────────────────────────────────────────────────

type TestLayer = Layer.Layer<EventStore | ObservabilityGateway>

function runContract(name: string, makeLayer: () => TestLayer) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<EventStore | ObservabilityGateway, never>

    beforeEach(() => {
      rt = ManagedRuntime.make(makeLayer())
    })

    afterEach(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, EventStore | ObservabilityGateway>) => rt.runPromise(effect)

    it('query returns events appended to the store', async () => {
      const session = randomUUID()
      await run(append({ ...baseEvent(), sessionId: session }))
      const results = await run(query({ sessionId: session }))
      expect(results).toHaveLength(1)
      expect(results.at(0)?.sessionId).toBe(session)
    })

    it('observed event contains full envelope fields', async () => {
      const session = randomUUID()
      const input = { ...baseEvent(), sessionId: session }
      await run(append(input))
      const [ev] = await run(query({ sessionId: session }))
      expect(ev?.id).toBeTypeOf('string')
      expect(ev?.contentHash).toBeTypeOf('string')
      expect(ev?.prevHash).toBe('genesis')
      expect(ev?.actor).toBe('user')
      expect(ev?.kind).toBe('GoalSubmitted')
    })

    it('query filters by sessionId', async () => {
      const wanted = randomUUID()
      const other = randomUUID()
      await run(
        Effect.all([append({ ...baseEvent(), sessionId: wanted }), append({ ...baseEvent(), sessionId: other })]),
      )
      const results = await run(query({ sessionId: wanted }))
      expect(results.every(e => e.sessionId === wanted)).toBeTruthy()
      expect(results).toHaveLength(1)
    })

    it('query filters by storyRef', async () => {
      await run(Effect.all([append({ ...baseEvent(), storyRef: 'S1' }), append({ ...baseEvent(), storyRef: 'S2' })]))
      const results = await run(query({ storyRef: 'S1' }))
      expect(results.every(e => e.storyRef === 'S1')).toBeTruthy()
    })

    it('query respects limit', async () => {
      const session = randomUUID()
      await run(
        Effect.all([
          append({ ...baseEvent(), sessionId: session }),
          append({ ...baseEvent(), sessionId: session }),
          append({ ...baseEvent(), sessionId: session }),
        ]),
      )
      const results = await run(query({ limit: 2, sessionId: session }))
      expect(results).toHaveLength(2)
    })

    it('replay delivers events from fromId in append order', async () => {
      const session = randomUUID()
      const [first, second, third] = await run(
        Effect.all([
          append({ ...baseEvent(), sessionId: session }),
          append({ ...baseEvent(), sessionId: session }),
          append({ ...baseEvent(), sessionId: session }),
        ]),
      )

      const seen: string[] = []
      await run(replay(second.id, e => Effect.sync(() => seen.push(e.id))))

      expect(seen).toEqual([second.id, third.id])
      expect(seen).not.toContain(first.id)
    })

    it('replay from unknown id delivers nothing', async () => {
      const seen: string[] = []
      await run(replay(randomUUID(), e => Effect.sync(() => seen.push(e.id))))
      expect(seen).toHaveLength(0)
    })
  })
}

// ─── backing layer configurations ────────────────────────────────────────────

const makeLayer = (eventStoreLayer: Layer.Layer<EventStore>): TestLayer =>
  EventStoreObservabilityGateway.layer.pipe(Layer.provideMerge(eventStoreLayer))

runContract('EventStoreObservabilityGateway / InMemoryEventStore', () => makeLayer(InMemoryEventStore.layer))

runContract('EventStoreObservabilityGateway / SqliteEventStore', () =>
  makeLayer(SqliteEventStore.layer(join(tmpdir(), `obs-gateway-test-${randomUUID()}.db`))),
)
