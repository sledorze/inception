import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Effect, Layer } from 'effect'
import { SessionError } from '../application/session.ts'
import { CapabilityAwareToolRegistry } from '../adapters/driven/CapabilityAwareToolRegistry.ts'
import { FileBackedCapabilityRegistry } from '../adapters/driven/FileBackedCapabilityRegistry.ts'
import { FileBackedHandle } from '../adapters/driven/FileBackedHandle.ts'
import { InMemoryCapabilityRegistry } from '../adapters/driven/InMemoryCapabilityRegistry.ts'
import { InMemoryDataHandleRegistry } from '../adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryPolicyGate } from '../adapters/driven/InMemoryPolicyGate.ts'
import { InMemoryWorkspaceMount } from '../adapters/driven/InMemoryWorkspaceMount.ts'
import { OpenAiCompatLlmProvider } from '../adapters/driven/OpenAiCompatLlmProvider.ts'
import { SqliteEventStore } from '../adapters/driven/SqliteEventStore.ts'
import { CliUserGateway } from '../adapters/driving/CliUserGateway.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'

export { GeorgesToolkit }

const __dir = import.meta.dirname
const DB_PATH = process.env['EVENT_STORE_PATH'] ?? join(__dir, '..', '..', 'data', 'events.db')
mkdirSync(dirname(DB_PATH), { recursive: true })
const TOOLS_YAML = join(__dir, '../bootstrap', 'tools.yaml')
const AGENT_MD_PATH = join(__dir, '../bootstrap', 'agent.md')
const FIXTURE_PATH = join(__dir, '../bootstrap/fixtures', 'synthetic-001.csv')
// Capability registry persisted to disk; promoted capabilities survive restarts.
const REGISTRY_PATH = join(__dir, '..', '..', 'data', 'capability-registry.json')
mkdirSync(dirname(REGISTRY_PATH), { recursive: true })

// 2.8: seed agent.md into the workspace at boot so Georges can `read-workspace agent.md`
const workspaceMountLayer = Layer.unwrap(
  Effect.gen(function* () {
    const agentMd = yield* Effect.tryPromise({
      catch: cause => new SessionError({ cause }),
      try: () => readFile(AGENT_MD_PATH, 'utf8'),
    }).pipe(Effect.orDie)
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

const eventStoreLayer = SqliteEventStore.layer(DB_PATH)

// FileBackedCapabilityRegistry persists promoted capabilities across restarts.
// CapabilityAwareToolRegistry merges YAML seed tools + promoted capabilities.
const capabilityRegistryLayer = FileBackedCapabilityRegistry.layer(REGISTRY_PATH)
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

export const appLayer = Layer.mergeAll(toolkitLayer, eventStoreLayer, capabilityRegistryLayer)

// Full runtime layer: toolkit + LLM + User gateway (used by main.ts)
export const fullLayer = Layer.mergeAll(appLayer, OpenAiCompatLlmProvider.layer(), CliUserGateway.layer())

export type AppServices = Layer.Success<typeof appLayer>
