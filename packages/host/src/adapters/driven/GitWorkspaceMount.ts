import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { Effect, Layer } from 'effect'
import { WorkspaceMount, WorkspaceMountError } from '../../ports/driven/WorkspaceMount.ts'

const execFileAsync = promisify(execFile)

const gitRoot = (cwd: string) =>
  Effect.tryPromise({
    catch: () => null as null,
    try: async () => {
      const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'])
      return stdout.trim()
    },
  })

const DEFAULT_PATH = process.env['WORKSPACE_PATH']

export const GitWorkspaceMount = {
  layer: (workspacePath = DEFAULT_PATH) =>
    Layer.effect(
      WorkspaceMount,
      workspacePath === undefined ?
        Effect.die(new Error('WORKSPACE_PATH env var is not set — cannot mount workspace'))
      : Effect.gen(function* () {
          const absPath = resolve(workspacePath)

          // Workspace must be inside a git repo.
          const wsRoot = yield* gitRoot(absPath)
          if (wsRoot === null) {
            yield* Effect.die(new Error(`Workspace path ${absPath} is not inside a git repository`))
          }

          // Workspace must not be the Host's own repo (boundary check).
          const hostRoot = yield* gitRoot(process.cwd())
          if (hostRoot !== null && wsRoot === hostRoot) {
            yield* Effect.die(
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
                try: async () => {
                  const fullPath = join(absPath, relativePath)
                  await mkdir(dirname(fullPath), { recursive: true })
                  await writeFile(fullPath, content, 'utf8')
                },
              }),
          })
        }),
    ),
}
