/**
 * Protocol contract test for the Supervisor driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L3.7 (risk signals R1/R2/R5 with bootstrap thresholds).
 */
import { randomUUID } from 'node:crypto'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InProcessSupervisor } from '../../src/adapters/driven/InProcessSupervisor.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent } from '../../src/ports/driven/EventStore.ts'
import { Supervisor } from '../../src/ports/driven/Supervisor.ts'

// ─── helpers ─────────────────────────────────────────────────────────────────

type TestRuntime = ManagedRuntime.ManagedRuntime<Supervisor | EventStore, never>

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

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => TestRuntime) {
  describe(name, () => {
    let rt: TestRuntime

    beforeAll(() => {
      rt = makeLayer()
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, Supervisor | EventStore>) => rt.runPromise(effect)

    it('evaluate returns a result for each implemented signal (R1, R2, R5)', async () => {
      const sessionId = randomUUID()
      const results = await run(
        Effect.gen(function* () {
          const supervisor = yield* Supervisor
          return yield* supervisor.evaluate(sessionId)
        }),
      )
      const riskIds = results.map(r => r.riskId).toSorted()
      expect(riskIds).toEqual(['R1', 'R2', 'R5'])
    })

    it('R2: session with no events has ratio 0 and is NOT tripped', async () => {
      const sessionId = randomUUID()
      const results = await run(
        Effect.gen(function* () {
          const supervisor = yield* Supervisor
          return yield* supervisor.evaluate(sessionId)
        }),
      )
      const r2 = results.find(r => r.riskId === 'R2')
      expect(r2?.tripped).toBeFalsy()
      expect(r2?.currentValue).toBe(0)
    })

    it('R2: fully corroborated session is NOT tripped', async () => {
      const sessionId = randomUUID()
      const corrId = randomUUID()
      const results = await run(
        Effect.gen(function* () {
          const store = yield* EventStore
          yield* store.append(makeEvent(sessionId, 'host', corrId, 'ToolResultObserved'))
          yield* store.append(makeEvent(sessionId, 'georges', corrId, 'ScriptSucceeded'))
          const supervisor = yield* Supervisor
          return yield* supervisor.evaluate(sessionId)
        }),
      )
      const r2 = results.find(r => r.riskId === 'R2')
      expect(r2?.tripped).toBeFalsy()
    })

    it('R5: session with no escape events is NOT tripped', async () => {
      const sessionId = randomUUID()
      const results = await run(
        Effect.gen(function* () {
          const supervisor = yield* Supervisor
          return yield* supervisor.evaluate(sessionId)
        }),
      )
      const r5 = results.find(r => r.riskId === 'R5')
      expect(r5?.tripped).toBeFalsy()
      expect(r5?.currentValue).toBe(0)
    })

    it('R5: session with a SandboxEscapeAttempt event IS tripped', async () => {
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
    })

    it('tripped signal emits a SupervisorTrip event to EventStore', async () => {
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
      expect(events.some(e => e.kind === 'SupervisorTrip' && e.actor === 'supervisor')).toBeTruthy()
    })

    it('each SignalResult has riskId, tripped, currentValue, threshold, sessionId', async () => {
      const sessionId = randomUUID()
      const results = await run(
        Effect.gen(function* () {
          const supervisor = yield* Supervisor
          return yield* supervisor.evaluate(sessionId)
        }),
      )
      for (const result of results) {
        expect(result.riskId).toBeTypeOf('string')
        expect(result.tripped).toBeTypeOf('boolean')
        expect(result.currentValue).toBeTypeOf('number')
        expect(result.threshold).toBeTypeOf('number')
        expect(result.sessionId).toBe(sessionId)
      }
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

const inProcessLayer = InProcessSupervisor.layer.pipe(Layer.provideMerge(InMemoryEventStore.layer))

runContract('InProcessSupervisor', () => ManagedRuntime.make(inProcessLayer))
