import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { Config, Effect, Layer, Option } from 'effect'
import { WorkspaceMount, WorkspaceMountError } from '../../ports/driven/WorkspaceMount.ts'

const execFileAsync = promisify(execFile)

const gitRoot = (cwd: string) =>
  Effect.tryPromise({
    catch: () => null as null,
    try: () => execFileAsync('git', ['-C', cwd, 'rev-parse', '--show-toplevel']).then(({ stdout }) => stdout.trim()),
  })

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
              const absPath = resolve(resolved)

              // Workspace must be inside a git repo.
              const wsRoot = yield* gitRoot(absPath)
              if (wsRoot === null) {
                return yield* Effect.die(new Error(`Workspace path ${absPath} is not inside a git repository`))
              }

              // Workspace must not be the Host's own repo (boundary check).
              const hostRoot = yield* gitRoot(process.cwd())
              if (hostRoot !== null && wsRoot === hostRoot) {
                return yield* Effect.die(
                  new Error(`Workspace ${absPath} resolves to the Host's own repository — boundary is ambiguous`),
                )
              }

              return WorkspaceMount.of({
                list: relativeDir =>
                  Effect.tryPromise({
                    catch: cause => new WorkspaceMountError({ cause, path: relativeDir }),
                    try: () => readdir(join(absPath, relativeDir)),
                  }),

                read: relativePath =>
                  Effect.tryPromise({
                    catch: cause => new WorkspaceMountError({ cause, path: relativePath }),
                    try: () => readFile(join(absPath, relativePath), 'utf8'),
                  }),

                rootPath: Effect.succeed(absPath),

                write: (relativePath, content) =>
                  Effect.tryPromise({
                    catch: cause => new WorkspaceMountError({ cause, path: relativePath }),
                    try: () => {
                      const fullPath = join(absPath, relativePath)
                      return mkdir(dirname(fullPath), { recursive: true }).then(() =>
                        writeFile(fullPath, content, 'utf8'),
                      )
                    },
                  }),
              })
            }),
        )
      }),
    ),
}
