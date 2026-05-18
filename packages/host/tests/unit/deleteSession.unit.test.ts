/**
 * Unit tests for deleteSession — tombstone-based soft-delete (S8 / L1.4 / append-only trace).
 *
 * Invariants tested:
 *  (a) isSessionDeleted returns false before any SessionDeleted event
 *  (b) deleteSession appends exactly one SessionDeleted event with the correct fields
 *  (c) isSessionDeleted returns true after deleteSession
 *  (d) idempotency: calling deleteSession twice yields exactly one SessionDeleted event
 *      (depends on deterministic correlationId === sessionId → same contentHash → dedup)
 *  (e) checkSessionDeleted fails with SessionDeletedError for a tombstoned session
 *  (f) checkSessionDeleted returns void for a non-deleted session
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import {
  SessionDeletedError,
  checkSessionDeleted,
  deleteSession,
  isSessionDeleted,
} from '../../src/application/deleteSession.ts'
import { EventKind, SessionDeletedPayload } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const withStore = <A>(eff: Effect.Effect<A, unknown, EventStore>) => Effect.provide(eff, InMemoryEventStore.layer)

describe('deleteSession', () => {
  it.effect('isSessionDeleted returns false when no SessionDeleted event exists', () =>
    withStore(
      Effect.gen(function* () {
        expect(yield* isSessionDeleted('session-x')).toBe(false)
      }),
    ),
  )

  it.effect('deleteSession appends a SessionDeleted event with correct shape', () =>
    withStore(
      Effect.gen(function* () {
        yield* deleteSession('session-abc')
        const store = yield* EventStore
        const events = yield* store.query({ sessionId: 'session-abc' })
        const tombstone = events.find(e => e.kind === EventKind.SessionDeleted)
        expect(tombstone).toBeDefined()
        expect(tombstone?.actor).toBe('user')
        expect(tombstone?.storyRef).toBe('S8')
        expect(tombstone?.correlationId).toBe('session-abc')
        const payload = yield* Schema.decodeUnknownEffect(SessionDeletedPayload)(tombstone?.payload).pipe(Effect.orDie)
        expect(payload.sessionId).toBe('session-abc')
      }),
    ),
  )

  it.effect('isSessionDeleted returns true after deleteSession', () =>
    withStore(
      Effect.gen(function* () {
        yield* deleteSession('session-y')
        expect(yield* isSessionDeleted('session-y')).toBe(true)
      }),
    ),
  )

  it.effect('deleteSession is idempotent — double call yields exactly one SessionDeleted event', () =>
    withStore(
      Effect.gen(function* () {
        yield* deleteSession('session-idem')
        yield* deleteSession('session-idem')
        const store = yield* EventStore
        const events = yield* store.query({ sessionId: 'session-idem' })
        const tombstones = events.filter(e => e.kind === EventKind.SessionDeleted)
        expect(tombstones).toHaveLength(1)
      }),
    ),
  )

  it.effect('checkSessionDeleted fails with SessionDeletedError for a tombstoned session', () =>
    withStore(
      Effect.gen(function* () {
        yield* deleteSession('session-d')
        const err = yield* Effect.flip(checkSessionDeleted('session-d'))
        expect(err).toBeInstanceOf(SessionDeletedError)
        expect((err as SessionDeletedError).sessionId).toBe('session-d')
      }),
    ),
  )

  it.effect('checkSessionDeleted returns void for a live session', () =>
    withStore(
      Effect.gen(function* () {
        const result = yield* checkSessionDeleted('session-live')
        expect(result).toBeUndefined()
      }),
    ),
  )
})
