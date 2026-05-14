/**
 * Behaviour archive driven port (§4.5, L2.13).
 *
 * MAP-Elites-style archive: variants are categorised by a low-dimensional
 * behaviour descriptor. The archive keeps the highest-fitness variant per cell
 * (keyed by descriptor × primitiveCompositionHash). Selection samples from the
 * archive (not only the current Pareto frontier) to drive exploration.
 *
 * Bootstrap descriptor axes (§12, bootstrap=true per L3.8):
 *   concern-tag × workflow-type × test-pass-count-bucket × cost-bucket
 */
import type { Effect } from 'effect'
import { Context, Schema } from 'effect'
import type { VariantEntry } from './VariantLog.ts'

// ─── descriptor ───────────────────────────────────────────────────────────────

export const BehaviourDescriptorSchema = Schema.Struct({
  concernTag: Schema.String,
  costBucket: Schema.String,
  testPassCountBucket: Schema.String,
  workflowType: Schema.String,
})
export type BehaviourDescriptor = typeof BehaviourDescriptorSchema.Type

// ─── archive cell ─────────────────────────────────────────────────────────────

export interface ArchiveCell {
  readonly descriptor: BehaviourDescriptor
  readonly primitiveCompositionHash: string
  readonly entry: VariantEntry
}

// ─── fitness scalar (for cell replacement, bootstrap) ────────────────────────

// acceptance: 'accepted' > 'pending' | undefined > 'rejected'
const acceptanceRank = (a: string | undefined): number =>
  a === 'accepted' ? 2
  : a === 'rejected' ? 0
  : 1

// Returns > 0 if `a` is fitter than `b`, 0 if equal, < 0 if less fit.
export const compareFitness = (a: VariantEntry, b: VariantEntry): number => {
  const acceptanceDiff = acceptanceRank(a.fitnessVector.acceptance) - acceptanceRank(b.fitnessVector.acceptance)
  if (acceptanceDiff !== 0) {
    return acceptanceDiff
  }
  return (a.fitnessVector.correctness ?? 0) - (b.fitnessVector.correctness ?? 0)
}

// ─── error ────────────────────────────────────────────────────────────────────

export class BehaviourArchiveError extends Schema.TaggedErrorClass<BehaviourArchiveError>()(
  '@app/host/BehaviourArchiveError',
  {
    message: Schema.String,
  },
) {}

// ─── port ─────────────────────────────────────────────────────────────────────

export class BehaviourArchive extends Context.Service<
  BehaviourArchive,
  {
    // Insert a variant into the archive. Returns true if the cell was updated
    // (either new cell or incumbent replaced by fitter variant).
    readonly insert: (
      descriptor: BehaviourDescriptor,
      entry: VariantEntry,
    ) => Effect.Effect<boolean, BehaviourArchiveError>

    // Sample a uniformly random cell from the archive, or null if empty.
    readonly sample: () => Effect.Effect<ArchiveCell | null, BehaviourArchiveError>

    // Return all cells matching the partial descriptor filter (all if omitted).
    readonly query: (
      filter?: Partial<BehaviourDescriptor>,
    ) => Effect.Effect<readonly ArchiveCell[], BehaviourArchiveError>

    // Current number of occupied cells.
    readonly size: () => Effect.Effect<number, BehaviourArchiveError>
  }
>()('@app/host/ports/driven/BehaviourArchive') {}
