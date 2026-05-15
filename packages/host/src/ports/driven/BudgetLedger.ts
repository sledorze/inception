import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

// ─── budget vector ────────────────────────────────────────────────────────────

// Every numeric dimension from §4.6 + §4.4 bootstrap. All optional — callers
// debit only the dimensions they observe; unspecified dimensions are treated as 0.
// Cost dimension included for swap-readiness (L3.8) even if not enforced in bootstrap.
export const BudgetVectorSchema = Schema.Struct({
  costUsd: Schema.optional(Schema.Number),
  infoBitsOut: Schema.optional(Schema.Number),
  mutations: Schema.optional(Schema.Number),
  policyDenials: Schema.optional(Schema.Number),
  rejections: Schema.optional(Schema.Number),
  reruns: Schema.optional(Schema.Number),
  sandboxMs: Schema.optional(Schema.Number),
  tokens: Schema.optional(Schema.Number),
})

export type BudgetVector = typeof BudgetVectorSchema.Type

// ─── scope ────────────────────────────────────────────────────────────────────

export const ScopeTypeSchema = Schema.Union([
  Schema.Literal('call'),
  Schema.Literal('variant'),
  Schema.Literal('cycle'),
  Schema.Literal('handle'),
  Schema.Literal('session'),
  Schema.Literal('role-version'),
])

export const BudgetScopeSchema = Schema.Struct({
  id: Schema.String,
  type: ScopeTypeSchema,
})

export type BudgetScope = typeof BudgetScopeSchema.Type

// ─── error ───────────────────────────────────────────────────────────────────

export class BudgetLedgerError extends Schema.TaggedErrorClass<BudgetLedgerError>()('@app/host/BudgetLedgerError', {
  cause: Schema.Defect,
}) {}

// ─── port ────────────────────────────────────────────────────────────────────

export class BudgetLedger extends Context.Service<
  BudgetLedger,
  {
    // Add `amount` to the running total for the given scope and return the new total.
    readonly debit: (scope: BudgetScope, amount: BudgetVector) => Effect.Effect<BudgetVector, BudgetLedgerError>

    // Return the current accumulated total for the given scope (zero-vector if never debited).
    readonly get: (scope: BudgetScope) => Effect.Effect<BudgetVector, BudgetLedgerError>

    // Reset the running total for the given scope back to zero.
    readonly reset: (scope: BudgetScope) => Effect.Effect<void, BudgetLedgerError>
  }
>()('@app/host/ports/driven/BudgetLedger') {}
