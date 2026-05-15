import { Config, ConfigProvider, Effect, FileSystem, Layer } from 'effect'
import * as NodeServices from '@effect/platform-node/NodeServices'
import { SessionError } from '../application/session.ts'
import { CapabilityAwareToolRegistry } from '../adapters/driven/CapabilityAwareToolRegistry.ts'
import { FileBackedCapabilityRegistry } from '../adapters/driven/FileBackedCapabilityRegistry.ts'
import { FileBackedHandle } from '../adapters/driven/FileBackedHandle.ts'
import { InMemoryCapabilityRegistry } from '../adapters/driven/InMemoryCapabilityRegistry.ts'
import { InMemoryDataHandleRegistry } from '../adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryPolicyGate } from '../adapters/driven/InMemoryPolicyGate.ts'
import { InMemoryWorkspaceMount } from '../adapters/driven/InMemoryWorkspaceMount.ts'
import { OpenAiCompatLlmProvider } from '../adapters/driven/OpenAiCompatLlmProvider.ts'
import { RecordReplayLlmProvider } from '../adapters/driven/RecordReplayLlmProvider.ts'
import type { RecordReplayMode } from '../adapters/driven/RecordReplayLlmProvider.ts'
import { SqliteEventStore } from '../adapters/driven/SqliteEventStore.ts'
import { CliUserGateway } from '../adapters/driving/CliUserGateway.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'

export { GeorgesToolkit }

// URL-based path resolution avoids node:path imports (P24).
const CASSETTE_DIR = new URL('../../tests/fixtures/llm-cassettes', import.meta.url).pathname
const TOOLS_YAML = new URL('../bootstrap/tools.yaml', import.meta.url).pathname
const AGENT_MD_PATH = new URL('../bootstrap/agent.md', import.meta.url).pathname
const FIXTURE_PATH = new URL('../bootstrap/fixtures/synthetic-001.csv', import.meta.url).pathname
// Capability registry persisted to disk; promoted capabilities survive restarts.
const REGISTRY_PATH = new URL('../../data/capability-registry.json', import.meta.url).pathname
const DATA_DIR = new URL('../../data/', import.meta.url).pathname

// 2.8: seed agent.md into the workspace at boot so Georges can `read-workspace agent.md`
const workspaceMountLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const agentMd = yield* fs.readFileString(AGENT_MD_PATH).pipe(
      Effect.mapError(cause => new SessionError({ cause })),
      Effect.orDie,
    )
    return InMemoryWorkspaceMount.layer({ 'agent.md': agentMd })
  }),
)

// Pre-seed the synthetic-001 fixture handle so Georges can call fetch-handle-shape
// without registering data on the User side (real registration lands in 3.2).
const dataHandlesLayer = Layer.unwrap(
  Effect.gen(function* () {
    const handle = yield* FileBackedHandle.create({
      filePath: FIXTURE_PATH,
      id: 'synthetic-001',
      redactedSample: { id: 'int', value: 'string' },
      schema: { columns: ['id', 'value'] },
    })
    return InMemoryDataHandleRegistry.layer([handle])
  }),
)

const BOOTSTRAP_TOOLS = [
  'call-capability',
  'fetch-handle-shape',
  'list-tools',
  'propose-capability',
  'read-workspace',
  'run-script',
  'write-workspace',
]

const eventStoreLayer = Layer.unwrap(
  Effect.gen(function* () {
    const dbPath = yield* Config.string('EVENT_STORE_PATH').pipe(
      Config.withDefault(new URL('../../data/events.db', import.meta.url).pathname),
    )
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(DATA_DIR, { recursive: true }).pipe(Effect.orDie)
    return SqliteEventStore.layer(dbPath)
  }),
)

// FileBackedCapabilityRegistry persists promoted capabilities across restarts.
// CapabilityAwareToolRegistry merges YAML seed tools + promoted capabilities.
const capabilityRegistryLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(DATA_DIR, { recursive: true }).pipe(Effect.orDie)
    return FileBackedCapabilityRegistry.layer(REGISTRY_PATH)
  }),
)
const toolRegistryLayer = CapabilityAwareToolRegistry.layerFromYamlFile(TOOLS_YAML).pipe(
  Layer.provide(capabilityRegistryLayer),
)

const toolkitLayer = GeorgesToolkitLive.pipe(
  Layer.provide(eventStoreLayer),
  Layer.provide(toolRegistryLayer),
  Layer.provide(workspaceMountLayer),
  Layer.provide(dataHandlesLayer),
  Layer.provide(InMemoryPolicyGate.layer(BOOTSTRAP_TOOLS)),
  Layer.provide(capabilityRegistryLayer),
)

// InMemoryCapabilityRegistry for tests that don't touch the capability flow.
export const InMemoryCapabilityRegistryLayer = InMemoryCapabilityRegistry.layer

export const appLayer = Layer.mergeAll(toolkitLayer, eventStoreLayer, capabilityRegistryLayer).pipe(
  Layer.provide(NodeServices.layer),
)

// LLM_MODE=record|replay → RecordReplayLlmProvider; otherwise → OpenAiCompatLlmProvider (default).
// RecordReplayLlmProvider needs no EventStore; OpenAiCompatLlmProvider needs it for P10 shape alerts.
const llmLayer = Layer.unwrap(
  Effect.gen(function* () {
    const mode = yield* Config.string('LLM_MODE').pipe(Config.withDefault(''))
    if (mode === 'record' || mode === 'replay') {
      return RecordReplayLlmProvider.layer({ cassetteDir: CASSETTE_DIR, mode: mode as RecordReplayMode })
    }
    return OpenAiCompatLlmProvider.layer().pipe(Layer.provide(eventStoreLayer))
  }),
)

// Full runtime layer: toolkit + LLM + User gateway (used by main.ts)
// ConfigProvider.layer is provided last so all sub-layers can read env config.
// Layer.provideMerge(NodeServices) here satisfies FileSystem needs from eventStoreLayer
// and exposes FileSystem so main.ts can use it in rt.runPromise.
export const fullLayer = Layer.mergeAll(appLayer, llmLayer, CliUserGateway.layer()).pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
)

export type AppServices = Layer.Success<typeof appLayer>
