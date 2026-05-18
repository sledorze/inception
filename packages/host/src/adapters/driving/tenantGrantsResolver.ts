import { Effect, Option, Schema } from 'effect'
import { EventKind, TenantGrantedPayload } from '../../domain/events.ts'
import { TENANTS_SESSION_ID } from '../../domain/tenantRegistry.ts'
import type { EventStoreError, EventStoreQuery, StoredEvent } from '../../ports/driven/EventStore.ts'

/**
 * Builds a tenant-grants resolver from a base-tenantIds lookup and a store query function.
 * Used by FakeAuthGateway and ScryptAuthGateway to fold TenantGranted events into
 * the effective tenantIds for a subject (P63 — event-sourced entitlements).
 */
export const makeTenantGrantsResolver =
  (
    getBaseTenantIds: (subject: string) => readonly string[],
    queryFn: (filter: EventStoreQuery) => Effect.Effect<readonly StoredEvent[], EventStoreError>,
  ) =>
  (subject: string): Effect.Effect<readonly string[], EventStoreError> =>
    Effect.gen(function* () {
      const baseTenantIds = [...getBaseTenantIds(subject)]
      const events = yield* queryFn({ sessionId: TENANTS_SESSION_ID })
      const grantedIds = events
        .filter(e => e.kind === EventKind.TenantGranted)
        .flatMap(e => {
          const p = Schema.decodeUnknownOption(TenantGrantedPayload)(e.payload)
          return Option.isSome(p) && p.value.subject === subject ? [p.value.tenantId] : []
        })
      return [...new Set([...baseTenantIds, ...grantedIds])] as readonly string[]
    })
