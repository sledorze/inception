import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { Clock, Effect, FileSystem, Layer, Schema } from 'effect'
import type { AuthSession, Role } from '../../ports/driving/AuthGateway.ts'
import {
  AuthGateway,
  AuthSessionSchema,
  InvalidCredentials,
  SessionExpired,
  SessionNotFound,
} from '../../ports/driving/AuthGateway.ts'

// Session TTL: 7 days in milliseconds (sliding — renewed on every successful verify).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000

export interface CredentialEntry {
  readonly role: Role
  readonly salt: string // hex-encoded random salt
  readonly scryptHash: string // hex-encoded scrypt(password, salt, 32)
  readonly subject: string
  readonly tenantIds?: readonly string[]
}

/** Hash a plaintext password with a given salt. Used to pre-compute stored credentials. */
export const hashPassword = (password: string, salt: string): string => scryptSync(password, salt, 32).toString('hex')

/** Generate a random salt suitable for scrypt. */
export const generateSalt = (): string => randomBytes(16).toString('hex')

// Shared session logic between the in-memory and file-backed layers.
const buildLogin =
  (
    credentials: readonly CredentialEntry[],
    sessions: Map<string, AuthSession>,
    persist: (m: Map<string, AuthSession>) => Effect.Effect<void>,
  ) =>
  (username: string, password: string) =>
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
        tenantIds: cred.tenantIds ?? ['default'],
        token,
      }
      sessions.set(token, session)
      yield* persist(sessions)
      return session
    })

const buildLogout =
  (sessions: Map<string, AuthSession>, persist: (m: Map<string, AuthSession>) => Effect.Effect<void>) =>
  (token: string) =>
    Effect.gen(function* () {
      sessions.delete(token)
      yield* persist(sessions)
    })

const buildVerify =
  (sessions: Map<string, AuthSession>, persist: (m: Map<string, AuthSession>) => Effect.Effect<void>) =>
  (token: string) =>
    Effect.gen(function* () {
      const session = sessions.get(token)
      if (session === undefined) {
        return yield* new SessionNotFound()
      }
      const now = yield* Clock.currentTimeMillis
      if (now > session.expiresAtMs) {
        return yield* new SessionExpired()
      }
      // Sliding renewal — extend expiry window on every successful verify.
      const renewed: AuthSession = { ...session, expiresAtMs: now + SESSION_TTL_MS }
      sessions.set(token, renewed)
      yield* persist(sessions)
      return { role: renewed.role, subject: renewed.subject, tenantIds: [...renewed.tenantIds] }
    })

const noPersist = (_: Map<string, AuthSession>): Effect.Effect<void> => Effect.void

const JsonSessions = Schema.fromJsonString(Schema.Array(AuthSessionSchema))

const filePersist =
  (fs: FileSystem.FileSystem, sessionsPath: string) =>
  (map: Map<string, AuthSession>): Effect.Effect<void> =>
    Schema.encodeEffect(JsonSessions)(Array.from(map.values())).pipe(
      Effect.flatMap(json => fs.writeFileString(sessionsPath, json)),
      Effect.ignore,
    )

export const ScryptAuthGateway = {
  /**
   * File-backed layer — sessions are loaded from disk on build and persisted on every
   * login/logout/verify-renew. Expired sessions are filtered out on load.
   * Persist is best-effort: a write failure does not propagate to callers.
   */
  fileBackedLayer: (credentials: readonly CredentialEntry[], sessionsPath: string) =>
    Layer.effect(
      AuthGateway,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const now = yield* Clock.currentTimeMillis

        const raw = yield* fs.readFileString(sessionsPath).pipe(Effect.orElseSucceed(() => '[]'))
        const loaded = yield* Schema.decodeUnknownEffect(JsonSessions)(raw).pipe(
          Effect.orElseSucceed(() => [] as readonly AuthSession[]),
        )
        const valid = loaded.filter(s => s.expiresAtMs > now)
        const sessions = new Map<string, AuthSession>(valid.map(s => [s.token, s]))

        const persist = filePersist(fs, sessionsPath)
        return AuthGateway.of({
          login: buildLogin(credentials, sessions, persist),
          logout: buildLogout(sessions, persist),
          verify: buildVerify(sessions, persist),
        })
      }),
    ),

  /**
   * In-memory layer — sessions are lost on restart. Used by the protocol test suite
   * (no FileSystem dependency required).
   */
  layer: (credentials: readonly CredentialEntry[]) =>
    Layer.effect(
      AuthGateway,
      Effect.sync(() => {
        const sessions = new Map<string, AuthSession>()
        return AuthGateway.of({
          login: buildLogin(credentials, sessions, noPersist),
          logout: buildLogout(sessions, noPersist),
          verify: buildVerify(sessions, noPersist),
        })
      }),
    ),
}
