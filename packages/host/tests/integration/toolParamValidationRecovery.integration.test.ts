/**
 * P54 — ToolParameterValidationError recovery (end-to-end).
 *
 * When Georges calls a tool without a required parameter (e.g. `list-tools`
 * without `role`), the Effect AI toolkit throws a ToolParameterValidationError.
 * generateWithRecovery must catch it and feed it back as a synthetic failed
 * tool-result so Georges can self-correct on the next round instead of
 * propagating a 500.
 *
 * Stub sequence:
 *   Round 1  →  LLM returns `list-tools` tool call with empty args `{}`
 *                (missing required `role`) → ToolParameterValidationError
 *   Recovery →  generateWithRecovery re-calls generateText with the failed
 *                tool result appended; stub serves a text answer.
 *
 * Asserts: GoalCompleted (not GoalFailed) is stored, proving the loop
 * finished normally instead of surfacing as a 500.
 */
import { Cause, Effect, Layer } from 'effect'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { expect, layer } from '@effect/vitest'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeLlmStubLayer } from '../helpers/fakeOpenAiStub.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

// ─── stub LLM ─────────────────────────────────────────────────────────────────

// Round 1: LLM calls list-tools with empty args (missing required `role`).
const BAD_TOOL_CALL_BODY = JSON.stringify({
  choices: [
    {
      finish_reason: 'tool_calls',
      index: 0,
      message: {
        content: null,
        role: 'assistant',
        tool_calls: [
          {
            function: { arguments: '{}', name: 'list-tools' },
            id: 'call_p54_bad',
            type: 'function',
          },
        ],
      },
    },
  ],
  created: 0,
  id: 'stub-bad',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 10, prompt_tokens: 80, total_tokens: 90 },
})

// Recovery round: LLM receives the failed tool result and returns a final answer.
const RECOVERY_TEXT_BODY = JSON.stringify({
  choices: [
    {
      finish_reason: 'stop',
      index: 0,
      message: { content: 'I need to include role when calling list-tools.', role: 'assistant' },
    },
  ],
  created: 0,
  id: 'stub-recovery',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 12, prompt_tokens: 120, total_tokens: 132 },
})

// ─── test setup ───────────────────────────────────────────────────────────────

const llmLayer = makeLlmStubLayer([
  { body: BAD_TOOL_CALL_BODY, status: 200 },
  { body: RECOVERY_TEXT_BODY, status: 200 },
])

const { handleRegLayer, registryLayer, storeLayer, toolkitLayer } = makeToolkitComponents([], {})

const TestLayer = Layer.mergeAll(
  toolkitLayer,
  storeLayer,
  handleRegLayer,
  registryLayer,
  NodeFileSystem.layer,
  llmLayer,
)

// ─── test ─────────────────────────────────────────────────────────────────────

layer(TestLayer)('P54 — ToolParameterValidationError recovery', it => {
  it.effect('GoalCompleted (not GoalFailed) when LLM omits required tool param and recovery feeds it back', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const store = yield* EventStore

      const outcome = yield* makeSubmitGoal(toolkit)({ goal: 'List available tools.', handleId: 'none' }).pipe(
        Effect.matchCause({
          onFailure: cause => ({ _tag: 'Left' as const, detail: Cause.pretty(cause) }),
          onSuccess: _ => ({ _tag: 'Right' as const }),
        }),
      )
      expect(outcome._tag, `recovery must succeed, got: ${JSON.stringify(outcome)}`).toBe('Right')

      const events = yield* store.query({})
      const completed = events.find(e => e.kind === 'GoalCompleted')
      const failed = events.find(e => e.kind === 'GoalFailed')

      expect(failed, 'GoalFailed must not be emitted — error should be recovered').toBeUndefined()
      expect(completed, 'GoalCompleted must be emitted after recovery').toBeDefined()
    }),
  )
})
