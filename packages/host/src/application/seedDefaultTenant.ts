/**
 * Seeds the default tenant on every boot (idempotent).
 * Uses a deterministic correlationId so the append is a no-op if already present.
 * Pattern: deleteSession.ts idempotent seed (correlationId === deterministic key).
 */
import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeCorrelationId, makeSessionId } from '../domain/ids.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export const seedDefaultTenant = Effect.fn('seedDefaultTenant')(function* () {
  const store = yield* EventStore
  yield* store
    .append({
      actor: 'host',
      correlationId: makeCorrelationId('default'),
      kind: EventKind.TenantCreated,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { name: 'Default', tenantId: 'default' },
      schemaV: 1,
      sessionId: makeSessionId('__tenants__'),
      storyRef: 'S12',
      tenantId: '__system__',
    })
    .pipe(Effect.orDie)
})
