/**
 * Law L1.1 — Mediation.
 * "Every Georges effect passes through the inner MCP. No backchannels."
 *
 * If-absent failure mode: containment is vacuous — Georges can read/write
 * the workspace directly, bypassing trace and policy enforcement.
 *
 * Tests:
 *  1. read-workspace returns file content via the toolkit.
 *  2. write-workspace + read-workspace round-trip via the toolkit.
 *  3. write-workspace is denied for a role without write permission (L2.2 enforcement).
 *  4. Both tools emit ToolResultObserved corroborator events (L1.8 wiring).
 *  5. write-workspace maps WorkspaceMountError to a structured tool failure.
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { expect, layer } from '@effect/vitest'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { WorkspaceMount } from '../../src/ports/driven/WorkspaceMount.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

const TOOLS: readonly ToolEntry[] = [
  { description: 'Discovers available tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Reads a file from the workspace.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect', 'Implementer', 'Reviewer'],
  },
  {
    description: 'Writes a file to the workspace.',
    inputSchema: { type: 'object' },
    name: 'write-workspace',
    roles: ['Implementer'],
  },
]

const { storeLayer, toolkitLayer, workspaceLayer } = makeToolkitComponents(TOOLS)
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer, workspaceLayer)

const callTool = (name: string, params: Record<string, string>) =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle(name, params)
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

layer(testLayer)('L1.1 — Mediation', it => {
  it.effect('read-workspace returns file content written into the mount', () =>
    Effect.gen(function* () {
      const wm = yield* WorkspaceMount
      yield* wm.write('hello.txt', 'world')
      const result = yield* callTool('read-workspace', { path: 'hello.txt' })
      expect(result.isFailure).toBeFalsy()
      expect((result.result as { content: string }).content).toBe('world')
    }),
  )

  it.effect('write-workspace + read-workspace round-trip via the toolkit', () =>
    Effect.gen(function* () {
      const writeResult = yield* callTool('write-workspace', {
        content: 'via-toolkit',
        path: 'roundtrip.txt',
        role: 'Implementer',
      })
      expect(writeResult.isFailure).toBeFalsy()

      const readResult = yield* callTool('read-workspace', { path: 'roundtrip.txt' })
      expect(readResult.isFailure).toBeFalsy()
      expect((readResult.result as { content: string }).content).toBe('via-toolkit')
    }),
  )

  it.effect('write-workspace is denied for Reviewer (L2.2 mutability enforcement)', () =>
    Effect.gen(function* () {
      const result = yield* callTool('write-workspace', {
        content: 'should-not-land',
        path: 'forbidden.txt',
        role: 'Reviewer',
      })
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain("'Reviewer'")
    }),
  )

  it.effect('read-workspace and write-workspace each emit ToolResultObserved (L1.8)', () =>
    Effect.gen(function* () {
      yield* callTool('write-workspace', { content: 'x', path: 'evt.txt', role: 'Implementer' })
      yield* callTool('read-workspace', { path: 'evt.txt' })

      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const toolNames = events
        .filter(e => e.kind === 'ToolResultObserved' && e.actor === 'host')
        .map(e => (e.payload as { toolName: string }).toolName)

      expect(toolNames).toContain('write-workspace')
      expect(toolNames).toContain('read-workspace')
    }),
  )

  it.effect('read-workspace returns a structured failure for a missing file', () =>
    Effect.gen(function* () {
      const result = yield* callTool('read-workspace', { path: 'does-not-exist.txt' })
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain('read failed')
    }),
  )
})
