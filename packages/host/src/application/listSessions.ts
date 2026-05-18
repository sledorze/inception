/**
 * Session enumeration — application function (S8 / persistent sessions).
 *
 * Aggregates every StoredEvent by `sessionId` into a summary the chat app uses to
 * list and switch sessions. Extracted from the inline `GET /api/sessions` route
 * body so the aggregation is unit-testable and the route stays thin (L2.14).
 *
 * Note: events carry only `actor`, not an owner/subject — every enduser sees all
 * enduser sessions. True per-user isolation needs an owner field on events
 * (tracked follow-up); out of scope here.
 */
import { Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export interface SessionSummary {
  readonly sessionId: string
  readonly eventCount: number
  readonly goalCount: number
  readonly lastActivity: string
}

/** All sessions with event/goal counts and lastActivity, sorted by lastActivity descending. */
export const listSessions: Effect.Effect<readonly SessionSummary[], never, EventStore> = Effect.gen(function* () {
  const store = yield* EventStore
  const events = yield* store.query({}).pipe(Effect.orDie)
  const sessions = new Map<string, { sessionId: string; eventCount: number; goalCount: number; lastActivity: string }>()
  const deleted = new Set<string>()
  for (const e of events) {
    if (e.kind === EventKind.SessionDeleted) {
      deleted.add(e.sessionId)
      continue
    }
    const s = sessions.get(e.sessionId)
    if (s === undefined) {
      sessions.set(e.sessionId, {
        eventCount: 1,
        goalCount: e.kind === EventKind.GoalSubmitted ? 1 : 0,
        lastActivity: e.occurredAt,
        sessionId: e.sessionId,
      })
    } else {
      s.eventCount++
      if (e.occurredAt > s.lastActivity) {
        s.lastActivity = e.occurredAt
      }
      if (e.kind === EventKind.GoalSubmitted) {
        s.goalCount++
      }
    }
  }
  return [...sessions.values()]
    .filter(s => !deleted.has(s.sessionId))
    .toSorted((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}).pipe(Effect.withSpan('ListSessions.list'))
