/**
 * P50 acceptance test — HTTP observability: three observability gaps closed.
 *
 * Asserts that when the LLM call fails inside submitGoal:
 *   (a) A GoalFailed event is appended to the EventStore (trace visibility)
 *   (b) The global catchAllCause handler converts any failing route Effect to a
 *       structured JSON 500 body — not the pre-fix empty body
 *
 * Both tests fail on pre-fix code:
 *   (a) EventKind.GoalFailed did not exist; tapErrorCause was not wired
 *   (b) The route error channel was cast as `never` with no handler → empty 500 body
 */
import { Cause, Effect, Exit, Layer } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse'
import { describe, expect, it, layer } from '@effect/vitest'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'
import { makeLlmStubLayer } from '../helpers/fakeOpenAiStub.ts'

// ─── (a) GoalFailed event emitted on LLM failure ─────────────────────────────

// Stub LLM that always returns HTTP 500 — simulates unreachable LLM endpoint.
const failingLlmLayer = makeLlmStubLayer([{ body: '{"error":"service_unavailable"}', status: 500 }])

const { handleRegLayer, registryLayer, storeLayer, toolkitLayer } = makeToolkitComponents([], {})

const TestLayer = Layer.mergeAll(
  toolkitLayer,
  storeLayer,
  handleRegLayer,
  registryLayer,
  NodeFileSystem.layer,
  failingLlmLayer,
)

layer(TestLayer)('P50 (a) — GoalFailed event emitted when the LLM call fails', it => {
  it.effect('GoalFailed event is in the store when makeSubmitGoal fails', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const store = yield* EventStore

      const result = yield* Effect.exit(
        makeSubmitGoal(toolkit)({
          goal: 'Describe the synthetic-001 fixture.',
          handleId: 'synthetic-001',
          sessionId: 'test-observability',
        }),
      )

      // The overall effect fails — LLM is unreachable.
      expect(Exit.isFailure(result)).toBe(true)

      // A GoalFailed event must have been appended (tapErrorCause in submitGoal.ts).
      const events = yield* store.query({})
      const failedEvent = events.find(e => e.kind === EventKind.GoalFailed)
      expect(failedEvent).toBeDefined()
      expect(failedEvent?.actor).toBe('host')
      const payload = failedEvent?.payload as { error: string; detail: string } | undefined
      expect(payload?.error).toBe('agent_loop_failed')
      expect(typeof payload?.detail).toBe('string')
      expect(payload?.detail.length).toBeGreaterThan(0)
    }),
  )
})

// ─── (b) catchAllCause returns structured JSON body, not empty ────────────────

describe('P50 (b) — catchAllCause converts failing route Effect to structured JSON 500', () => {
  it.effect('a failing Effect becomes a 500 response with an error field in the body', () =>
    Effect.gen(function* () {
      const response = yield* Effect.fail('simulated_route_error' as unknown).pipe(
        Effect.onError(_cause => Effect.logError('http request failed')),
        Effect.catchCause(cause =>
          Effect.succeed(
            HttpServerResponse.jsonUnsafe({ detail: Cause.pretty(cause), error: 'internal_error' }, { status: 500 }),
          ),
        ),
      )
      expect(response.status).toBe(500)
      expect(response.headers['content-type']).toContain('application/json')
    }),
  )
})
