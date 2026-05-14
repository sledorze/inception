/**
 * OS-process fallback for SandboxExecutor.
 *
 * WARNING: This adapter runs scripts in a plain Node.js child process — not inside
 * a Wasmtime/WASI sandbox. Per §13 + TODO 1.8, this requires explicit per-cycle
 * approval. Wasmtime/WASI is the intended default adapter; this is only for
 * environments where Wasmtime is unavailable.
 *
 * Constraints enforced:
 *   wallMs  — via execFile `timeout` option (SIGTERM after wallMs ms)
 *   memoryMb — via `--max-old-space-size=<memoryMb>` V8 flag
 *   cpuMs   — not enforced at OS-process level (requires cgroups / Wasmtime)
 *
 * Determinism hints (L3.6):
 *   SANDBOX_TIME=<epoch ms at invocation>  — scripts can read a stable wall-clock
 *   SANDBOX_SEED=0                          — scripts can seed PRNGs consistently
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Clock, Effect, Layer } from 'effect'
import { SandboxError, SandboxExecutor } from '../../ports/driven/SandboxExecutor.ts'
import type { SandboxConstraints, SandboxResult } from '../../ports/driven/SandboxExecutor.ts'

interface ProcessOutput {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const runInProcess = (script: string, constraints: SandboxConstraints, sandboxTime: number): Promise<ProcessOutput> =>
  new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), 'sandbox-'))
      .then(dir => {
        const scriptPath = join(dir, 'script.js')
        return writeFile(scriptPath, script, 'utf8').then(() => scriptPath)
      })
      .then(scriptPath => {
        const nodeArgs = [`--max-old-space-size=${constraints.memoryMb}`, scriptPath]
        execFile(
          process.execPath,
          nodeArgs,
          {
            env: {
              ...process.env,
              SANDBOX_SEED: '0',
              SANDBOX_TIME: String(sandboxTime),
            },
            timeout: constraints.wallMs,
          },
          (error, stdout, stderr) => {
            // timeout: execFile sets killed=true when it sends the signal itself
            if (error?.killed === true) {
              reject(new Error(`Wall time budget exceeded (${constraints.wallMs}ms)`))
              return
            }
            const exitCode =
              typeof error?.code === 'number' ? error.code
              : error !== null && error !== undefined ? 1
              : 0
            resolve({ exitCode, stderr, stdout })
          },
        )
      })
      .catch(error => {
        reject(error)
      })
  })

const hashString = (s: string) => createHash('sha256').update(s).digest('hex')

const execute = (script: string, constraints: SandboxConstraints): Effect.Effect<SandboxResult, SandboxError> =>
  Effect.gen(function* () {
    const sandboxTime = yield* Clock.currentTimeMillis
    return yield* Effect.tryPromise({
      catch: cause => new SandboxError({ cause }),
      try: () =>
        runInProcess(script, constraints, sandboxTime).then(({ exitCode, stdout, stderr }) => ({
          exitCode,
          stderrHash: hashString(stderr),
          stdoutHash: hashString(stdout),
        })),
    })
  })

export const OsProcessSandboxExecutor = {
  layer: Layer.effect(
    SandboxExecutor,
    Effect.succeed(
      SandboxExecutor.of({
        run: execute,
      }),
    ),
  ),
}
