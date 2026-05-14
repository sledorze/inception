/**
 * Protocol contract test for the DataHandle / DataHandleRegistry driven port.
 * Parametrised over handle implementations — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), L1.3 (only AggregateResult exits the handle), §10.1 Q6.
 */
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Effect, ManagedRuntime, Ref } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DpFileBackedHandle } from '../../src/adapters/driven/DpFileBackedHandle.ts'
import { FileBackedHandle } from '../../src/adapters/driven/FileBackedHandle.ts'
import { InMemoryDataHandleRegistry } from '../../src/adapters/driven/InMemoryDataHandleRegistry.ts'
import { DataHandleRegistry, HandleExhausted, HandleRevoked } from '../../src/ports/driven/DataHandle.ts'
import type { AggregateResult, DataHandle } from '../../src/ports/driven/DataHandle.ts'

// ─── shared helpers ───────────────────────────────────────────────────────────

const register = (handle: DataHandle) =>
  Effect.gen(function* () {
    const reg = yield* DataHandleRegistry
    return yield* reg.register(handle)
  })

const get = (id: string) =>
  Effect.gen(function* () {
    const reg = yield* DataHandleRegistry
    return yield* reg.get(id)
  })

// ─── shared contract ─────────────────────────────────────────────────────────

interface HandleFactory {
  // Creates a fresh handle; callers must register it before use.
  readonly makeHandle: () => Effect.Effect<DataHandle>
  // A Node.js script string exercised by runScript tests (FileBackedHandle runs it;
  // InMemoryDataHandle ignores the script and returns its pre-configured result).
  readonly sampleScript: string
}

function runContract(name: string, makeFactory: () => Promise<HandleFactory> | HandleFactory) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<DataHandleRegistry, never>
    let factory: HandleFactory

    beforeEach(async () => {
      factory = await makeFactory()
      rt = ManagedRuntime.make(InMemoryDataHandleRegistry.layer())
    })

    afterEach(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, DataHandleRegistry>) => rt.runPromise(effect)

    it('register + get round-trips the handle', async () => {
      const handle = await run(factory.makeHandle())
      await run(register(handle))
      const fetched = await run(get(handle.id))
      expect(fetched.id).toBe(handle.id)
    })

    it('get returns HandleRevoked for an unknown id', async () => {
      await expect(run(get('nonexistent'))).rejects.toThrow()
    })

    it('fetchShape returns shape data', async () => {
      const handle = await run(factory.makeHandle())
      await run(register(handle))
      const fetched = await run(get(handle.id))
      const shape = await run(
        Effect.gen(function* () {
          return yield* fetched.fetchShape()
        }),
      )
      expect(shape).toHaveProperty('schema')
      expect(shape).toHaveProperty('redactedSample')
    })

    it('isAlive returns true for a live handle', async () => {
      const handle = await run(factory.makeHandle())
      await run(register(handle))
      const fetched = await run(get(handle.id))
      const alive = await run(
        Effect.gen(function* () {
          return yield* fetched.isAlive()
        }),
      )
      expect(alive).toBeTruthy()
    })

    it('revoke marks handle as not alive', async () => {
      const handle = await run(factory.makeHandle())
      await run(register(handle))
      const fetched = await run(get(handle.id))
      await run(
        Effect.gen(function* () {
          return yield* fetched.revoke()
        }),
      )
      const alive = await run(
        Effect.gen(function* () {
          return yield* fetched.isAlive()
        }),
      )
      expect(alive).toBeFalsy()
    })

    it('runScript returns an AggregateResult with all fields', async () => {
      const handle = await run(factory.makeHandle())
      await run(register(handle))
      const fetched = await run(get(handle.id))
      const result: AggregateResult = await run(
        Effect.gen(function* () {
          return yield* fetched.runScript(factory.sampleScript)
        }),
      )
      expect(result.exitCode).toBeTypeOf('number')
      expect(result.stdoutHash).toBeTypeOf('string')
      expect(result.stdoutHash.length).toBeGreaterThan(0)
      expect(result.summary).toBeTypeOf('string')
      expect(result.bitsConsumed).toBeTypeOf('number')
    })

    it('runScript after revoke fails with HandleRevoked', async () => {
      const handle = await run(factory.makeHandle())
      await run(register(handle))
      const fetched = await run(get(handle.id))
      await run(
        Effect.gen(function* () {
          return yield* fetched.revoke()
        }),
      )
      await expect(
        run(
          Effect.gen(function* () {
            return yield* fetched.runScript(factory.sampleScript)
          }),
        ),
      ).rejects.toThrow()
    })
  })
}

// ─── InMemory handle (no subprocess) ─────────────────────────────────────────

const FIXED_RESULT: AggregateResult = {
  bitsConsumed: 64,
  exitCode: 0,
  stdoutHash: 'deadbeef00000000000000000000000000000000000000000000000000000000',
  summary: 'rows: 3',
}

runContract('InMemoryDataHandle', () => ({
  makeHandle: () =>
    Effect.gen(function* () {
      const alive = yield* Ref.make(true)
      const id = randomUUID()
      return {
        fetchShape: () => Effect.succeed({ redactedSample: { row: '...' }, schema: { type: 'csv' } }),
        id,
        isAlive: () => Ref.get(alive),
        revoke: () => Ref.set(alive, false),
        runScript: (_script: string) =>
          Effect.gen(function* () {
            if (!(yield* Ref.get(alive))) {
              return yield* Effect.fail(new HandleRevoked({ handleId: id }))
            }
            return FIXED_RESULT
          }),
      }
    }),
  sampleScript: 'process.stdout.write("ignored")',
}))

// ─── FileBackedHandle (real subprocess) ──────────────────────────────────────

runContract('FileBackedHandle', async () => {
  // Temporary CSV file the handle points at.
  const filePath = join(tmpdir(), `handle-test-${randomUUID()}.csv`)
  await writeFile(filePath, 'id,name\n1,Alice\n2,Bob\n3,Charlie\n', 'utf8')

  return {
    makeHandle: () =>
      FileBackedHandle.create({
        filePath,
        id: randomUUID(),
        redactedSample: { name: '***' },
        schema: { columns: ['id', 'name'] },
      }),
    // Script reads the CSV and writes a JSON summary to stdout.
    sampleScript: [
      "const { readFileSync } = require('node:fs')",
      String.raw`const rows = readFileSync(process.env['DATA_FILE'], 'utf8').trim().split('\n')`,
      'process.stdout.write(JSON.stringify({ row_count: rows.length - 1 }))',
    ].join('; '),
  }
})

// ─── DpFileBackedHandle (DP noise, real subprocess) ──────────────────────────

runContract('DpFileBackedHandle', async () => {
  const filePath = join(tmpdir(), `dp-handle-test-${randomUUID()}.csv`)
  await writeFile(filePath, 'id,name\n1,Alice\n2,Bob\n3,Charlie\n', 'utf8')

  return {
    makeHandle: () =>
      DpFileBackedHandle.create({
        filePath,
        id: randomUUID(),
        redactedSample: { name: '***' },
        schema: { columns: ['id', 'name'] },
      }),
    sampleScript: [
      "const { readFileSync } = require('node:fs')",
      String.raw`const rows = readFileSync(process.env['DATA_FILE'], 'utf8').trim().split('\n')`,
      'process.stdout.write(JSON.stringify({ row_count: rows.length - 1 }))',
    ].join('; '),
  }
})

// ─── FileBackedHandle info-ledger (L1.7) ─────────────────────────────────────

describe('FileBackedHandle info-ledger (L1.7)', () => {
  let filePath: string
  let rt: ManagedRuntime.ManagedRuntime<DataHandleRegistry, never>

  beforeEach(async () => {
    filePath = join(tmpdir(), `handle-info-${randomUUID()}.csv`)
    await writeFile(filePath, 'x\n1\n2\n3\n', 'utf8')
    rt = ManagedRuntime.make(InMemoryDataHandleRegistry.layer())
  })

  afterEach(() => rt.dispose())

  const run = <A>(eff: Effect.Effect<A, unknown, DataHandleRegistry>) => rt.runPromise(eff)

  it('runScript fails with HandleExhausted once info-bit limit is reached (L1.7)', async () => {
    // infoBitLimit = 1 bit forces exhaustion on the first non-empty output.
    const handle = await run(
      FileBackedHandle.create({
        filePath,
        id: randomUUID(),
        infoBitLimit: 1,
      }),
    )
    await run(
      Effect.gen(function* () {
        const reg = yield* DataHandleRegistry
        yield* reg.register(handle)
      }),
    )
    // First call should succeed (output may be empty), or fail with HandleExhausted
    // immediately — either way, by the second call we must see HandleExhausted.
    await run(
      Effect.gen(function* () {
        const reg = yield* DataHandleRegistry
        const h = yield* reg.get(handle.id)
        // Run once — may succeed or exhaust
        yield* h.runScript('process.stdout.write("x")').pipe(Effect.ignore)
        // Second run must be exhausted
        yield* h.runScript('process.stdout.write("y")').pipe(
          Effect.flip,
          Effect.flatMap(e => (e instanceof HandleExhausted ? Effect.void : Effect.die('expected HandleExhausted'))),
        )
      }),
    )
  })

  it('isAlive returns false after info-bit limit is exhausted (L1.7)', async () => {
    const handle = await run(
      FileBackedHandle.create({
        filePath,
        id: randomUUID(),
        infoBitLimit: 1,
      }),
    )
    await run(
      Effect.gen(function* () {
        const reg = yield* DataHandleRegistry
        yield* reg.register(handle)
      }),
    )
    // Exhaust the handle
    await run(
      Effect.gen(function* () {
        const reg = yield* DataHandleRegistry
        const h = yield* reg.get(handle.id)
        yield* h.runScript('process.stdout.write("x")').pipe(Effect.ignore)
        yield* h.runScript('process.stdout.write("y")').pipe(Effect.ignore)
      }),
    )
    const alive = await run(
      Effect.gen(function* () {
        const reg = yield* DataHandleRegistry
        const h = yield* reg.get(handle.id)
        return yield* h.isAlive()
      }),
    )
    expect(alive).toBeFalsy()
  })
})
