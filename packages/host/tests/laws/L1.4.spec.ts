/**
 * Law L1.4 — Tamper-Evident Trace.
 * "Every event carries contentHash + prevHash forming a per-session content-hash chain
 *  that is tamper-evident by construction." (§9, L1.4)
 *
 * If-absent failure mode: a mutated event would not be detectable during replay.
 * This test asserts the chain can be verified, and that mutation breaks verification.
 */
import { randomUUID } from 'node:crypto'
import { DateTime, Effect, Layer } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { FakeAuthGateway } from '../../src/adapters/driving/FakeAuthGateway.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { grantTenant } from '../../src/application/grantTenant.ts'
import { deleteSession } from '../../src/application/deleteSession.ts'
import { computeContentHash, EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent, StoredEvent } from '../../src/ports/driven/EventStore.ts'
import { EventKind } from '../../src/domain/events.ts'
import { createTenant } from '../../src/application/createTenant.ts'

const baseEvent = (sessionId: string): NewEvent => ({
  actor: 'user' as const,
  correlationId: randomUUID(),
  kind: EventKind.GoalSubmitted,
  occurredAt: new Date().toISOString(),
  payload: { goal: 'test' },
  schemaV: 1,
  sessionId,
  storyRef: 'S1',
})

/** Verify the hash chain of a sequence of events. Returns false on first broken link. */
function verifyChain(events: readonly StoredEvent[]): boolean {
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (!event) {
      return false
    }
    // Each event's contentHash must match the §9 formula for its business fields.
    const expected = computeContentHash({
      actor: event.actor,
      correlationId: event.correlationId,
      kind: event.kind,
      occurredAt: event.occurredAt,
      payload: event.payload,
      schemaV: event.schemaV,
      sessionId: event.sessionId,
      storyRef: event.storyRef,
    })
    if (event.contentHash !== expected) {
      return false
    }
    // prevHash must point to the previous event's contentHash (or 'genesis').
    const expectedPrev = i === 0 ? 'genesis' : (events[i - 1]?.contentHash ?? 'genesis')
    if (event.prevHash !== expectedPrev) {
      return false
    }
  }
  return true
}

const append = (event: NewEvent) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.append(event)
  })

const withStore = <A>(eff: Effect.Effect<A, unknown, EventStore>) => Effect.provide(eff, InMemoryEventStore.layer)

describe('L1.4 — tamper-evident hash chain', () => {
  it.effect('an untampered chain verifies successfully', () =>
    withStore(
      Effect.gen(function* () {
        const session = randomUUID()
        const events = yield* Effect.all([
          append(baseEvent(session)),
          append(baseEvent(session)),
          append(baseEvent(session)),
        ])
        expect(verifyChain(events)).toBeTruthy()
      }),
    ),
  )

  it.effect('mutating payload breaks the hash chain (tamper detection)', () =>
    withStore(
      Effect.gen(function* () {
        const session = randomUUID()
        const [a, b] = yield* Effect.all([append(baseEvent(session)), append(baseEvent(session))])
        // Simulate tampering: mutate the payload of the first event.
        const tampered = [{ ...a, payload: { goal: 'TAMPERED' } }, b] as const
        expect(verifyChain(tampered)).toBeFalsy()
      }),
    ),
  )

  it.effect('mutating prevHash breaks the chain', () =>
    withStore(
      Effect.gen(function* () {
        const session = randomUUID()
        const [a, b] = yield* Effect.all([append(baseEvent(session)), append(baseEvent(session))])
        const tampered = [a, { ...b, prevHash: 'deadbeef' }] as const
        expect(verifyChain(tampered)).toBeFalsy()
      }),
    ),
  )

  it.effect(
    'original events survive tombstone — deleteSession preserves history and chain stays intact (L1.4 guard)',
    () =>
      Effect.provide(
        Effect.gen(function* () {
          const session = randomUUID()
          // Seed two events for the session.
          const [a, b] = yield* Effect.all([append(baseEvent(session)), append(baseEvent(session))])
          // Tombstone the session.
          yield* deleteSession(session)
          // History is preserved: the original events are still returned.
          const store = yield* EventStore
          const events = yield* store.query({ sessionId: session })
          expect(events.find(e => e.id === a.id)).toBeDefined()
          expect(events.find(e => e.id === b.id)).toBeDefined()
          // The tombstone itself is appended, not a replacement.
          expect(events.some(e => e.kind === EventKind.SessionDeleted)).toBe(true)
          // The full chain (original events + tombstone) verifies correctly.
          expect(verifyChain(events), 'hash chain must remain intact through the tombstone').toBe(true)
        }),
        InMemoryEventStore.layer.pipe(
          Layer.provideMerge(DateTime.layerCurrentZoneLocal as Layer.Layer<DateTime.CurrentTimeZone>),
        ),
      ),
  )

  it.effect('grantTenant emits a TenantGranted event — L1.4 traceability (P59 red→green)', () =>
    Effect.provide(
      Effect.gen(function* () {
        // Create the tenant so the existence guard passes.
        yield* createTenant('acme', 'Acme Corp')
        yield* grantTenant('alice', 'acme')
        const store = yield* EventStore
        const events = yield* store.query({})
        expect(events.some(e => e.kind === EventKind.TenantGranted)).toBe(true)
        const granted = events.find(e => e.kind === EventKind.TenantGranted)
        expect(granted?.payload).toMatchObject({ subject: 'alice', tenantId: 'acme' })
      }),
      InMemoryEventStore.layer.pipe(
        Layer.provideMerge(DateTime.layerCurrentZoneLocal as Layer.Layer<DateTime.CurrentTimeZone>),
        Layer.provideMerge(FakeAuthGateway.layer([{ password: 'x', role: 'enduser', username: 'alice' }])),
      ),
    ),
  )
})
