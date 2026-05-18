import { randomBytes } from 'node:crypto'
import { Clock, Effect, Layer } from 'effect'
import type { AuthSession, Role } from '../../ports/driving/AuthGateway.ts'
import { AuthGateway, InvalidCredentials, SessionExpired, SessionNotFound } from '../../ports/driving/AuthGateway.ts'

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
      Effect.sync(() => {
        const sessions = new Map<string, AuthSession>()

        return AuthGateway.of({
          login: (username, password) =>
            Effect.gen(function* () {
              const cred = creds.find(c => c.username === username && c.password === password)
              if (cred === undefined) {
                return yield* new InvalidCredentials({ subject: username })
              }
              const now = yield* Clock.currentTimeMillis
              const token = randomBytes(32).toString('hex')
              const session: AuthSession = {
                expiresAtMs: now + SESSION_TTL_MS,
                issuedAtMs: now,
                role: cred.role,
                subject: username,
                tenantIds: cred.tenantIds ?? ['default'],
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
              return { role: session.role, subject: session.subject, tenantIds: [...session.tenantIds] }
            }),
        })
      }),
    ),
}
