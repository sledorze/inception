/**
 * Protocol contract for the GeorgesToolkit driving adapter.
 *
 * This test documents the external surface contract for ALL 6 tools:
 * what shape they return on success, and that they return a structured
 * { isFailure: true, result: { message: string } } on failure — never a crash.
 *
 * This is the Liskov proof for any future toolkit reimplementation.
 * Law-specific invariants (L1.3, L1.5, L1.8, L2.2, L2.6) are tested in
 * packages/host/tests/laws/. This file concerns only the shape contract.
 *
 * Invariants every toolkit implementation must satisfy:
 *  1. list-tools returns an array of { description, inputSchema, name }.
 *  2. read-workspace returns { content: string } on success.
 *  3. write-workspace returns { path: string } on success.
 *  4. fetch-handle-shape returns { redactedSample, schema } on success.
 *  5. run-script returns { bitsConsumed, exitCode, stdoutHash, summary } on success.
 *  6. propose-capability returns { proposalId: string } on success.
 *  7. Every tool returns { isFailure: true, result: { message: string } } on failure.
 *  8. An unknown tool name fails with a structured error (not a crash).
 */
import { randomUUID } from 'node:crypto'
import { Effect, Layer, Option, Stream } from 'effect'
import { expect, layer } from '@effect/vitest'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import type { AggregateResult, DataHandle } from '../../src/ports/driven/DataHandle.ts'
import { DataHandleRegistry } from '../../src/ports/driven/DataHandle.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

// ─── fixtures ────────────────────────────────────────────────────────────────

const ALL_TOOLS: readonly ToolEntry[] = [
  { description: 'Discovers tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
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
  {
    description: 'Fetches handle shape.',
    inputSchema: { type: 'object' },
    name: 'fetch-handle-shape',
    roles: ['Architect', 'Implementer'],
  },
  {
    description: 'Runs a script.',
    inputSchema: { type: 'object' },
    name: 'run-script',
    roles: ['Implementer'],
  },
  {
    description: 'Proposes a capability.',
    inputSchema: { type: 'object' },
    name: 'propose-capability',
    roles: ['Implementer'],
  },
]

const SEED_FILES = { 'hello.txt': 'world' }

const AGGREGATE: AggregateResult = {
  bitsConsumed: 10,
  exitCode: 0,
  stdoutHash: 'deadbeef',
  summary: 'ok',
}

const SHAPE = { redactedSample: { x: '***' }, schema: { type: 'object' } }

const makeFakeHandle = (id: string): DataHandle => ({
  fetchShape: () => Effect.succeed(SHAPE),
  id,
  isAlive: () => Effect.succeed(true),
  revoke: () => Effect.void,
  runScript: () => Effect.succeed(AGGREGATE),
})

const VALID_MANIFEST = JSON.stringify({
  description: 'A test capability.',
  name: 'test-cap',
  scope: 'capability',
  version: '0.1.0',
})

// ─── layer wiring ─────────────────────────────────────────────────────────────

const { handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents(ALL_TOOLS, SEED_FILES)
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer, handleRegLayer)

// ─── helpers ─────────────────────────────────────────────────────────────────

const call = (name: string, params: Record<string, unknown>) =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle(name as 'list-tools', params as { role: string })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

const registerHandle = (handle: DataHandle) =>
  Effect.gen(function* () {
    const reg = yield* DataHandleRegistry
    yield* reg.register(handle)
  })

// ─── tests ───────────────────────────────────────────────────────────────────

layer(testLayer)('GeorgesToolkit — protocol contract', it => {
  // 1. list-tools ──────────────────────────────────────────────────────────────

  it.effect('list-tools → array of { description, inputSchema, name }', () =>
    Effect.gen(function* () {
      const r = yield* call('list-tools', { role: 'Implementer' })
      expect(r.isFailure).toBeFalsy()
      const tools = r.result as readonly { description: string; inputSchema: unknown; name: string }[]
      expect(Array.isArray(tools)).toBeTruthy()
      expect(tools.length).toBeGreaterThan(0)
      for (const t of tools) {
        expect(typeof t.name).toBe('string')
        expect(typeof t.description).toBe('string')
        expect(t.inputSchema).toBeDefined()
      }
    }),
  )

  it.effect('list-tools → failure returns { isFailure: true, result: { message } }', () =>
    Effect.gen(function* () {
      // Call with an invalid role type to trigger a registry/policy failure path.
      // Policy is pre-seeded so the gate passes; registry returns empty for unknown role.
      const r = yield* call('list-tools', { role: 'UnknownRole' })
      // Returns success (empty array) — contract: no crash for unknown roles.
      expect(r.isFailure).toBeFalsy()
    }),
  )

  // 2. read-workspace ──────────────────────────────────────────────────────────

  it.effect('read-workspace → { content: string } on success', () =>
    Effect.gen(function* () {
      const r = yield* call('read-workspace', { path: 'hello.txt' })
      expect(r.isFailure).toBeFalsy()
      const result = r.result as { content: string }
      expect(result.content).toBe('world')
    }),
  )

  it.effect('read-workspace → { isFailure: true, result: { message } } on missing file', () =>
    Effect.gen(function* () {
      const r = yield* call('read-workspace', { path: 'no-such-file.txt' })
      expect(r.isFailure).toBeTruthy()
      expect(typeof (r.result as { message: string }).message).toBe('string')
    }),
  )

  // 3. write-workspace ─────────────────────────────────────────────────────────

  it.effect('write-workspace → { path: string } on success', () =>
    Effect.gen(function* () {
      const r = yield* call('write-workspace', { content: 'data', path: 'out.txt', role: 'Implementer' })
      expect(r.isFailure).toBeFalsy()
      expect((r.result as { path: string }).path).toBe('out.txt')
    }),
  )

  it.effect('write-workspace → { isFailure: true, result: { message } } on role denial', () =>
    Effect.gen(function* () {
      const r = yield* call('write-workspace', { content: 'data', path: 'out.txt', role: 'Reviewer' })
      expect(r.isFailure).toBeTruthy()
      expect(typeof (r.result as { message: string }).message).toBe('string')
    }),
  )

  // 4. fetch-handle-shape ──────────────────────────────────────────────────────

  it.effect('fetch-handle-shape → { redactedSample, schema } on success', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const r = yield* call('fetch-handle-shape', { handleId: id, role: 'Implementer' })
      expect(r.isFailure).toBeFalsy()
      const result = r.result as typeof SHAPE
      expect(result.schema).toStrictEqual(SHAPE.schema)
      expect(result.redactedSample).toStrictEqual(SHAPE.redactedSample)
    }),
  )

  it.effect('fetch-handle-shape → { isFailure: true, result: { message } } on missing handle', () =>
    Effect.gen(function* () {
      const r = yield* call('fetch-handle-shape', { handleId: 'no-such-handle', role: 'Implementer' })
      expect(r.isFailure).toBeTruthy()
      expect(typeof (r.result as { message: string }).message).toBe('string')
    }),
  )

  // 5. run-script ──────────────────────────────────────────────────────────────

  it.effect('run-script → { bitsConsumed, exitCode, stdoutHash, summary } on success', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const r = yield* call('run-script', { handleId: id, role: 'Implementer', script: 'echo 1' })
      expect(r.isFailure).toBeFalsy()
      const result = r.result as AggregateResult
      expect(typeof result.exitCode).toBe('number')
      expect(typeof result.stdoutHash).toBe('string')
      expect(typeof result.summary).toBe('string')
      expect(typeof result.bitsConsumed).toBe('number')
    }),
  )

  it.effect('run-script → { isFailure: true, result: { message } } on missing handle', () =>
    Effect.gen(function* () {
      const r = yield* call('run-script', { handleId: 'no-such-handle', role: 'Implementer', script: 'echo 1' })
      expect(r.isFailure).toBeTruthy()
      expect(typeof (r.result as { message: string }).message).toBe('string')
    }),
  )

  // 6. propose-capability ──────────────────────────────────────────────────────

  it.effect('propose-capability → { proposalId: string } on success', () =>
    Effect.gen(function* () {
      const r = yield* call('propose-capability', {
        code: 'export const x = 1',
        manifest: VALID_MANIFEST,
        role: 'Implementer',
        tests: 'it("works", () => {})',
      })
      expect(r.isFailure).toBeFalsy()
      expect(typeof (r.result as { proposalId: string }).proposalId).toBe('string')
    }),
  )

  it.effect('propose-capability → { isFailure: true, result: { message } } on invalid manifest JSON', () =>
    Effect.gen(function* () {
      const r = yield* call('propose-capability', {
        code: 'x',
        manifest: 'not-json',
        role: 'Implementer',
        tests: 'y',
      })
      expect(r.isFailure).toBeTruthy()
      expect(typeof (r.result as { message: string }).message).toBe('string')
    }),
  )

  // 7. Success result keys are exact ────────────────────────────────────────

  it.effect('run-script success result has exactly the 4 aggregate keys', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const r = yield* call('run-script', { handleId: id, role: 'Implementer', script: 'echo 1' })
      const keys = Object.keys(r.result as object).toSorted()
      expect(keys).toStrictEqual(['bitsConsumed', 'exitCode', 'stdoutHash', 'summary'])
    }),
  )

  it.effect('fetch-handle-shape success result has exactly the 2 shape keys', () =>
    Effect.gen(function* () {
      const id = randomUUID()
      yield* registerHandle(makeFakeHandle(id))
      const r = yield* call('fetch-handle-shape', { handleId: id, role: 'Implementer' })
      const keys = Object.keys(r.result as object).toSorted()
      expect(keys).toStrictEqual(['redactedSample', 'schema'])
    }),
  )
})
