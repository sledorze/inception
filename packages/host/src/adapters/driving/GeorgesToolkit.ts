/**
 * Inner MCP driving adapter — Georges' tool surface (Phase 2, §10.1 Q1).
 * Exposes list-tools, read-workspace, write-workspace backed by ToolRegistry and WorkspaceMount.
 * Emits ToolResultObserved for every call (L1.8 wiring).
 * Laws: L1.1 (every Georges effect passes through inner MCP), L2.1 (self-description),
 *       L2.2 (write-workspace enforces role-scoped mutability).
 */
import { randomUUID } from 'node:crypto'
import { Clock, Effect, Schema } from 'effect'
import { Tool, Toolkit } from 'effect/unstable/ai'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { ToolRegistry } from '../../ports/driven/ToolRegistry.ts'
import { WorkspaceMount } from '../../ports/driven/WorkspaceMount.ts'

const ToolDescriptorSchema = Schema.Struct({
  description: Schema.String,
  inputSchema: Schema.Unknown,
  name: Schema.String,
})

const WorkspaceFailureSchema = Schema.Struct({ message: Schema.String })

export const ListToolsTool = Tool.make('list-tools', {
  description: 'Returns the list of tools available for a given role. Call this first to discover your capabilities.',
  parameters: Schema.Struct({ role: Schema.String }),
  success: Schema.Array(ToolDescriptorSchema),
})

export const ReadWorkspaceTool = Tool.make('read-workspace', {
  description: 'Reads a file from the managed workspace. Returns file contents as a string.',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
  parameters: Schema.Struct({ path: Schema.String }),
  success: Schema.Struct({ content: Schema.String }),
})

export const WriteWorkspaceTool = Tool.make('write-workspace', {
  description: 'Writes content to a file in the managed workspace. Requires a role with write permission.',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
  parameters: Schema.Struct({ content: Schema.String, path: Schema.String, role: Schema.String }),
  success: Schema.Struct({ path: Schema.String }),
})

export const GeorgesToolkit = Toolkit.make(ListToolsTool, ReadWorkspaceTool, WriteWorkspaceTool)

export const GeorgesToolkitLive = GeorgesToolkit.toLayer(
  Effect.gen(function* () {
    const registry = yield* ToolRegistry
    const store = yield* EventStore
    const workspace = yield* WorkspaceMount

    const emitCorroborator = (toolName: string, payload: Record<string, unknown>) =>
      Effect.gen(function* () {
        const ms = yield* Clock.currentTimeMillis
        yield* store
          .append({
            actor: 'host',
            correlationId: randomUUID(),
            kind: 'ToolResultObserved',
            occurredAt: new Date(ms).toISOString(),
            payload: { ...payload, toolName },
            schemaV: 1,
            sessionId: 'bootstrap',
            storyRef: 'S1',
          })
          .pipe(Effect.orDie)
      })

    return GeorgesToolkit.of({
      'list-tools': Effect.fn('GeorgesToolkit.listTools')(function* ({ role }: { role: string }) {
        const tools = yield* registry.listTools(role)
        yield* emitCorroborator('list-tools', { role })
        return tools.map(t => ({ description: t.description, inputSchema: t.inputSchema, name: t.name }))
      }),

      'read-workspace': Effect.fn('GeorgesToolkit.readWorkspace')(function* ({ path }: { path: string }) {
        const content = yield* workspace
          .read(path)
          .pipe(Effect.mapError(e => ({ message: `read failed: ${e.path} — ${String(e.cause)}` })))
        yield* emitCorroborator('read-workspace', { path })
        return { content }
      }),

      'write-workspace': Effect.fn('GeorgesToolkit.writeWorkspace')(function* ({
        content,
        path,
        role,
      }: {
        content: string
        path: string
        role: string
      }) {
        // L2.2: enforce role-scoped mutability before touching the filesystem
        const availableTools = yield* registry.listTools(role)
        if (!availableTools.some(t => t.name === 'write-workspace')) {
          return yield* Effect.fail({
            message: `Permission denied: write-workspace is not in the tool surface for role '${role}'`,
          })
        }
        yield* workspace
          .write(path, content)
          .pipe(Effect.mapError(e => ({ message: `write failed: ${e.path} — ${String(e.cause)}` })))
        yield* emitCorroborator('write-workspace', { path, role })
        return { path }
      }),
    })
  }),
)
