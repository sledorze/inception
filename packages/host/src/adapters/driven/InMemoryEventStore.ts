import { Effect, Layer, Random, Ref } from 'effect'
import { computeContentHash, EventStore } from '../../ports/driven/EventStore.ts'
import type { NewEvent, StoredEvent } from '../../ports/driven/EventStore.ts'

export const InMemoryEventStore = {
  layer: Layer.effect(
    EventStore,
    Effect.gen(function* () {
      const store = yield* Ref.make<readonly StoredEvent[]>([])

      return EventStore.of({
        append: (event: NewEvent) =>
          Effect.gen(function* () {
            const events = yield* Ref.get(store)
            const contentHash = computeContentHash(event)
            const existing = events.find(e => e.contentHash === contentHash)
            if (existing !== undefined) {
              return existing
            }
            const sessionEvents = events.filter(e => e.sessionId === event.sessionId)
            const prevHash = sessionEvents.length > 0 ? (sessionEvents.at(-1)?.contentHash ?? 'genesis') : 'genesis'
            const id = yield* Random.nextUUIDv4
            // Mirror SQLite DEFAULT 'default' on tenant_id: events appended without
            // a tenantId (e.g. legacy seeds) are treated as belonging to 'default'.
            const stored: StoredEvent = { ...event, contentHash, id, prevHash, tenantId: event.tenantId ?? 'default' }
            yield* Ref.update(store, es => [...es, stored])
            return stored
          }),

        query: filter =>
          Effect.gen(function* () {
            const events = yield* Ref.get(store)
            let result = [...events]
            if (filter.storyRef !== undefined) {
              result = result.filter(e => e.storyRef === filter.storyRef)
            }
            if (filter.tenantId !== undefined) {
              result = result.filter(e => e.tenantId === filter.tenantId)
            }
            if (filter.sessionId !== undefined) {
              result = result.filter(e => e.sessionId === filter.sessionId)
            }
            if (filter.correlationId !== undefined) {
              result = result.filter(e => e.correlationId === filter.correlationId)
            }
            if (filter.limit !== undefined) {
              result = result.slice(0, filter.limit)
            }
            return result
          }),

        replay: (fromId, onEvent) =>
          Effect.gen(function* () {
            const events = yield* Ref.get(store)
            const startIdx = events.findIndex(e => e.id === fromId)
            if (startIdx === -1) {
              return
            }
            for (const event of events.slice(startIdx)) {
              yield* onEvent(event)
            }
          }),
      })
    }),
  ),
}
