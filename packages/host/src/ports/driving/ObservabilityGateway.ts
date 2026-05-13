import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface TraceQuery {
  readonly storyRef?: string
  readonly sessionId?: string
  readonly limit?: number
}

export interface RawEvent {
  readonly id: string
  readonly kind: string
  readonly occurredAt: string
  readonly payload: unknown
}

export class ObservabilityGatewayError extends Schema.TaggedErrorClass<ObservabilityGatewayError>()(
  '@app/host/ObservabilityGatewayError',
  { cause: Schema.Defect },
) {}

export class ObservabilityGateway extends Context.Service<
  ObservabilityGateway,
  {
    readonly query: (q: TraceQuery) => Effect.Effect<readonly RawEvent[], ObservabilityGatewayError>
    readonly replay: (
      fromId: string,
      onEvent: (e: RawEvent) => Effect.Effect<void>,
    ) => Effect.Effect<void, ObservabilityGatewayError>
  }
>()('@app/host/ObservabilityGateway') {}
