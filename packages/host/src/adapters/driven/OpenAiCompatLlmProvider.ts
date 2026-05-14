/**
 * LLM adapter: @effect/ai-openai-compat → LanguageModel (§13, L2.14).
 *
 * Wires OpenAiClient + FetchHttpClient into LanguageModel.LanguageModel.
 * Replaces the hand-rolled OpenAiLlmProvider (AL.7 adoption).
 * Target: LMStudio (or any OpenAI-compatible endpoint) via LLM_BASE_URL env.
 */
import { Layer, Option, Schema } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'

const DEFAULT_BASE_URL = process.env['LLM_BASE_URL'] ?? 'http://localhost:1234/v1'
const DEFAULT_MODEL = process.env['LLM_MODEL'] ?? 'local-model'

// Schema for the subset of the LMStudio/OpenAI-compat message shape we care about (P7).
// When the message doesn't parse (unknown vendor extension), we pass it through unchanged
// and emit a console.warn so the shape divergence is visible (see PAIN.md P9 for EventStore
// promotion of this signal).
const LmMessage = Schema.Struct({
  content: Schema.optional(Schema.NullOr(Schema.String)),
  reasoning_content: Schema.optional(Schema.String),
})

const decodeLmMessage = Schema.decodeUnknownOption(LmMessage)

// Bridge: promotes reasoning_content → content when content is blank (P7).
// Required for reasoning models (e.g. qwopus3.6-35b-a3b-v1) that put the final
// answer in reasoning_content while leaving content empty.
// Promise chaining is intentional — FetchHttpClient.Fetch must satisfy typeof globalThis.fetch.
const reasoningAwareFetch: typeof globalThis.fetch = (input, init) =>
  globalThis.fetch(input, init).then(response => {
    const ct = response.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) {
      return response
    }
    return response.json().then((body: unknown) => {
      const b = body as Record<string, unknown>
      const choices = b['choices']
      if (Array.isArray(choices)) {
        for (const choice of choices as Record<string, unknown>[]) {
          const msg = choice['message']
          if (msg === undefined || msg === null) {
            continue
          }
          const decoded = decodeLmMessage(msg)
          if (Option.isNone(decoded)) {
            // Shape alerting (P9): LMStudio returned a message shape we don't recognise.
            // TODO (P9): emit UnknownShapeObserved to EventStore for Claude to inspect.
            console.warn('[OpenAiCompatLlmProvider] unrecognised message shape — pass through unchanged')
            continue
          }
          const { content, reasoning_content: reasoning } = decoded.value
          if (
            (content === null || content === undefined || content.trim() === '') &&
            reasoning !== undefined &&
            reasoning.length > 0
          ) {
            ;(msg as Record<string, unknown>)['content'] = reasoning
          }
        }
      }
      // Do not forward original headers — Content-Length would be stale after body mutation.
      return Response.json(b, { status: response.status })
    })
  })

export const OpenAiCompatLlmProvider = {
  layer: (opts?: { baseUrl?: string; model?: string }) =>
    OpenAiLanguageModel.layer({ model: opts?.model ?? DEFAULT_MODEL }).pipe(
      Layer.provide(OpenAiClient.layer({ apiUrl: opts?.baseUrl ?? DEFAULT_BASE_URL })),
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, reasoningAwareFetch)),
    ),
}
