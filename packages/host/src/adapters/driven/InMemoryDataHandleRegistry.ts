import { Effect, Layer, Ref } from 'effect'
import { DataHandleRegistry, HandleRevoked } from '../../ports/driven/DataHandle.ts'
import type { DataHandle } from '../../ports/driven/DataHandle.ts'

export const InMemoryDataHandleRegistry = {
  layer: (seed: readonly DataHandle[] = []) =>
    Layer.effect(
      DataHandleRegistry,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map<string, DataHandle>(seed.map(h => [h.id, h])))

        return DataHandleRegistry.of({
          get: id =>
            Effect.gen(function* () {
              const map = yield* Ref.get(store)
              const handle = map.get(id)
              if (handle === undefined) {
                return yield* new HandleRevoked({ handleId: id })
              }
              return handle
            }),

          register: handle => Ref.update(store, m => new Map([...m, [handle.id, handle]])),
        })
      }),
    ),
}
