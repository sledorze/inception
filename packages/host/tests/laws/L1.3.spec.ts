/**
 * Law L1.3 — Code-over-Data.
 * "For every data handle, the inner MCP returns schema + redacted sample only;
 *  bytes return only when the handle's policy permits, never by default."
 *
 * If-absent failure mode: the central security promise of the factory collapses —
 * Georges can reconstruct raw data via iterated aggregate probing.
 *
 * Tests (run-script):
 *  1. run-script returns only AggregateResult fields (exitCode, stdoutHash, summary, bitsConsumed).
 *  2. run-script result contains no raw-data properties beyond the aggregate shape.
 *  3. run-script fails with a structured message when the handle is revoked/missing.
 *  4. run-script is denied for Reviewer (L2.2 enforcement).
 *  5. run-script emits ToolResultObserved corroborator event (L1.8 wiring).
 *
 * Tests (fetch-handle-shape):
 *  6. fetch-handle-shape returns { schema, redactedSample } for a valid handle.
 *  7. fetch-handle-shape result has no extra fields beyond { schema, redactedSample }.
 *  8. fetch-handle-shape fails with a structured message for a missing handle.
 *  9. fetch-handle-shape is denied for Reviewer (L2.2 enforcement).
 * 10. fetch-handle-shape emits ToolResultObserved corroborator event (L1.8 wiring).
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { expect, layer } from '@effect/vitest'
import { randomUUID } from 'node:crypto'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import type { AggregateResult, DataHandle } from '../../src/ports/driven/DataHandle.ts'
import { DataHandleRegistry } from '../../src/ports/driven/DataHandle.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

// ─── fake handle ─────────────────────────────────────────────────────────────

const AGGREGATE: AggregateResult = {
  bitsConsumed: 42,
  exitCode: 0,
  stdoutHash: 'abc123',
  summary: 'count=10',
}

const SHAPE = { redactedSample: { count: '***' }, schema: { type: 'object' } }

const makeFakeHandle = (id: string, result: AggregateResult = AGGREGATE): DataHandle => ({
  fetchShape: () => Effect.succeed(SHAPE),
  id,
  isAlive: () => Effect.succeed(true),
  revoke: () => Effect.void,
  runScript: () => Effect.succeed(result),
})

// ─── TOOLS ───────────────────────────────────────────────────────────────────

const TOOLS: readonly ToolEntry[] = [
  { description: 'Discovers available tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Returns schema + redacted sample for a handle.',
    inputSchema: { type: 'object' },
    name: 'fetch-handle-shape',
    roles: ['Architect', 'Implementer'],
  },
  {
    description: 'Runs a script in the sandbox.',
    inputSchema: { type: 'object' },
    name: 'run-script',
    roles: ['Implementer'],
  },
  {
    description: 'Reads a file.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect', 'Implementer', 'Reviewer'],
  },
  {
    description: 'Writes a file.',
    inputSchema: { type: 'object' },
    name: 'write-workspace',
    roles: ['Implementer'],
  },
]

// ─── layer wiring ─────────────────────────────────────────────────────────────

const { handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS)
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer, handleRegLayer)

// ─── helpers ──────────────────────────────────────────────────────────────────

const callRunScript = (handleId: string, role = 'Implementer') =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle('run-script', { handleId, role, script: 'console.log(1)' })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

const callFetchShape = (handleId: string, role = 'Implementer') =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle('fetch-handle-shape', { handleId, role })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

const registerHandle = (handle: DataHandle) =>
  Effect.gen(function* () {
    const reg = yield* DataHandleRegistry
    yield* reg.register(handle)
  })

// ─── tests ────────────────────────────────────────────────────────────────────

layer(testLayer)('L1.3 — Code-over-Data', it => {
  // run-script ----------------------------------------------------------------

  it.effect('run-script returns only the AggregateResult aggregate shape', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const handlerResult = yield* callRunScript(id)
      expect(handlerResult.isFailure).toBeFalsy()
      const result = handlerResult.result as AggregateResult
      expect(result.exitCode).toBe(0)
      expect(result.stdoutHash).toBe('abc123')
      expect(result.summary).toBe('count=10')
      expect(result.bitsConsumed).toBe(42)
    }),
  )

  it.effect('run-script result has no raw-data fields beyond the aggregate shape', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const handlerResult = yield* callRunScript(id)
      const keys = Object.keys(handlerResult.result as object).toSorted()
      expect(keys).toStrictEqual(['bitsConsumed', 'exitCode', 'stdoutHash', 'summary'])
    }),
  )

  it.effect('run-script returns a structured failure for a missing/revoked handle', () =>
    Effect.gen(function* () {
      const handlerResult = yield* callRunScript('no-such-handle')
      expect(handlerResult.isFailure).toBeTruthy()
      expect((handlerResult.result as { message: string }).message).toContain('revoked')
    }),
  )

  it.effect('run-script is denied for Reviewer (L2.2 mutability enforcement)', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const handlerResult = yield* callRunScript(id, 'Reviewer')
      expect(handlerResult.isFailure).toBeTruthy()
      expect((handlerResult.result as { message: string }).message).toContain('Permission denied')
    }),
  )

  it.effect('run-script emits a ToolResultObserved corroborator event (L1.8 wiring)', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      yield* callRunScript(id)
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      expect(
        events.some(
          e =>
            e.kind === 'ToolResultObserved' &&
            e.actor === 'host' &&
            (e.payload as { toolName: string }).toolName === 'run-script',
        ),
      ).toBeTruthy()
    }),
  )

  // fetch-handle-shape --------------------------------------------------------

  it.effect('fetch-handle-shape returns { schema, redactedSample } for a valid handle', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const handlerResult = yield* callFetchShape(id)
      expect(handlerResult.isFailure).toBeFalsy()
      const result = handlerResult.result as typeof SHAPE
      expect(result.schema).toStrictEqual(SHAPE.schema)
      expect(result.redactedSample).toStrictEqual(SHAPE.redactedSample)
    }),
  )

  it.effect('fetch-handle-shape result has no fields beyond { schema, redactedSample }', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const handlerResult = yield* callFetchShape(id)
      const keys = Object.keys(handlerResult.result as object).toSorted()
      expect(keys).toStrictEqual(['redactedSample', 'schema'])
    }),
  )

  it.effect('fetch-handle-shape returns a structured failure for a missing handle', () =>
    Effect.gen(function* () {
      const handlerResult = yield* callFetchShape('no-such-handle')
      expect(handlerResult.isFailure).toBeTruthy()
      expect((handlerResult.result as { message: string }).message).toContain('revoked')
    }),
  )

  it.effect('fetch-handle-shape is denied for Reviewer (L2.2 enforcement)', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const handlerResult = yield* callFetchShape(id, 'Reviewer')
      expect(handlerResult.isFailure).toBeTruthy()
      expect((handlerResult.result as { message: string }).message).toContain('Permission denied')
    }),
  )

  it.effect('fetch-handle-shape emits a ToolResultObserved corroborator event (L1.8 wiring)', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      yield* callFetchShape(id)
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      expect(
        events.some(
          e =>
            e.kind === 'ToolResultObserved' &&
            e.actor === 'host' &&
            (e.payload as { toolName: string }).toolName === 'fetch-handle-shape',
        ),
      ).toBeTruthy()
    }),
  )
})
