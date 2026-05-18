/**
 * Unit tests for listSessions — the session-enumeration application function (S8 / persistent sessions).
 *
 * Lifted out of the inline `GET /api/sessions` route body so the aggregation is
 * unit-testable without HTTP (L2.14 thin-route; TDD).
 *
 * Behaviours tested:
 *   (a) aggregates events by sessionId — eventCount, goalCount (GoalSubmitted only)
 *   (b) lastActivity = max occurredAt within a session
 *   (c) result sorted by lastActivity descending
 *   (d) empty store → []
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { listSessions } from '../../src/application/listSessions.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const T1 = '2024-01-01T00:00:01.000Z'
const T2 = '2024-01-01T00:00:02.000Z'
const T3 = '2024-01-01T00:00:03.000Z'

const seed = Effect.gen(function* () {
  const store = yield* EventStore
  yield* store.append({
    actor: 'user',
    correlationId: 'c1',
    kind: EventKind.GoalSubmitted,
    occurredAt: T1,
    payload: { goal: 'g1', handleId: 'h1' },
    schemaV: 1,
    sessionId: 's1',
    storyRef: 'S1',
  })
  yield* store.append({
    actor: 'host',
    correlationId: 'c1',
    kind: EventKind.GoalCompleted,
    occurredAt: T2,
    payload: { text: 'done' },
    schemaV: 1,
    sessionId: 's1',
    storyRef: 'S1',
  })
  yield* store.append({
    actor: 'user',
    correlationId: 'c2',
    kind: EventKind.GoalSubmitted,
    occurredAt: T3,
    payload: { goal: 'g2', handleId: 'h2' },
    schemaV: 1,
    sessionId: 's2',
    storyRef: 'S1',
  })
})

describe('listSessions', () => {
  it.effect('aggregates events by sessionId with event/goal counts and lastActivity', () =>
    Effect.gen(function* () {
      yield* seed
      const sessions = yield* listSessions
      const s1 = sessions.find(s => s.sessionId === 's1')
      const s2 = sessions.find(s => s.sessionId === 's2')
      expect(s1).toEqual({ eventCount: 2, goalCount: 1, lastActivity: T2, sessionId: 's1' })
      expect(s2).toEqual({ eventCount: 1, goalCount: 1, lastActivity: T3, sessionId: 's2' })
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )

  it.effect('sorts sessions by lastActivity descending', () =>
    Effect.gen(function* () {
      yield* seed
      const sessions = yield* listSessions
      expect(sessions.map(s => s.sessionId)).toEqual(['s2', 's1'])
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )

  it.effect('returns [] for an empty store', () =>
    Effect.gen(function* () {
      const sessions = yield* listSessions
      expect(sessions).toEqual([])
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )
})
