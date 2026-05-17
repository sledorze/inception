import { createHash } from 'node:crypto'
import { Effect, FileSystem, Path, Ref } from 'effect'
import { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner'
import { DataHandleError, HandleExhausted, HandleRevoked } from '../../ports/driven/DataHandle.ts'
import type { DataHandle } from '../../ports/driven/DataHandle.ts'
import { runScriptInTempDir } from '../runScriptInTempDir.ts'

export interface FileBackedHandleOptions {
  readonly id: string
  readonly filePath: string
  readonly schema?: unknown
  readonly redactedSample?: unknown
  // Bootstrap info-budget limit (L1.7 phase-1): handle is closed after accumulating
  // this many bits. Default: 80_000 bits (≈10 KB of output). bootstrap=true per §12.
  readonly infoBitLimit?: number
}

// Bootstrap entropy estimator: 8 bits per byte of returned output (L1.7 phase-1).
// TODO 1.19 replaces this with (ε,δ)-DP noise mechanisms (Laplace/Gaussian).
const estimateBits = (stdout: string) => stdout.length * 8

const DEFAULT_INFO_BIT_LIMIT = 80_000

// Handle state distinguishes the close reason so callers get the right typed error.
type HandleState = 'alive' | 'revoked' | 'exhausted'

export const FileBackedHandle = {
  create: (
    opts: FileBackedHandleOptions,
  ): Effect.Effect<DataHandle, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner
      const state = yield* Ref.make<HandleState>('alive')
      const bitsAccumulated = yield* Ref.make(0)
      const limit = opts.infoBitLimit ?? DEFAULT_INFO_BIT_LIMIT

      return {
        fetchShape: () =>
          Effect.succeed({
            redactedSample: opts.redactedSample ?? {},
            schema: opts.schema ?? {},
          }),

        id: opts.id,

        isAlive: () => Effect.map(Ref.get(state), s => s === 'alive'),

        revoke: () => Ref.set(state, 'revoked'),

        runScript: (script: string) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(state)
            if (current === 'revoked') {
              return yield* new HandleRevoked({ handleId: opts.id })
            }
            const accumulated = yield* Ref.get(bitsAccumulated)
            if (current === 'exhausted' || accumulated >= limit) {
              return yield* new HandleExhausted({ bitsConsumed: accumulated, handleId: opts.id })
            }
            const stdout = yield* runScriptInTempDir({
              code: script,
              env: { ...process.env, DATA_FILE: opts.filePath },
              prefix: 'handle-script-',
            }).pipe(
              Effect.mapError(cause => new DataHandleError({ cause })),
              Effect.provideService(FileSystem.FileSystem, fs),
              Effect.provideService(Path.Path, path),
              Effect.provideService(ChildProcessSpawner, spawner),
            )
            const bitsConsumed = estimateBits(stdout)
            const newTotal = accumulated + bitsConsumed
            yield* Ref.set(bitsAccumulated, newTotal)
            if (newTotal >= limit) {
              yield* Ref.set(state, 'exhausted')
            }
            const stdoutHash = createHash('sha256').update(stdout).digest('hex')
            return {
              bitsConsumed,
              exitCode: 0,
              stdoutHash,
              summary: stdout.slice(0, 512),
            }
          }),
      } satisfies DataHandle
    }),
}
