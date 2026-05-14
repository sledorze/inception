/**
 * TODO 4.3 — First Georges-proposed capability accepted end-to-end.
 *
 * Exercises the same HTTP API the UI uses:
 *   1. makeSubmitGoal (= POST /api/goals) → stub LLM calls propose-capability
 *   2. CapabilityProposed event stored in EventStore
 *   3. registerCapability (= POST /api/proposals/:id/promote) → capability in registry
 *   4. toolkit.handle('call-capability') (= POST /api/tools/call-capability) → code runs
 *   5. Assert: stdout contains the expected output from Georges-authored code
 *
 * Fails if any stage of the promote→exercise pipeline is broken.
 *
 * Uses @effect/vitest layer() + FakeOpenAiStubLive (scoped Layer) — fixes P18:
 * the stub server is started by Effect.acquireRelease inside the layer build,
 * guaranteed to be listening before OpenAiClient.layer is built.
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { NodeFileSystem } from '@effect/platform-node'
import { expect, layer } from '@effect/vitest'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { registerCapability } from '../../src/application/registerCapability.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'
import { makeLlmStubLayer } from '../helpers/fakeOpenAiStub.ts'

// ─── stub LLM ─────────────────────────────────────────────────────────────────
// Call 1: LLM proposes a capability via propose-capability tool call.
// Call 2: LLM returns a text completion to close the generateText loop.

const PROPOSE_ARGS = JSON.stringify({
  code: "console.log('hello-from-georges')",
  manifest: JSON.stringify({
    description: 'Prints a greeting to stdout.',
    name: 'greet',
    scope: 'capability',
    version: '1.0.0',
  }),
  role: 'Implementer',
  tests: '// none',
})

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
            function: { arguments: PROPOSE_ARGS, name: 'propose-capability' },
            id: 'call_4_3_propose',
            type: 'function',
          },
        ],
      },
    },
  ],
  created: 0,
  id: 'stub-propose',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 30, prompt_tokens: 100, total_tokens: 130 },
})

const TEXT_BODY = JSON.stringify({
  choices: [{ finish_reason: 'stop', index: 0, message: { content: 'Capability proposed.', role: 'assistant' } }],
  created: 0,
  id: 'stub-done',
  model: 'stub',
  object: 'chat.completion',
  usage: { completion_tokens: 5, prompt_tokens: 200, total_tokens: 205 },
})

// ─── test setup ───────────────────────────────────────────────────────────────

// Implementer role must have propose-capability in its surface (L2.2 role-scope check).
const TOOLS = [
  {
    description: 'Proposes a capability for review.',
    inputSchema: { type: 'object' },
    name: 'propose-capability',
    roles: ['Implementer'],
  },
]

const llmLayer = makeLlmStubLayer([
  { body: TOOL_CALL_BODY, status: 200 },
  { body: TEXT_BODY, status: 200 },
])

const { capabilityRegistryLayer, handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS, {}, [
  'propose-capability',
  'call-capability',
])

const TestLayer = Layer.mergeAll(
  toolkitLayer,
  storeLayer,
  handleRegLayer,
  capabilityRegistryLayer,
  NodeFileSystem.layer,
  llmLayer,
)

// ─── helper ───────────────────────────────────────────────────────────────────

const callTool = (name: string, params: Record<string, unknown>) =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle(name as 'list-tools', params as { role: string })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

// ─── test ─────────────────────────────────────────────────────────────────────

layer(TestLayer)('TODO 4.3 — propose → promote → call-capability executes Georges-authored code', it => {
  it.effect('propose → promote → call-capability pipeline', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const store = yield* EventStore

      // Step 1: Georges receives the goal, calls propose-capability, CapabilityProposed stored.
      yield* makeSubmitGoal(toolkit)({ goal: 'Propose a greet capability.', handleId: 'none' }).pipe(Effect.orDie)

      // Step 2: verify CapabilityProposed is in the event store
      const events = yield* store.query({})
      const proposed = events.find(e => e.kind === 'CapabilityProposed')
      expect(proposed).toBeDefined()
      if (proposed === undefined) {
        return
      }
      const proposalId = proposed.contentHash
      const payload = proposed.payload as { name: string; code: string }
      expect(payload.name).toBe('greet')
      expect(payload.code).toContain('hello-from-georges')

      // Step 3: registerCapability reads CapabilityProposed from EventStore and writes to CapabilityRegistry.
      const version = yield* registerCapability(proposalId)
      expect(version).toBeGreaterThan(0)

      // Step 4: Georges-authored code runs in a sandboxed Node.js subprocess.
      const result = yield* callTool('call-capability', { name: 'greet', role: 'Implementer' })
      expect(result.isFailure).toBe(false)
      const callResult = result.result as { exitCode: number; output: string }
      expect(callResult.exitCode).toBe(0)
      expect(callResult.output).toContain('hello-from-georges')
    }),
  )
})
