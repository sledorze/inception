/**
 * Law L2.1 — Self-Description.
 * "Georges' tool surface is introspectable via list-tools. He may act only on advertised tools."
 *
 * If-absent failure mode: Georges cannot discover what he can do — he either hallucinates
 * tool names and gets runtime errors, or the host silently accepts calls to non-existent tools.
 *
 * Tests:
 *  1. list-tools handler returns descriptors filtered by role.
 *  2. Each descriptor has name, description, and inputSchema.
 *  3. A ToolResultObserved corroborator event is emitted (L1.8 wiring).
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { expect, layer } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const TOOLS: readonly ToolEntry[] = [
  { description: 'Discovers available tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Runs a script in the sandbox.',
    inputSchema: { type: 'object' },
    name: 'run-script',
    roles: ['Implementer'],
  },
  {
    description: 'Reads a file from the workspace.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect', 'Implementer', 'Reviewer'],
  },
]

// Single instances — memoized by Effect so GeorgesToolkitLive and tests share the same store.
const storeLayer = InMemoryEventStore.layer
const registryLayer = InMemoryToolRegistry.layer(TOOLS)

// toolkitLayer satisfies GeorgesToolkitLive's requirements internally.
const toolkitLayer = GeorgesToolkitLive.pipe(Layer.provide(storeLayer), Layer.provide(registryLayer))

// Merge so tests can yield* GeorgesToolkit AND yield* EventStore (same store instance).
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer)

const callListTools = (role: string) =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle('list-tools', { role })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

layer(testLayer)('L2.1 — Self-Description', it => {
  it.effect('list-tools returns an array of ToolDescriptors', () =>
    Effect.gen(function* () {
      const handlerResult = yield* callListTools('Implementer')
      expect(handlerResult.isFailure).toBeFalsy()
      expect(Array.isArray(handlerResult.result)).toBeTruthy()
    }),
  )

  it.effect('each descriptor has name, description, and inputSchema', () =>
    Effect.gen(function* () {
      const handlerResult = yield* callListTools('Implementer')
      const descriptors = handlerResult.result as { description: string; inputSchema: unknown; name: string }[]
      expect(descriptors.length).toBeGreaterThan(0)
      for (const d of descriptors) {
        expect(d.name).toBeTypeOf('string')
        expect(d.description).toBeTypeOf('string')
        expect(d.inputSchema).toBeDefined()
      }
    }),
  )

  it.effect('list-tools result is role-scoped: Implementer sees run-script', () =>
    Effect.gen(function* () {
      const handlerResult = yield* callListTools('Implementer')
      const names = (handlerResult.result as { name: string }[]).map(d => d.name)
      expect(names).toContain('run-script')
    }),
  )

  it.effect('list-tools result is role-scoped: Reviewer does not see run-script', () =>
    Effect.gen(function* () {
      const handlerResult = yield* callListTools('Reviewer')
      const names = (handlerResult.result as { name: string }[]).map(d => d.name)
      expect(names).not.toContain('run-script')
    }),
  )

  it.effect('list-tools emits a ToolResultObserved corroborator event (L1.8 wiring)', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const stream = yield* toolkit.handle('list-tools', { role: 'Implementer' })
      yield* Stream.runDrain(stream)
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      expect(events.some(e => e.kind === 'ToolResultObserved' && e.actor === 'host')).toBeTruthy()
    }),
  )
})
