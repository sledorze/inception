/**
 * P51 acceptance test — file-backed auth sessions survive server restarts (7-day sliding TTL).
 *
 * RED: fails before ScryptAuthGateway.fileBackedLayer is implemented.
 * GREEN: passes after fileBackedLayer is wired in bind.ts.
 *
 * Tests two guarantees:
 *   (a) A token issued by one layer instance is verified by a fresh instance built
 *       from the same sessions file (simulates a server restart / tsx-watch reload).
 *   (b) Sliding renewal: a verify call within the TTL window extends the expiry so
 *       the token remains valid beyond the original fixed 7-day window.
 */
import { Effect, Layer, Random } from 'effect'
import { TestClock } from 'effect/testing'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { describe, expect, it } from '@effect/vitest'
import type { CredentialEntry } from '../../src/adapters/driving/ScryptAuthGateway.ts'
import { ScryptAuthGateway, generateSalt, hashPassword } from '../../src/adapters/driving/ScryptAuthGateway.ts'
import { AuthGateway } from '../../src/ports/driving/AuthGateway.ts'

const salt = generateSalt()
const creds: readonly CredentialEntry[] = [
  { role: 'admin', salt, scryptHash: hashPassword('secret', salt), subject: 'alice' },
]

const makeAuthLayer = (sessionsPath: string): Layer.Layer<AuthGateway> =>
  ScryptAuthGateway.fileBackedLayer(creds, sessionsPath).pipe(Layer.provide(NodeFileSystem.layer))

// ─── (a) token survives layer rebuild ────────────────────────────────────────

describe('P51 (a) — token verified by a fresh layer instance from same sessions file', () => {
  it.effect('verify succeeds after layer is rebuilt from the persisted sessions file', () =>
    Effect.gen(function* () {
      const id = yield* Random.nextUUIDv4
      const sessionsPath = `/tmp/auth-sessions-test-${id}.json`

      // First "server instance" — login, sessions written to file.
      const token = yield* Effect.gen(function* () {
        const auth = yield* AuthGateway
        const session = yield* auth.login('alice', 'secret')
        return session.token
      }).pipe(Effect.provide(makeAuthLayer(sessionsPath)))

      // Second "server instance" — fresh Map seeded from same file.
      const principal = yield* Effect.gen(function* () {
        const auth = yield* AuthGateway
        return yield* auth.verify(token)
      }).pipe(Effect.provide(makeAuthLayer(sessionsPath)))

      expect(principal.subject).toBe('alice')
      expect(principal.role).toBe('admin')
    }),
  )
})

// ─── (b) sliding renewal extends lifetime ────────────────────────────────────

describe('P51 (b) — sliding renewal keeps the session alive past the fixed 7-day window', () => {
  it.effect('verify at day 6 renews; verify at day 12 still succeeds', () =>
    Effect.gen(function* () {
      const id = yield* Random.nextUUIDv4
      const sessionsPath = `/tmp/auth-sessions-test-${id}.json`

      // Login at t=0: expiresAtMs = 7 days.
      const token = yield* Effect.gen(function* () {
        const auth = yield* AuthGateway
        const session = yield* auth.login('alice', 'secret')
        return session.token
      }).pipe(Effect.provide(makeAuthLayer(sessionsPath)))

      // Advance 6 days — still within window.
      yield* TestClock.adjust('6 days')

      // Verify at t=6d: succeeds and renews expiry to t=13d.
      yield* Effect.gen(function* () {
        const auth = yield* AuthGateway
        yield* auth.verify(token)
      }).pipe(Effect.provide(makeAuthLayer(sessionsPath)))

      // Advance another 6 days — total 12 elapsed, renewed expiry is t=13d → still valid.
      yield* TestClock.adjust('6 days')

      const principal = yield* Effect.gen(function* () {
        const auth = yield* AuthGateway
        return yield* auth.verify(token)
      }).pipe(Effect.provide(makeAuthLayer(sessionsPath)))

      expect(principal.subject).toBe('alice')
    }),
  )
})
