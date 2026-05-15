import { Effect, FileSystem, Layer, Schema } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import type { CapabilityEntry } from '../../ports/driven/CapabilityRegistry.ts'
import { CapabilityRegistryError, CapabilityRegistry } from '../../ports/driven/CapabilityRegistry.ts'

const CapabilityEntrySchema = Schema.Struct({
  code: Schema.String,
  description: Schema.String,
  name: Schema.String,
  promotedAt: Schema.String,
  proposalId: Schema.String,
  scope: Schema.Array(Schema.String),
  tests: Schema.String,
})

const PersistedStateSchema = Schema.Struct({
  current: Schema.Number,
  snapshots: Schema.Array(Schema.Array(CapabilityEntrySchema)),
})

type PersistedState = typeof PersistedStateSchema.Type

const emptyState: PersistedState = { current: 0, snapshots: [[]] }

export const FileBackedCapabilityRegistry = {
  layer: (filePath: string) =>
    Layer.effect(
      CapabilityRegistry,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        const load: Effect.Effect<PersistedState> = fs.readFileString(filePath).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(PersistedStateSchema))),
          Effect.catch(() => Effect.succeed(emptyState)),
        )

        const save = (state: PersistedState): Effect.Effect<void, CapabilityRegistryError> =>
          Schema.encodeEffect(Schema.fromJsonString(PersistedStateSchema))(state).pipe(
            Effect.flatMap(json => fs.writeFileString(filePath, json)),
            Effect.mapError(e => new CapabilityRegistryError({ cause: e })),
          )

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
                return yield* new CapabilityRegistryError({ cause: new Error(`version ${version} does not exist`) })
              }
              yield* save({ ...state, current: version })
            }),
        })
      }),
    ).pipe(Layer.provide(NodeFileSystem.layer)),
}
