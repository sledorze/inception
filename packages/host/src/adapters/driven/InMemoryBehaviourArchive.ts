/**
 * In-memory MAP-Elites behaviour archive adapter (§4.5, L2.13).
 *
 * Bootstrap adapter: each archive cell is keyed by
 * `${concernTag}|${workflowType}|${testPassCountBucket}|${costBucket}|${primitiveCompositionHash}`.
 * A new variant replaces the incumbent only when it is strictly fitter
 * (compareFitness > 0). On tie, the incumbent is retained.
 */
import { Effect, Layer, Random, Ref } from 'effect'
import { BehaviourArchive, compareFitness } from '../../ports/driven/BehaviourArchive.ts'
import type { ArchiveCell, BehaviourDescriptor } from '../../ports/driven/BehaviourArchive.ts'
import type { VariantEntry } from '../../ports/driven/VariantLog.ts'

const cellKey = (descriptor: BehaviourDescriptor, primitiveCompositionHash: string): string =>
  `${descriptor.concernTag}|${descriptor.workflowType}|${descriptor.testPassCountBucket}|${descriptor.costBucket}|${primitiveCompositionHash}`

export const InMemoryBehaviourArchive = {
  layer: Layer.effect(
    BehaviourArchive,
    Effect.gen(function* () {
      const cells = yield* Ref.make<Map<string, ArchiveCell>>(new Map())

      return BehaviourArchive.of({
        insert: (descriptor: BehaviourDescriptor, entry: VariantEntry) =>
          Ref.modify(cells, archive => {
            const key = cellKey(descriptor, entry.primitiveCompositionHash)
            const existing = archive.get(key)
            if (existing !== undefined && compareFitness(entry, existing.entry) <= 0) {
              return [false, archive]
            }
            return [
              true,
              new Map([
                ...archive,
                [key, { descriptor, entry, primitiveCompositionHash: entry.primitiveCompositionHash }],
              ]),
            ]
          }),

        query: (filter?: Partial<BehaviourDescriptor>) =>
          Effect.gen(function* () {
            const archive = yield* Ref.get(cells)
            const all = [...archive.values()]
            if (filter === undefined) {
              return all
            }
            return all.filter(
              cell =>
                (filter.concernTag === undefined || cell.descriptor.concernTag === filter.concernTag) &&
                (filter.workflowType === undefined || cell.descriptor.workflowType === filter.workflowType) &&
                (filter.testPassCountBucket === undefined ||
                  cell.descriptor.testPassCountBucket === filter.testPassCountBucket) &&
                (filter.costBucket === undefined || cell.descriptor.costBucket === filter.costBucket),
            )
          }),

        sample: () =>
          Effect.gen(function* () {
            const archive = yield* Ref.get(cells)
            const all = [...archive.values()]
            if (all.length === 0) {
              return null
            }
            const idx = yield* Random.nextIntBetween(0, all.length - 1)
            return all[idx] ?? null
          }),

        size: () => Effect.map(Ref.get(cells), m => m.size),
      })
    }),
  ),
}
