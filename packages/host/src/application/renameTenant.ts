import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { makeCorrelationId, makeSessionId } from '../domain/ids.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

export const renameTenant = Effect.fn('renameTenant')(function* (tenantId: string, name: string) {
  const store = yield* EventStore
  yield* store
    .append({
      actor: 'host',
      correlationId: makeCorrelationId(`tenant-renamed-${tenantId}-${name}`),
      kind: EventKind.TenantRenamed,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { name, tenantId },
      schemaV: 1,
      sessionId: makeSessionId('__tenants__'),
      storyRef: 'S12',
      tenantId: '__system__',
    })
    .pipe(Effect.orDie)
})
