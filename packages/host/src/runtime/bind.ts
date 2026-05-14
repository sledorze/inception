import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Layer } from 'effect'
import { SessionError } from '../application/session.ts'
import { FileBackedHandle } from '../adapters/driven/FileBackedHandle.ts'
import { InMemoryDataHandleRegistry } from '../adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'
import { InMemoryPolicyGate } from '../adapters/driven/InMemoryPolicyGate.ts'
import { InMemoryToolRegistry } from '../adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from '../adapters/driven/InMemoryWorkspaceMount.ts'
import { OpenAiCompatLlmProvider } from '../adapters/driven/OpenAiCompatLlmProvider.ts'
import { CliUserGateway } from '../adapters/driving/CliUserGateway.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'

export { GeorgesToolkit }

const __dir = dirname(fileURLToPath(import.meta.url))
const TOOLS_YAML = join(__dir, '../bootstrap', 'tools.yaml')
const AGENT_MD_PATH = join(__dir, '../bootstrap', 'agent.md')
const FIXTURE_PATH = join(__dir, '../bootstrap/fixtures', 'synthetic-001.csv')

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
  'fetch-handle-shape',
  'list-tools',
  'propose-capability',
  'read-workspace',
  'run-script',
  'write-workspace',
]

const eventStoreLayer = InMemoryEventStore.layer

const toolkitLayer = GeorgesToolkitLive.pipe(
  Layer.provide(eventStoreLayer),
  Layer.provide(InMemoryToolRegistry.layerFromYamlFile(TOOLS_YAML)),
  Layer.provide(workspaceMountLayer),
  Layer.provide(dataHandlesLayer),
  Layer.provide(InMemoryPolicyGate.layer(BOOTSTRAP_TOOLS)),
)

// Export both toolkit and EventStore so submitGoal can access the store
export const appLayer = Layer.mergeAll(toolkitLayer, eventStoreLayer)

// Full runtime layer: toolkit + LLM + User gateway (used by main.ts)
export const fullLayer = Layer.mergeAll(appLayer, OpenAiCompatLlmProvider.layer(), CliUserGateway.layer())

export type AppServices = Layer.Success<typeof appLayer>
