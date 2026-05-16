/**
 * Law L1.2 — Containment.
 * "Georges cannot invoke tools absent from the live capability registry."
 *
 * If-absent failure mode: every other Law becomes bypassable — Georges can invoke
 * arbitrary capabilities outside the reviewed surface.
 *
 * Tests:
 *  1. ToolRegistry.get fails with ToolNotFound for an unknown tool (structural rejection).
 *  2. ToolRegistry.listTools returns only registered tools — no extras leak in.
 */
import type { Layer } from 'effect'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { ToolNotFound, ToolRegistry } from '../../src/ports/driven/ToolRegistry.ts'

const TOOLS: readonly ToolEntry[] = [
  { description: 'Lists tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Reads a workspace file.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect'],
  },
]

const registryLayer: Layer.Layer<ToolRegistry> = InMemoryToolRegistry.layer(TOOLS)

describe('L1.2 — Containment', () => {
  it.effect('ToolRegistry.get fails with ToolNotFound for an unknown tool', () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry
      const err = yield* registry.get('nonexistent-tool').pipe(Effect.flip)
      expect(err).toBeInstanceOf(ToolNotFound)
      expect((err as ToolNotFound).name).toBe('nonexistent-tool')
    }).pipe(Effect.provide(registryLayer)),
  )

  it.effect('ToolRegistry.listTools returns only registered tools — no extras leak in', () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry
      const tools = yield* registry.listTools('Architect')
      const names = tools.map(t => t.name)
      expect(names).toContain('read-workspace')
      expect(names).not.toContain('nonexistent-tool')
      expect(names).not.toContain('run-script')
    }).pipe(Effect.provide(registryLayer)),
  )
})
