import { Effect, Layer, Schema } from 'effect'
import { LlmProvider, LlmProviderError } from '../../ports/driven/LlmProvider.ts'
import type { LlmRequest } from '../../ports/driven/LlmProvider.ts'

const DEFAULT_BASE_URL = process.env['LLM_BASE_URL'] ?? 'http://localhost:1234'

// Minimal OpenAI chat-completions response shape (other fields ignored).
const ChatCompletionResponse = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      message: Schema.Struct({
        content: Schema.String,
      }),
    }),
  ),
  model: Schema.String,
  usage: Schema.Struct({
    completion_tokens: Schema.Number,
    prompt_tokens: Schema.Number,
  }),
})

const buildBody = (req: LlmRequest): string =>
  JSON.stringify({
    messages: req.messages,
    model: req.model,
    ...(req.maxTokens !== undefined && { max_tokens: req.maxTokens }),
    ...(req.seed !== undefined && { seed: req.seed }),
  })

export const OpenAiLlmProvider = {
  layer: (baseUrl = DEFAULT_BASE_URL) =>
    Layer.effect(
      LlmProvider,
      Effect.succeed(
        LlmProvider.of({
          complete: req =>
            Effect.gen(function* () {
              const raw = yield* Effect.tryPromise({
                catch: cause => new LlmProviderError({ cause }),
                try: async () => {
                  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
                    body: buildBody(req),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                  })
                  if (!res.ok) {
                    throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`)
                  }
                  return res.json() as Promise<unknown>
                },
              })

              const parsed = yield* Schema.decodeUnknownEffect(ChatCompletionResponse)(raw).pipe(
                Effect.mapError(cause => new LlmProviderError({ cause })),
              )

              const content = parsed.choices.at(0)?.message.content ?? ''

              return {
                content,
                modelId: parsed.model,
                usage: {
                  completionTokens: parsed.usage.completion_tokens,
                  promptTokens: parsed.usage.prompt_tokens,
                },
              }
            }),
        }),
      ),
    ),
}
