/**
 * Integration test for S3 / 5.2 — rejection pattern detection.
 *
 * Asserts that:
 * 1. recordRejection emits UserRejected events to the EventStore.
 * 2. After REJECTION_THRESHOLD (3) rejections on the same storyRef,
 *    RejectionPatternCandidate is emitted exactly once.
 * 3. Further rejections do not emit duplicate candidates.
 *
 * This test closes the S3 feedback loop from the code side:
 * Claude queries traces via bin/observe.ts, observes the candidate event,
 * and refines agent.md out-of-band (done — see agent.md session protocol).
 */
import { Effect, Layer } from 'effect'
import { NodeFileSystem } from '@effect/platform-node'
import { expect, layer } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { recordRejection } from '../../src/application/rejectionPattern.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const TestLayer = Layer.mergeAll(InMemoryEventStore.layer, NodeFileSystem.layer)

const reject = (n: number) =>
  recordRejection({
    correlationId: `corr-${n}`,
    reason: 'result was incorrect',
    sessionId: 'test-session',
    storyRef: 'S3',
  })

layer(TestLayer)('rejectionPattern — S3 rejection detection (5.2)', it => {
  it.effect('UserRejected events accumulate in the store', () =>
    Effect.gen(function* () {
      yield* reject(1)
      yield* reject(2)

      const store = yield* EventStore
      const events = yield* store.query({ storyRef: 'S3' })
      const rejections = events.filter(e => e.kind === 'UserRejected')
      expect(rejections).toHaveLength(2)
      expect(rejections.every(e => e.actor === 'user')).toBe(true)
    }),
  )

  it.effect('RejectionPatternCandidate emitted after threshold rejections', () =>
    Effect.gen(function* () {
      yield* reject(1)
      yield* reject(2)
      yield* reject(3)

      const store = yield* EventStore
      const events = yield* store.query({ storyRef: 'S3' })
      const candidates = events.filter(e => e.kind === 'RejectionPatternCandidate')
      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.actor).toBe('host')
      const payload = candidates[0]?.payload as { rejectionCount: number; storyRef: string } | undefined
      expect(payload?.rejectionCount).toBe(3)
      expect(payload?.storyRef).toBe('S3')
    }),
  )

  it.effect('RejectionPatternCandidate is not duplicated on further rejections', () =>
    Effect.gen(function* () {
      yield* reject(1)
      yield* reject(2)
      yield* reject(3)
      yield* reject(4)

      const store = yield* EventStore
      const events = yield* store.query({ storyRef: 'S3' })
      const candidates = events.filter(e => e.kind === 'RejectionPatternCandidate')
      expect(candidates).toHaveLength(1)
    }),
  )
})
