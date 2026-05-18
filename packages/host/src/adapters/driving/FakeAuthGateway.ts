import { randomBytes } from 'node:crypto'
import { Clock, Effect, Layer } from 'effect'
import type { AuthSession, Role } from '../../ports/driving/AuthGateway.ts'
import { AuthGateway, InvalidCredentials, SessionExpired, SessionNotFound } from '../../ports/driving/AuthGateway.ts'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { makeTenantGrantsResolver } from './tenantGrantsResolver.ts'

// Session TTL: 7 days in milliseconds (matches ScryptAuthGateway; sliding renewal in verify).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000

export interface FakeCred {
  readonly password: string
  readonly role: Role
  readonly username: string
  readonly tenantIds?: readonly string[]
}

export const FakeAuthGateway = {
  layer: (creds: readonly FakeCred[]) =>
    Layer.effect(
      AuthGateway,
      Effect.gen(function* () {
        const store = yield* EventStore
        const sessions = new Map<string, AuthSession>()

        // Resolves effective tenantIds: static cred tenantIds + TenantGranted events in EventStore.
        // Uses the store captured at layer build time — no EventStore requirement at call site.
        const getTenantIds = makeTenantGrantsResolver(
          subject => {
            const cred = creds.find(c => c.username === subject)
            return cred?.tenantIds ?? ['default']
          },
          filter => store.query(filter),
        )

        return AuthGateway.of({
          login: (username, password) =>
            Effect.gen(function* () {
              const cred = creds.find(c => c.username === username && c.password === password)
              if (cred === undefined) {
                return yield* new InvalidCredentials({ subject: username })
              }
              const now = yield* Clock.currentTimeMillis
              const token = randomBytes(32).toString('hex')
              // EventStoreError → die: EventStore is always present inside this layer.
              const tenantIds = yield* getTenantIds(username).pipe(Effect.orDie)
              const session: AuthSession = {
                expiresAtMs: now + SESSION_TTL_MS,
                issuedAtMs: now,
                role: cred.role,
                subject: username,
                tenantIds: [...tenantIds],
                token,
              }
              sessions.set(token, session)
              return session
            }),

          logout: token =>
            Effect.sync(() => {
              sessions.delete(token)
            }),

          verify: token =>
            Effect.gen(function* () {
              const session = sessions.get(token)
              if (session === undefined) {
                return yield* new SessionNotFound()
              }
              const now = yield* Clock.currentTimeMillis
              if (now > session.expiresAtMs) {
                return yield* new SessionExpired()
              }
              // EventStoreError → die: EventStore is always present inside this layer.
              const tenantIds = yield* getTenantIds(session.subject).pipe(Effect.orDie)
              return { role: session.role, subject: session.subject, tenantIds: [...tenantIds] }
            }),
        })
      }),
    ),
}
