import { Config, Effect, FileSystem, Layer, Option, Path, Stream } from 'effect'
import { ChildProcess } from 'effect/unstable/process'
import { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner'
import { WorkspaceMount, WorkspaceMountError } from '../../ports/driven/WorkspaceMount.ts'

const gitRootFor = (spawner: ChildProcessSpawner['Service'], cwd: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(ChildProcess.make('git', ['-C', cwd, 'rev-parse', '--show-toplevel']))
      const stdout = yield* Stream.mkString(Stream.decodeText(handle.stdout)).pipe(
        Effect.catch(() => Effect.succeed('')),
      )
      yield* handle.exitCode.pipe(Effect.ignore)
      return stdout.trim() || null
    }),
  ).pipe(Effect.catch(() => Effect.succeed(null as string | null)))

export const GitWorkspaceMount = {
  layer: (workspacePath?: string) =>
    Layer.unwrap(
      Effect.gen(function* () {
        const resolved = workspacePath ?? Option.getOrUndefined(yield* Config.option(Config.string('WORKSPACE_PATH')))
        return Layer.effect(
          WorkspaceMount,
          resolved === undefined ?
            Effect.die(new Error('WORKSPACE_PATH env var is not set — cannot mount workspace'))
          : Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem
              const path = yield* Path.Path
              const spawner = yield* ChildProcessSpawner
              const absPath = path.resolve(resolved)

              // Workspace must be inside a git repo.
              const wsRoot = yield* gitRootFor(spawner, absPath)
              if (wsRoot === null) {
                return yield* Effect.die(new Error(`Workspace path ${absPath} is not inside a git repository`))
              }

              // Workspace must not be the Host's own repo (boundary check).
              const hostRoot = yield* gitRootFor(spawner, process.cwd())
              if (hostRoot !== null && wsRoot === hostRoot) {
                return yield* Effect.die(
                  new Error(`Workspace ${absPath} resolves to the Host's own repository — boundary is ambiguous`),
                )
              }

              return WorkspaceMount.of({
                list: relativeDir =>
                  fs
                    .readDirectory(path.join(absPath, relativeDir))
                    .pipe(Effect.mapError(cause => new WorkspaceMountError({ cause, path: relativeDir }))),

                read: relativePath =>
                  fs
                    .readFileString(path.join(absPath, relativePath))
                    .pipe(Effect.mapError(cause => new WorkspaceMountError({ cause, path: relativePath }))),

                rootPath: Effect.succeed(absPath),

                write: (relativePath, content) =>
                  Effect.gen(function* () {
                    const fullPath = path.join(absPath, relativePath)
                    yield* fs
                      .makeDirectory(path.dirname(fullPath), { recursive: true })
                      .pipe(Effect.mapError(cause => new WorkspaceMountError({ cause, path: relativePath })))
                    yield* fs
                      .writeFileString(fullPath, content)
                      .pipe(Effect.mapError(cause => new WorkspaceMountError({ cause, path: relativePath })))
                  }),
              })
            }),
        )
      }),
    ),
}
