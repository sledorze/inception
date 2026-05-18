/**
 * Capability proposal review — application functions (4.1).
 *
 * L2.6: Claude is the single promoter. Promoted / CapabilityRejected events carry actor='claude'.
 * L1.5: A proposed capability is shelved until a Promoted event activates it.
 * L2.9: Provenance — the decision event carries the proposalId (contentHash of the proposal).
 */
import { DateTime, Effect, Schema } from 'effect'
import { DecisionPayload, EventKind } from '../domain/events.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { StoredEvent } from '../ports/driven/EventStore.ts'

// Pure helper: finds a CapabilityProposed event by its contentHash (proposalId).
const findProposedEvent = (all: readonly StoredEvent[], proposalId: string): StoredEvent | undefined =>
  all.find(e => e.kind === EventKind.CapabilityProposed && e.contentHash === proposalId)

/** Returns CapabilityProposed events that have not yet been Promoted or CapabilityRejected. */
export const listPendingProposals: Effect.Effect<readonly StoredEvent[], never, EventStore> = Effect.gen(function* () {
  const store = yield* EventStore
  const all = yield* store.query({}).pipe(Effect.orDie)
  const decided = new Set<string>()
  for (const e of all) {
    if (e.kind === EventKind.Promoted || e.kind === EventKind.CapabilityRejected) {
      const p = yield* Schema.decodeUnknownEffect(DecisionPayload)(e.payload).pipe(Effect.orDie)
      decided.add(p.proposalId)
    }
  }
  return all.filter(e => e.kind === EventKind.CapabilityProposed && !decided.has(e.contentHash))
}).pipe(Effect.withSpan('ReviewProposals.list'))

const emitDecision =
  (kind: typeof EventKind.CapabilityRejected | typeof EventKind.Promoted) =>
  (proposalId: string, notes?: string): Effect.Effect<void, never, EventStore> =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const all = yield* store.query({}).pipe(Effect.orDie)
      const proposal = findProposedEvent(all, proposalId)
      if (proposal === undefined) {
        return yield* Effect.die(`proposal not found: ${proposalId}`)
      }
      yield* store
        .append({
          actor: 'claude',
          correlationId: proposal.correlationId,
          kind,
          occurredAt: DateTime.formatIso(yield* DateTime.now),
          payload: notes === undefined ? { proposalId } : { notes, proposalId },
          schemaV: 1,
          sessionId: proposal.sessionId,
          storyRef: 'S2',
          tenantId: 'default',
        })
        .pipe(Effect.orDie)
    }).pipe(Effect.withSpan(`ReviewProposals.${kind}`))

/** Emit a Promoted event for the given proposalId. Dies if the proposal does not exist. */
export const promoteProposal = emitDecision(EventKind.Promoted)

/** Emit a CapabilityRejected event for the given proposalId. Dies if the proposal does not exist. */
export const rejectProposal = emitDecision(EventKind.CapabilityRejected)
