/**
 * LLM adapter: @effect/ai-openai-compat → LanguageModel (§13, L2.14).
 *
 * Wires OpenAiClient + FetchHttpClient into LanguageModel.LanguageModel.
 * Replaces the hand-rolled OpenAiLlmProvider (AL.7 adoption).
 * Target: LMStudio (or any OpenAI-compatible endpoint) via LLM_BASE_URL env.
 */
import { Layer } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'

const DEFAULT_BASE_URL = process.env['LLM_BASE_URL'] ?? 'http://localhost:1234'
const DEFAULT_MODEL = process.env['LLM_MODEL'] ?? 'local-model'

export const OpenAiCompatLlmProvider = {
  layer: (opts?: { baseUrl?: string; model?: string }) =>
    OpenAiLanguageModel.layer({ model: opts?.model ?? DEFAULT_MODEL }).pipe(
      Layer.provide(OpenAiClient.layer({ apiUrl: opts?.baseUrl ?? DEFAULT_BASE_URL })),
      Layer.provide(FetchHttpClient.layer),
    ),
}
