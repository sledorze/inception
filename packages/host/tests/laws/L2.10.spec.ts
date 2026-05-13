/**
 * Law L2.10 — Role Versioning.
 * "Roles are versioned artifacts. Within a cycle, role changes emit RoleSwitched(from, to).
 *  Tool surface and mutability scope are parametrised by the current role; calls outside
 *  scope are rejected."
 *
 * If-absent failure mode: persona drift; behaviours become unattributable; same Georges
 * silently widens his own surface across stages.
 *
 * Tests assert: switchRole emits a correctly-shaped RoleSwitched event, the event carries
 * roleVersionHash, and switching to an unknown role fails with RoleNotFound (no event emitted).
 */
import { randomUUID } from 'node:crypto'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryRoleRegistry } from '../../src/adapters/driven/InMemoryRoleRegistry.ts'
import { switchRole } from '../../src/domain/roleSwitch.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { RoleNotFound } from '../../src/ports/driven/RoleRegistry.ts'

const testLayer = Layer.merge(InMemoryEventStore.layer, InMemoryRoleRegistry.bootstrapLayer)

const run = <A>(
  eff: Effect.Effect<A, unknown, typeof testLayer extends Layer.Layer<infer R, never, never> ? R : never>,
) => Effect.runPromise(Effect.provide(eff, testLayer))

describe('L2.10 — Role Versioning', () => {
  it('switchRole emits a RoleSwitched event to the EventStore', async () => {
    const sessionId = randomUUID()
    const correlationId = randomUUID()

    const events = await run(
      Effect.gen(function* () {
        yield* switchRole('Architect', 'Implementer', {
          correlationId,
          sessionId,
          storyRef: 'S1',
        })
        const store = yield* EventStore
        return yield* store.query({ sessionId })
      }),
    )

    expect(events.some(e => e.kind === 'RoleSwitched')).toBeTruthy()
  })

  it('the RoleSwitched event carries from, to, and roleVersionHash', async () => {
    const sessionId = randomUUID()
    const correlationId = randomUUID()

    const events = await run(
      Effect.gen(function* () {
        yield* switchRole('Architect', 'Implementer', {
          correlationId,
          sessionId,
          storyRef: 'S1',
        })
        const store = yield* EventStore
        return yield* store.query({ sessionId })
      }),
    )

    const switched = events.find(e => e.kind === 'RoleSwitched')
    expect(switched).toBeDefined()
    const payload = switched?.payload as Record<string, unknown>
    expect(payload['from']).toBe('Architect')
    expect(payload['to']).toBe('Implementer')
    expect(payload['roleVersionHash']).toBeTypeOf('string')
  })

  it('switchRole to an unknown role fails with RoleNotFound and emits no event', async () => {
    const sessionId = randomUUID()
    const correlationId = randomUUID()

    const [error, events] = await run(
      Effect.gen(function* () {
        const result = yield* switchRole('Architect', 'NoSuchRole', {
          correlationId,
          sessionId,
          storyRef: 'S1',
        }).pipe(Effect.flip)
        const store = yield* EventStore
        const stored = yield* store.query({ sessionId })
        return [result, stored] as const
      }),
    )

    expect(error instanceof RoleNotFound).toBeTruthy()
    expect((events as readonly unknown[]).length).toBe(0)
  })

  it('switchRole uses the target role version hash from the registry', async () => {
    const sessionId = randomUUID()
    const correlationId = randomUUID()

    const [descriptor, event] = await run(
      Effect.gen(function* () {
        const role = yield* switchRole('Reviewer', 'Implementer', {
          correlationId,
          sessionId,
          storyRef: 'S1',
        })
        const store = yield* EventStore
        const events = yield* store.query({ sessionId })
        const switched = events.find(e => e.kind === 'RoleSwitched')
        return [role, switched] as const
      }),
    )

    const payload = (event as { payload: Record<string, unknown> } | undefined)?.payload
    expect(payload?.['roleVersionHash']).toBe((descriptor as { version: string }).version)
  })
})
