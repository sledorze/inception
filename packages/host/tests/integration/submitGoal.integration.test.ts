/**
 * Integration smoke-test for TODO 3.1: the User-entry-point wire.
 *
 * Asserts that when a goal is submitted via the UserGateway:
 *   1. A GoalSubmitted event is emitted (actor=user, payload carries goal+handleId).
 *   2. A GoalCompleted event is emitted (actor=host, non-empty text).
 *   3. Both events share the same correlationId (goal-level correlation anchor).
 *
 * Runs in CI without LMStudio: a stub HTTP server acts as the OpenAI-compatible
 * LLM endpoint and returns a fixed text response without tool calls.
 */
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { Effect, Layer } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'
import { afterAll, beforeAll } from 'vitest'
import { expect, layer } from '@effect/vitest'
import { InMemoryUserGateway } from '../../src/adapters/driving/InMemoryUserGateway.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { UserGateway } from '../../src/ports/driving/UserGateway.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

// ─── stub LLM HTTP server ─────────────────────────────────────────────────────

const STUB_TEXT = 'Fixture has two columns: id (int) and value (string).'

let stubServer: Server
let stubBaseUrl = ''

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
          res.end(
            JSON.stringify({
              choices: [{ finish_reason: 'stop', index: 0, message: { content: STUB_TEXT, role: 'assistant' } }],
              created: 0,
              id: 'stub',
              model: 'stub',
              object: 'chat.completion',
              usage: { completion_tokens: 12, prompt_tokens: 50, total_tokens: 62 },
            }),
          )
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

const GOAL = { goal: 'Describe the synthetic-001 fixture.', handleId: 'synthetic-001' }

const makeTestLayer = () => {
  const { handleRegLayer, storeLayer, toolkitLayer } = makeToolkitComponents([], {})
  const stubLlmLayer = OpenAiLanguageModel.layer({ model: 'stub' }).pipe(
    Layer.provide(OpenAiClient.layer({ apiUrl: stubBaseUrl })),
    Layer.provide(FetchHttpClient.layer),
  )
  return Layer.mergeAll(toolkitLayer, storeLayer, handleRegLayer, stubLlmLayer, InMemoryUserGateway.layer([GOAL]))
}

// ─── tests ────────────────────────────────────────────────────────────────────

layer(Layer.suspend(makeTestLayer))('submitGoal — User entry point wire (3.1)', it => {
  it.effect('GoalSubmitted + GoalCompleted share a correlationId, carry expected payload', () =>
    Effect.gen(function* () {
      const toolkit = yield* GeorgesToolkit
      const gw = yield* UserGateway
      yield* gw.listen(submission => makeSubmitGoal(toolkit)(submission).pipe(Effect.orDie))

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
})
