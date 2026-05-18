/**
 * Protocol contract test for the AuthGateway driving port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L0.3 (asymmetry disclosure), L2.14 (port contract).
 */
import { DateTime, Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from '@effect/vitest'
import type { FakeCred } from '../../src/adapters/driving/FakeAuthGateway.ts'
import { FakeAuthGateway } from '../../src/adapters/driving/FakeAuthGateway.ts'
import { generateSalt, hashPassword, ScryptAuthGateway } from '../../src/adapters/driving/ScryptAuthGateway.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import {
  AuthGateway,
  InvalidCredentialsTag,
  SessionExpiredTag,
  SessionNotFoundTag,
} from '../../src/ports/driving/AuthGateway.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { EventKind } from '../../src/domain/events.ts'
import { SYSTEM_TENANT_ID, TENANTS_SESSION_ID } from '../../src/domain/tenantRegistry.ts'
import { makeCorrelationId } from '../../src/domain/ids.ts'

// InMemoryEventStore requires DateTime.CurrentTimeZone (for DateTime.now inside append).
const eventStoreLayer = InMemoryEventStore.layer.pipe(
  Layer.provide(DateTime.layerCurrentZoneLocal as Layer.Layer<DateTime.CurrentTimeZone>),
)

// ─── contract ─────────────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => Layer.Layer<AuthGateway | EventStore>) {
  describe(name, () => {
    const run = <A, E>(eff: Effect.Effect<A, E, AuthGateway | EventStore>) => Effect.provide(eff, makeLayer())

    it.effect('login succeeds with valid credentials and returns a session', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const session = yield* auth.login('alice', 'secret')
          expect(session.subject).toBe('alice')
          expect(session.role).toBe('admin')
          expect(session.token).toBeTruthy()
          expect(session.expiresAtMs).toBeGreaterThan(session.issuedAtMs)
        }),
      ),
    )

    it.effect('login with wrong password fails with InvalidCredentials', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const err = yield* Effect.flip(auth.login('alice', 'wrong'))
          expect(err._tag).toBe(InvalidCredentialsTag)
        }),
      ),
    )

    it.effect('login with unknown user fails with InvalidCredentials', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const err = yield* Effect.flip(auth.login('unknown', 'secret'))
          expect(err._tag).toBe(InvalidCredentialsTag)
        }),
      ),
    )

    it.effect('verify of unknown token fails with SessionNotFound', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const err = yield* Effect.flip(auth.verify('no-such-token'))
          expect(err._tag).toBe(SessionNotFoundTag)
        }),
      ),
    )

    it.effect('verify after logout fails with SessionNotFound (illegal sequence)', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const session = yield* auth.login('alice', 'secret')
          yield* auth.logout(session.token)
          const err = yield* Effect.flip(auth.verify(session.token))
          expect(err._tag).toBe(SessionNotFoundTag)
        }),
      ),
    )

    it.effect('verify after session expiry fails with SessionExpired (TestClock)', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const session = yield* auth.login('alice', 'secret')
          // Advance the test clock past the 7-day session TTL.
          yield* TestClock.adjust('8 days')
          const err = yield* Effect.flip(auth.verify(session.token))
          expect(err._tag).toBe(SessionExpiredTag)
        }),
      ),
    )

    it.effect('verify of valid token returns Principal with correct role and tenantIds', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const session = yield* auth.login('alice', 'secret')
          expect(session.tenantIds).toContain('default')
          const principal = yield* auth.verify(session.token)
          expect(principal.subject).toBe('alice')
          expect(principal.role).toBe('admin')
          expect(principal.tenantIds).toContain('default')
        }),
      ),
    )

    // P63 acceptance test: verify reflects TenantGranted events written directly to EventStore.
    it.effect('verify reflects TenantGranted events from EventStore (P63 green)', () =>
      run(
        Effect.gen(function* () {
          const auth = yield* AuthGateway
          const store = yield* EventStore
          const session = yield* auth.login('alice', 'secret')

          // Emit TenantGranted event DIRECTLY to EventStore — no auth.grantTenant call.
          yield* store.append({
            actor: 'host' as const,
            correlationId: makeCorrelationId('test-p63'),
            kind: EventKind.TenantGranted,
            occurredAt: DateTime.formatIso(yield* DateTime.now),
            payload: { subject: 'alice', tenantId: 'acme' },
            schemaV: 1,
            sessionId: TENANTS_SESSION_ID,
            storyRef: 'S12',
            tenantId: SYSTEM_TENANT_ID,
          })

          const principal = yield* auth.verify(session.token)
          expect(principal.tenantIds).toContain('acme')
        }),
      ),
    )
  })
}

// ─── adapter configurations ───────────────────────────────────────────────────

const fakeCreds: readonly FakeCred[] = [{ password: 'secret', role: 'admin', username: 'alice' }]

runContract('FakeAuthGateway', () => FakeAuthGateway.layer(fakeCreds).pipe(Layer.provideMerge(eventStoreLayer)))

const salt = generateSalt()
const scryptCreds = [{ role: 'admin' as const, salt, scryptHash: hashPassword('secret', salt), subject: 'alice' }]

runContract('ScryptAuthGateway', () => ScryptAuthGateway.layer(scryptCreds).pipe(Layer.provideMerge(eventStoreLayer)))
