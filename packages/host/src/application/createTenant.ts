import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeCorrelationId, makeSessionId } from '../domain/ids.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export const createTenant = Effect.fn('createTenant')(function* (tenantId: string, name: string) {
  const store = yield* EventStore
  yield* store
    .append({
      actor: 'host',
      // Deterministic correlationId makes this idempotent (same contentHash on re-call).
      correlationId: makeCorrelationId(`tenant-created-${tenantId}`),
      kind: EventKind.TenantCreated,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { name, tenantId },
      schemaV: 1,
      sessionId: makeSessionId('__tenants__'),
      storyRef: 'S12',
      tenantId: '__system__',
    })
    .pipe(Effect.orDie)
})
