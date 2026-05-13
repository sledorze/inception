import type { Effect } from 'effect'
import { Context, Schema } from 'effect'
import type { Actor } from '../driven/EventStore.ts'

export interface TraceQuery {
  readonly limit?: number
  readonly sessionId?: string
  readonly storyRef?: string
}

// Full event envelope exposed to the outer observer (Claude / Monitor).
// Mirrors StoredEvent but defined here to keep the driving port independent of storage internals.
export interface ObservedEvent {
  readonly actor: Actor
  readonly contentHash: string
  readonly correlationId: string
  readonly id: string
  readonly kind: string
  readonly occurredAt: string
  readonly payload: unknown
  readonly prevHash: string
  readonly schemaV: number
  readonly sessionId: string
  readonly storyRef: string
}

export class ObservabilityGatewayError extends Schema.TaggedErrorClass<ObservabilityGatewayError>()(
  '@app/host/ObservabilityGatewayError',
  { cause: Schema.Defect },
) {}

export class ObservabilityGateway extends Context.Service<
  ObservabilityGateway,
  {
    readonly query: (q: TraceQuery) => Effect.Effect<readonly ObservedEvent[], ObservabilityGatewayError>
    readonly replay: (
      fromId: string,
      onEvent: (e: ObservedEvent) => Effect.Effect<void>,
    ) => Effect.Effect<void, ObservabilityGatewayError>
  }
>()('@app/host/ObservabilityGateway') {}
