import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface StoredEvent {
  readonly id: string
  readonly kind: string
  readonly storyRef: string
  readonly sessionId: string
  readonly correlationId: string
  readonly contentHash: string
  readonly prevHash: string
  readonly schemaV: number
  readonly occurredAt: string
  readonly payload: unknown
}

export type NewEvent = Omit<StoredEvent, 'id'>

export interface EventStoreQuery {
  readonly storyRef?: string
  readonly sessionId?: string
  readonly limit?: number
}

export class EventStoreError extends Schema.TaggedErrorClass<EventStoreError>()('@app/host/EventStoreError', {
  cause: Schema.Defect,
}) {}

export class EventStore extends Context.Service<
  EventStore,
  {
    readonly append: (event: NewEvent) => Effect.Effect<StoredEvent, EventStoreError>
    readonly query: (filter: EventStoreQuery) => Effect.Effect<readonly StoredEvent[], EventStoreError>
    readonly replay: (
      fromId: string,
      onEvent: (e: StoredEvent) => Effect.Effect<void>,
    ) => Effect.Effect<void, EventStoreError>
  }
>()('@app/host/EventStore') {}
