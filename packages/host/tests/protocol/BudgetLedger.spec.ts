/**
 * Protocol contract test for the BudgetLedger driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L1.6 (vector budget per cycle/variant/call), L2.14 (port contract).
 * §4.6: per-call/variant/cycle/handle/session debit; all dimensions tracked.
 */
import { Effect, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'
import { InMemoryBudgetLedger } from '../../src/adapters/driven/InMemoryBudgetLedger.ts'
import { BudgetLedger } from '../../src/ports/driven/BudgetLedger.ts'
import type { BudgetScope, BudgetVector } from '../../src/ports/driven/BudgetLedger.ts'

// ─── fixtures ────────────────────────────────────────────────────────────────

const callScope: BudgetScope = { id: 'call-1', type: 'call' }
const variantScope: BudgetScope = { id: 'variant-1', type: 'variant' }
const cycleScope: BudgetScope = { id: 'cycle-1', type: 'cycle' }
const handleScope: BudgetScope = { id: 'handle-1', type: 'handle' }
const sessionScope: BudgetScope = { id: 'session-1', type: 'session' }

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => ManagedRuntime.ManagedRuntime<BudgetLedger, never>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<BudgetLedger, never>

    beforeAll(() => {
      rt = makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, BudgetLedger>) => rt.runPromise(effect)

    it('get returns zero vector for an unseen scope', async () => {
      const total = await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          return yield* ledger.get({ id: 'unseen', type: 'call' })
        }),
      )
      expect(total.tokens ?? 0).toBe(0)
      expect(total.costUsd ?? 0).toBe(0)
    })

    it('debit returns the new accumulated total', async () => {
      const total: BudgetVector = await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          return yield* ledger.debit(callScope, { costUsd: 0.001, tokens: 100 })
        }),
      )
      expect(total.tokens).toBeGreaterThanOrEqual(100)
    })

    it('debit accumulates across multiple calls', async () => {
      const scope: BudgetScope = { id: 'accumulate-test', type: 'call' }
      const total = await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          yield* ledger.debit(scope, { tokens: 50 })
          yield* ledger.debit(scope, { tokens: 75 })
          return yield* ledger.get(scope)
        }),
      )
      expect(total.tokens).toBe(125)
    })

    it('debit is scope-isolated (call vs variant)', async () => {
      const totals = await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          yield* ledger.debit(callScope, { tokens: 10 })
          yield* ledger.debit(variantScope, { tokens: 20 })
          const call = yield* ledger.get(callScope)
          const variant = yield* ledger.get(variantScope)
          return { call, variant }
        }),
      )
      expect(totals.call.tokens).toBeGreaterThanOrEqual(10)
      expect(totals.variant.tokens).toBeGreaterThanOrEqual(20)
      expect(totals.call.tokens).not.toBe(totals.variant.tokens)
    })

    it('debit tracks all vector dimensions (L1.6)', async () => {
      const scope: BudgetScope = { id: 'all-dims', type: 'cycle' }
      const full: BudgetVector = {
        costUsd: 0.002,
        infoBitsOut: 512,
        mutations: 3,
        policyDenials: 1,
        rejections: 0,
        reruns: 1,
        sandboxMs: 400,
        tokens: 200,
      }
      const total = await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          return yield* ledger.debit(scope, full)
        }),
      )
      expect(total.tokens).toBe(200)
      expect(total.costUsd).toBe(0.002)
      expect(total.infoBitsOut).toBe(512)
      expect(total.mutations).toBe(3)
      expect(total.policyDenials).toBe(1)
      expect(total.sandboxMs).toBe(400)
      expect(total.reruns).toBe(1)
    })

    it('all scope types are independently addressable (§4.6)', async () => {
      const scopes = [callScope, variantScope, cycleScope, handleScope, sessionScope]
      const amounts = scopes.map((_, i) => ({ tokens: (i + 1) * 100 }))
      await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          for (let i = 0; i < scopes.length; i++) {
            yield* ledger.debit(scopes[i] as BudgetScope, amounts[i] as BudgetVector)
          }
        }),
      )
      for (let i = 0; i < scopes.length; i++) {
        const total = await run(
          Effect.gen(function* () {
            const ledger = yield* BudgetLedger
            return yield* ledger.get(scopes[i] as BudgetScope)
          }),
        )
        expect(total.tokens).toBeGreaterThanOrEqual((i + 1) * 100)
      }
    })

    it('reset clears the scope total back to zero', async () => {
      const scope: BudgetScope = { id: 'reset-test', type: 'cycle' }
      const after = await run(
        Effect.gen(function* () {
          const ledger = yield* BudgetLedger
          yield* ledger.debit(scope, { tokens: 999 })
          yield* ledger.reset(scope)
          return yield* ledger.get(scope)
        }),
      )
      expect(after.tokens ?? 0).toBe(0)
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryBudgetLedger', () => ManagedRuntime.make(InMemoryBudgetLedger.layer))
