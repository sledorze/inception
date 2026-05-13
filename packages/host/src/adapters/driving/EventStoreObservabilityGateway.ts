import { Effect, Layer } from 'effect'
import { EventStore } from '../../ports/driven/EventStore.ts'
import type { StoredEvent } from '../../ports/driven/EventStore.ts'
import { ObservabilityGateway, ObservabilityGatewayError } from '../../ports/driving/ObservabilityGateway.ts'
import type { ObservedEvent } from '../../ports/driving/ObservabilityGateway.ts'

const toObservedEvent = (e: StoredEvent): ObservedEvent => ({
  actor: e.actor,
  contentHash: e.contentHash,
  correlationId: e.correlationId,
  id: e.id,
  kind: e.kind,
  occurredAt: e.occurredAt,
  payload: e.payload,
  prevHash: e.prevHash,
  schemaV: e.schemaV,
  sessionId: e.sessionId,
  storyRef: e.storyRef,
})

export const EventStoreObservabilityGateway = {
  layer: Layer.effect(
    ObservabilityGateway,
    Effect.gen(function* () {
      const store = yield* EventStore
      return ObservabilityGateway.of({
        query: q =>
          Effect.gen(function* () {
            const events = yield* store
              .query(q)
              .pipe(Effect.mapError(cause => new ObservabilityGatewayError({ cause })))
            return events.map(toObservedEvent)
          }),
        replay: (fromId, onEvent) =>
          Effect.gen(function* () {
            yield* store
              .replay(fromId, e => onEvent(toObservedEvent(e)))
              .pipe(Effect.mapError(cause => new ObservabilityGatewayError({ cause })))
          }),
      })
    }),
  ),
}
