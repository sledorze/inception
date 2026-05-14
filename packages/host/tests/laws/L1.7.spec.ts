/**
 * Law L1.7 — Information Budget per Handle (DP).
 * "Every data handle carries a cumulative (ε,δ)-DP budget. Each runScript
 *  debits ε. Byte-count estimators are forbidden (Dwork-Roth-Vadhan).
 *  When ε is exhausted, the Host closes the handle (HandleExhausted)."
 *
 * If-absent failure mode: information leakage via iterated aggregates cannot
 * be bounded; folklore byte-count estimators allow reverse-engineering raw data.
 *
 * Tests assert:
 * - ε budget composition exhausts handle after ε_max / ε_per_query queries.
 * - SensitivityViolation is thrown when declared sensitivity exceeds the max.
 * - bitsConsumed from the DP adapter is always ≥ 0.
 * - bitsConsumed is non-deterministic (differs across calls — noise is applied).
 * - Handle is not alive after ε exhaustion.
 */
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Effect, Random } from 'effect'
import { describe, expect, it } from 'vitest'
import { DpFileBackedHandle } from '../../src/adapters/driven/DpFileBackedHandle.ts'
import { dpBitsEstimate } from '../../src/domain/dp.ts'
import { HandleExhausted, SensitivityViolation } from '../../src/ports/driven/DataHandle.ts'

const SAMPLE_SCRIPT = 'process.stdout.write("42")'

const makeTestFile = async () => {
  const filePath = join(tmpdir(), `l1.7-test-${randomUUID()}.csv`)
  await writeFile(filePath, 'x\n1\n2\n3\n', 'utf8')
  return filePath
}

describe('L1.7 — DP information budget', () => {
  it('ε budget exhausts handle after ε_max / ε_per_query queries', async () => {
    const filePath = await makeTestFile()
    // ε_per_query=0.5, ε_max=1.0 → exhausts after 2 successful calls
    const handle = await Effect.runPromise(
      DpFileBackedHandle.create({ epsilonMax: 1, epsilonPerQuery: 0.5, filePath, id: randomUUID() }),
    )

    await Effect.runPromise(handle.runScript(SAMPLE_SCRIPT))
    await Effect.runPromise(handle.runScript(SAMPLE_SCRIPT))

    // Third call must fail with HandleExhausted
    await Effect.runPromise(
      handle.runScript(SAMPLE_SCRIPT).pipe(
        Effect.flip,
        Effect.flatMap(e =>
          e instanceof HandleExhausted ? Effect.void : Effect.die(`expected HandleExhausted, got ${String(e)}`),
        ),
      ),
    )
  })

  it('handle isAlive returns false after ε exhaustion', async () => {
    const filePath = await makeTestFile()
    const handle = await Effect.runPromise(
      DpFileBackedHandle.create({ epsilonMax: 0.5, epsilonPerQuery: 0.5, filePath, id: randomUUID() }),
    )

    await Effect.runPromise(handle.runScript(SAMPLE_SCRIPT))

    const alive = await Effect.runPromise(handle.isAlive())
    expect(alive).toBeFalsy()
  })

  it('SensitivityViolation when declared sensitivity exceeds max (L1.7 boundary enforcement)', async () => {
    const filePath = await makeTestFile()
    const handle = await Effect.runPromise(
      DpFileBackedHandle.create({ filePath, id: randomUUID(), maxSensitivityL1: 1 }),
    )

    await Effect.runPromise(
      handle.runScript(SAMPLE_SCRIPT, { norm: 'l1', value: 2 }).pipe(
        Effect.flip,
        Effect.flatMap(e =>
          e instanceof SensitivityViolation ?
            Effect.void
          : Effect.die(`expected SensitivityViolation, got ${String(e)}`),
        ),
      ),
    )
  })

  it('bitsConsumed is always ≥ 0 (DP noise clamped)', async () => {
    const filePath = await makeTestFile()
    const handle = await Effect.runPromise(DpFileBackedHandle.create({ filePath, id: randomUUID() }))

    const result = await Effect.runPromise(handle.runScript(SAMPLE_SCRIPT))
    expect(result.bitsConsumed).toBeGreaterThanOrEqual(0)
  })

  it('dpBitsEstimate noise differs between seeds (forbids byte-count estimator)', async () => {
    // Use large trueBits (10_000) so Laplace noise (scale≈80) never clamps to 0,
    // making two different seeds reliably produce distinct values.
    const run = (seed: number) =>
      dpBitsEstimate(10_000, { norm: 'l1', value: 1 }, 0.1, 1e-5).pipe(
        Effect.map(r => r.noisyBits),
        Random.withSeed(seed),
      )

    const bits1 = await Effect.runPromise(run(1))
    const bits2 = await Effect.runPromise(run(2))
    expect(bits1).not.toBe(bits2)
  })

  it('Gaussian mechanism also produces non-negative bitsConsumed', async () => {
    const filePath = await makeTestFile()
    const handle = await Effect.runPromise(DpFileBackedHandle.create({ filePath, id: randomUUID() }))

    const result = await Effect.runPromise(handle.runScript(SAMPLE_SCRIPT, { norm: 'l2', value: 1 }))
    expect(result.bitsConsumed).toBeGreaterThanOrEqual(0)
  })
})
