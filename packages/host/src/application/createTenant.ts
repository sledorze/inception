import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeCorrelationId } from '../domain/ids.ts'
import { SYSTEM_TENANT_ID, TENANTS_SESSION_ID } from '../domain/tenantRegistry.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export const createTenant = Effect.fn('createTenant')(function* (tenantId: string, name: string) {
  const store = yield* EventStore
  yield* store.append({
    actor: 'host',
    // Deterministic correlationId makes this idempotent (same contentHash on re-call).
    correlationId: makeCorrelationId(`tenant-created-${tenantId}`),
    kind: EventKind.TenantCreated,
    occurredAt: DateTime.formatIso(yield* DateTime.now),
    payload: { name, tenantId, v: 1 as const },
    schemaV: 1,
    sessionId: TENANTS_SESSION_ID,
    storyRef: 'S12',
    tenantId: SYSTEM_TENANT_ID,
  })
})
