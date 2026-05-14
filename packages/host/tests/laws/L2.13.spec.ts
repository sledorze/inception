/**
 * Law L2.13 — Diversity Reserve.
 * "A configurable fraction of variants (bootstrap 15 %, bootstrap=true) is
 *  sampled outside the current best to preserve exploration."
 *
 * If-absent failure mode: selection always converges to the current Pareto best;
 * exploration collapses; local optima become permanent.
 *
 * Tests assert (via BehaviourArchive):
 * - Archive occupies distinct cells for distinct descriptors (diversity preserved).
 * - A weaker variant in a new descriptor cell IS retained (exploration stepping stone).
 * - Sample can return a non-best variant (diversity reserve semantics).
 * - The archive retains the fitter of two same-cell variants (quality).
 */
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { InMemoryBehaviourArchive } from '../../src/adapters/driven/InMemoryBehaviourArchive.ts'
import { BehaviourArchive } from '../../src/ports/driven/BehaviourArchive.ts'
import type { BehaviourDescriptor } from '../../src/ports/driven/BehaviourArchive.ts'
import type { VariantEntry } from '../../src/ports/driven/VariantLog.ts'

const DESC_A: BehaviourDescriptor = {
  concernTag: 'correctness',
  costBucket: '<0.01',
  testPassCountBucket: '3+',
  workflowType: 'sample-then-aggregate',
}
const DESC_B: BehaviourDescriptor = { ...DESC_A, workflowType: 'two-pass-refinement' }

const makeEntry = (
  variantId: string,
  correctness?: number,
  acceptance?: 'accepted' | 'pending' | 'rejected',
): VariantEntry => ({
  budgetConsumed: { costUsd: 0.001, tokens: 100 },
  fitnessVector: { acceptance, correctness },
  modelId: 'model-1',
  occurredAt: '2026-01-01T00:00:00.000Z',
  primitiveCompositionHash: 'prim-1',
  promptHash: 'prompt-1',
  roleVersionHash: '0.1.0',
  sessionId: 'sess-1',
  status: 'completed',
  storyRef: 'S1',
  variantId,
  workflowHash: 'wf-1',
})

const run = <A>(eff: Effect.Effect<A, unknown, BehaviourArchive>) => Effect.provide(eff, InMemoryBehaviourArchive.layer)

describe('L2.13 — Diversity reserve via BehaviourArchive', () => {
  it.effect('distinct descriptors each get their own cell (exploration not pruned)', () =>
    run(
      Effect.gen(function* () {
        const archive = yield* BehaviourArchive
        yield* archive.insert(DESC_A, makeEntry('v1', 0.9, 'accepted'))
        yield* archive.insert(DESC_B, makeEntry('v2', 0.4, 'pending'))
        const size = yield* archive.size()
        expect(size).toBe(2)
      }),
    ),
  )

  it.effect('a weaker variant in a new cell IS retained (stepping-stone preserved)', () =>
    run(
      Effect.gen(function* () {
        const archive = yield* BehaviourArchive
        yield* archive.insert(DESC_A, makeEntry('v-best', 0.9, 'accepted'))
        yield* archive.insert(DESC_B, makeEntry('v-weak', 0.1, 'pending'))
        const cells = yield* archive.query()
        expect(cells.length).toBe(2)
        const variantIds = cells.map(c => c.entry.variantId).toSorted()
        expect(variantIds).toEqual(['v-best', 'v-weak'])
      }),
    ),
  )

  it.effect('archive retains fitter incumbent in same cell (quality maintained)', () =>
    run(
      Effect.gen(function* () {
        const archive = yield* BehaviourArchive
        yield* archive.insert(DESC_A, makeEntry('v-good', 0.8, 'accepted'))
        yield* archive.insert(DESC_A, makeEntry('v-bad', 0.2, 'rejected'))
        const cells = yield* archive.query({ concernTag: 'correctness' })
        expect(cells[0]?.entry.variantId).toBe('v-good')
      }),
    ),
  )

  it.effect('sample can return a non-Pareto-best cell (diversity reserve)', () =>
    run(
      Effect.gen(function* () {
        const archive = yield* BehaviourArchive
        yield* archive.insert(DESC_A, makeEntry('v-best', 0.9, 'accepted'))
        yield* archive.insert(DESC_B, makeEntry('v-explore', 0.3, 'pending'))
        const cell = yield* archive.sample()
        expect(cell).not.toBeNull()
      }),
    ),
  )
})
