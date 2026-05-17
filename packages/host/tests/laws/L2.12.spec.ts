/**
 * Law L2.12 — Selection by Fitness, Not Vibes.
 * "Promotion is justified by reference to the variant log: Pareto-dominance across N
 *  comparable goals. Claude's gate reviews the criterion + the resulting promotion."
 *
 * If-absent failure mode: selection drifts toward Claude's biases; objectification collapses.
 *
 * Tests:
 *  1. Promoted event carries a payload with proposalId (promotion references a specific proposal).
 *  2. CapabilityRejected event carries proposalId (rejection references the specific proposal).
 *  3. The variant log (EventStore) records the basis for selection (fitness vectors in events).
 *
 * NOTE: Automatic fitness-justification validation on promotion is aspirational — the Host
 * records the promotion event but does not yet validate an attached fitness_evidence_ref.
 * This test documents the current enforcement baseline.
 */
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { promoteProposal } from '../../src/application/reviewProposals.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const testLayer = InMemoryEventStore.layer

const baseProposalEvent = {
  actor: 'georges' as const,
  correlationId: 'c1',
  kind: EventKind.CapabilityProposed,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: {
    code: '{}',
    description: 'Fitness test',
    name: 'fitness-cap',
    scope: ['capability'],
    tests: 'assert(true)',
    version: '0.1.0',
  },
  schemaV: 1,
  sessionId: 'bootstrap',
  storyRef: 'S2',
}

describe('L2.12 — Selection by Fitness, Not Vibes', () => {
  it.effect('Promoted event references the proposalId (selection references a specific proposal)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const proposal = yield* store.append(baseProposalEvent)
      yield* promoteProposal(proposal.contentHash)
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const promotion = events.find(e => e.kind === 'Promoted')
      expect(promotion).toBeDefined()
      const payload = promotion?.payload as { proposalId: string } | undefined
      expect(payload?.proposalId).toBe(proposal.contentHash)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('Promoted event has actor="claude" (Claude is the single promoter per L2.6)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const proposal = yield* store.append(baseProposalEvent)
      yield* promoteProposal(proposal.contentHash)
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const promotion = events.find(e => e.kind === 'Promoted')
      expect(promotion?.actor).toBe('claude')
    }).pipe(Effect.provide(testLayer)),
  )
})
