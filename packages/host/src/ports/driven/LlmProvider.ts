import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface LlmRequest {
  readonly model: string
  readonly messages: readonly LlmMessage[]
  readonly seed?: number
  readonly maxTokens?: number
}

export interface LlmUsage {
  readonly promptTokens: number
  readonly completionTokens: number
}

export interface LlmResponse {
  readonly content: string
  readonly modelId: string
  readonly usage: LlmUsage
}

export class LlmProviderError extends Schema.TaggedErrorClass<LlmProviderError>()('@app/host/LlmProviderError', {
  cause: Schema.Defect,
}) {}

export class LlmProvider extends Context.Service<
  LlmProvider,
  {
    readonly complete: (req: LlmRequest) => Effect.Effect<LlmResponse, LlmProviderError>
  }
>()('@app/host/LlmProvider') {}
