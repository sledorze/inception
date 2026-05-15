import { Layer } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodeServices from '@effect/platform-node/NodeServices'
import { InMemoryCapabilityRegistry } from '../../src/adapters/driven/InMemoryCapabilityRegistry.ts'
import { InMemoryDataHandleRegistry } from '../../src/adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryPolicyGate } from '../../src/adapters/driven/InMemoryPolicyGate.ts'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from '../../src/adapters/driven/InMemoryWorkspaceMount.ts'
import { GeorgesToolkitLive } from '../../src/adapters/driving/GeorgesToolkit.ts'

export const makeToolkitComponents = (
  tools: readonly ToolEntry[],
  initialFiles: Record<string, string> = {},
  permittedTools?: readonly string[],
) => {
  const storeLayer = InMemoryEventStore.layer
  const registryLayer = InMemoryToolRegistry.layer(tools)
  const workspaceLayer = InMemoryWorkspaceMount.layer(initialFiles)
  const handleRegLayer = InMemoryDataHandleRegistry.layer()
  const policyGateLayer = InMemoryPolicyGate.layer(permittedTools ?? tools.map(t => t.name))
  const capabilityRegistryLayer = InMemoryCapabilityRegistry.layer
  const toolkitLayer = GeorgesToolkitLive.pipe(
    Layer.provide(storeLayer),
    Layer.provide(registryLayer),
    Layer.provide(workspaceLayer),
    Layer.provide(handleRegLayer),
    Layer.provide(policyGateLayer),
    Layer.provide(capabilityRegistryLayer),
    Layer.provide(NodeServices.layer),
  )
  return {
    capabilityRegistryLayer,
    handleRegLayer,
    nodeFileSystemLayer: NodeFileSystem.layer,
    policyGateLayer,
    storeLayer,
    toolkitLayer,
    workspaceLayer,
  }
}
