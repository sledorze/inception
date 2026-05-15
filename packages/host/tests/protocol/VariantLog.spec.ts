/**
 * Protocol contract test for the VariantLog driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.11 (variant provenance; schema-enforced at write).
 */
import { randomUUID } from 'node:crypto'
import { Effect, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'
import { InMemoryVariantLog } from '../../src/adapters/driven/InMemoryVariantLog.ts'
import { VariantLog } from '../../src/ports/driven/VariantLog.ts'
import type { VariantEntry } from '../../src/ports/driven/VariantLog.ts'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<VariantEntry> = {}): VariantEntry => ({
  budgetConsumed: { costUsd: 0.001, tokens: 100 },
  fitnessVector: { correctness: 0.9, status: undefined },
  modelId: 'test-model',
  occurredAt: new Date().toISOString(),
  primitiveCompositionHash: 'abc123',
  promptHash: 'def456',
  roleVersionHash: '0.1.0',
  sessionId: randomUUID(),
  status: 'completed',
  storyRef: 'S1',
  variantId: randomUUID(),
  workflowHash: 'ghi789',
  ...overrides,
})

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => ManagedRuntime.ManagedRuntime<VariantLog, never>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<VariantLog, never>

    beforeAll(() => {
      rt = makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, VariantLog>) => rt.runPromise(effect)

    it('record stores a variant; query retrieves it by sessionId', async () => {
      const entry = makeEntry()
      const found = await run(
        Effect.gen(function* () {
          const log = yield* VariantLog
          yield* log.record(entry)
          return yield* log.query({ sessionId: entry.sessionId })
        }),
      )
      expect(found.length).toBe(1)
      expect(found[0]?.variantId).toBe(entry.variantId)
    })

    it('query filters by storyRef (L2.11)', async () => {
      const session = randomUUID()
      const a = makeEntry({ sessionId: session, storyRef: 'S1' })
      const b = makeEntry({ sessionId: session, storyRef: 'S2' })

      const found = await run(
        Effect.gen(function* () {
          const log = yield* VariantLog
          yield* log.record(a)
          yield* log.record(b)
          return yield* log.query({ sessionId: session, storyRef: 'S1' })
        }),
      )

      expect(found.length).toBe(1)
      expect(found[0]?.storyRef).toBe('S1')
    })

    it('query with no filter returns all recorded variants', async () => {
      const session = randomUUID()
      const entries = [makeEntry({ sessionId: session }), makeEntry({ sessionId: session })]

      const found = await run(
        Effect.gen(function* () {
          const log = yield* VariantLog
          for (const e of entries) {
            yield* log.record(e)
          }
          return yield* log.query({ sessionId: session })
        }),
      )

      expect(found.length).toBe(2)
    })

    it('each stored entry carries all L2.11 provenance fields', async () => {
      const entry = makeEntry()

      const found = await run(
        Effect.gen(function* () {
          const log = yield* VariantLog
          yield* log.record(entry)
          return yield* log.query({ sessionId: entry.sessionId })
        }),
      )

      const stored = found[0]
      expect(stored?.roleVersionHash).toBeTypeOf('string')
      expect(stored?.promptHash).toBeTypeOf('string')
      expect(stored?.modelId).toBeTypeOf('string')
      expect(stored?.workflowHash).toBeTypeOf('string')
      expect(stored?.primitiveCompositionHash).toBeTypeOf('string')
      expect(stored?.budgetConsumed).toBeDefined()
      expect(stored?.fitnessVector).toBeDefined()
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryVariantLog', () => ManagedRuntime.make(InMemoryVariantLog.layer))
