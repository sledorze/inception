/**
 * P8 regression — ToolResultObserved correlationId propagation.
 *
 * Acceptance test: observable behavior is that every ToolResultObserved event
 * shares the same correlationId as the GoalSubmitted event that triggered it.
 * This verifies P8 is fixed (was: emitCorroborator generated a fresh UUID per call).
 *
 * Fails on pre-fix code (where emitCorroborator used randomUUID()).
 * Passes when CurrentCorrelationId is threaded from submitGoal → generateText → emitCorroborator.
 */
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { Effect, Layer } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'
import { afterAll, beforeAll, expect } from 'vitest'
import { layer } from '@effect/vitest'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

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

let stubServer: Server
let stubBaseUrl = ''
let callCount = 0

beforeAll(
  () =>
    new Promise<void>(resolve => {
      stubServer = createServer((req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(callCount++ === 0 ? TOOL_CALL_BODY : TEXT_BODY)
        })
      })
      stubServer.listen(0, '127.0.0.1', () => {
        stubBaseUrl = `http://127.0.0.1:${(stubServer.address() as AddressInfo).port}`
        resolve()
      })
    }),
)

afterAll(
  () =>
    new Promise<void>(resolve => {
      stubServer.close(() => resolve())
    }),
)

// ─── test layer ───────────────────────────────────────────────────────────────

const TOOLS = [{ description: 'List tools for a role.', inputSchema: {}, name: 'list-tools', roles: ['Architect'] }]

const makeTestLayer = () => {
  const { handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS, {}, ['list-tools'])
  const stubLlmLayer = OpenAiLanguageModel.layer({ model: 'stub' }).pipe(
    Layer.provide(OpenAiClient.layer({ apiUrl: stubBaseUrl })),
    Layer.provide(FetchHttpClient.layer),
  )
  return Layer.mergeAll(toolkitLayer, storeLayer, handleRegLayer, stubLlmLayer)
}

// ─── acceptance test ──────────────────────────────────────────────────────────

layer(Layer.suspend(makeTestLayer))('P8 — ToolResultObserved correlationId propagation', it => {
  it.effect('ToolResultObserved.correlationId matches GoalSubmitted.correlationId', () =>
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
