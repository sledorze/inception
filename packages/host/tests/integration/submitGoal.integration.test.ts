/**
 * Integration smoke-test for TODO 3.1: the User-entry-point wire.
 *
 * Asserts that when a goal is submitted via the UserGateway:
 *   1. A GoalSubmitted event is emitted (actor=user, payload carries goal+handleId).
 *   2. A GoalCompleted event is emitted (actor=host, non-empty text).
 *   3. Both events share the same correlationId (goal-level correlation anchor).
 *
 * Runs in CI without LMStudio: FakeOpenAiStubLive acts as the OpenAI-compatible
 * LLM endpoint and returns a fixed text response without tool calls.
 *
 * Uses @effect/vitest layer() + FakeOpenAiStubLive (scoped Layer) — fixes P18:
 * the stub server is started by Effect.acquireRelease inside the layer build,
 * guaranteed to be listening before OpenAiClient.layer is built.
 */
import { Effect, Layer } from 'effect'
import { NodeFileSystem } from '@effect/platform-node'
import { expect, layer } from '@effect/vitest'
import { InMemoryUserGateway } from '../../src/adapters/driving/InMemoryUserGateway.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { UserGateway } from '../../src/ports/driving/UserGateway.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'
import { makeLlmStubLayer } from '../helpers/fakeOpenAiStub.ts'

// ─── stub LLM HTTP server ─────────────────────────────────────────────────────

const STUB_TEXT = 'Fixture has two columns: id (int) and value (string).'

const STUB_BODY = JSON.stringify({
  choices: [{ finish_reason: 'stop', index: 0, message: { content: STUB_TEXT, role: 'assistant' } }],
  created: 0,
  id: 'stub',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 12, prompt_tokens: 50, total_tokens: 62 },
})

// ─── test setup ───────────────────────────────────────────────────────────────

const GOAL = { goal: 'Describe the synthetic-001 fixture.', handleId: 'synthetic-001' }

const llmLayer = makeLlmStubLayer([{ body: STUB_BODY, status: 200 }])

const { handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents([], {})

const TestLayer = Layer.mergeAll(
  toolkitLayer,
  storeLayer,
  handleRegLayer,
  NodeFileSystem.layer,
  llmLayer,
  InMemoryUserGateway.layer([GOAL]),
)

// ─── tests ────────────────────────────────────────────────────────────────────

layer(TestLayer)(
  'submitGoal (3.1) — GoalSubmitted + GoalCompleted share a correlationId, carry expected payload',
  it => {
    it.effect('events are emitted with matching correlationId and expected payload', () =>
      Effect.gen(function* () {
        const toolkit = yield* GeorgesToolkit
        const gw = yield* UserGateway
        yield* gw.listen(submission => makeSubmitGoal(toolkit)(submission).pipe(Effect.asVoid, Effect.orDie))

        const store = yield* EventStore
        const events = yield* store.query({})

        const submitted = events.find(e => e.kind === 'GoalSubmitted')
        const completed = events.find(e => e.kind === 'GoalCompleted')

        expect(submitted).toBeDefined()
        expect(completed).toBeDefined()
        expect(submitted?.actor).toBe('user')
        expect(completed?.actor).toBe('host')
        expect(submitted?.correlationId).toBe(completed?.correlationId)
        expect(submitted?.payload).toMatchObject({ goal: GOAL.goal, handleId: GOAL.handleId })
        const text = (completed?.payload as { text: string } | undefined)?.text
        expect(typeof text).toBe('string')
        expect((text ?? '').length).toBeGreaterThan(0)
      }),
    )
  },
)
