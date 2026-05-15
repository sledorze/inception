/**
 * Protocol contract test for the BehaviourArchive driven port (§4.5, L2.13).
 * Parametrised over archive implementations — Liskov substitution proven by test.
 */
import { Effect, ManagedRuntime } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { InMemoryBehaviourArchive } from '../../src/adapters/driven/InMemoryBehaviourArchive.ts'
import { BehaviourArchive } from '../../src/ports/driven/BehaviourArchive.ts'
import type { BehaviourDescriptor } from '../../src/ports/driven/BehaviourArchive.ts'
import type { VariantEntry } from '../../src/ports/driven/VariantLog.ts'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const DESCRIPTOR: BehaviourDescriptor = {
  concernTag: 'correctness',
  costBucket: '<0.01',
  testPassCountBucket: '3+',
  workflowType: 'sample-then-aggregate',
}

const makeEntry = (
  variantId: string,
  correctness?: number,
  acceptance?: 'accepted' | 'pending' | 'rejected',
): VariantEntry => ({
  budgetConsumed: { costUsd: 0.001, tokens: 100 },
  fitnessVector: { acceptance, correctness },
  modelId: 'test-model',
  occurredAt: '2026-01-01T00:00:00.000Z',
  primitiveCompositionHash: 'prim-hash-1',
  promptHash: 'prompt-hash-1',
  roleVersionHash: '0.1.0',
  sessionId: 'sess-1',
  status: 'completed',
  storyRef: 'S1',
  variantId,
  workflowHash: 'wf-hash-1',
})

// ─── contract ─────────────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => ManagedRuntime.ManagedRuntime<BehaviourArchive, never>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<BehaviourArchive, never>

    beforeEach(() => {
      rt = makeLayer()
    })

    afterEach(() => rt.dispose())

    const run = <A>(eff: Effect.Effect<A, unknown, BehaviourArchive>) => rt.runPromise(eff)

    it('size is 0 for an empty archive', async () => {
      const s = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          return yield* archive.size()
        }),
      )
      expect(s).toBe(0)
    })

    it('insert adds a new cell and returns true', async () => {
      const result = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          return yield* archive.insert(DESCRIPTOR, makeEntry('v1'))
        }),
      )
      expect(result).toBeTruthy()
    })

    it('size increases after insert', async () => {
      const s = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1'))
          return yield* archive.size()
        }),
      )
      expect(s).toBe(1)
    })

    it('fitter variant replaces incumbent and returns true', async () => {
      const result = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1', 0.5, 'pending'))
          return yield* archive.insert(DESCRIPTOR, makeEntry('v2', 0.9, 'accepted'))
        }),
      )
      expect(result).toBeTruthy()
    })

    it('weaker variant does not replace incumbent and returns false', async () => {
      const result = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1', 0.9, 'accepted'))
          return yield* archive.insert(DESCRIPTOR, makeEntry('v2', 0.3, 'pending'))
        }),
      )
      expect(result).toBeFalsy()
    })

    it('size stays 1 after replacing incumbent (same cell key)', async () => {
      const s = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1', 0.5))
          yield* archive.insert(DESCRIPTOR, makeEntry('v2', 0.9, 'accepted'))
          return yield* archive.size()
        }),
      )
      expect(s).toBe(1)
    })

    it('different descriptors occupy different cells', async () => {
      const s = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1'))
          yield* archive.insert({ ...DESCRIPTOR, concernTag: 'efficiency' }, makeEntry('v2'))
          return yield* archive.size()
        }),
      )
      expect(s).toBe(2)
    })

    it('sample returns null for empty archive', async () => {
      const cell = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          return yield* archive.sample()
        }),
      )
      expect(cell).toBeNull()
    })

    it('sample returns a cell after insert', async () => {
      const cell = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1'))
          return yield* archive.sample()
        }),
      )
      expect(cell).not.toBeNull()
      expect(cell?.entry.variantId).toBe('v1')
    })

    it('query with no filter returns all cells', async () => {
      const cells = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1'))
          yield* archive.insert({ ...DESCRIPTOR, concernTag: 'efficiency' }, makeEntry('v2'))
          return yield* archive.query()
        }),
      )
      expect(cells.length).toBe(2)
    })

    it('query with partial filter returns matching cells only', async () => {
      const cells = await run(
        Effect.gen(function* () {
          const archive = yield* BehaviourArchive
          yield* archive.insert(DESCRIPTOR, makeEntry('v1'))
          yield* archive.insert({ ...DESCRIPTOR, concernTag: 'efficiency' }, makeEntry('v2'))
          return yield* archive.query({ concernTag: 'correctness' })
        }),
      )
      expect(cells.length).toBe(1)
      expect(cells[0]?.descriptor.concernTag).toBe('correctness')
    })
  })
}

runContract('InMemoryBehaviourArchive', () => ManagedRuntime.make(InMemoryBehaviourArchive.layer))
