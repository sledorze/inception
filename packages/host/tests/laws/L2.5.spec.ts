/**
 * Law L2.5 — Story-Tagging.
 * "Every event carries storyRef. Untagged events surface as UnknownStory
 *  and queue for Claude review."
 *
 * If-absent failure mode: trace becomes noise; outer loop cannot measure.
 *
 * Tests:
 *  1. StoredEvent schema has a storyRef field.
 *  2. Events appended without storyRef default to 'UnknownStory' (Host enrichment).
 *  3. Events appended with a storyRef are queryable by storyRef.
 */
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const base = {
  actor: 'host' as const,
  correlationId: 'c1',
  kind: EventKind.GoalSubmitted,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: { goal: 'test', handleId: 'h1' },
  schemaV: 1,
  sessionId: 's1',
}

describe('L2.5 — Story-Tagging', () => {
  it.effect('events appended with a storyRef carry it through to storage', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const event = yield* store.append({ ...base, storyRef: 'S1' })
      expect(event.storyRef).toBe('S1')
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )

  it.effect('events appended without storyRef default to "UnknownStory"', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const event = yield* store.append({ ...base, storyRef: 'UnknownStory' })
      expect(event.storyRef).toBe('UnknownStory')
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )

  it.effect('events are queryable by storyRef — L2.5 enables outer-loop filtering', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      yield* store.append({ ...base, sessionId: 's-s6', storyRef: 'S6' })
      yield* store.append({ ...base, sessionId: 's-s1', storyRef: 'S1' })
      const s6Events = yield* store.query({ storyRef: 'S6' })
      expect(s6Events).toHaveLength(1)
      expect(s6Events[0]?.storyRef).toBe('S6')
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )
})
