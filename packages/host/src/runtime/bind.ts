import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Layer } from 'effect'
import { InMemoryDataHandleRegistry } from '../adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'
import { InMemoryPolicyGate } from '../adapters/driven/InMemoryPolicyGate.ts'
import { InMemoryToolRegistry } from '../adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from '../adapters/driven/InMemoryWorkspaceMount.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'

export { GeorgesToolkit }

const __dir = dirname(fileURLToPath(import.meta.url))
const TOOLS_YAML = join(__dir, '../bootstrap', 'tools.yaml')

const BOOTSTRAP_TOOLS = [
  'fetch-handle-shape',
  'list-tools',
  'propose-capability',
  'read-workspace',
  'run-script',
  'write-workspace',
]

export const appLayer = GeorgesToolkitLive.pipe(
  Layer.provide(InMemoryEventStore.layer),
  Layer.provide(InMemoryToolRegistry.layerFromYamlFile(TOOLS_YAML)),
  Layer.provide(InMemoryWorkspaceMount.layer()),
  Layer.provide(InMemoryDataHandleRegistry.layer),
  Layer.provide(InMemoryPolicyGate.layer(BOOTSTRAP_TOOLS)),
)

export type AppServices = Layer.Success<typeof appLayer>
