import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeSessionId, nextCorrelationId } from '../domain/ids.ts'
import { CurrentTenantId } from '../domain/tracing.ts'
import { AuthGateway } from '../ports/driving/AuthGateway.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

/**
 * Authenticate a user and emit an `Authenticated` event (L0.3).
 * The event carries subject + role only — NO token, NO password.
 */
export const login = Effect.fn('login.login')(function* (username: string, password: string) {
  const auth = yield* AuthGateway
  const session = yield* auth.login(username, password)

  // Emit trace-visible asymmetry disclosure (L0.3).
  const store = yield* EventStore
  const correlationId = yield* nextCorrelationId
  const tenantId = yield* CurrentTenantId
  yield* store.append({
    actor: 'host',
    correlationId,
    kind: EventKind.Authenticated,
    occurredAt: DateTime.formatIso(yield* DateTime.now),
    payload: { role: session.role, subject: session.subject },
    schemaV: 1,
    sessionId: makeSessionId('auth'),
    storyRef: 'L0.3',
    tenantId,
  })

  return session
})
