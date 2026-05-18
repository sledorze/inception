/**
 * Unit tests for projectSessionTurns (extracted from sessionTurnsRoute).
 * Verifies the projection is behaviour-identical to the original inline logic.
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import type { StoredEvent } from '../../src/ports/driven/EventStore.ts'
import { projectSessionTurns } from '../../src/application/sessionTurns.ts'
import { EventKind } from '../../src/domain/events.ts'

const NOW = '2024-01-01T00:00:00.000Z'

const makeEvent = (
  overrides: Partial<StoredEvent> & Pick<StoredEvent, 'kind' | 'correlationId' | 'payload'>,
): StoredEvent => ({
  actor: 'host',
  contentHash: 'hash',
  id: `id-${overrides.correlationId}`,
  occurredAt: NOW,
  prevHash: 'genesis',
  schemaV: 1,
  sessionId: 'session-1',
  storyRef: 'S6',
  ...overrides,
})

describe('projectSessionTurns', () => {
  it.effect('empty events → empty array', () =>
    Effect.gen(function* () {
      const turns = yield* projectSessionTurns([])
      expect(turns).toHaveLength(0)
    }),
  )

  it.effect('GoalSubmitted + GoalCompleted → one turn with goal and reply', () =>
    Effect.gen(function* () {
      const events: StoredEvent[] = [
        makeEvent({
          actor: 'user',
          correlationId: 'cid-1',
          kind: EventKind.GoalSubmitted,
          payload: { goal: 'What is X?', handleId: 'h1' },
        }),
        makeEvent({ correlationId: 'cid-1', kind: EventKind.GoalCompleted, payload: { text: 'X is Y.' } }),
      ]
      const turns = yield* projectSessionTurns(events)
      expect(turns).toHaveLength(1)
      expect(turns[0]?.goal).toBe('What is X?')
      expect(turns[0]?.reply).toBe('X is Y.')
      expect(turns[0]?.turnIndex).toBe(0)
      expect(turns[0]?.correlationId).toBe('cid-1')
    }),
  )

  it.effect('GoalSubmitted without GoalCompleted (no reply, no clarify) → excluded', () =>
    Effect.gen(function* () {
      const events: StoredEvent[] = [
        makeEvent({
          actor: 'user',
          correlationId: 'cid-1',
          kind: EventKind.GoalSubmitted,
          payload: { goal: 'Pending', handleId: 'h1' },
        }),
      ]
      const turns = yield* projectSessionTurns(events)
      expect(turns).toHaveLength(0)
    }),
  )

  it.effect('ClarifyRequested (no GoalCompleted) → included with clarifyQuestion', () =>
    Effect.gen(function* () {
      const events: StoredEvent[] = [
        makeEvent({
          actor: 'user',
          correlationId: 'cid-1',
          kind: EventKind.GoalSubmitted,
          payload: { goal: 'Help me.', handleId: 'h1' },
        }),
        makeEvent({
          correlationId: 'cid-1',
          kind: EventKind.ClarifyRequested,
          payload: { question: 'What specifically?' },
        }),
      ]
      const turns = yield* projectSessionTurns(events)
      expect(turns).toHaveLength(1)
      expect(turns[0]?.goal).toBe('Help me.')
      expect(turns[0]?.reply).toBeUndefined()
      expect(turns[0]?.clarifyQuestion).toBe('What specifically?')
    }),
  )

  it.effect('ClarifyAnswered is captured on the turn', () =>
    Effect.gen(function* () {
      const events: StoredEvent[] = [
        makeEvent({
          actor: 'user',
          correlationId: 'cid-1',
          kind: EventKind.GoalSubmitted,
          payload: { goal: 'Help me.', handleId: 'h1' },
        }),
        makeEvent({
          correlationId: 'cid-1',
          kind: EventKind.ClarifyRequested,
          payload: { question: 'What specifically?' },
        }),
        makeEvent({
          actor: 'user',
          correlationId: 'cid-1',
          kind: EventKind.ClarifyAnswered,
          payload: { answer: 'I need X.', question: 'What specifically?' },
        }),
        makeEvent({ correlationId: 'cid-1', kind: EventKind.GoalCompleted, payload: { text: 'Here is X.' } }),
      ]
      const turns = yield* projectSessionTurns(events)
      expect(turns).toHaveLength(1)
      expect(turns[0]?.clarifyAnswer).toBe('I need X.')
      expect(turns[0]?.reply).toBe('Here is X.')
    }),
  )

  it.effect('multiple turns — ordered by GoalSubmitted order; turnIndex is sequential', () =>
    Effect.gen(function* () {
      const events: StoredEvent[] = [
        makeEvent({
          actor: 'user',
          correlationId: 'cid-1',
          kind: EventKind.GoalSubmitted,
          payload: { goal: 'Turn 1', handleId: 'h1' },
        }),
        makeEvent({ correlationId: 'cid-1', kind: EventKind.GoalCompleted, payload: { text: 'Reply 1' } }),
        makeEvent({
          actor: 'user',
          correlationId: 'cid-2',
          kind: EventKind.GoalSubmitted,
          payload: { goal: 'Turn 2', handleId: 'h1' },
        }),
        makeEvent({ correlationId: 'cid-2', kind: EventKind.GoalCompleted, payload: { text: 'Reply 2' } }),
      ]
      const turns = yield* projectSessionTurns(events)
      expect(turns).toHaveLength(2)
      expect(turns[0]?.goal).toBe('Turn 1')
      expect(turns[0]?.turnIndex).toBe(0)
      expect(turns[1]?.goal).toBe('Turn 2')
      expect(turns[1]?.turnIndex).toBe(1)
    }),
  )
})
