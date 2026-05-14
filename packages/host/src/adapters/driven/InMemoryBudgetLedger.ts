import { Effect, Layer, Ref } from 'effect'
import { BudgetLedger } from '../../ports/driven/BudgetLedger.ts'
import type { BudgetScope, BudgetVector } from '../../ports/driven/BudgetLedger.ts'

const ZERO: Required<BudgetVector> = {
  costUsd: 0,
  infoBitsOut: 0,
  mutations: 0,
  policyDenials: 0,
  rejections: 0,
  reruns: 0,
  sandboxMs: 0,
  tokens: 0,
}

const scopeKey = (scope: BudgetScope) => `${scope.type}:${scope.id}`

const add = (a: BudgetVector, b: BudgetVector): Required<BudgetVector> => ({
  costUsd: (a.costUsd ?? 0) + (b.costUsd ?? 0),
  infoBitsOut: (a.infoBitsOut ?? 0) + (b.infoBitsOut ?? 0),
  mutations: (a.mutations ?? 0) + (b.mutations ?? 0),
  policyDenials: (a.policyDenials ?? 0) + (b.policyDenials ?? 0),
  rejections: (a.rejections ?? 0) + (b.rejections ?? 0),
  reruns: (a.reruns ?? 0) + (b.reruns ?? 0),
  sandboxMs: (a.sandboxMs ?? 0) + (b.sandboxMs ?? 0),
  tokens: (a.tokens ?? 0) + (b.tokens ?? 0),
})

export const InMemoryBudgetLedger = {
  layer: Layer.effect(
    BudgetLedger,
    Effect.gen(function* () {
      const store = yield* Ref.make(new Map<string, Required<BudgetVector>>())

      return BudgetLedger.of({
        debit: (scope, amount) =>
          Effect.gen(function* () {
            const key = scopeKey(scope)
            const current = (yield* Ref.get(store)).get(key) ?? ZERO
            const next = add(current, amount)
            yield* Ref.update(store, m => new Map([...m, [key, next]]))
            return next
          }),

        get: scope => Effect.map(Ref.get(store), m => m.get(scopeKey(scope)) ?? ZERO),

        reset: scope => {
          const key = scopeKey(scope)
          return Ref.update(store, m => new Map([...m.entries()].filter(([k]) => k !== key)))
        },
      })
    }),
  ),
}
