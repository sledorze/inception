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
import { createHash } from 'node:crypto'
import { Effect, FileSystem, Path, Ref } from 'effect'
import { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner'
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
import { runScriptInTempDir } from '../runScriptInTempDir.ts'

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

const DEFAULT_SENSITIVITY: QuerySensitivity = { norm: 'l1', value: 1 }

export const DpFileBackedHandle = {
  create: (
    opts: DpHandleOptions,
  ): Effect.Effect<DataHandle, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner
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

            const stdout = yield* runScriptInTempDir({
              code: script,
              env: { ...process.env, DATA_FILE: opts.filePath } as Record<string, string>,
              prefix: 'dp-handle-script-',
            }).pipe(
              Effect.mapError(cause => new DataHandleError({ cause })),
              Effect.provideService(FileSystem.FileSystem, fs),
              Effect.provideService(Path.Path, path),
              Effect.provideService(ChildProcessSpawner, spawner),
            )

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
