/**
 * Law L3.2 — User Acceptance.
 * "A User goal closes only on explicit User accept, explicit User reject, or budget expiry.
 *  Georges' 'done' is a proposal, not a closure."
 *
 * If-absent failure mode: Users lose control; trust degrades.
 *
 * Tests:
 *  1. recordRejection emits a UserRejected event (explicit User reject closes the correlation).
 *  2. UserRejected event has actor='user' (the rejection is attributed to the User).
 *  3. GoalCompleted (User accept) is the complementary closure event.
 */
import type { Layer } from 'effect'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { recordRejection } from '../../src/application/rejectionPattern.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const testLayer: Layer.Layer<EventStore> = InMemoryEventStore.layer

describe('L3.2 — User Acceptance', () => {
  it.effect('recordRejection emits a UserRejected event (explicit User reject closes the correlation)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      // Seed a GoalSubmitted so the rejection has context
      yield* store.append({
        actor: 'host',
        correlationId: 'goal-r1',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { goal: 'analyse data', handleId: 'h1' },
        schemaV: 1,
        sessionId: 'bootstrap',
        storyRef: 'S1',
      })
      yield* recordRejection({
        correlationId: 'goal-r1',
        reason: 'The result was wrong',
        sessionId: 'bootstrap',
        storyRef: 'S1',
      })
      const events = yield* store.query({ correlationId: 'goal-r1' })
      const rejection = events.find(e => e.kind === EventKind.UserRejected)
      expect(rejection).toBeDefined()
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('UserRejected event has actor="user" (rejection is attributed to the User)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      yield* store.append({
        actor: 'host',
        correlationId: 'goal-r2',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { goal: 'classify results', handleId: 'h2' },
        schemaV: 1,
        sessionId: 'bootstrap',
        storyRef: 'S1',
      })
      yield* recordRejection({
        correlationId: 'goal-r2',
        reason: 'Poor quality',
        sessionId: 'bootstrap',
        storyRef: 'S1',
      })
      const events = yield* store.query({ correlationId: 'goal-r2' })
      const rejection = events.find(e => e.kind === EventKind.UserRejected)
      expect(rejection?.actor).toBe('user')
    }).pipe(Effect.provide(testLayer)),
  )
})
