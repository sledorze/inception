/**
 * Protocol contract test for the LlmProvider driven port.
 * Parametrised over all bound backing adapters — Liskov substitution proven by test, not intent (§2.13).
 * Laws exercised: L2.14 (port contract), L3.6 (model-id + usage captured for provenance).
 */
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import type { Layer } from 'effect'
import { Effect, ManagedRuntime } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { InMemoryLlmProvider } from '../../src/adapters/driven/InMemoryLlmProvider.ts'
import { OpenAiLlmProvider } from '../../src/adapters/driven/OpenAiLlmProvider.ts'
import type { LlmRequest, LlmResponse } from '../../src/ports/driven/LlmProvider.ts'
import { LlmProvider } from '../../src/ports/driven/LlmProvider.ts'

// ─── OpenAI stub server ───────────────────────────────────────────────────────

const STUB_MODEL = 'stub-model-1'
const STUB_CONTENT = 'Hello from stub.'
const STUB_PROMPT_TOKENS = 10
const STUB_COMPLETION_TOKENS = 5

const makeStubCompletion = (model: string) => ({
  choices: [{ message: { content: STUB_CONTENT, role: 'assistant' } }],
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
            // ignore parse failures — use stub model
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

const baseRequest: LlmRequest = {
  messages: [{ content: 'Say hello.', role: 'user' }],
  model: STUB_MODEL,
}

const complete = (req: LlmRequest) =>
  Effect.gen(function* () {
    const provider = yield* LlmProvider
    return yield* provider.complete(req)
  })

// ─── shared contract ─────────────────────────────────────────────────────────

type TestLayer = Layer.Layer<LlmProvider>

function runContract(name: string, makeLayer: () => TestLayer) {
  describe(name, () => {
    let rt: ManagedRuntime.ManagedRuntime<LlmProvider, never>

    beforeAll(() => {
      rt = ManagedRuntime.make(makeLayer())
    })

    afterAll(() => rt.dispose())

    const run = <A>(effect: Effect.Effect<A, unknown, LlmProvider>) => rt.runPromise(effect)

    it('complete returns a non-empty content string', async () => {
      const result: LlmResponse = await run(complete(baseRequest))
      expect(result.content).toBeTypeOf('string')
      expect(result.content.length).toBeGreaterThan(0)
    })

    it('complete returns modelId for L3.6 provenance', async () => {
      const result: LlmResponse = await run(complete(baseRequest))
      expect(result.modelId).toBeTypeOf('string')
      expect(result.modelId.length).toBeGreaterThan(0)
    })

    it('complete returns usage with token counts', async () => {
      const result: LlmResponse = await run(complete(baseRequest))
      expect(result.usage.promptTokens).toBeTypeOf('number')
      expect(result.usage.completionTokens).toBeTypeOf('number')
      expect(result.usage.promptTokens).toBeGreaterThanOrEqual(0)
      expect(result.usage.completionTokens).toBeGreaterThanOrEqual(0)
    })
  })
}

// ─── adapter configurations ──────────────────────────────────────────────────

runContract('InMemoryLlmProvider', () =>
  InMemoryLlmProvider.layer(_req => ({
    content: STUB_CONTENT,
    modelId: STUB_MODEL,
    usage: { completionTokens: STUB_COMPLETION_TOKENS, promptTokens: STUB_PROMPT_TOKENS },
  })),
)

// OpenAiLlmProvider is wired to the local stub server — no real LLM required in CI.
runContract('OpenAiLlmProvider', () => OpenAiLlmProvider.layer(stubBaseUrl))
