/**
 * L2.3 — Quarantine enforcement.
 *
 * A session is quarantined when the most recent quarantine-related event in
 * the store is SessionQuarantined (not QuarantineReleased). Multiple quarantine
 * + release cycles are handled correctly via ordering by event insertion order.
 */
import { Effect, Schema } from 'effect'
import { EventKind } from '../domain/events.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export class SessionQuarantinedError extends Schema.TaggedErrorClass<SessionQuarantinedError>()(
  '@app/host/SessionQuarantinedError',
  { sessionId: Schema.String },
) {}

// Returns void when the session is not quarantined; fails with SessionQuarantinedError
// when the last quarantine-related event for this session is SessionQuarantined.
export const checkQuarantine = Effect.fn('quarantine.checkQuarantine')(function* (sessionId: string) {
  const store = yield* EventStore
  const events = yield* store.query({ sessionId })
  const quarantineEvents = events.filter(
    e => e.kind === EventKind.SessionQuarantined || e.kind === EventKind.QuarantineReleased,
  )
  if (quarantineEvents.length === 0) {
    return
  }
  const last = quarantineEvents.at(-1)
  if (last?.kind === EventKind.SessionQuarantined) {
    return yield* new SessionQuarantinedError({ sessionId })
  }
})
