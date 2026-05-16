/**
 * Law L1.6 — Vector Budget.
 * "Every cycle, variant, and call carries a vector budget — time, tokens, cost,
 *  sandbox seconds, mutations, policy-denials, rejections, info-bits-out.
 *  Exceeding any dimension halts the scope."
 *
 * If-absent failure mode: one-dimensional budgets miss orthogonal risks (low time but
 * high info-leak); judgement stays subjective.
 *
 * Tests:
 *  1. BudgetVectorSchema declares all 8 required dimensions.
 *  2. BudgetLedger.debit tracks cumulative totals across multiple debits.
 *  3. BudgetLedger.get returns the sum of all debits for a scope.
 */
import type { Layer } from 'effect'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryBudgetLedger } from '../../src/adapters/driven/InMemoryBudgetLedger.ts'
import { BudgetLedger, BudgetVectorSchema } from '../../src/ports/driven/BudgetLedger.ts'

const testLayer: Layer.Layer<BudgetLedger> = InMemoryBudgetLedger.layer

const scope = { id: 'test-session-1', type: 'session' } as const

describe('L1.6 — Vector Budget', () => {
  it('BudgetVectorSchema declares all 8 required dimensions (L1.6 §4.6)', () => {
    const fields = Object.keys(BudgetVectorSchema.fields)
    const required = [
      'tokens',
      'costUsd',
      'sandboxMs',
      'infoBitsOut',
      'mutations',
      'policyDenials',
      'rejections',
      'reruns',
    ]
    for (const dim of required) {
      expect(fields, `Missing dimension '${dim}' from BudgetVectorSchema`).toContain(dim)
    }
  })

  it.effect('BudgetLedger.debit accumulates totals across multiple calls', () =>
    Effect.gen(function* () {
      const ledger = yield* BudgetLedger
      yield* ledger.debit(scope, { costUsd: 0.01, tokens: 100 })
      yield* ledger.debit(scope, { sandboxMs: 200, tokens: 50 })
      const total = yield* ledger.get(scope)
      expect(total.tokens).toBe(150)
      expect(total.costUsd).toBe(0.01)
      expect(total.sandboxMs).toBe(200)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('BudgetLedger.reset zeroes the scope budget', () =>
    Effect.gen(function* () {
      const ledger = yield* BudgetLedger
      yield* ledger.debit(scope, { tokens: 500 })
      yield* ledger.reset(scope)
      const total = yield* ledger.get(scope)
      expect(total.tokens ?? 0).toBe(0)
    }).pipe(Effect.provide(testLayer)),
  )
})
