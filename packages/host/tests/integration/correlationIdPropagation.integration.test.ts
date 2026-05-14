/**
 * P8 regression — ToolResultObserved correlationId propagation.
 *
 * Acceptance test: observable behavior is that every ToolResultObserved event
 * shares the same correlationId as the GoalSubmitted event that triggered it.
 * This verifies P8 is fixed (was: emitCorroborator generated a fresh UUID per call).
 *
 * Fails on pre-fix code (where emitCorroborator used randomUUID()).
 * Passes when CurrentCorrelationId is threaded from submitGoal → generateText → emitCorroborator.
 *
 * Uses @effect/vitest layer() + FakeOpenAiStubLive (scoped Layer) — fixes P18:
 * the stub server is started by Effect.acquireRelease inside the layer build,
 * guaranteed to be listening before OpenAiClient.layer is built.
 */
import { Effect, Layer } from 'effect'
import { NodeFileSystem } from '@effect/platform-node'
import { expect, layer } from '@effect/vitest'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'
import { makeLlmStubLayer } from '../helpers/fakeOpenAiStub.ts'

// ─── stub LLM: first call returns list-tools tool_call, second returns text ──

const TOOL_CALL_BODY = JSON.stringify({
  choices: [
    {
      finish_reason: 'tool_calls',
      index: 0,
      message: {
        content: null,
        role: 'assistant',
        tool_calls: [
          {
            function: { arguments: '{"role":"Architect"}', name: 'list-tools' },
            id: 'call_p8_test',
            type: 'function',
          },
        ],
      },
    },
  ],
  created: 0,
  id: 'stub-tool-call',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 10, prompt_tokens: 50, total_tokens: 60 },
})

const TEXT_BODY = JSON.stringify({
  choices: [{ finish_reason: 'stop', index: 0, message: { content: 'Done.', role: 'assistant' } }],
  created: 0,
  id: 'stub-done',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 5, prompt_tokens: 100, total_tokens: 105 },
})

// ─── test setup ───────────────────────────────────────────────────────────────

const TOOLS = [{ description: 'List tools for a role.', inputSchema: {}, name: 'list-tools', roles: ['Architect'] }]

const llmLayer = makeLlmStubLayer([
  { body: TOOL_CALL_BODY, status: 200 },
  { body: TEXT_BODY, status: 200 },
])

const { handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS, {}, ['list-tools'])

const TestLayer = Layer.mergeAll(toolkitLayer, storeLayer, handleRegLayer, NodeFileSystem.layer, llmLayer)

// ─── acceptance test ──────────────────────────────────────────────────────────

layer(TestLayer)('P8 — ToolResultObserved.correlationId matches GoalSubmitted.correlationId', it => {
  it.effect('ToolResultObserved shares correlationId with GoalSubmitted', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const store = yield* EventStore

      yield* makeSubmitGoal(toolkit)({ goal: 'Describe the data.', handleId: 'none' }).pipe(Effect.orDie)

      const events = yield* store.query({})
      const submitted = events.find(e => e.kind === 'GoalSubmitted')
      const observed = events.find(e => e.kind === 'ToolResultObserved')

      expect(submitted).toBeDefined()
      expect(observed).toBeDefined()
      expect(observed?.correlationId).toBe(submitted?.correlationId)
      expect(observed?.correlationId).not.toBe('bootstrap')
    }),
  )
})
