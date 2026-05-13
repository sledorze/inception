/**
 * Inner MCP driving adapter — Georges' tool surface (Phase 2, §10.1 Q1).
 * Exposes list-tools backed by ToolRegistry; emits ToolResultObserved (L1.8 wiring).
 * Laws: L1.1 (every Georges effect passes through inner MCP), L2.1 (self-description).
 */
import { randomUUID } from 'node:crypto'
import { Clock, Effect, Schema } from 'effect'
import { Tool, Toolkit } from 'effect/unstable/ai'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { ToolRegistry } from '../../ports/driven/ToolRegistry.ts'

const ToolDescriptorSchema = Schema.Struct({
  description: Schema.String,
  inputSchema: Schema.Unknown,
  name: Schema.String,
})

export const ListToolsTool = Tool.make('list-tools', {
  description: 'Returns the list of tools available for a given role. Call this first to discover your capabilities.',
  parameters: Schema.Struct({ role: Schema.String }),
  success: Schema.Array(ToolDescriptorSchema),
})

export const GeorgesToolkit = Toolkit.make(ListToolsTool)

export const GeorgesToolkitLive = GeorgesToolkit.toLayer(
  Effect.gen(function* () {
    const registry = yield* ToolRegistry
    const store = yield* EventStore

    return GeorgesToolkit.of({
      'list-tools': Effect.fn('GeorgesToolkit.listTools')(function* ({ role }: { role: string }) {
        const ms = yield* Clock.currentTimeMillis
        const tools = yield* registry.listTools(role)
        yield* store
          .append({
            actor: 'host',
            correlationId: randomUUID(),
            kind: 'ToolResultObserved',
            occurredAt: new Date(ms).toISOString(),
            payload: { role, toolName: 'list-tools' },
            schemaV: 1,
            sessionId: 'bootstrap',
            storyRef: 'S1',
          })
          .pipe(Effect.orDie)
        return tools.map(t => ({ description: t.description, inputSchema: t.inputSchema, name: t.name }))
      }),
    })
  }),
)
