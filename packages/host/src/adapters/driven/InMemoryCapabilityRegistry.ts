import { Effect, Layer, Ref } from 'effect'
import type { CapabilityEntry } from '../../ports/driven/CapabilityRegistry.ts'
import { CapabilityRegistryError, CapabilityRegistry } from '../../ports/driven/CapabilityRegistry.ts'

interface State {
  readonly current: number
  readonly snapshots: readonly (readonly CapabilityEntry[])[]
}

export const InMemoryCapabilityRegistry = {
  layer: Layer.effect(
    CapabilityRegistry,
    Effect.gen(function* () {
      const state = yield* Ref.make<State>({ current: 0, snapshots: [[]] })

      return CapabilityRegistry.of({
        currentVersion: () =>
          Effect.gen(function* () {
            const { current } = yield* Ref.get(state)
            return current
          }),

        list: () =>
          Effect.gen(function* () {
            const { current, snapshots } = yield* Ref.get(state)
            return snapshots[current] ?? []
          }),

        register: (entry: CapabilityEntry) =>
          Effect.gen(function* () {
            const { current, snapshots } = yield* Ref.get(state)
            const prev = snapshots[current] ?? []
            const next = [...prev.filter(e => e.name !== entry.name), entry]
            const nextVersion = current + 1
            yield* Ref.set(state, { current: nextVersion, snapshots: [...snapshots, next] })
            return nextVersion
          }),

        rollback: (version: number) =>
          Effect.gen(function* () {
            const { snapshots } = yield* Ref.get(state)
            if (version < 0 || version >= snapshots.length) {
              return yield* Effect.fail(
                new CapabilityRegistryError({ cause: new Error(`version ${version} does not exist`) }),
              )
            }
            yield* Ref.update(state, s => ({ ...s, current: version }))
          }),
      })
    }),
  ),
}
