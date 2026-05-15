/**
 * LLM adapter: @effect/ai-openai-compat → LanguageModel (§13, L2.14).
 *
 * Wires OpenAiClient + FetchHttpClient into LanguageModel.LanguageModel.
 * Replaces the hand-rolled OpenAiLlmProvider (AL.7 adoption).
 * Target: LMStudio (or any OpenAI-compatible endpoint) via LLM_BASE_URL env.
 */
import { Config, DateTime, Effect, Layer, Option, Schema } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'
import { EventStore } from '../../ports/driven/EventStore.ts'

const LLM_BASE_URL = Config.string('LLM_BASE_URL').pipe(Config.withDefault('http://192.168.0.15:1235/v1'))
const LLM_MODEL = Config.string('LLM_MODEL').pipe(Config.withDefault('local-model'))

// Schema for the subset of the LMStudio/OpenAI-compat message shape we care about (P7).
const LmMessage = Schema.Struct({
  content: Schema.optional(Schema.NullOr(Schema.String)),
  reasoning_content: Schema.optional(Schema.String),
})

const decodeLmMessage = Schema.decodeUnknownOption(LmMessage)

// Bridge: promotes reasoning_content → content when content is blank (P7).
// Promise chaining is intentional — FetchHttpClient.Fetch must satisfy typeof globalThis.fetch.
// shape-alert callback: when a message fails LmMessage decode, onShapeAlert is called so the
// Effect-side handler can persist an UnknownShapeObserved event (P10).
const makeReasoningAwareFetch =
  (baseFetch: typeof globalThis.fetch, onShapeAlert: (msg: unknown) => void): typeof globalThis.fetch =>
  (input, init) =>
    baseFetch(input, init).then(response => {
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
              onShapeAlert(msg)
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
    Layer.unwrap(
      Effect.gen(function* () {
        const baseUrl = opts?.baseUrl ?? (yield* LLM_BASE_URL)
        const model = opts?.model ?? (yield* LLM_MODEL)
        // Capture the full service context so we can run Effects from Promise territory (P10).
        const ctx = yield* Effect.context<EventStore>()

        // P10: bridge Promise-territory shape alerts back into the Effect runtime.
        // Effect.runPromiseWith(ctx) runs the append in the same scheduler as the outer fiber,
        // so the store write is visible to subsequent queries in the same test/session.
        const onShapeAlert = (msg: unknown): void => {
          void Effect.runPromiseWith(ctx)(
            Effect.gen(function* () {
              const store = yield* EventStore
              yield* store
                .append({
                  actor: 'host',
                  correlationId: 'untraced',
                  kind: 'UnknownShapeObserved',
                  occurredAt: DateTime.formatIso(yield* DateTime.now),
                  payload: { message: msg },
                  schemaV: 1,
                  sessionId: 'untraced',
                  storyRef: 'untraced',
                })
                .pipe(Effect.orDie)
            }),
          )
        }

        const baseFetch = yield* FetchHttpClient.Fetch
        const fetch = makeReasoningAwareFetch(baseFetch, onShapeAlert)
        return OpenAiLanguageModel.layer({ model }).pipe(
          Layer.provide(OpenAiClient.layer({ apiUrl: baseUrl })),
          Layer.provide(FetchHttpClient.layer),
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
        )
      }),
    ),
}
