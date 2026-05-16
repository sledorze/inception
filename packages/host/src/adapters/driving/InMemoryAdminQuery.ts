import { Effect, Layer } from 'effect'
import type { LoopHealth, PainItem, TodoItem } from '../../domain/loopHealth.ts'
import { AdminQuery } from '../../ports/driving/AdminQuery.ts'
import type { ObservedEvent, TraceQuery } from '../../ports/driving/ObservabilityGateway.ts'

export interface InMemoryAdminQuerySeed {
  readonly events?: readonly ObservedEvent[]
  readonly health?: LoopHealth
  readonly pain?: readonly PainItem[]
  readonly work?: readonly TodoItem[]
}

const defaultHealth: LoopHealth = {
  archivedPainItems: 0,
  doneTodoItems: 0,
  eventCount: 0,
  openPainItems: 0,
  openTodoItems: 0,
}

export const InMemoryAdminQuery = {
  layer: (seed: InMemoryAdminQuerySeed = {}) =>
    Layer.succeed(
      AdminQuery,
      AdminQuery.of({
        metrics: () => Effect.succeed(seed.health ?? defaultHealth),
        pain: () => Effect.succeed(seed.pain ?? []),
        trace: (_q: TraceQuery) => Effect.succeed(seed.events ?? []),
        work: () => Effect.succeed(seed.work ?? []),
      }),
    ),
}
