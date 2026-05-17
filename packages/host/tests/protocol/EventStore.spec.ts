/**
 * Protocol contract test for the EventStore port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L1.4 (tamper-evident chain), L2.14 (port contract).
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Layer } from 'effect'
import { Effect, ManagedRuntime } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { SqliteEventStore } from '../../src/adapters/driven/SqliteEventStore.ts'
import { EventKind } from '../../src/domain/events.ts'
import { computeContentHash, EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'

const baseEvent = (): NewEvent => ({
  actor: 'user',
  correlationId: randomUUID(),
  kind: EventKind.GoalSubmitted,
  occurredAt: new Date().toISOString(),
  payload: { goal: 'test goal' },
  schemaV: 1,
  sessionId: randomUUID(),
  storyRef: 'S1',
})

// Thin helpers so test bodies stay readable.
// Using Effect.gen to avoid false-positives from react-hooks/rules-of-hooks (EventStore.use)
// and unicorn/no-array-method-this-argument (Effect.flatMap two-arg form).
const append = (event: NewEvent) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.append(event)
  })
const query = (filter: Parameters<EventStore['Service']['query']>[0]) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.query(filter)
  })
const replay = (fromId: string, onEvent: Parameters<EventStore['Service']['replay']>[1]) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.replay(fromId, onEvent)
  })

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => Layer.Layer<EventStore>) {
  describe(name, () => {
    // ManagedRuntime builds the layer once per test — shared Ref persists across run() calls.
    let rt: ManagedRuntime.ManagedRuntime<EventStore, never>

    beforeEach(() => {
      rt = ManagedRuntime.make(makeLayer())
    })

    afterEach(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, EventStore>) => rt.runPromise(effect)

    it('append returns a StoredEvent with a generated id', async () => {
      const event = await run(append(baseEvent()))
      expect(event.id).toBeTypeOf('string')
      expect(event.id.length).toBeGreaterThan(0)
    })

    it('contentHash matches the §9 formula', async () => {
      const input = baseEvent()
      const event = await run(append(input))
      expect(event.contentHash).toBe(computeContentHash(input))
    })

    it('first event in a session has prevHash = "genesis"', async () => {
      const event = await run(append(baseEvent()))
      expect(event.prevHash).toBe('genesis')
    })

    it('second event in same session chains to first contentHash', async () => {
      const session = randomUUID()
      const first = await run(append({ ...baseEvent(), sessionId: session }))
      const second = await run(append({ ...baseEvent(), sessionId: session }))
      expect(second.prevHash).toBe(first.contentHash)
    })

    it('different sessions have independent chains (both genesis first)', async () => {
      const [a, b] = await run(Effect.all([append(baseEvent()), append(baseEvent())]))
      expect(a.prevHash).toBe('genesis')
      expect(b.prevHash).toBe('genesis')
    })

    it('query returns all events when no filter supplied', async () => {
      const session = randomUUID()
      await run(
        Effect.all([append({ ...baseEvent(), sessionId: session }), append({ ...baseEvent(), sessionId: session })]),
      )
      const results = await run(query({}))
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    it('query filters by sessionId', async () => {
      const wanted = randomUUID()
      const other = randomUUID()
      await run(
        Effect.all([append({ ...baseEvent(), sessionId: wanted }), append({ ...baseEvent(), sessionId: other })]),
      )
      const results = await run(query({ sessionId: wanted }))
      expect(results.every(e => e.sessionId === wanted)).toBeTruthy()
      expect(results.length).toBe(1)
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
      expect(results.length).toBe(2)
    })

    it('replay delivers events in append order starting from fromId', async () => {
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

    it('payload round-trips faithfully', async () => {
      const payload = { arr: [1, 2, 3], nested: { value: 42 } }
      const event = await run(append({ ...baseEvent(), payload }))
      expect(event.payload).toEqual(payload)
    })

    it('duplicate append is idempotent — returns existing stored event without error', async () => {
      const event = baseEvent()
      const first = await run(append(event))
      const second = await run(append(event))
      expect(second.id).toBe(first.id)
      expect(second.contentHash).toBe(first.contentHash)
      const all = await run(query({}))
      expect(all.filter(e => e.contentHash === first.contentHash)).toHaveLength(1)
    })
  })
}

// ─── adapter instantiation ────────────────────────────────────────────────────

runContract('InMemoryEventStore', () => InMemoryEventStore.layer)

runContract('SqliteEventStore', () => SqliteEventStore.layer(join(tmpdir(), `event-store-test-${randomUUID()}.db`)))

// ─── SQLite durability: cross-restart persistence (P33) ──────────────────────
//
// Verifies that events written in one layer lifetime are readable after the layer
// is closed and re-opened on the same file path. InMemoryEventStore cannot satisfy
// this invariant by design — this test is SQLite-only.
describe('SqliteEventStore — cross-restart durability (P33)', () => {
  it('events survive a close-and-reopen cycle', async () => {
    const dbPath = join(tmpdir(), `event-store-durability-${randomUUID()}.db`)
    const session = randomUUID()

    // Phase 1: write two events, then dispose the layer.
    const rt1 = ManagedRuntime.make(SqliteEventStore.layer(dbPath))
    let firstId: string
    let secondId: string
    try {
      const first = await rt1.runPromise(append({ ...baseEvent(), sessionId: session }))
      const second = await rt1.runPromise(append({ ...baseEvent(), sessionId: session }))
      firstId = first.id
      secondId = second.id
    } finally {
      await rt1.dispose()
    }

    // Phase 2: reopen on the same path — events must still be present.
    const rt2 = ManagedRuntime.make(SqliteEventStore.layer(dbPath))
    try {
      const results = await rt2.runPromise(query({ sessionId: session }))
      expect(results.map(e => e.id)).toContain(firstId)
      expect(results.map(e => e.id)).toContain(secondId)
      expect(results).toHaveLength(2)
    } finally {
      await rt2.dispose()
    }
  })
})
