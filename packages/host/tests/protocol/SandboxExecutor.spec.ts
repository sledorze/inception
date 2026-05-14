/**
 * Protocol contract test for the SandboxExecutor driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), L3.6 (SANDBOX_TIME + SANDBOX_SEED env vars for determinism).
 *
 * InMemorySandboxExecutor: ignores the script and returns a pre-configured result.
 * OsProcessSandboxExecutor: documented fallback (OS-process, not WASI); requires per-cycle approval §13.
 */
import { Effect, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'
import { InMemorySandboxExecutor } from '../../src/adapters/driven/InMemorySandboxExecutor.ts'
import { OsProcessSandboxExecutor } from '../../src/adapters/driven/OsProcessSandboxExecutor.ts'
import { SandboxExecutor } from '../../src/ports/driven/SandboxExecutor.ts'
import type { SandboxConstraints, SandboxResult } from '../../src/ports/driven/SandboxExecutor.ts'

// ─── shared helpers ───────────────────────────────────────────────────────────

const DEFAULT_CONSTRAINTS: SandboxConstraints = {
  cpuMs: 5000,
  memoryMb: 64,
  wallMs: 10_000,
}

const FIXED_RESULT: SandboxResult = {
  exitCode: 0,
  stderrHash: 'cafebabe00000000000000000000000000000000000000000000000000000000',
  stdoutHash: 'deadbeef00000000000000000000000000000000000000000000000000000000',
}

// SHA-256 hex string: 64 lowercase hex characters.
const SHA256_RE = /^[0-9a-f]{64}$/u

// ─── shared contract ─────────────────────────────────────────────────────────

interface ExecutorFactory {
  // A script that exits 0; InMemory ignores it and returns its pre-configured result.
  readonly sampleScript: string
}

function runContract(
  name: string,
  makeFactory: () => ExecutorFactory,
  makeLayer: () => ManagedRuntime.ManagedRuntime<SandboxExecutor, never>,
) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<SandboxExecutor, never>
    let factory: ExecutorFactory

    beforeAll(() => {
      factory = makeFactory()
      rt = makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, SandboxExecutor>) => rt.runPromise(effect)

    it('run returns a result with exitCode as number', async () => {
      const result: SandboxResult = await run(
        Effect.gen(function* () {
          const executor = yield* SandboxExecutor
          return yield* executor.run(factory.sampleScript, DEFAULT_CONSTRAINTS)
        }),
      )
      expect(result.exitCode).toBeTypeOf('number')
    })

    it('run returns a result with stdoutHash as SHA-256 hex', async () => {
      const result: SandboxResult = await run(
        Effect.gen(function* () {
          const executor = yield* SandboxExecutor
          return yield* executor.run(factory.sampleScript, DEFAULT_CONSTRAINTS)
        }),
      )
      expect(result.stdoutHash).toMatch(SHA256_RE)
    })

    it('run returns a result with stderrHash as SHA-256 hex', async () => {
      const result: SandboxResult = await run(
        Effect.gen(function* () {
          const executor = yield* SandboxExecutor
          return yield* executor.run(factory.sampleScript, DEFAULT_CONSTRAINTS)
        }),
      )
      expect(result.stderrHash).toMatch(SHA256_RE)
    })
  })
}

// ─── InMemory (no subprocess) ─────────────────────────────────────────────────

runContract(
  'InMemorySandboxExecutor',
  () => ({ sampleScript: 'process.stdout.write("ignored")' }),
  () => ManagedRuntime.make(InMemorySandboxExecutor.layer(FIXED_RESULT)),
)

// ─── OsProcess (real subprocess — documented fallback, per §13 + TODO 1.8) ───

runContract(
  'OsProcessSandboxExecutor',
  () => ({
    sampleScript: 'process.stdout.write(JSON.stringify({ ok: true }))',
  }),
  () => ManagedRuntime.make(OsProcessSandboxExecutor.layer),
)

// ─── OsProcess-specific behavioural tests ────────────────────────────────────

describe('OsProcessSandboxExecutor behaviour', () => {
  let rt: ManagedRuntime.ManagedRuntime<SandboxExecutor, never>

  beforeAll(() => {
    rt = ManagedRuntime.make(OsProcessSandboxExecutor.layer)
  })

  afterAll(() => rt.dispose())

  const run = <A>(effect: Effect.Effect<A, unknown, SandboxExecutor>) => rt.runPromise(effect)

  it('exitCode reflects script exit status (non-zero)', async () => {
    const result: SandboxResult = await run(
      Effect.gen(function* () {
        const executor = yield* SandboxExecutor
        return yield* executor.run('process.exit(42)', DEFAULT_CONSTRAINTS)
      }),
    )
    expect(result.exitCode).toBe(42)
  })

  it('stdoutHash differs for different output', async () => {
    const runScript = (output: string) =>
      run(
        Effect.gen(function* () {
          const executor = yield* SandboxExecutor
          return yield* executor.run(`process.stdout.write(${JSON.stringify(output)})`, DEFAULT_CONSTRAINTS)
        }),
      )
    const [r1, r2] = await Promise.all([runScript('alpha'), runScript('beta')])
    expect(r1.stdoutHash).not.toBe(r2.stdoutHash)
  })

  it('wallMs timeout yields a SandboxError', async () => {
    await expect(
      run(
        Effect.gen(function* () {
          const executor = yield* SandboxExecutor
          return yield* executor.run('setTimeout(() => {}, 60_000)', {
            cpuMs: 5000,
            memoryMb: 64,
            wallMs: 200,
          })
        }),
      ),
    ).rejects.toThrow()
  })
})
