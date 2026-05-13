/**
 * Law L1.8 — Host Corroboration.
 * "Every Georges-asserted claim event must be paired with a Host-emitted corroborator
 *  event (exit code, output hash, sandbox metric) from a non-Georges actor.
 *  Unpaired claims are tagged `uncorroborated` and excluded from fitness scoring."
 *
 * If-absent failure mode: Georges can self-narrate undetected — fitness signals become
 * his self-assessment rather than observed ground truth.
 *
 * This test asserts the corroboration-pairing logic is enforced by findUncorroboratedClaims.
 */
import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { findUncorroboratedClaims } from '../../src/domain/corroboration.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'

const makeEvent = (
  sessionId: string,
  actor: NewEvent['actor'],
  correlationId: string,
  kind = 'ToolResult',
): NewEvent => ({
  actor,
  correlationId,
  kind,
  occurredAt: new Date().toISOString(),
  payload: { result: 'ok' },
  schemaV: 1,
  sessionId,
  storyRef: 'S1',
})

// All operations in a single run() share the same layer instance.
const run = <A>(eff: Effect.Effect<A, unknown, EventStore>) =>
  Effect.runPromise(Effect.provide(eff, InMemoryEventStore.layer))

describe('L1.8 — Host Corroboration', () => {
  it('a Georges claim WITHOUT a host corroborator is returned as uncorroborated', async () => {
    const session = randomUUID()
    const correlationId = randomUUID()

    const uncorroborated = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(makeEvent(session, 'georges', correlationId, 'ScriptSucceeded'))
        return yield* findUncorroboratedClaims(session)
      }),
    )

    expect(uncorroborated.map(e => e.correlationId)).toContain(correlationId)
  })

  it('a Georges claim WITH a matching host corroborator is NOT uncorroborated', async () => {
    const session = randomUUID()
    const correlationId = randomUUID()

    const uncorroborated = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(makeEvent(session, 'host', correlationId, 'ToolResultObserved'))
        yield* store.append(makeEvent(session, 'georges', correlationId, 'ScriptSucceeded'))
        return yield* findUncorroboratedClaims(session)
      }),
    )

    expect(uncorroborated.map(e => e.correlationId)).not.toContain(correlationId)
  })

  it('a host-only event is not treated as an uncorroborated claim', async () => {
    const session = randomUUID()
    const correlationId = randomUUID()

    const uncorroborated = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(makeEvent(session, 'host', correlationId, 'ToolResultObserved'))
        return yield* findUncorroboratedClaims(session)
      }),
    )

    expect(uncorroborated.map(e => e.correlationId)).not.toContain(correlationId)
  })

  it('multiple Georges claims in same session: only unpaired ones are returned', async () => {
    const session = randomUUID()
    const pairedCorrId = randomUUID()
    const unpairedCorrId = randomUUID()

    const uncorroborated = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        // Paired: host observation + Georges claim on same correlationId.
        yield* store.append(makeEvent(session, 'host', pairedCorrId, 'ToolResultObserved'))
        yield* store.append(makeEvent(session, 'georges', pairedCorrId, 'ScriptSucceeded'))
        // Unpaired: Georges claim without host observation.
        yield* store.append(makeEvent(session, 'georges', unpairedCorrId, 'TestPassed'))
        return yield* findUncorroboratedClaims(session)
      }),
    )

    const ids = uncorroborated.map(e => e.correlationId)
    expect(ids).toContain(unpairedCorrId)
    expect(ids).not.toContain(pairedCorrId)
  })
})
