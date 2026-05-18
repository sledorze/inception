/**
 * Law L0.3 — Asymmetry Disclosure.
 * "Where actors hold asymmetric privileges, the asymmetry is named here and visible in the trace.
 *  Hidden asymmetry is forbidden." (docs/SPEC.md L0.3)
 *
 * If-absent failure modes tested:
 *   1. An enduser token on an admin-required call is rejected (Forbidden) — RBAC enforced.
 *   2. A successful login emits exactly one Authenticated event with NO secret material.
 *   3. The Authenticated event is queryable in the EventStore — asymmetry is trace-visible.
 *   4. An admin token on an admin-required call is permitted.
 */
import { Effect, Layer, Schema } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { FakeAuthGateway } from '../../src/adapters/driving/FakeAuthGateway.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { login } from '../../src/application/login.ts'
import { requireRole } from '../../src/application/authorize.ts'
import { AuthenticatedPayload, EventKind } from '../../src/domain/events.ts'
import { AuthGateway, ForbiddenTag, SessionNotFoundTag } from '../../src/ports/driving/AuthGateway.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const makeLayer = () =>
  FakeAuthGateway.layer([
    { password: 'adminpass', role: 'admin', username: 'admin' },
    { password: 'userpass', role: 'enduser', username: 'enduser' },
  ]).pipe(Layer.provideMerge(InMemoryEventStore.layer))

describe('L0.3 — Asymmetry Disclosure', () => {
  it.effect('enduser token on admin-required call is rejected with Forbidden', () =>
    Effect.gen(function* () {
      const auth = yield* AuthGateway
      const session = yield* auth.login('enduser', 'userpass')
      const err = yield* Effect.flip(requireRole(session.token, 'admin'))
      expect(err._tag).toBe(ForbiddenTag)
    }).pipe(
      Effect.provide(
        FakeAuthGateway.layer([{ password: 'userpass', role: 'enduser', username: 'enduser' }]).pipe(
          Layer.provide(InMemoryEventStore.layer),
        ),
      ),
    ),
  )

  it.effect('missing token on admin-required call is rejected with SessionNotFound', () =>
    Effect.gen(function* () {
      const err = yield* Effect.flip(requireRole(undefined, 'admin'))
      expect(err._tag).toBe(SessionNotFoundTag)
    }).pipe(
      Effect.provide(
        FakeAuthGateway.layer([{ password: 'adminpass', role: 'admin', username: 'admin' }]).pipe(
          Layer.provide(InMemoryEventStore.layer),
        ),
      ),
    ),
  )

  it.effect('successful login emits exactly one Authenticated event with no secret material', () =>
    Effect.gen(function* () {
      yield* login('admin', 'adminpass')

      const store = yield* EventStore
      const events = yield* store.query({ storyRef: 'L0.3' })
      const authEvents = events.filter(e => e.kind === EventKind.Authenticated)

      expect(authEvents).toHaveLength(1)
      const authEvent = authEvents[0]
      if (authEvent === undefined) {
        return
      }

      // Payload must decode as AuthenticatedPayload (subject + role only).
      const payload = yield* Schema.decodeUnknownEffect(AuthenticatedPayload)(authEvent.payload)
      expect(payload.subject).toBe('admin')
      expect(payload.role).toBe('admin')

      // No secret material — use type narrowing, no unsafe casts.
      const p = authEvent.payload
      if (typeof p === 'object' && p !== null) {
        expect('token' in p).toBe(false)
        expect('password' in p).toBe(false)
      }
    }).pipe(Effect.provide(makeLayer())),
  )

  it.effect('admin token on admin-required call is permitted', () =>
    Effect.gen(function* () {
      const auth = yield* AuthGateway
      const session = yield* auth.login('admin', 'adminpass')
      const principal = yield* requireRole(session.token, 'admin')
      expect(principal.role).toBe('admin')
      expect(principal.subject).toBe('admin')
    }).pipe(
      Effect.provide(
        FakeAuthGateway.layer([{ password: 'adminpass', role: 'admin', username: 'admin' }]).pipe(
          Layer.provide(InMemoryEventStore.layer),
        ),
      ),
    ),
  )
})
