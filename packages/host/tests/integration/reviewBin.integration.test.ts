/**
 * Integration test for bin/review.ts wiring (4.1).
 *
 * Tests the Claude-mediated review path against an in-memory EventStore —
 * same layer composition as bin/review.ts, exercised in-process.
 *
 * Laws: L2.6 (Claude is single promoter), L1.5 (proposed shelved until promoted), L2.9 (provenance).
 */
import { Effect } from 'effect'
import { assert, expect, layer } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'
import { listPendingProposals, promoteProposal, rejectProposal } from '../../src/application/reviewProposals.ts'
import { EventKind } from '../../src/domain/events.ts'

const proposal = (): NewEvent => ({
  actor: 'georges',
  correlationId: 'corr-review-1',
  kind: EventKind.CapabilityProposed,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: { rationale: 'useful tool', tool: 'my-tool' },
  schemaV: 1,
  sessionId: 'session-review-1',
  storyRef: 'S2',
})

layer(InMemoryEventStore.layer)('listPendingProposals — empty store', it => {
  it.effect('returns empty array when no proposals exist', () =>
    Effect.gen(function* () {
      const proposals = yield* listPendingProposals
      expect(proposals).toHaveLength(0)
    }),
  )
})

layer(InMemoryEventStore.layer)('listPendingProposals — pending proposal', it => {
  it.effect('CapabilityProposed event appears in pending list', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      yield* store.append(proposal())
      const proposals = yield* listPendingProposals
      expect(proposals).toHaveLength(1)
      expect(proposals[0]?.kind).toBe(EventKind.CapabilityProposed)
    }),
  )
})

layer(InMemoryEventStore.layer)('promoteProposal — L2.6, L1.5, L2.9', it => {
  it.effect('Promoted event emitted with actor=claude and proposalId provenance', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append(proposal())
      yield* promoteProposal(stored.contentHash)
      const all = yield* store.query({}).pipe(Effect.orDie)
      const promoted = all.find(e => e.kind === EventKind.Promoted)
      assert.isDefined(promoted)
      expect(promoted.actor).toBe('claude')
      expect((promoted.payload as { proposalId: string }).proposalId).toBe(stored.contentHash)
    }),
  )

  it.effect('promoted proposal no longer appears in pending list (L1.5)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append(proposal())
      yield* promoteProposal(stored.contentHash)
      const pending = yield* listPendingProposals
      expect(pending).toHaveLength(0)
    }),
  )
})

layer(InMemoryEventStore.layer)('rejectProposal — L2.6, L1.5, L2.9', it => {
  it.effect('CapabilityRejected event emitted with actor=claude, notes, and proposalId provenance', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append(proposal())
      yield* rejectProposal(stored.contentHash, 'not ready yet')
      const all = yield* store.query({}).pipe(Effect.orDie)
      const rejected = all.find(e => e.kind === EventKind.CapabilityRejected)
      assert.isDefined(rejected)
      expect(rejected.actor).toBe('claude')
      expect((rejected.payload as { proposalId: string; notes: string }).proposalId).toBe(stored.contentHash)
      expect((rejected.payload as { proposalId: string; notes: string }).notes).toBe('not ready yet')
    }),
  )

  it.effect('rejected proposal no longer appears in pending list (L1.5)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append(proposal())
      yield* rejectProposal(stored.contentHash)
      const pending = yield* listPendingProposals
      expect(pending).toHaveLength(0)
    }),
  )
})

layer(InMemoryEventStore.layer)('promoteProposal — unknown proposalId', it => {
  it.effect('dies when proposal is not found in store', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(promoteProposal('nonexistent-hash'))
      expect(exit._tag).toBe('Failure')
    }),
  )
})
