/**
 * Unit tests for respondToGoal application service (TODO 6.9 / S8).
 *
 * Failure modes tested:
 *   (a) ClarifyNotFoundError — raised when no ClarifyRequested event exists for the correlationId
 *
 * Happy path tested:
 *   (b) GoalCompleted lands under the ORIGINAL correlationId, not the LLM's internal newCorrelationId.
 *       This proves the correlation chain is intact across the clarify round-trip.
 */
import { describe, expect, it } from '@effect/vitest'
import { DateTime, Effect, Layer } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { InMemoryDataHandleRegistry } from '../../src/adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { ClarifyNotFoundError, makeRespondToGoal } from '../../src/application/respondToGoal.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const NOW = '2024-01-01T00:00:00.000Z'

const seedEvents = (correlationId: string, sessionId: string) =>
  Effect.gen(function* () {
    const store = yield* EventStore
    yield* store.append({
      actor: 'user',
      correlationId,
      kind: EventKind.GoalSubmitted,
      occurredAt: NOW,
      payload: { goal: 'help me', handleId: 'h1', sessionId },
      schemaV: 1,
      sessionId,
      storyRef: 'S6',
    })
    yield* store.append({
      actor: 'host',
      correlationId,
      kind: EventKind.ClarifyRequested,
      occurredAt: NOW,
      payload: { question: 'What specifically?' },
      schemaV: 1,
      sessionId: 'bootstrap',
      storyRef: 'S8',
    })
  })

// Minimal LanguageModel stub: always returns a fixed text reply.
const fakeLanguageModelLayer = Layer.succeed(
  LanguageModel.LanguageModel,
  LanguageModel.LanguageModel.of({
    generateObject: (() => Effect.die('not used')) as LanguageModel.Service['generateObject'],
    generateText: () =>
      Effect.succeed(new LanguageModel.GenerateTextResponse([{ text: 'Stub reply.', type: 'text' }])) as ReturnType<
        LanguageModel.Service['generateText']
      >,
    streamObject: (() => Effect.die('not used')) as LanguageModel.Service['streamObject'],
    streamText: (() => Effect.die('not used')) as LanguageModel.Service['streamText'],
  }),
)

const testLayer = Layer.mergeAll(
  InMemoryEventStore.layer,
  fakeLanguageModelLayer,
  NodeFileSystem.layer,
  InMemoryToolRegistry.layer([]),
  InMemoryDataHandleRegistry.layer(),
)

describe(makeRespondToGoal, () => {
  it.effect('raises ClarifyNotFoundError when no pending clarification exists', () =>
    Effect.gen(function* () {
      const toolkit = {} as Parameters<typeof makeRespondToGoal>[0]
      const err = yield* Effect.flip(makeRespondToGoal(toolkit)('no-such-cid', 'some answer', 'session'))
      expect(err).toBeInstanceOf(ClarifyNotFoundError)
      expect((err as ClarifyNotFoundError).correlationId).toBe('no-such-cid')
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )

  it.effect('GoalCompleted is appended under the original correlationId (not the LLM-internal one)', () =>
    Effect.gen(function* () {
      const correlationId = 'cid-clarify-test'
      const sessionId = 'session-1'
      const toolkit = {} as Parameters<typeof makeRespondToGoal>[0]

      yield* seedEvents(correlationId, sessionId)
      const result = yield* makeRespondToGoal(toolkit)(correlationId, 'Because I need X.', sessionId)

      expect(result.correlationId).toBe(correlationId)
      expect(result.sessionId).toBe(sessionId)

      // Verify GoalCompleted landed under the original correlationId, not a fresh UUID.
      const store = yield* EventStore
      const events = yield* store.query({ correlationId })
      const completed = events.find(e => e.kind === EventKind.GoalCompleted)
      expect(completed).toBeDefined()
      expect(completed?.correlationId).toBe(correlationId)
      expect(completed?.payload).toMatchObject({ text: 'Stub reply.' })
    }).pipe(Effect.provide(testLayer), Effect.provide(DateTime.layerCurrentZoneLocal)),
  )
})
