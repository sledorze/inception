import { Data, Duration, Effect, FileSystem, Path, Stream } from 'effect'
import { ChildProcess } from 'effect/unstable/process'
import { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner'

export class RunScriptError extends Data.TaggedError('@app/host/RunScriptError')<{ cause: unknown }> {}

export interface RunScriptOptions {
  readonly code: string
  readonly env?: NodeJS.ProcessEnv
  readonly filename?: string
  readonly prefix?: string
  readonly timeout?: number
}

export const runScriptInTempDir = (
  opts: RunScriptOptions,
): Effect.Effect<string, RunScriptError, FileSystem.FileSystem | Path.Path | ChildProcessSpawner> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner

    const dir = yield* fs
      .makeTempDirectory({ prefix: opts.prefix ?? 'script-' })
      .pipe(Effect.mapError(cause => new RunScriptError({ cause })))
    const scriptPath = path.join(dir, opts.filename ?? 'script.js')
    yield* fs.writeFileString(scriptPath, opts.code).pipe(Effect.mapError(cause => new RunScriptError({ cause })))

    const cmd = ChildProcess.make(process.execPath, [scriptPath], {
      env: (opts.env ?? process.env) as Record<string, string>,
    })

    return yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(cmd).pipe(Effect.mapError(cause => new RunScriptError({ cause })))
        return yield* Stream.mkString(Stream.decodeText(handle.stdout)).pipe(
          Effect.mapError(cause => new RunScriptError({ cause })),
        )
      }),
    ).pipe(
      Effect.timeoutOrElse({
        duration: Duration.millis(opts.timeout ?? 30_000),
        orElse: () =>
          Effect.fail(
            new RunScriptError({ cause: new Error(`Script timed out after ${String(opts.timeout ?? 30_000)}ms`) }),
          ),
      }),
    )
  })
