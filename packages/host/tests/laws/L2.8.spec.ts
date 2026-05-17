/**
 * Law L2.8 — Cooldown.
 * "After a rejected proposal on a topic, Georges may not re-propose on that topic
 *  until cooldown expires or new evidence is attached."
 *
 * If-absent failure mode: rejected paths thrash, burning budget.
 *
 * Tests:
 *  1. CapabilityRejected event is stored with actor='claude' (rejection is Claude's act).
 *  2. rejectProposal records the decision — the state machine has a rejected terminal state.
 *
 * NOTE: Automatic cooldown enforcement (blocking subsequent proposals on the same topic)
 * is aspirational — the Host currently records rejections but does not yet block re-proposals
 * on the same topic within a cooldown window. This test records that gap.
 */
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { rejectProposal } from '../../src/application/reviewProposals.ts'
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
    description: 'test',
    name: 'test',
    scope: ['capability'],
    tests: 'assert(true)',
    version: '0.1.0',
  },
  schemaV: 1,
  sessionId: 'bootstrap',
  storyRef: 'S2',
}

describe('L2.8 — Cooldown', () => {
  it.effect('CapabilityRejected event is stored with actor="claude" (rejection is Claude\'s act)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const proposal = yield* store.append(baseProposalEvent)
      yield* rejectProposal(proposal.contentHash)
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const rejection = events.find(e => e.kind === 'CapabilityRejected')
      expect(rejection).toBeDefined()
      expect(rejection?.actor).toBe('claude')
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('CapabilityRejected payload carries the proposalId', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const proposal = yield* store.append(baseProposalEvent)
      yield* rejectProposal(proposal.contentHash)
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const rejection = events.find(e => e.kind === 'CapabilityRejected')
      const payload = rejection?.payload as { proposalId: string } | undefined
      expect(payload?.proposalId).toBe(proposal.contentHash)
    }).pipe(Effect.provide(testLayer)),
  )
})
