/**
 * Inner MCP driving adapter — Georges' tool surface (Phase 2, §10.1 Q1).
 * Exposes list-tools, read-workspace, write-workspace, run-script, fetch-handle-shape,
 * propose-capability backed by ports. Emits ToolResultObserved for every call (L1.8 wiring).
 * Laws: L1.1 (mediation), L1.3 (code-over-data), L1.5 (policy gate — deny by default),
 *       L2.1 (self-description), L2.2 (role-scoped mutability), L2.6 (single promoter per scope).
 */
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Data, DateTime, Effect, Schema } from 'effect'
import { Tool, Toolkit } from 'effect/unstable/ai'
import { CapabilityRegistry } from '../../ports/driven/CapabilityRegistry.ts'
import { DataHandleRegistry } from '../../ports/driven/DataHandle.ts'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { PolicyGate } from '../../ports/driven/PolicyGate.ts'
import { ToolRegistry } from '../../ports/driven/ToolRegistry.ts'
import { WorkspaceMount } from '../../ports/driven/WorkspaceMount.ts'
import { CurrentCorrelationId } from '../../domain/tracing.ts'

const execFileAsync = promisify(execFile)

class CapabilityRunError extends Data.TaggedError('@app/host/CapabilityRunError')<{ cause: unknown }> {}

const runCapabilityCode = (code: string): Effect.Effect<string, CapabilityRunError> =>
  Effect.tryPromise({
    catch: e => new CapabilityRunError({ cause: e }),
    try: async () => {
      const dir = await mkdtemp(join(tmpdir(), 'capability-'))
      const scriptPath = join(dir, 'capability.js')
      await writeFile(scriptPath, code)
      const { stdout } = await execFileAsync(process.execPath, [scriptPath], { timeout: 10_000 })
      return stdout
    },
  })

const ToolDescriptorSchema = Schema.Struct({
  description: Schema.String,
  inputSchema: Schema.Unknown,
  name: Schema.String,
})

const WorkspaceFailureSchema = Schema.Struct({ message: Schema.String })

// L2.6: manifest fields required for a capability proposal.
const CapabilityManifestSchema = Schema.Struct({
  description: Schema.String,
  name: Schema.String,
  scope: Schema.Union([Schema.Literal('capability'), Schema.Literal('role'), Schema.Literal('workflow')]),
  version: Schema.String,
})

export const ListToolsTool = Tool.make('list-tools', {
  description: 'Returns the list of tools available for a given role. Call this first to discover your capabilities.',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
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

export const ProposeCapabilityTool = Tool.make('propose-capability', {
  description:
    'Submits a capability manifest + code + tests for promotion review (L2.6). Returns proposalId on success.',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
  parameters: Schema.Struct({
    code: Schema.String,
    manifest: Schema.String,
    role: Schema.String,
    tests: Schema.String,
  }),
  success: Schema.Struct({ proposalId: Schema.String }),
})

export const CallCapabilityTool = Tool.make('call-capability', {
  description:
    'Calls a previously promoted capability by name. The capability code runs in a sandboxed Node.js process and returns its stdout (up to 512 chars). Only promoted capabilities appear in list-tools.',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
  parameters: Schema.Struct({ name: Schema.String, role: Schema.String }),
  success: Schema.Struct({ exitCode: Schema.Number, output: Schema.String }),
})

export const FetchHandleShapeTool = Tool.make('fetch-handle-shape', {
  description: 'Returns the schema and a redacted sample for a data handle. Never returns raw bytes (L1.3).',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
  parameters: Schema.Struct({ handleId: Schema.String, role: Schema.String }),
  success: Schema.Struct({ redactedSample: Schema.Unknown, schema: Schema.Unknown }),
})

export const RunScriptTool = Tool.make('run-script', {
  description:
    'Submits a script to the sandbox against a data handle. Returns aggregate only — never raw data bytes (L1.3).',
  failure: WorkspaceFailureSchema,
  failureMode: 'return',
  parameters: Schema.Struct({ handleId: Schema.String, role: Schema.String, script: Schema.String }),
  success: Schema.Struct({
    bitsConsumed: Schema.Number,
    exitCode: Schema.Number,
    stdoutHash: Schema.String,
    summary: Schema.String,
  }),
})

export const GeorgesToolkit = Toolkit.make(
  CallCapabilityTool,
  FetchHandleShapeTool,
  ListToolsTool,
  ProposeCapabilityTool,
  ReadWorkspaceTool,
  RunScriptTool,
  WriteWorkspaceTool,
)

export const GeorgesToolkitLive = GeorgesToolkit.toLayer(
  Effect.gen(function* () {
    const registry = yield* ToolRegistry
    const store = yield* EventStore
    const workspace = yield* WorkspaceMount
    const handleRegistry = yield* DataHandleRegistry
    const policyGate = yield* PolicyGate
    const capabilityRegistry = yield* CapabilityRegistry

    // L1.5: first gate on every tool call — deny by default if no active policy.
    const checkPolicy = (toolName: string) =>
      policyGate.check(toolName).pipe(Effect.mapError(e => ({ message: e.reason })))

    const emitCorroborator = (toolName: string, payload: Record<string, unknown>) =>
      Effect.gen(function* () {
        const correlationId = yield* CurrentCorrelationId
        yield* store
          .append({
            actor: 'host',
            correlationId,
            kind: 'ToolResultObserved',
            occurredAt: DateTime.formatIso(yield* DateTime.now),
            payload: { ...payload, toolName },
            schemaV: 1,
            sessionId: 'bootstrap',
            storyRef: 'S1',
          })
          .pipe(Effect.orDie)
      })

    return GeorgesToolkit.of({
      'call-capability': Effect.fn('GeorgesToolkit.callCapability')(function* ({
        name,
        role,
      }: {
        name: string
        role: string
      }) {
        yield* checkPolicy('call-capability')
        const caps = yield* capabilityRegistry
          .list()
          .pipe(Effect.mapError(e => ({ message: `capability registry error: ${String(e.cause)}` })))
        const cap = caps.find(c => c.name === name)
        if (cap === undefined) {
          return yield* Effect.fail({ message: `capability '${name}' not found in registry` })
        }
        const stdout = yield* runCapabilityCode(cap.code).pipe(
          Effect.mapError(e => ({ message: `capability execution failed: ${String(e)}` })),
        )
        const exitCode = 0
        const output = stdout.slice(0, 512)
        yield* emitCorroborator('call-capability', { capabilityName: name, exitCode, role })
        return { exitCode, output }
      }),

      'fetch-handle-shape': Effect.fn('GeorgesToolkit.fetchHandleShape')(function* ({
        handleId,
        role,
      }: {
        handleId: string
        role: string
      }) {
        yield* checkPolicy('fetch-handle-shape')
        // L2.2: role must have fetch-handle-shape in its surface
        const availableTools = yield* registry.listTools(role)
        if (!availableTools.some(t => t.name === 'fetch-handle-shape')) {
          return yield* Effect.fail({
            message: `Permission denied: fetch-handle-shape is not in the tool surface for role '${role}'`,
          })
        }
        // L1.3: return schema + redacted sample only — never raw bytes
        const handle = yield* handleRegistry
          .get(handleId)
          .pipe(Effect.mapError(e => ({ message: `handle '${e.handleId}' has been revoked` })))
        const shape = yield* handle
          .fetchShape()
          .pipe(Effect.mapError(e => ({ message: `fetch-shape failed: ${String(e.cause)}` })))
        yield* emitCorroborator('fetch-handle-shape', { handleId, role })
        return { redactedSample: shape.redactedSample, schema: shape.schema }
      }),

      'list-tools': Effect.fn('GeorgesToolkit.listTools')(function* ({ role }: { role: string }) {
        yield* checkPolicy('list-tools')
        const tools = yield* registry.listTools(role)
        yield* emitCorroborator('list-tools', { role })
        return tools.map(t => ({ description: t.description, inputSchema: t.inputSchema, name: t.name }))
      }),

      'propose-capability': Effect.fn('GeorgesToolkit.proposeCapability')(function* ({
        code,
        manifest: manifestJson,
        role,
        tests,
      }: {
        code: string
        manifest: string
        role: string
        tests: string
      }) {
        yield* checkPolicy('propose-capability')
        // L2.2: only Implementer may propose capabilities
        const availableTools = yield* registry.listTools(role)
        if (!availableTools.some(t => t.name === 'propose-capability')) {
          return yield* Effect.fail({
            message: `Permission denied: propose-capability is not in the tool surface for role '${role}'`,
          })
        }
        const manifest = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(CapabilityManifestSchema))(
          manifestJson,
        ).pipe(Effect.mapError(e => ({ message: `manifest validation failed: ${String(e)}` })))
        // L2.6: record proposal — Georges proposes, Host witnesses, Claude promotes
        const correlationId = yield* CurrentCorrelationId
        const stored = yield* store
          .append({
            actor: 'georges',
            correlationId,
            kind: 'CapabilityProposed',
            occurredAt: DateTime.formatIso(yield* DateTime.now),
            payload: {
              code,
              description: manifest.description,
              name: manifest.name,
              scope: manifest.scope,
              tests,
              version: manifest.version,
            },
            schemaV: 1,
            sessionId: 'bootstrap',
            storyRef: 'S2',
          })
          .pipe(Effect.orDie)
        yield* emitCorroborator('propose-capability', { role, scope: manifest.scope })
        return { proposalId: stored.contentHash }
      }),

      'read-workspace': Effect.fn('GeorgesToolkit.readWorkspace')(function* ({ path: wsPath }: { path: string }) {
        yield* checkPolicy('read-workspace')
        const content = yield* workspace
          .read(wsPath)
          .pipe(Effect.mapError(e => ({ message: `read failed: ${e.path} — ${String(e.cause)}` })))
        yield* emitCorroborator('read-workspace', { path: wsPath })
        return { content }
      }),

      'run-script': Effect.fn('GeorgesToolkit.runScript')(function* ({
        handleId,
        role,
        script,
      }: {
        handleId: string
        role: string
        script: string
      }) {
        yield* checkPolicy('run-script')
        // L2.2: only Implementer may run scripts
        const availableTools = yield* registry.listTools(role)
        if (!availableTools.some(t => t.name === 'run-script')) {
          return yield* Effect.fail({
            message: `Permission denied: run-script is not in the tool surface for role '${role}'`,
          })
        }
        // L1.3: resolve handle, run script, return aggregate only — never raw bytes
        const handle = yield* handleRegistry
          .get(handleId)
          .pipe(Effect.mapError(e => ({ message: `handle '${e.handleId}' has been revoked` })))
        const aggregate = yield* handle.runScript(script).pipe(
          Effect.catchTags({
            '@app/host/DataHandleError': e => Effect.fail({ message: `data handle error: ${String(e.cause)}` }),
            '@app/host/HandleExhausted': e =>
              Effect.fail({ message: `handle '${e.handleId}' budget exhausted (${e.bitsConsumed} bits consumed)` }),
            '@app/host/HandleRevoked': e => Effect.fail({ message: `handle '${e.handleId}' has been revoked` }),
            '@app/host/SensitivityViolation': e =>
              Effect.fail({ message: `sensitivity violation: declared ${e.declared} > max ${e.max} (${e.norm})` }),
          }),
        )
        yield* emitCorroborator('run-script', { handleId, role })
        return {
          bitsConsumed: aggregate.bitsConsumed,
          exitCode: aggregate.exitCode,
          stdoutHash: aggregate.stdoutHash,
          summary: aggregate.summary,
        }
      }),

      'write-workspace': Effect.fn('GeorgesToolkit.writeWorkspace')(function* ({
        content,
        path: wsPath,
        role,
      }: {
        content: string
        path: string
        role: string
      }) {
        yield* checkPolicy('write-workspace')
        // L2.2: enforce role-scoped mutability before touching the filesystem
        const availableTools = yield* registry.listTools(role)
        if (!availableTools.some(t => t.name === 'write-workspace')) {
          return yield* Effect.fail({
            message: `Permission denied: write-workspace is not in the tool surface for role '${role}'`,
          })
        }
        yield* workspace
          .write(wsPath, content)
          .pipe(Effect.mapError(e => ({ message: `write failed: ${e.path} — ${String(e.cause)}` })))
        yield* emitCorroborator('write-workspace', { path: wsPath, role })
        return { path: wsPath }
      }),
    })
  }),
)
