import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { Clock, Effect, Layer } from 'effect'
import type { AuthSession, Role } from '../../ports/driving/AuthGateway.ts'
import { AuthGateway, InvalidCredentials, SessionExpired, SessionNotFound } from '../../ports/driving/AuthGateway.ts'

// Session TTL: 1 hour in milliseconds.
const SESSION_TTL_MS = 3_600_000

export interface CredentialEntry {
  readonly role: Role
  readonly salt: string // hex-encoded random salt
  readonly scryptHash: string // hex-encoded scrypt(password, salt, 32)
  readonly subject: string
}

/** Hash a plaintext password with a given salt. Used to pre-compute stored credentials. */
export const hashPassword = (password: string, salt: string): string => scryptSync(password, salt, 32).toString('hex')

/** Generate a random salt suitable for scrypt. */
export const generateSalt = (): string => randomBytes(16).toString('hex')

export const ScryptAuthGateway = {
  layer: (credentials: readonly CredentialEntry[]) =>
    Layer.effect(
      AuthGateway,
      Effect.sync(() => {
        // NOTE: sessions are in-memory — a server restart invalidates all active tokens.
        // Acceptable for the prototype; production path would persist tokens in the EventStore.
        const sessions = new Map<string, AuthSession>()

        return AuthGateway.of({
          login: (username, password) =>
            Effect.gen(function* () {
              const cred = credentials.find(c => c.subject === username)
              if (cred === undefined) {
                return yield* new InvalidCredentials({ subject: username })
              }
              // Constant-time comparison; crypto errors treated as auth failure.
              const match = yield* Effect.try({
                catch: () => new InvalidCredentials({ subject: username }),
                try: () => {
                  const hash = scryptSync(password, cred.salt, 32)
                  return timingSafeEqual(hash, Buffer.from(cred.scryptHash, 'hex'))
                },
              })
              if (!match) {
                return yield* new InvalidCredentials({ subject: username })
              }
              const now = yield* Clock.currentTimeMillis
              const token = randomBytes(32).toString('hex')
              const session: AuthSession = {
                expiresAtMs: now + SESSION_TTL_MS,
                issuedAtMs: now,
                role: cred.role,
                subject: username,
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
              return { role: session.role, subject: session.subject }
            }),
        })
      }),
    ),
}
