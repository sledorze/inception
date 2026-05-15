/**
 * OS-process fallback for SandboxExecutor.
 *
 * WARNING: This adapter runs scripts in a plain Node.js child process — not inside
 * a Wasmtime/WASI sandbox. Per §13 + TODO 1.8, this requires explicit per-cycle
 * approval. Wasmtime/WASI is the intended default adapter; this is only for
 * environments where Wasmtime is unavailable.
 *
 * Constraints enforced:
 *   wallMs  — via Effect.timeoutOrElse (SIGTERM via scope finalizer after wallMs ms)
 *   memoryMb — via `--max-old-space-size=<memoryMb>` V8 flag
 *   cpuMs   — not enforced at OS-process level (requires cgroups / Wasmtime)
 *
 * Determinism hints (L3.6):
 *   SANDBOX_TIME=<epoch ms at invocation>  — scripts can read a stable wall-clock
 *   SANDBOX_SEED=0                          — scripts can seed PRNGs consistently
 */
import { createHash } from 'node:crypto'
import { Clock, Duration, Effect, FileSystem, Layer, Path, Stream } from 'effect'
import { ChildProcess } from 'effect/unstable/process'
import { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner'
import { NodeServices } from '@effect/platform-node'
import { SandboxError, SandboxExecutor } from '../../ports/driven/SandboxExecutor.ts'
import type { SandboxConstraints, SandboxResult } from '../../ports/driven/SandboxExecutor.ts'

const hashString = (s: string) => createHash('sha256').update(s).digest('hex')

export const OsProcessSandboxExecutor = {
  layer: Layer.effect(
    SandboxExecutor,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner

      const execute = (script: string, constraints: SandboxConstraints): Effect.Effect<SandboxResult, SandboxError> =>
        Effect.gen(function* () {
          const sandboxTime = yield* Clock.currentTimeMillis

          const dir = yield* fs
            .makeTempDirectory({ prefix: 'sandbox-' })
            .pipe(Effect.mapError(cause => new SandboxError({ cause })))
          const scriptPath = path.join(dir, 'script.js')
          yield* fs.writeFileString(scriptPath, script).pipe(Effect.mapError(cause => new SandboxError({ cause })))

          const cmd = ChildProcess.make(
            process.execPath,
            [`--max-old-space-size=${String(constraints.memoryMb)}`, scriptPath],
            { env: { ...process.env, SANDBOX_SEED: '0', SANDBOX_TIME: String(sandboxTime) } as Record<string, string> },
          )

          return yield* Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(cmd)
              const [stdoutStr, stderrStr] = yield* Effect.all(
                [
                  Stream.mkString(Stream.decodeText(handle.stdout)).pipe(Effect.catch(() => Effect.succeed(''))),
                  Stream.mkString(Stream.decodeText(handle.stderr)).pipe(Effect.catch(() => Effect.succeed(''))),
                ],
                { concurrency: 2 },
              )
              const code = yield* handle.exitCode.pipe(
                Effect.map(c => c as unknown as number),
                Effect.catch(() => Effect.succeed(1)),
              )
              return { exitCode: code, stderr: stderrStr, stdout: stdoutStr }
            }),
          ).pipe(
            Effect.timeoutOrElse({
              duration: Duration.millis(constraints.wallMs),
              orElse: () =>
                Effect.fail(
                  new SandboxError({ cause: new Error(`Wall time budget exceeded (${String(constraints.wallMs)}ms)`) }),
                ),
            }),
            Effect.catchTag('@app/host/SandboxError', e => Effect.fail(e)),
            Effect.mapError(cause => new SandboxError({ cause })),
            Effect.map(
              ({ exitCode, stdout, stderr }) =>
                ({
                  exitCode,
                  stderrHash: hashString(stderr),
                  stdoutHash: hashString(stdout),
                }) satisfies SandboxResult,
            ),
          )
        })

      return SandboxExecutor.of({ run: execute })
    }),
  ).pipe(Layer.provide(NodeServices.layer)),
}
