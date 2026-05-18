/**
 * Session deletion — tombstone pattern (append-only hash chain; hard delete would break L1.4).
 *
 * A session is deleted when any SessionDeleted event exists for the sessionId.
 * Deletion is idempotent: the event is content-hash-deterministic (correlationId === sessionId),
 * so a second append is a no-op (EventStore deduplicates on contentHash).
 */
import { DateTime, Effect, Schema } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeCorrelationId, SessionId } from '../domain/ids.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export class SessionDeletedError extends Schema.TaggedErrorClass<SessionDeletedError>()(
  '@app/host/SessionDeletedError',
  { sessionId: SessionId },
) {}

export const isSessionDeleted = Effect.fn('deleteSession.isSessionDeleted')(function* (sessionId: SessionId) {
  const store = yield* EventStore
  const events = yield* store.query({ sessionId })
  return events.some(e => e.kind === EventKind.SessionDeleted)
})

// Returns void when the session is not deleted; fails with SessionDeletedError when it is.
export const checkSessionDeleted = Effect.fn('deleteSession.checkSessionDeleted')(function* (sessionId: SessionId) {
  if (yield* isSessionDeleted(sessionId)) {
    return yield* new SessionDeletedError({ sessionId })
  }
})

export const deleteSession = Effect.fn('application.deleteSession')(function* (sessionId: SessionId) {
  const store = yield* EventStore
  yield* store
    .append({
      actor: 'user',
      // Deterministic correlationId makes the append idempotent (same contentHash on re-call).
      // SessionId used as CorrelationId for idempotency — same underlying string, different domains.
      correlationId: makeCorrelationId(sessionId),
      kind: EventKind.SessionDeleted,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { sessionId },
      schemaV: 1,
      sessionId,
      storyRef: 'S8',
    })
    .pipe(Effect.orDie)
})
