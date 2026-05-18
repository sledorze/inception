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

// Grants schema: { subject → [tenantId, ...] } — persisted separately from credentials.
const JsonGrants = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Array(Schema.String)))

// Shared grant-tenant logic: updates effective in-memory creds + runtime grants map + active sessions.
// Only grants (not credentials) are persisted so credentials.json stays read-only.
const buildGrantTenant =
  (
    mutableCreds: CredentialEntry[],
    sessions: Map<string, AuthSession>,
    grants: Map<string, string[]>,
    persistFn: (grants: Map<string, string[]>) => Effect.Effect<void>,
  ) =>
  (subject: string, tenantId: string): Effect.Effect<void> =>
    Effect.gen(function* () {
      const idx = mutableCreds.findIndex(c => c.subject === subject)
      if (idx === -1) {
        return
      }
      const cred = mutableCreds[idx]!
      const ids = cred.tenantIds ?? ['default']
      if (ids.includes(tenantId)) {
        return
      }
      mutableCreds[idx] = { ...cred, tenantIds: [...ids, tenantId] }
      const runtimeGrants = grants.get(subject) ?? []
      grants.set(subject, [...runtimeGrants, tenantId])
      for (const [token, session] of sessions) {
        if (session.subject === subject) {
          sessions.set(token, { ...session, tenantIds: [...session.tenantIds, tenantId] })
        }
      }
      yield* persistFn(grants)
    })

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
   *
   * grantsPath: when provided, grantTenant writes runtime-granted tenantIds to a
   * separate grants file (gitignored) so credentials.json stays read-only.
   * On startup, grants are merged with the static tenantIds from credentials.
   */
  fileBackedLayer: (credentials: readonly CredentialEntry[], sessionsPath: string, grantsPath?: string) =>
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

        // Load runtime grants (written by grantTenant at runtime, never by credentials.json).
        const grantsRaw =
          grantsPath !== undefined ? yield* fs.readFileString(grantsPath).pipe(Effect.orElseSucceed(() => '{}')) : '{}'
        const grantsRecord = yield* Schema.decodeUnknownEffect(JsonGrants)(grantsRaw).pipe(
          Effect.orElseSucceed(() => ({}) as Record<string, readonly string[]>),
        )
        const grants = new Map<string, string[]>(
          Object.entries(grantsRecord).map(([k, v]): [string, string[]] => [k, [...v]]),
        )

        // Merge static credentials with runtime grants into the effective in-memory state.
        const mutableCreds: CredentialEntry[] = credentials.map(cred => {
          const base = cred.tenantIds ?? ['default']
          const extra = grants.get(cred.subject) ?? []
          return { ...cred, tenantIds: [...new Set([...base, ...extra])] }
        })

        const persist = filePersist(fs, sessionsPath)
        const grantsPersist =
          grantsPath !== undefined ?
            (g: Map<string, string[]>) =>
              fs.writeFileString(grantsPath, JSON.stringify(Object.fromEntries(g), null, 2)).pipe(Effect.ignore)
          : (_: Map<string, string[]>) => Effect.void

        return AuthGateway.of({
          grantTenant: buildGrantTenant(mutableCreds, sessions, grants, grantsPersist),
          login: buildLogin(mutableCreds, sessions, persist),
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
        const grants = new Map<string, string[]>()
        const mutableCreds: CredentialEntry[] = [...credentials]
        return AuthGateway.of({
          grantTenant: buildGrantTenant(mutableCreds, sessions, grants, () => Effect.void),
          login: buildLogin(mutableCreds, sessions, noPersist),
          logout: buildLogout(sessions, noPersist),
          verify: buildVerify(sessions, noPersist),
        })
      }),
    ),
}
