/**
 * Law L2.3 — Quarantine.
 * "Repeated failure on a correlation triggers quarantine: the cycle halts,
 *  the trace surfaces to Claude, no further attempts proceed until Claude releases."
 *
 * If-absent failure mode: tight failure loops burn budget and pollute traces.
 *
 * Tests assert:
 * - SessionQuarantined blocks checkQuarantine.
 * - SessionQuarantined + QuarantineReleased unblocks checkQuarantine.
 * - Sessions with no quarantine events are not blocked.
 * - Quarantine is per-session — other sessions are unaffected.
 */
import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import { describe, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { checkQuarantine, SessionQuarantinedError } from '../../src/application/quarantine.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'

const withStore = <A>(eff: Effect.Effect<A, unknown, EventStore>) => Effect.provide(eff, InMemoryEventStore.layer)

const quarantineEvent = (
  sessionId: string,
  kind: typeof EventKind.SessionQuarantined | typeof EventKind.QuarantineReleased,
): NewEvent => ({
  actor: 'supervisor',
  correlationId: `test-${kind}-${sessionId}`,
  kind,
  occurredAt: new Date().toISOString(),
  payload: {},
  schemaV: 1,
  sessionId,
  storyRef: 'supervision',
})

describe('L2.3 — Quarantine', () => {
  it.effect('session with no quarantine events is not blocked', () =>
    withStore(
      Effect.gen(function* () {
        yield* checkQuarantine(randomUUID())
      }),
    ),
  )

  it.effect('SessionQuarantined blocks the cycle (if-absent: tight loops burn budget)', () =>
    withStore(
      Effect.gen(function* () {
        const sessionId = randomUUID()
        const store = yield* EventStore
        yield* store.append(quarantineEvent(sessionId, EventKind.SessionQuarantined))

        yield* checkQuarantine(sessionId).pipe(
          Effect.flip,
          Effect.flatMap(e =>
            e instanceof SessionQuarantinedError ?
              Effect.void
            : Effect.die(`expected SessionQuarantinedError, got ${String(e)}`),
          ),
        )
      }),
    ),
  )

  it.effect('QuarantineReleased after SessionQuarantined unblocks the cycle', () =>
    withStore(
      Effect.gen(function* () {
        const sessionId = randomUUID()
        const store = yield* EventStore
        yield* store.append(quarantineEvent(sessionId, EventKind.SessionQuarantined))
        yield* store.append(quarantineEvent(sessionId, EventKind.QuarantineReleased))

        yield* checkQuarantine(sessionId)
      }),
    ),
  )

  it.effect('quarantine is per-session — other sessions are unaffected', () =>
    withStore(
      Effect.gen(function* () {
        const quarantinedSession = randomUUID()
        const freeSession = randomUUID()
        const store = yield* EventStore
        yield* store.append(quarantineEvent(quarantinedSession, EventKind.SessionQuarantined))

        yield* checkQuarantine(quarantinedSession).pipe(
          Effect.flip,
          Effect.flatMap(e =>
            e instanceof SessionQuarantinedError ?
              Effect.void
            : Effect.die(`expected SessionQuarantinedError, got ${String(e)}`),
          ),
        )

        yield* checkQuarantine(freeSession)
      }),
    ),
  )
})
