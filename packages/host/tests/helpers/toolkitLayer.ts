import { Layer } from 'effect'
import { InMemoryDataHandleRegistry } from '../../src/adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from '../../src/adapters/driven/InMemoryWorkspaceMount.ts'
import { GeorgesToolkitLive } from '../../src/adapters/driving/GeorgesToolkit.ts'

export const makeToolkitComponents = (tools: readonly ToolEntry[]) => {
  const storeLayer = InMemoryEventStore.layer
  const registryLayer = InMemoryToolRegistry.layer(tools)
  const workspaceLayer = InMemoryWorkspaceMount.layer()
  const handleRegLayer = InMemoryDataHandleRegistry.layer
  const toolkitLayer = GeorgesToolkitLive.pipe(
    Layer.provide(storeLayer),
    Layer.provide(registryLayer),
    Layer.provide(workspaceLayer),
    Layer.provide(handleRegLayer),
  )
  return { handleRegLayer, storeLayer, toolkitLayer, workspaceLayer }
}
