/**
 * Law L3.1 — Visible Intent.
 * "Every cycle begins with a stated goal that becomes the correlation root.
 *  Cycles without stated goals are rejected."
 *
 * If-absent failure mode: effects cannot be attributed to intent.
 *
 * Tests:
 *  1. GoalSubmitted event carries the stated goal text (intent is recorded verbatim).
 *  2. GoalSubmitted event actor is 'user' (intent is attributed to the User).
 *  3. GoalSubmitted payload schema requires both goal and handleId (incomplete intent rejected).
 */
import { Effect, Schema } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { EventKind, GoalSubmittedPayload } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const testLayer = InMemoryEventStore.layer

describe('L3.1 — Visible Intent', () => {
  it.effect('GoalSubmitted event carries the stated goal text (intent recorded verbatim)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'user',
        correlationId: 'corr-intent-1',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { goal: 'analyse the sales dataset', handleId: 'h1' },
        schemaV: 1,
        sessionId: 'session-1',
        storyRef: 'S1',
      })
      const payload = stored.payload as { goal: string; handleId: string }
      expect(payload.goal).toBe('analyse the sales dataset')
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('GoalSubmitted event has actor="user" (intent attributed to the User)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'user',
        correlationId: 'corr-intent-2',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { goal: 'classify results', handleId: 'h2' },
        schemaV: 1,
        sessionId: 'session-2',
        storyRef: 'S1',
      })
      expect(stored.actor).toBe('user')
    }).pipe(Effect.provide(testLayer)),
  )

  it('GoalSubmittedPayload schema requires goal and handleId (incomplete intent fails decode)', () => {
    const withoutHandleId = Schema.decodeUnknownOption(GoalSubmittedPayload)({ goal: 'missing handle' })
    expect(withoutHandleId._tag).toBe('None')

    const withoutGoal = Schema.decodeUnknownOption(GoalSubmittedPayload)({ handleId: 'h1' })
    expect(withoutGoal._tag).toBe('None')

    const complete = Schema.decodeUnknownOption(GoalSubmittedPayload)({ goal: 'analyse data', handleId: 'h1' })
    expect(complete._tag).toBe('Some')
  })
})
