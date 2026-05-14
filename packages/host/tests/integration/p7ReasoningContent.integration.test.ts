/**
 * P7 — reasoning_content promotion.
 *
 * Verifies that OpenAiCompatLlmProvider promotes message.reasoning_content → text
 * when message.content is blank (the behaviour of LMStudio with reasoning models
 * such as qwopus3.6-35b-a3b-v1, DeepSeek-R1, Qwen3-reasoning).
 *
 * Uses captured-then-curated fixture files from tests/fixtures/lmstudio/ so
 * the test is deterministic and CI-runnable without a live LLM endpoint.
 * See docs/PAIN.md P7 for full background.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import { OpenAiCompatLlmProvider } from '../../src/adapters/driven/OpenAiCompatLlmProvider.ts'
import { startFakeLmstudio } from '../helpers/fakeLmstudioServer.ts'

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/lmstudio')
const fixture = (name: string) => join(FIXTURE_DIR, name)

const REASONING_ANSWER = 'The synthetic-001 fixture has two columns: id and value.'

describe('P7 — reasoning_content promotion', () => {
  it.effect('promotes reasoning_content to response text when content is null (finish=stop)', () =>
    Effect.gen(function* () {
      const fake = yield* Effect.promise(() => startFakeLmstudio([fixture('round-stop-reasoning-only.json')]))
      const result = yield* LanguageModel.generateText({ prompt: 'Summarise the fixture.' }).pipe(
        Effect.provide(OpenAiCompatLlmProvider.layer({ baseUrl: fake.baseUrl, model: 'stub' })),
      )
      yield* Effect.promise(() => fake.close())
      expect(result.text).toContain(REASONING_ANSWER)
    }),
  )

  it.effect('preserves content unchanged when content is non-empty (happy path)', () =>
    Effect.gen(function* () {
      const fake = yield* Effect.promise(() => startFakeLmstudio([fixture('round-stop-content-normal.json')]))
      const result = yield* LanguageModel.generateText({ prompt: 'Summarise the fixture.' }).pipe(
        Effect.provide(OpenAiCompatLlmProvider.layer({ baseUrl: fake.baseUrl, model: 'stub' })),
      )
      yield* Effect.promise(() => fake.close())
      expect(result.text).toContain(REASONING_ANSWER)
    }),
  )
})
