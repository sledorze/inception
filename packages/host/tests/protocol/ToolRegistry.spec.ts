/**
 * Protocol contract test for the ToolRegistry driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.1 (self-description + ToolNotFound), L2.10 (role-scoped tool surface), L2.14 (port contract).
 */
import { fileURLToPath } from 'node:url'
import { Effect, Layer, ManagedRuntime } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { ToolNotFound, ToolRegistry } from '../../src/ports/driven/ToolRegistry.ts'
import type { ToolDescriptor } from '../../src/ports/driven/ToolRegistry.ts'

// ─── fixtures ────────────────────────────────────────────────────────────────

const TOOLS: readonly ToolEntry[] = [
  {
    description: 'Lists available tools.',
    inputSchema: { type: 'object' },
    name: 'list-tools',
    roles: [],
  },
  {
    description: 'Runs a script in the sandbox.',
    inputSchema: { type: 'object' },
    name: 'run-script',
    roles: ['Implementer'],
  },
  {
    description: 'Reads a workspace file.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect', 'Implementer', 'Reviewer'],
  },
]

// Path to the bootstrap tools.yaml used by the YAML-file adapter.
const TOOLS_YAML_PATH = fileURLToPath(new URL('../../src/bootstrap/tools.yaml', import.meta.url))

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => ManagedRuntime.ManagedRuntime<ToolRegistry, never>) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<ToolRegistry, never>

    beforeAll(() => {
      rt = makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, ToolRegistry>) => rt.runPromise(effect)

    it('listTools returns an array of ToolDescriptors', async () => {
      const tools: readonly ToolDescriptor[] = await run(
        Effect.gen(function* () {
          const registry = yield* ToolRegistry
          return yield* registry.listTools('Implementer')
        }),
      )
      expect(Array.isArray(tools)).toBeTruthy()
    })

    it('listTools result has name and description on each entry', async () => {
      const tools = await run(
        Effect.gen(function* () {
          const registry = yield* ToolRegistry
          return yield* registry.listTools('Implementer')
        }),
      )
      for (const t of tools) {
        expect(t.name).toBeTypeOf('string')
        expect(t.description).toBeTypeOf('string')
      }
    })

    it('listTools is role-scoped: Implementer sees run-script (L2.10)', async () => {
      const tools = await run(
        Effect.gen(function* () {
          const registry = yield* ToolRegistry
          return yield* registry.listTools('Implementer')
        }),
      )
      const names = tools.map(t => t.name)
      expect(names).toContain('run-script')
    })

    it('listTools is role-scoped: Reviewer does not see run-script (L2.10)', async () => {
      const tools = await run(
        Effect.gen(function* () {
          const registry = yield* ToolRegistry
          return yield* registry.listTools('Reviewer')
        }),
      )
      const names = tools.map(t => t.name)
      expect(names).not.toContain('run-script')
    })

    it('listTools includes tools with empty roles for any role (L2.10)', async () => {
      const [toolsArch, toolsImpl, toolsReview] = await Promise.all([
        run(
          Effect.gen(function* () {
            const registry = yield* ToolRegistry
            return yield* registry.listTools('Architect')
          }),
        ),
        run(
          Effect.gen(function* () {
            const registry = yield* ToolRegistry
            return yield* registry.listTools('Implementer')
          }),
        ),
        run(
          Effect.gen(function* () {
            const registry = yield* ToolRegistry
            return yield* registry.listTools('Reviewer')
          }),
        ),
      ])
      for (const tools of [toolsArch, toolsImpl, toolsReview]) {
        expect(tools.map(t => t.name)).toContain('list-tools')
      }
    })

    it('get returns a ToolDescriptor for a known tool', async () => {
      const tool = await run(
        Effect.gen(function* () {
          const registry = yield* ToolRegistry
          return yield* registry.get('list-tools')
        }),
      )
      expect(tool.name).toBe('list-tools')
      expect(tool.description).toBeTypeOf('string')
    })

    it('get returns ToolNotFound for an unknown tool name (L2.1)', async () => {
      const effect = Effect.gen(function* () {
        const registry = yield* ToolRegistry
        return yield* registry.get('no-such-tool')
      })
      await expect(run(effect)).rejects.toSatisfy((e: unknown) => e instanceof ToolNotFound)
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryToolRegistry (static entries)', () => ManagedRuntime.make(InMemoryToolRegistry.layer(TOOLS)))

runContract('InMemoryToolRegistry (YAML file bootstrap)', () =>
  ManagedRuntime.make(
    InMemoryToolRegistry.layerFromYamlFile(TOOLS_YAML_PATH).pipe(Layer.provide(NodeFileSystem.layer)),
  ),
)
