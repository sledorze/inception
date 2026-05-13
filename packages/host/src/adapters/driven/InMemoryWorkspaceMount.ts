import { Effect, Layer, Ref } from 'effect'
import { WorkspaceMount, WorkspaceMountError } from '../../ports/driven/WorkspaceMount.ts'

const VIRTUAL_ROOT = '/virtual-workspace'

export const InMemoryWorkspaceMount = {
  layer: (initialFiles: Record<string, string> = {}) =>
    Layer.effect(
      WorkspaceMount,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map<string, string>(Object.entries(initialFiles)))

        return WorkspaceMount.of({
          list: relativeDir =>
            Effect.gen(function* () {
              const files = yield* Ref.get(store)
              const prefix = relativeDir === '.' ? '' : `${relativeDir}/`
              const names = [...files.keys()]
                .filter(k => k.startsWith(prefix))
                .map(k => k.slice(prefix.length).split('/').at(0) ?? '')
                .filter((v, i, arr) => v !== '' && arr.indexOf(v) === i)
              return names
            }),

          read: relativePath =>
            Effect.gen(function* () {
              const files = yield* Ref.get(store)
              const content = files.get(relativePath)
              if (content === undefined) {
                return yield* Effect.fail(
                  new WorkspaceMountError({ cause: new Error(`not found`), path: relativePath }),
                )
              }
              return content
            }),

          rootPath: Effect.succeed(VIRTUAL_ROOT),

          write: (relativePath, content) => Ref.update(store, m => new Map([...m, [relativePath, content]])),
        })
      }),
    ),
}
