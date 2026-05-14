/**
 * Corroboration discipline (L1.8, §Kernel).
 *
 * Every Georges-emitted claim event must be paired with a Host-emitted corroborator
 * event on the same correlationId. Unpaired claims are returned by
 * `findUncorroboratedClaims` and excluded from fitness scoring (§4.4).
 *
 * Pairing rule: for a given session, a Georges event is "corroborated" if at least
 * one Host event shares its correlationId within the same session. The Host emits
 * its observation event during tool execution (inner MCP, Phase 2); the Georges
 * claim is emitted after the Host has already appended its observation.
 */
import { Effect } from 'effect'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { EventStoreError, StoredEvent } from '../ports/driven/EventStore.ts'

// Georges emits claim events; Host emits corroborator events.
const CLAIM_ACTOR = 'georges' as const
const CORROBORATOR_ACTOR = 'host' as const

export const findUncorroboratedClaims = (
  sessionId: string,
): Effect.Effect<readonly StoredEvent[], EventStoreError, EventStore> =>
  Effect.gen(function* () {
    const store = yield* EventStore
    const events = yield* store.query({ sessionId })

    // Build the set of correlationIds that have at least one Host corroborator.
    const corroboratedIds = new Set<string>()
    for (const e of events) {
      if (e.actor === CORROBORATOR_ACTOR) {
        corroboratedIds.add(e.correlationId)
      }
    }

    // Return Georges claim events whose correlationId lacks a Host corroborator.
    return events.filter(e => e.actor === CLAIM_ACTOR && !corroboratedIds.has(e.correlationId))
  })
