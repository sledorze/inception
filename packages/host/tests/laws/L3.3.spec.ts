/**
 * Law L3.3 — Honest Reporting.
 * "Georges' final report to the User must be derivable from events in the trace.
 *  Claims with no supporting event are flagged 'unsupported'."
 *
 * If-absent failure mode: Georges can confabulate undetected.
 *
 * Tests:
 *  1. findUncorroboratedClaims returns events with no matching host corroborator.
 *  2. A paired host corroborator removes an event from the uncorroborated set.
 */
import type { Layer } from 'effect'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { findUncorroboratedClaims } from '../../src/application/corroboration.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const testLayer: Layer.Layer<EventStore> = InMemoryEventStore.layer

describe('L3.3 — Honest Reporting', () => {
  it.effect('findUncorroboratedClaims returns georges-actor events with no host corroborator', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      // Seed a ToolResultObserved claim without a host corroborator
      yield* store.append({
        actor: 'georges',
        correlationId: 'c-uncorr',
        kind: EventKind.ToolResultObserved,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { result: 'success', toolName: 'run-script' },
        schemaV: 1,
        sessionId: 'session-uncorr',
        storyRef: 'S1',
      })
      const uncorroborated = yield* findUncorroboratedClaims('session-uncorr')
      expect(uncorroborated.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('a paired host corroborator removes the event from the uncorroborated set', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      // Georges emits a claim
      yield* store.append({
        actor: 'georges',
        correlationId: 'c-corr',
        kind: EventKind.ToolResultObserved,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { result: 'success', toolName: 'run-script' },
        schemaV: 1,
        sessionId: 'session-corr',
        storyRef: 'S1',
      })
      // Host emits the matching corroborator on the same correlationId
      yield* store.append({
        actor: 'host',
        correlationId: 'c-corr',
        kind: EventKind.ToolResultObserved,
        occurredAt: '2026-01-01T00:00:00.001Z',
        payload: { exitCode: 0, toolName: 'run-script' },
        schemaV: 1,
        sessionId: 'session-corr',
        storyRef: 'S1',
      })
      const uncorroborated = yield* findUncorroboratedClaims('session-corr')
      expect(uncorroborated).toHaveLength(0)
    }).pipe(Effect.provide(testLayer)),
  )
})
