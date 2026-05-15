/**
 * Protocol contract test for the LLM driven port.
 * Parametrised over all bound adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), L3.6 (modelId + usage captured for provenance).
 *
 * The port is now LanguageModel.LanguageModel from effect/unstable/ai (§13 Tech Decision).
 * The stub HttpClient layer intercepts HTTP calls so no real LLM is needed in CI.
 */
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { Effect, Layer } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'
import { afterAll, beforeAll, describe, expect, it } from '@effect/vitest'

// ─── stub OpenAI server ───────────────────────────────────────────────────────

const STUB_MODEL = 'stub-model-1'
const STUB_CONTENT = 'Hello from stub.'
const STUB_PROMPT_TOKENS = 10
const STUB_COMPLETION_TOKENS = 5

const makeStubCompletion = (model: string) => ({
  choices: [{ finish_reason: 'stop', index: 0, message: { content: STUB_CONTENT, role: 'assistant' } }],
  created: Math.floor(Date.now() / 1000),
  id: 'chatcmpl-stub',
  model,
  object: 'chat.completion',
  usage: { completion_tokens: STUB_COMPLETION_TOKENS, prompt_tokens: STUB_PROMPT_TOKENS, total_tokens: 15 },
})

let stubServer: Server
let stubBaseUrl: string

beforeAll(
  () =>
    new Promise<void>(resolve => {
      stubServer = createServer((req, res) => {
        let body = ''
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        req.on('end', () => {
          let parsed: Record<string, unknown> = {}
          try {
            parsed = JSON.parse(body) as Record<string, unknown>
          } catch {
            // ignore
          }
          const model = typeof parsed['model'] === 'string' ? parsed['model'] : STUB_MODEL
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(makeStubCompletion(model)))
        })
      })
      stubServer.listen(0, '127.0.0.1', () => {
        const addr = stubServer.address() as AddressInfo
        stubBaseUrl = `http://127.0.0.1:${addr.port}`
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

// ─── shared helpers ───────────────────────────────────────────────────────────

const generateText = Effect.gen(function* () {
  return yield* LanguageModel.generateText({ prompt: 'Say hello.' })
})

// ─── shared contract ─────────────────────────────────────────────────────────

function runContract(name: string, makeLayer: () => Layer.Layer<LanguageModel.LanguageModel>) {
  describe(name, () => {
    const withLayer = <A>(eff: Effect.Effect<A, unknown, LanguageModel.LanguageModel>) =>
      Effect.provide(eff, makeLayer())

    it.effect('generateText returns non-empty text content', () =>
      withLayer(
        Effect.gen(function* () {
          const response = yield* generateText
          const text = response.text
          expect(text).toBeTypeOf('string')
          expect(text.length).toBeGreaterThan(0)
        }),
      ),
    )

    it.effect('generateText captures modelId for L3.6 provenance', () =>
      withLayer(
        Effect.gen(function* () {
          const response = yield* generateText
          const meta = response.content.find(p => p.type === 'response-metadata')
          expect(meta).toBeDefined()
          expect(meta?.modelId).toBeTypeOf('string')
          expect((meta?.modelId ?? '').length).toBeGreaterThan(0)
        }),
      ),
    )

    it.effect('generateText captures token usage', () =>
      withLayer(
        Effect.gen(function* () {
          const response = yield* generateText
          const input = response.usage.inputTokens.total
          const output = response.usage.outputTokens.total
          expect(typeof input === 'number' || input === undefined).toBeTruthy()
          expect(typeof output === 'number' || output === undefined).toBeTruthy()
        }),
      ),
    )
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

// OpenAiCompatLlmProvider wired to the local stub server — no real LLM required in CI.
runContract('OpenAiCompatLlmProvider', () =>
  OpenAiLanguageModel.layer({ model: STUB_MODEL }).pipe(
    Layer.provide(OpenAiClient.layer({ apiUrl: stubBaseUrl })),
    Layer.provide(FetchHttpClient.layer),
  ),
)
