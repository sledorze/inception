/**
 * Law L2.9 — Capability Provenance.
 * "Every capability records author, generation lineage (parent capability if derived),
 *  and the correlation that produced it."
 *
 * If-absent failure mode: outer loop cannot attribute success or failure.
 *
 * Tests:
 *  1. CapabilityProposedPayload schema requires name, description, code, tests, scope.
 *  2. A stored CapabilityProposed event carries actor='georges' (the author is recorded).
 *  3. The event carries correlationId (the correlation that produced it).
 */
import { Effect, Schema } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { CapabilityProposedPayload, EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const testLayer = InMemoryEventStore.layer

describe('L2.9 — Capability Provenance', () => {
  it('CapabilityProposedPayload schema requires name, description, code, tests, scope', () => {
    const fields = Object.keys(CapabilityProposedPayload.fields)
    for (const field of ['name', 'description', 'code', 'tests', 'scope']) {
      expect(fields, `CapabilityProposedPayload is missing field '${field}'`).toContain(field)
    }
  })

  it.effect('CapabilityProposed event carries actor="georges" (author recorded)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'georges',
        correlationId: 'corr-xyz',
        kind: EventKind.CapabilityProposed,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: {
          code: '{}',
          description: 'Test cap',
          name: 'test-cap',
          scope: ['capability'],
          tests: 'ok',
          version: '0.1.0',
        },
        schemaV: 1,
        sessionId: 'bootstrap',
        storyRef: 'S2',
      })
      expect(stored.actor).toBe('georges')
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('CapabilityProposed event carries correlationId (correlation that produced it)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'georges',
        correlationId: 'goal-corr-42',
        kind: EventKind.CapabilityProposed,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: {
          code: '{}',
          description: 'Test cap 2',
          name: 'test-cap-2',
          scope: ['capability'],
          tests: 'ok',
          version: '0.2.0',
        },
        schemaV: 1,
        sessionId: 'bootstrap',
        storyRef: 'S2',
      })
      expect(stored.correlationId).toBe('goal-corr-42')
    }).pipe(Effect.provide(testLayer)),
  )

  it('CapabilityProposedPayload schema validates correctly — missing name fails decode', () => {
    const result = Schema.decodeUnknownOption(CapabilityProposedPayload)({
      code: '{}',
      description: 'no name',
      scope: ['capability'],
      tests: 'ok',
    })
    expect(result._tag).toBe('None')
  })
})
