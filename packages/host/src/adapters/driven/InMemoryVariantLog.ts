import { Effect, Layer, Ref } from 'effect'
import type { VariantEntry } from '../../ports/driven/VariantLog.ts'
import { VariantLog } from '../../ports/driven/VariantLog.ts'

export const InMemoryVariantLog = {
  layer: Layer.effect(
    VariantLog,
    Effect.gen(function* () {
      const store = yield* Ref.make<readonly VariantEntry[]>([])

      return VariantLog.of({
        query: filter =>
          Effect.map(Ref.get(store), entries =>
            entries.filter(
              e =>
                (filter.sessionId === undefined || e.sessionId === filter.sessionId) &&
                (filter.storyRef === undefined || e.storyRef === filter.storyRef),
            ),
          ),

        record: entry => Ref.update(store, entries => [...entries, entry]),
      })
    }),
  ),
}
