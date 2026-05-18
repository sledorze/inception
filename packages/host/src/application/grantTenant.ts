import { DateTime, Effect, Schema } from 'effect'
import { EventKind } from '../domain/events.ts'
import { SYSTEM_TENANT_ID, TENANTS_SESSION_ID } from '../domain/tenantRegistry.ts'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import { AuthGateway } from '../ports/driving/AuthGateway.ts'
import { listTenants } from './listTenants.ts'

export const TenantNotFoundTag = '@app/host/TenantNotFound' as const
export class TenantNotFound extends Schema.TaggedErrorClass<TenantNotFound>()(TenantNotFoundTag, {
  tenantId: Schema.String,
}) {}

export const grantTenant = Effect.fn('grantTenant')(function* (subject: string, tenantId: string) {
  // P61: existence guard — reject phantom tenantIds before writing any state.
  const tenants = yield* listTenants()
  if (!tenants.some(t => t.id === tenantId)) {
    return yield* new TenantNotFound({ tenantId })
  }

  const auth = yield* AuthGateway
  yield* auth.grantTenant(subject, tenantId)

  const store = yield* EventStore
  const correlationId = yield* CurrentCorrelationId
  yield* store.append({
    actor: 'host',
    correlationId,
    kind: EventKind.TenantGranted,
    occurredAt: DateTime.formatIso(yield* DateTime.now),
    payload: { subject, tenantId },
    schemaV: 1,
    sessionId: TENANTS_SESSION_ID,
    storyRef: 'S12',
    tenantId: SYSTEM_TENANT_ID,
  })
})
