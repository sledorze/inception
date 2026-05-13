/**
 * VariantLog driven port (L2.11).
 *
 * Every variant attempt logs full provenance: role version, inputs, prompt-hash,
 * model-id, seed, budget consumed, and fitness vector (§4.4). Variants missing
 * required fields are invalid for selection and must be rejected at write time.
 */
import type { Effect } from 'effect'
import { Context, Schema } from 'effect'
import { BudgetVectorSchema } from './BudgetLedger.ts'

export const FitnessVectorSchema = Schema.Struct({
  // L1.8: corroboration ratio for self-narration detection.
  acceptance: Schema.optional(Schema.Literal('accepted', 'pending', 'rejected')),
  correctness: Schema.optional(Schema.Number),
  costUsd: Schema.optional(Schema.Number),
  efficiency: Schema.optional(
    Schema.Struct({
      sandboxMs: Schema.optional(Schema.Number),
      tokens: Schema.optional(Schema.Number),
      wallMs: Schema.optional(Schema.Number),
    }),
  ),
  honesty: Schema.optional(Schema.Number),
  infoBitsConsumed: Schema.optional(Schema.Number),
  safety: Schema.optional(Schema.Number),
})

export type FitnessVector = typeof FitnessVectorSchema.Type

// contentHash = sha256(roleVersionHash ‖ workflowHash ‖ primitiveCompositionHash ‖
//               promptHash ‖ modelId ‖ seed ‖ canonicalJson(budgetVector))  (§4.3)
export const VariantEntrySchema = Schema.Struct({
  budgetConsumed: BudgetVectorSchema,
  fitnessVector: FitnessVectorSchema,
  modelId: Schema.String,
  occurredAt: Schema.String,
  primitiveCompositionHash: Schema.String,
  promptHash: Schema.String,
  roleVersionHash: Schema.String,
  seed: Schema.optional(Schema.String),
  sessionId: Schema.String,
  status: Schema.Literal('completed', 'failed', 'pending'),
  storyRef: Schema.String,
  variantId: Schema.String,
  workflowHash: Schema.String,
})

export type VariantEntry = typeof VariantEntrySchema.Type

export class VariantLogError extends Schema.TaggedErrorClass<VariantLogError>()('@app/host/VariantLogError', {
  message: Schema.String,
}) {}

export class VariantLog extends Context.Service<
  VariantLog,
  {
    readonly record: (entry: VariantEntry) => Effect.Effect<void, VariantLogError>
    readonly query: (filter: {
      readonly sessionId?: string
      readonly storyRef?: string
    }) => Effect.Effect<readonly VariantEntry[], VariantLogError>
  }
>()('@app/host/VariantLog') {}
