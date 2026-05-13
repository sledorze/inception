import type { Layer } from 'effect'

import type { ContentStore } from '../ports/driven/ContentStore.ts'
import type { DataHandleRegistry } from '../ports/driven/DataHandle.ts'
import type { EventStore } from '../ports/driven/EventStore.ts'
import type { LlmProvider } from '../ports/driven/LlmProvider.ts'
import type { SandboxExecutor } from '../ports/driven/SandboxExecutor.ts'
import type { ToolRegistry } from '../ports/driven/ToolRegistry.ts'
import type { WorkspaceMount } from '../ports/driven/WorkspaceMount.ts'
import type { ObservabilityGateway } from '../ports/driving/ObservabilityGateway.ts'
import type { UserGateway } from '../ports/driving/UserGateway.ts'

export type AppServices =
  | UserGateway
  | ObservabilityGateway
  | EventStore
  | LlmProvider
  | DataHandleRegistry
  | ToolRegistry
  | WorkspaceMount
  | SandboxExecutor
  | ContentStore

export type AppLayer = Layer.Layer<AppServices>
