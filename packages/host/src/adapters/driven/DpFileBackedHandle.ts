/**
 * DP-backed DataHandle adapter (L1.7 §12).
 *
 * Replaces the bootstrap byte-count estimator in FileBackedHandle with
 * calibrated (ε,δ)-DP noise (Laplace for ℓ₁, Gaussian for ℓ₂).
 * Tracks a per-handle ε ledger; exhausts the handle when cumulative ε ≥ ε_max.
 *
 * Bootstrap calibration (bootstrap=true §12):
 *   ε_per_query = 0.1, ε_max = 1.0, δ = 1e-5, max_sensitivity = 1.0
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Effect, Ref } from 'effect'
import {
  DEFAULT_DELTA,
  DEFAULT_EPSILON_MAX,
  DEFAULT_EPSILON_PER_QUERY,
  DEFAULT_MAX_SENSITIVITY_L1,
  DEFAULT_MAX_SENSITIVITY_L2,
  dpBitsEstimate,
} from '../../domain/dp.ts'
import { DataHandleError, HandleExhausted, HandleRevoked, SensitivityViolation } from '../../ports/driven/DataHandle.ts'
import type { DataHandle, QuerySensitivity } from '../../ports/driven/DataHandle.ts'

const execFileAsync = promisify(execFile)

export interface DpHandleOptions {
  readonly id: string
  readonly filePath: string
  readonly schema?: unknown
  readonly redactedSample?: unknown
  readonly epsilonPerQuery?: number
  readonly epsilonMax?: number
  readonly delta?: number
  readonly maxSensitivityL1?: number
  readonly maxSensitivityL2?: number
}

type HandleState = 'alive' | 'revoked' | 'exhausted'

const runScriptInProcess = async (script: string, filePath: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'dp-handle-script-'))
  const scriptPath = join(dir, 'script.js')
  await writeFile(scriptPath, script, 'utf8')
  const { stdout } = await execFileAsync(process.execPath, [scriptPath], {
    env: { ...process.env, DATA_FILE: filePath },
    timeout: 30_000,
  })
  return stdout
}

const DEFAULT_SENSITIVITY: QuerySensitivity = { norm: 'l1', value: 1 }

export const DpFileBackedHandle = {
  create: (opts: DpHandleOptions): Effect.Effect<DataHandle> =>
    Effect.gen(function* () {
      const state = yield* Ref.make<HandleState>('alive')
      const epsilonAccumulated = yield* Ref.make(0)
      const bitsAccumulated = yield* Ref.make(0)

      const epsilonPerQuery = opts.epsilonPerQuery ?? DEFAULT_EPSILON_PER_QUERY
      const epsilonMax = opts.epsilonMax ?? DEFAULT_EPSILON_MAX
      const delta = opts.delta ?? DEFAULT_DELTA
      const maxSensL1 = opts.maxSensitivityL1 ?? DEFAULT_MAX_SENSITIVITY_L1
      const maxSensL2 = opts.maxSensitivityL2 ?? DEFAULT_MAX_SENSITIVITY_L2

      return {
        fetchShape: () =>
          Effect.succeed({
            redactedSample: opts.redactedSample ?? {},
            schema: opts.schema ?? {},
          }),

        id: opts.id,

        isAlive: () => Effect.map(Ref.get(state), s => s === 'alive'),

        revoke: () => Ref.set(state, 'revoked'),

        runScript: (script: string, sensitivity?: QuerySensitivity) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(state)
            if (current === 'revoked') {
              return yield* new HandleRevoked({ handleId: opts.id })
            }
            const epsilonUsed = yield* Ref.get(epsilonAccumulated)
            const bits = yield* Ref.get(bitsAccumulated)
            if (current === 'exhausted' || epsilonUsed >= epsilonMax) {
              return yield* new HandleExhausted({ bitsConsumed: bits, handleId: opts.id })
            }

            const sens = sensitivity ?? DEFAULT_SENSITIVITY
            const maxSens = sens.norm === 'l1' ? maxSensL1 : maxSensL2
            if (sens.value > maxSens) {
              return yield* new SensitivityViolation({ declared: sens.value, max: maxSens, norm: sens.norm })
            }

            const stdout = yield* Effect.tryPromise({
              catch: cause => new DataHandleError({ cause }),
              try: () => runScriptInProcess(script, opts.filePath),
            })

            const trueBits = stdout.length * 8
            const { noisyBits } = yield* dpBitsEstimate(trueBits, sens, epsilonPerQuery, delta)

            yield* Ref.set(epsilonAccumulated, epsilonUsed + epsilonPerQuery)
            yield* Ref.set(bitsAccumulated, bits + noisyBits)
            if (epsilonUsed + epsilonPerQuery >= epsilonMax) {
              yield* Ref.set(state, 'exhausted')
            }

            const stdoutHash = createHash('sha256').update(stdout).digest('hex')
            return {
              bitsConsumed: noisyBits,
              exitCode: 0,
              stdoutHash,
              summary: stdout.slice(0, 512),
            }
          }),
      } satisfies DataHandle
    }),
}
