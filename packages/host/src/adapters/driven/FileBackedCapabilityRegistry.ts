import { Effect, FileSystem, Layer } from 'effect'
import { NodeFileSystem } from '@effect/platform-node'
import type { CapabilityEntry } from '../../ports/driven/CapabilityRegistry.ts'
import { CapabilityRegistryError, CapabilityRegistry } from '../../ports/driven/CapabilityRegistry.ts'

interface PersistedState {
  current: number
  snapshots: readonly (readonly CapabilityEntry[])[]
}

const emptyState: PersistedState = { current: 0, snapshots: [[]] }

export const FileBackedCapabilityRegistry = {
  layer: (filePath: string) =>
    Layer.effect(
      CapabilityRegistry,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        const load: Effect.Effect<PersistedState> = fs.readFileString(filePath).pipe(
          Effect.map(content => JSON.parse(content) as PersistedState),
          Effect.catch(() => Effect.succeed(emptyState)),
        )

        const save = (state: PersistedState): Effect.Effect<void, CapabilityRegistryError> =>
          fs
            .writeFileString(filePath, JSON.stringify(state, null, 2))
            .pipe(Effect.mapError(e => new CapabilityRegistryError({ cause: e })))

        return CapabilityRegistry.of({
          currentVersion: () => load.pipe(Effect.map(s => s.current)),

          list: () => load.pipe(Effect.map(({ current, snapshots }) => snapshots[current] ?? [])),

          register: (entry: CapabilityEntry) =>
            Effect.gen(function* () {
              const state = yield* load
              const prev = state.snapshots[state.current] ?? []
              const next = [...prev.filter(e => e.name !== entry.name), entry]
              const nextVersion = state.current + 1
              yield* save({ current: nextVersion, snapshots: [...state.snapshots, next] })
              return nextVersion
            }),

          rollback: (version: number) =>
            Effect.gen(function* () {
              const state = yield* load
              if (version < 0 || version >= state.snapshots.length) {
                return yield* Effect.fail(
                  new CapabilityRegistryError({ cause: new Error(`version ${version} does not exist`) }),
                )
              }
              yield* save({ ...state, current: version })
            }),
        })
      }),
    ).pipe(Layer.provide(NodeFileSystem.layer)),
}
