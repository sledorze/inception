/**
 * Capability proposal review — application functions (4.1).
 *
 * L2.6: Claude is the single promoter. Promoted / CapabilityRejected events carry actor='claude'.
 * L1.5: A proposed capability is shelved until a Promoted event activates it.
 * L2.9: Provenance — the decision event carries the proposalId (contentHash of the proposal).
 */
import { Clock, Effect } from 'effect'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { StoredEvent } from '../ports/driven/EventStore.ts'

interface DecisionPayload {
  notes?: string
  proposalId: string
}

/** Returns CapabilityProposed events that have not yet been Promoted or CapabilityRejected. */
export const listPendingProposals: Effect.Effect<readonly StoredEvent[], never, EventStore> = Effect.fn(
  'ReviewProposals.list',
)(function* () {
  const store = yield* EventStore
  const all = yield* store.query({}).pipe(Effect.orDie)
  const decided = new Set(
    all
      .filter(e => e.kind === 'Promoted' || e.kind === 'CapabilityRejected')
      .map(e => (e.payload as DecisionPayload).proposalId),
  )
  return all.filter(e => e.kind === 'CapabilityProposed' && !decided.has(e.contentHash))
})()

const emitDecision =
  (kind: 'CapabilityRejected' | 'Promoted') =>
  (proposalId: string, notes?: string): Effect.Effect<void, never, EventStore> =>
    Effect.fn(`ReviewProposals.${kind}`)(function* () {
      const store = yield* EventStore
      const all = yield* store.query({}).pipe(Effect.orDie)
      const proposal = all.find(e => e.kind === 'CapabilityProposed' && e.contentHash === proposalId)
      if (proposal === undefined) {
        return yield* Effect.die(`proposal not found: ${proposalId}`)
      }
      const ms = yield* Clock.currentTimeMillis
      yield* store
        .append({
          actor: 'claude',
          correlationId: proposal.correlationId,
          kind,
          occurredAt: new Date(ms).toISOString(),
          payload: notes === undefined ? { proposalId } : { notes, proposalId },
          schemaV: 1,
          sessionId: proposal.sessionId,
          storyRef: 'S2',
        })
        .pipe(Effect.orDie)
    })()

/** Emit a Promoted event for the given proposalId. Dies if the proposal does not exist. */
export const promoteProposal = emitDecision('Promoted')

/** Emit a CapabilityRejected event for the given proposalId. Dies if the proposal does not exist. */
export const rejectProposal = emitDecision('CapabilityRejected')
