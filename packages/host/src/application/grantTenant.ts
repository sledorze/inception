import { DateTime, Effect, Option, Schema } from 'effect'
import { EventKind, TenantGrantedPayload } from '../domain/events.ts'
import { SYSTEM_TENANT_ID, TENANTS_SESSION_ID } from '../domain/tenantRegistry.ts'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import { listTenants } from './listTenants.ts'

export const TenantNotFoundTag = '@app/host/TenantNotFound' as const
class TenantNotFound extends Schema.TaggedErrorClass<TenantNotFound>()(TenantNotFoundTag, {
  tenantId: Schema.String,
}) {}

export const grantTenant = Effect.fn('grantTenant')(function* (subject: string, tenantId: string) {
  // P61: existence guard — reject phantom tenantIds before writing any state.
  const tenants = yield* listTenants()
  if (!tenants.some(t => t.id === tenantId)) {
    return yield* new TenantNotFound({ tenantId })
  }

  const store = yield* EventStore

  // Idempotency: skip append if this subject was already granted access to this tenant.
  const existing = yield* store.query({ sessionId: TENANTS_SESSION_ID })
  const alreadyGranted = existing
    .filter(e => e.kind === EventKind.TenantGranted)
    .some(e => {
      const p = Schema.decodeUnknownOption(TenantGrantedPayload)(e.payload)
      return Option.isSome(p) && p.value.subject === subject && p.value.tenantId === tenantId
    })
  if (alreadyGranted) {
    return
  }

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
