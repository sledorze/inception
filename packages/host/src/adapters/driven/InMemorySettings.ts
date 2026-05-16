import { Effect, Layer, Ref } from 'effect'
import { DEFAULT_SETTINGS, Settings } from '../../ports/driven/Settings.ts'
import type { AppSettings } from '../../ports/driven/Settings.ts'

export const InMemorySettings = {
  layer: (initial?: Partial<AppSettings>): Layer.Layer<Settings> =>
    Layer.effect(
      Settings,
      Effect.gen(function* () {
        const ref = yield* Ref.make<AppSettings>({ ...DEFAULT_SETTINGS, ...initial })
        return Settings.of({
          get: () => Ref.get(ref),
          patch: updates =>
            Ref.updateAndGet(ref, current => ({
              ...current,
              ...updates,
            })),
        })
      }),
    ),
}
