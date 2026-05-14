import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Layer } from 'effect'
import { SessionError } from '../application/session.ts'
import { InMemoryDataHandleRegistry } from '../adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../adapters/driven/InMemoryEventStore.ts'
import { InMemoryPolicyGate } from '../adapters/driven/InMemoryPolicyGate.ts'
import { InMemoryToolRegistry } from '../adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from '../adapters/driven/InMemoryWorkspaceMount.ts'
import { OpenAiCompatLlmProvider } from '../adapters/driven/OpenAiCompatLlmProvider.ts'
import { GeorgesToolkit, GeorgesToolkitLive } from '../adapters/driving/GeorgesToolkit.ts'

export { GeorgesToolkit }

const __dir = dirname(fileURLToPath(import.meta.url))
const TOOLS_YAML = join(__dir, '../bootstrap', 'tools.yaml')
const AGENT_MD_PATH = join(__dir, '../bootstrap', 'agent.md')

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
  Layer.provide(workspaceMountLayer),
  Layer.provide(InMemoryDataHandleRegistry.layer),
  Layer.provide(InMemoryPolicyGate.layer(BOOTSTRAP_TOOLS)),
)

// Full runtime layer: toolkit + storage + LLM provider (used by main.ts)
export const fullLayer = Layer.mergeAll(appLayer, OpenAiCompatLlmProvider.layer())

export type AppServices = Layer.Success<typeof appLayer>
