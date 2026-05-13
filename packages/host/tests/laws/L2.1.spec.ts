/**
 * Law L2.1 — Self-Description.
 * "Georges' tool surface is introspectable via list-tools. He may act only on advertised tools."
 *
 * If-absent failure mode: Georges cannot discover what he can do — he either hallucinates
 * tool names and gets runtime errors, or the host silently accepts calls to non-existent tools.
 *
 * This test verifies:
 *  1. list-tools handler returns descriptors filtered by role.
 *  2. Each descriptor has name, description, inputSchema.
 *  3. A ToolResultObserved corroborator event is emitted (L1.8 wiring).
 */
import { Effect, Option, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
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

const run = <A>(eff: Effect.Effect<A, unknown, never>) => Effect.runPromise(eff)

const callListTools = (role: string) =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle('list-tools', { role })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  }).pipe(
    Effect.provide(GeorgesToolkitLive),
    Effect.provide(InMemoryToolRegistry.layer(TOOLS)),
    Effect.provide(InMemoryEventStore.layer),
  )

describe('L2.1 — Self-Description', () => {
  it('list-tools returns an array of ToolDescriptors', async () => {
    const handlerResult = await run(callListTools('Implementer'))
    expect(handlerResult.isFailure).toBeFalsy()
    expect(Array.isArray(handlerResult.result)).toBeTruthy()
  })

  it('each descriptor has name, description, and inputSchema', async () => {
    const handlerResult = await run(callListTools('Implementer'))
    const descriptors = handlerResult.result as { name: string; description: string; inputSchema: unknown }[]
    expect(descriptors.length).toBeGreaterThan(0)
    for (const d of descriptors) {
      expect(d.name).toBeTypeOf('string')
      expect(d.description).toBeTypeOf('string')
      expect(d.inputSchema).toBeDefined()
    }
  })

  it('list-tools result is role-scoped: Implementer sees run-script', async () => {
    const handlerResult = await run(callListTools('Implementer'))
    const names = (handlerResult.result as { name: string }[]).map(d => d.name)
    expect(names).toContain('run-script')
  })

  it('list-tools result is role-scoped: Reviewer does not see run-script', async () => {
    const handlerResult = await run(callListTools('Reviewer'))
    const names = (handlerResult.result as { name: string }[]).map(d => d.name)
    expect(names).not.toContain('run-script')
  })

  it('list-tools emits a ToolResultObserved corroborator event (L1.8 wiring)', async () => {
    const events = await run(
      Effect.gen(function* () {
        const toolkit = yield* GeorgesToolkit
        const stream = yield* toolkit.handle('list-tools', { role: 'Implementer' })
        yield* Stream.runDrain(stream)
        const store = yield* EventStore
        return yield* store.query({ sessionId: 'bootstrap' })
      }).pipe(
        Effect.provide(GeorgesToolkitLive),
        Effect.provide(InMemoryToolRegistry.layer(TOOLS)),
        Effect.provide(InMemoryEventStore.layer),
      ),
    )
    expect(events.some(e => e.kind === 'ToolResultObserved' && e.actor === 'host')).toBeTruthy()
  })
})
