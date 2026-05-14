import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Effect, Ref } from 'effect'
import { DataHandleError, HandleExhausted, HandleRevoked } from '../../ports/driven/DataHandle.ts'

const execFileAsync = promisify(execFile)

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
  create: (opts: FileBackedHandleOptions) =>
    Effect.gen(function* () {
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
            const stdout = yield* Effect.tryPromise({
              catch: cause => new DataHandleError({ cause }),
              try: async () => {
                const dir = await mkdtemp(join(tmpdir(), 'handle-script-'))
                const scriptPath = join(dir, 'script.js')
                await writeFile(scriptPath, script, 'utf8')
                const { stdout: out } = await execFileAsync(process.execPath, [scriptPath], {
                  env: { ...process.env, DATA_FILE: opts.filePath },
                  timeout: 30_000,
                })
                return out
              },
            })
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
      }
    }),
}
