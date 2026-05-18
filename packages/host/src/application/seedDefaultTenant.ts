/**
 * Seeds the default tenant on every boot (idempotent).
 * Uses a deterministic correlationId so the append is a no-op if already present.
 * Pattern: deleteSession.ts idempotent seed (correlationId === deterministic key).
 */
import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeCorrelationId } from '../domain/ids.ts'
import { SYSTEM_TENANT_ID, TENANTS_SESSION_ID } from '../domain/tenantRegistry.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export const seedDefaultTenant = Effect.fn('seedDefaultTenant')(function* () {
  const store = yield* EventStore
  yield* store.append({
    actor: 'host',
    correlationId: makeCorrelationId('default'),
    kind: EventKind.TenantCreated,
    occurredAt: DateTime.formatIso(yield* DateTime.now),
    payload: { name: 'Default', tenantId: 'default', v: 1 as const },
    schemaV: 1,
    sessionId: TENANTS_SESSION_ID,
    storyRef: 'S12',
    tenantId: SYSTEM_TENANT_ID,
  })
})
