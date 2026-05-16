import type { Effect } from 'effect'
import { Context, Schema } from 'effect'
import type { LoopHealth, PainItem, TodoItem } from '../../domain/loopHealth.ts'
import type { ObservedEvent, TraceQuery } from './ObservabilityGateway.ts'

export const AdminQueryErrorTag = '@app/host/AdminQueryError' as const
export class AdminQueryError extends Schema.TaggedErrorClass<AdminQueryError>()(AdminQueryErrorTag, {
  cause: Schema.Defect,
}) {}

export class AdminQuery extends Context.Service<
  AdminQuery,
  {
    readonly metrics: () => Effect.Effect<LoopHealth, AdminQueryError>
    readonly pain: () => Effect.Effect<readonly PainItem[], AdminQueryError>
    readonly trace: (q: TraceQuery) => Effect.Effect<readonly ObservedEvent[], AdminQueryError>
    readonly work: () => Effect.Effect<readonly TodoItem[], AdminQueryError>
  }
>()('@app/host/ports/driving/AdminQuery') {}
