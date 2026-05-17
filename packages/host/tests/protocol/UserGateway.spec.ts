/**
 * Protocol contract test for the UserGateway driving port.
 * Parametrised over all bound backing adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), §10.1 Q4 (User gateway bootstrap).
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Layer } from 'effect'
import { Effect, Fiber, ManagedRuntime, MutableRef } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { CliUserGateway } from '../../src/adapters/driving/CliUserGateway.ts'
import { InMemoryUserGateway } from '../../src/adapters/driving/InMemoryUserGateway.ts'
import type { GoalSubmission } from '../../src/ports/driving/UserGateway.ts'
import { UserGateway } from '../../src/ports/driving/UserGateway.ts'

// ─── helpers ─────────────────────────────────────────────────────────────────

const getFreePort = () =>
  new Promise<number>(resolve => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port
      srv.close(() => resolve(port))
    })
  })

// POST with retry so the server has time to bind before the first attempt.
const postGoalHttp = async (port: number, goal: GoalSubmission): Promise<void> => {
  const maxAttempts = 20
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/goals`, {
        body: JSON.stringify(goal),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (res.ok) {
        return
      }
      throw new Error(`HTTP ${res.status}`)
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error
      }
      await new Promise<void>(r => {
        setTimeout(r, 25)
      })
    }
  }
}

const listen = (onGoal: (s: GoalSubmission) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    const gw = yield* UserGateway
    return yield* gw.listen(onGoal)
  })

// ─── shared contract ─────────────────────────────────────────────────────────

type TestLayer = Layer.Layer<UserGateway>

interface TestHarness {
  readonly layer: TestLayer
  readonly postGoal: (goal: GoalSubmission) => Promise<void>
}

// makeHarness receives the goals expected in this test run, so InMemory can
// pre-load them; CLI-backed harnesses ignore the list and receive via HTTP.
type HarnessFactory = (goals: readonly GoalSubmission[]) => Promise<TestHarness> | TestHarness

function runContract(name: string, factory: HarnessFactory) {
  describe(name, () => {
    // Each test creates a fresh runtime scoped to its own goal set.
    const withHarness = async (
      goals: readonly GoalSubmission[],
      fn: (h: TestHarness, run: <A>(eff: Effect.Effect<A, unknown, UserGateway>) => Promise<A>) => Promise<void>,
    ) => {
      const harness = await factory(goals)
      const rt = ManagedRuntime.make(harness.layer)
      try {
        await fn(harness, eff => rt.runPromise(eff))
      } finally {
        await rt.dispose()
      }
    }

    it('listen calls onGoal for each submitted goal', async () => {
      const received: GoalSubmission[] = []
      const goal: GoalSubmission = { goal: 'analyse dataset', handleId: 'h1' }

      await withHarness([goal], async (harness, run) => {
        await run(
          Effect.gen(function* () {
            const fiber = yield* Effect.forkChild(listen(sub => Effect.sync(() => received.push(sub))))
            yield* Effect.promise(() => harness.postGoal(goal))
            yield* Effect.sleep('200 millis')
            yield* Fiber.interrupt(fiber)
          }),
        )
      })

      expect(received).toHaveLength(1)
      expect(received.at(0)).toEqual(goal)
    })

    it('goal fields pass through without mutation', async () => {
      const received: GoalSubmission[] = []
      const goal: GoalSubmission = { goal: 'summarise results', handleId: 'hx' }

      await withHarness([goal], async (harness, run) => {
        await run(
          Effect.gen(function* () {
            const fiber = yield* Effect.forkChild(listen(sub => Effect.sync(() => received.push(sub))))
            yield* Effect.promise(() => harness.postGoal(goal))
            yield* Effect.sleep('200 millis')
            yield* Fiber.interrupt(fiber)
          }),
        )
      })

      expect(received.at(0)?.goal).toBe('summarise results')
      expect(received.at(0)?.handleId).toBe('hx')
    })

    it('respond completes without error', async () => {
      await withHarness([], async (_harness, run) => {
        await run(
          Effect.gen(function* () {
            const gw = yield* UserGateway
            yield* gw.respond('cid-1', 'the answer', 'session-1')
          }),
        )
      })
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryUserGateway', goals => ({
  layer: InMemoryUserGateway.layer(goals),
  // Goals are pre-configured in the layer; no external submission needed.
  postGoal: async () => {},
}))

runContract('CliUserGateway', async _goals => {
  const port = await getFreePort()
  return {
    layer: CliUserGateway.layer(port),
    postGoal: async (goal: GoalSubmission) => postGoalHttp(port, goal),
  }
})

// ─── InMemoryUserGateway postcondition: respond records the call (P32) ────────
//
// CliUserGateway.respond is a known stub (HTTP polling not yet implemented).
// This test targets InMemoryUserGateway directly and asserts that `respond`
// writes to the responds Ref — not a no-op. Regressions are visible immediately.
describe('InMemoryUserGateway — respond postcondition (P32)', () => {
  it('respond records the call in the responds MutableRef', async () => {
    const { layer, responds } = InMemoryUserGateway.layerWithResponds([])
    const rt = ManagedRuntime.make(layer)
    try {
      await rt.runPromise(
        Effect.gen(function* () {
          const gw = yield* UserGateway
          yield* gw.respond('cid-42', 'hello clarify', 'sess-1')
        }),
      )
      const calls = MutableRef.get(responds)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual({ correlationId: 'cid-42', sessionId: 'sess-1', text: 'hello clarify' })
    } finally {
      await rt.dispose()
    }
  })
})
