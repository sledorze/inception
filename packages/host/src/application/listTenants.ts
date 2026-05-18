/**
 * Tenant registry projection — folds TenantCreated/TenantRenamed events into
 * the current tenant list. Stream is stored on the reserved session
 * `sessionId='__tenants__'` in the `__system__` tenant (L1.9 §13).
 */
import { Effect, Schema } from 'effect'
import { TenantCreatedPayload, TenantRenamedPayload, EventKind } from '../domain/events.ts'
import { SYSTEM_TENANT_ID, TENANTS_SESSION_ID } from '../domain/tenantRegistry.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export interface Tenant {
  readonly id: string
  readonly name: string
}

export const listTenants = Effect.fn('listTenants')(function* () {
  const store = yield* EventStore
  const events = yield* store.query({ sessionId: TENANTS_SESSION_ID, tenantId: SYSTEM_TENANT_ID })

  const tenants = new Map<string, Tenant>()

  for (const event of events) {
    if (event.kind === EventKind.TenantCreated) {
      const p = yield* Schema.decodeUnknownEffect(TenantCreatedPayload)(event.payload).pipe(Effect.orDie)
      // Skip events with an unrecognised schema version (future-compat guard).
      if (p.v !== undefined && p.v !== 1) {
        yield* Effect.logWarning(`listTenants: skipping TenantCreated with unknown v=${String(p.v)}`)
        continue
      }
      tenants.set(p.tenantId, { id: p.tenantId, name: p.name })
    } else if (event.kind === EventKind.TenantRenamed) {
      const p = yield* Schema.decodeUnknownEffect(TenantRenamedPayload)(event.payload).pipe(Effect.orDie)
      if (p.v !== undefined && p.v !== 1) {
        yield* Effect.logWarning(`listTenants: skipping TenantRenamed with unknown v=${String(p.v)}`)
        continue
      }
      const existing = tenants.get(p.tenantId)
      if (existing !== undefined) {
        tenants.set(p.tenantId, { ...existing, name: p.name })
      }
    }
  }

  return [...tenants.values()]
})
