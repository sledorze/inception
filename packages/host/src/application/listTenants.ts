/**
 * Tenant registry projection — folds TenantCreated/TenantRenamed events into
 * the current tenant list. Stream is stored on the reserved session
 * `sessionId='__tenants__'` in the `__system__` tenant (L1.9 §13).
 */
import { Effect, Schema } from 'effect'
import { TenantCreatedPayload, TenantRenamedPayload, EventKind } from '../domain/events.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export interface Tenant {
  readonly id: string
  readonly name: string
}

export const listTenants = Effect.fn('listTenants')(function* () {
  const store = yield* EventStore
  const events = yield* store.query({ sessionId: '__tenants__', tenantId: '__system__' })

  const tenants = new Map<string, Tenant>()

  for (const event of events) {
    if (event.kind === EventKind.TenantCreated) {
      const p = yield* Schema.decodeUnknownEffect(TenantCreatedPayload)(event.payload).pipe(Effect.orDie)
      tenants.set(p.tenantId, { id: p.tenantId, name: p.name })
    } else if (event.kind === EventKind.TenantRenamed) {
      const p = yield* Schema.decodeUnknownEffect(TenantRenamedPayload)(event.payload).pipe(Effect.orDie)
      const existing = tenants.get(p.tenantId)
      if (existing !== undefined) {
        tenants.set(p.tenantId, { ...existing, name: p.name })
      }
    }
  }

  return [...tenants.values()]
})
