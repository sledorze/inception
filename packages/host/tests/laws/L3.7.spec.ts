/**
 * Law L3.7 — Continuous Risk Supervision.
 * "Each row of the Risk Register (§3.5) is a live signal with a declared threshold,
 *  cadence, and action. A Supervisor computes signals from the event store and
 *  emits trip events. A Monitor independently recomputes a randomly-selected subset;
 *  disagreements trip SupervisorDivergence."
 *
 * If-absent failure mode: risks degrade into a static list, OR the Supervisor
 * becomes a Goodhart target and single point of failure with no out-of-domain check.
 *
 * Tests assert:
 * - R1 trips when HandleExhausted events are present (bootstrap proxy for DP ε-exhaust).
 * - R2 trips when uncorroborated-event ratio exceeds 5 % (bootstrap=true §12).
 * - R5 trips when SandboxEscapeAttempt events are present (threshold > 0, continuous).
 * - SupervisorDivergence event is emitted when Monitor disagrees with Supervisor.
 */
import { randomUUID } from 'node:crypto'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InProcessSupervisor } from '../../src/adapters/driven/InProcessSupervisor.ts'
import { checkSupervisorDivergence } from '../../src/domain/supervisorDivergence.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'
import { Supervisor } from '../../src/ports/driven/Supervisor.ts'
import type { SignalResult } from '../../src/ports/driven/Supervisor.ts'

const testLayer = InProcessSupervisor.layer.pipe(Layer.provideMerge(InMemoryEventStore.layer))

const run = <A>(eff: Effect.Effect<A, unknown, EventStore | Supervisor>) =>
  Effect.runPromise(Effect.provide(eff, testLayer))

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
  payload: {},
  schemaV: 1,
  sessionId,
  storyRef: 'S1',
})

describe('L3.7 — Continuous Risk Supervision', () => {
  it('R1 trips when a HandleExhausted event is present (bootstrap DP proxy)', async () => {
    const sessionId = randomUUID()

    const results = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append({
          actor: 'host',
          correlationId: randomUUID(),
          kind: 'HandleExhausted',
          occurredAt: new Date().toISOString(),
          payload: { bitsConsumed: 80_001, handleId: 'h1' },
          schemaV: 1,
          sessionId,
          storyRef: 'S1',
        })
        const supervisor = yield* Supervisor
        return yield* supervisor.evaluate(sessionId)
      }),
    )

    const r1 = results.find(r => r.riskId === 'R1')
    expect(r1?.tripped).toBeTruthy()
  })

  it('R2 trips when uncorroborated-event ratio exceeds 5 % (L3.7, bootstrap=true)', async () => {
    const sessionId = randomUUID()

    // 1 corroborated + 19 uncorroborated Georges events → ratio = 95 % > 5 %
    const results = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        const pairedId = randomUUID()
        yield* store.append(makeEvent(sessionId, 'host', pairedId, 'ToolResultObserved'))
        yield* store.append(makeEvent(sessionId, 'georges', pairedId, 'ScriptSucceeded'))
        for (let i = 0; i < 19; i++) {
          yield* store.append(makeEvent(sessionId, 'georges', randomUUID(), 'ScriptSucceeded'))
        }
        const supervisor = yield* Supervisor
        return yield* supervisor.evaluate(sessionId)
      }),
    )

    const r2 = results.find(r => r.riskId === 'R2')
    expect(r2?.tripped).toBeTruthy()
    expect(r2?.currentValue).toBeGreaterThan(0.05)
  })

  it('R2 does NOT trip when all Georges events are corroborated', async () => {
    const sessionId = randomUUID()

    const results = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        for (let i = 0; i < 5; i++) {
          const corrId = randomUUID()
          yield* store.append(makeEvent(sessionId, 'host', corrId, 'ToolResultObserved'))
          yield* store.append(makeEvent(sessionId, 'georges', corrId, 'ScriptSucceeded'))
        }
        const supervisor = yield* Supervisor
        return yield* supervisor.evaluate(sessionId)
      }),
    )

    const r2 = results.find(r => r.riskId === 'R2')
    expect(r2?.tripped).toBeFalsy()
  })

  it('R5 trips when a SandboxEscapeAttempt event is present (L3.7, threshold > 0)', async () => {
    const sessionId = randomUUID()

    const results = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(makeEvent(sessionId, 'host', randomUUID(), 'SandboxEscapeAttempt'))
        const supervisor = yield* Supervisor
        return yield* supervisor.evaluate(sessionId)
      }),
    )

    const r5 = results.find(r => r.riskId === 'R5')
    expect(r5?.tripped).toBeTruthy()
    expect(r5?.currentValue).toBeGreaterThan(0)
  })

  it('tripped signals emit SupervisorTrip events (L3.7)', async () => {
    const sessionId = randomUUID()

    const events = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append(makeEvent(sessionId, 'host', randomUUID(), 'SandboxEscapeAttempt'))
        const supervisor = yield* Supervisor
        yield* supervisor.evaluate(sessionId)
        return yield* store.query({ sessionId })
      }),
    )

    const trips = events.filter(e => e.kind === 'SupervisorTrip' && e.actor === 'supervisor')
    expect(trips.length).toBeGreaterThan(0)
  })

  it('SupervisorDivergence is emitted when Monitor disagrees with Supervisor (L3.7, L3.10)', async () => {
    const sessionId = randomUUID()

    const divergences = await run(
      Effect.gen(function* () {
        // Supervisor sees clean session (no escape events).
        const supervisor = yield* Supervisor
        const supervisorResults = yield* supervisor.evaluate(sessionId)

        // Monitor independently sees an escape attempt the Supervisor missed
        // (injected disagreement to test divergence detection).
        const monitorResults: readonly SignalResult[] = supervisorResults.map(r =>
          r.riskId === 'R5' ? { ...r, currentValue: 1, tripped: true } : r,
        )

        return yield* checkSupervisorDivergence(sessionId, supervisorResults, monitorResults)
      }),
    )

    expect(divergences).toContain('R5')
  })

  it('SupervisorDivergence event is stored in EventStore on disagreement', async () => {
    const sessionId = randomUUID()

    const events = await run(
      Effect.gen(function* () {
        const store = yield* EventStore
        const supervisor = yield* Supervisor
        const supervisorResults = yield* supervisor.evaluate(sessionId)

        const monitorResults: readonly SignalResult[] = supervisorResults.map(r =>
          r.riskId === 'R2' ? { ...r, currentValue: 0.9, tripped: true } : r,
        )

        yield* checkSupervisorDivergence(sessionId, supervisorResults, monitorResults)
        return yield* store.query({ sessionId })
      }),
    )

    expect(events.some(e => e.kind === 'SupervisorDivergence' && e.actor === 'monitor')).toBeTruthy()
  })
})
