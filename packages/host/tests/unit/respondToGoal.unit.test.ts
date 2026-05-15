/**
 * Unit tests for respondToGoal application service (TODO 6.9 / S8).
 *
 * Failure modes tested:
 *   (a) ClarifyNotFoundError — raised when no ClarifyRequested event exists for the correlationId
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { ClarifyNotFoundError, makeRespondToGoal } from '../../src/application/respondToGoal.ts'

describe(makeRespondToGoal, () => {
  it.effect('raises ClarifyNotFoundError when no pending clarification exists', () =>
    Effect.gen(function* () {
      const toolkit = {} as Parameters<typeof makeRespondToGoal>[0]
      const err = yield* Effect.flip(makeRespondToGoal(toolkit)('no-such-cid', 'some answer', 'session'))
      expect(err).toBeInstanceOf(ClarifyNotFoundError)
      expect((err as ClarifyNotFoundError).correlationId).toBe('no-such-cid')
    }).pipe(Effect.provide(InMemoryEventStore.layer)),
  )
})
