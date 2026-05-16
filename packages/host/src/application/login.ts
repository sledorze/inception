import { Clock, Effect, Random } from 'effect'
import { EventKind } from '../domain/events.ts'
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
  const nowMs = yield* Clock.currentTimeMillis
  const correlationId = yield* Random.nextUUIDv4
  yield* store.append({
    actor: 'host',
    correlationId,
    kind: EventKind.Authenticated,
    occurredAt: new Date(nowMs).toISOString(),
    payload: { role: session.role, subject: session.subject },
    schemaV: 1,
    sessionId: 'auth',
    storyRef: 'L0.3',
  })

  return session
})
