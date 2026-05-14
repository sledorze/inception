/**
 * Role switching discipline (L2.10).
 *
 * Within a cycle, Georges may switch roles only by emitting a `RoleSwitched` event.
 * This function validates the target role exists, then appends the event. Callers
 * must pass a `correlationId` that will be paired with a Host corroborator event
 * by the inner-MCP (Phase 2) to satisfy L1.8.
 */
import { Clock, Effect } from 'effect'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { EventStoreError } from '../ports/driven/EventStore.ts'
import { RoleRegistry } from '../ports/driven/RoleRegistry.ts'
import type { RoleDescriptor, RoleNotFound } from '../ports/driven/RoleRegistry.ts'

export interface RoleSwitchContext {
  readonly correlationId: string
  readonly sessionId: string
  readonly storyRef: string
}

export const switchRole = (
  fromRole: string,
  toRole: string,
  ctx: RoleSwitchContext,
): Effect.Effect<RoleDescriptor, RoleNotFound | EventStoreError, RoleRegistry | EventStore> =>
  Effect.gen(function* () {
    const registry = yield* RoleRegistry
    const next = yield* registry.getRole(toRole)

    const store = yield* EventStore
    yield* store.append({
      actor: 'host',
      correlationId: ctx.correlationId,
      kind: 'RoleSwitched',
      occurredAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
      payload: {
        from: fromRole,
        roleVersionHash: next.version,
        to: next.name,
      },
      schemaV: 1,
      sessionId: ctx.sessionId,
      storyRef: ctx.storyRef,
    })

    return next
  })
