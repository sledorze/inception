/**
 * LLM adapter: record/replay cassette provider for deterministic testing.
 *
 * Record mode: delegates to the underlying OpenAI-compat endpoint with
 * temperature=0 + seed=42, writes each response to a cassette file keyed by
 * a stable request hash (model + messages[].{role,content} + tools sorted by name).
 *
 * Replay mode: serves responses from cassette files; fails loudly on a miss.
 *
 * Volatile fields excluded from the hash: message IDs, tool_call_id,
 * timestamps, reasoning_content, correlationId.
 *
 * Used by: runtime/bind.ts (LLM_MODE=record|replay env); LlmProvider.spec.ts.
 */
import { Config, Effect, Layer } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from 'node:crypto'
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const LLM_BASE_URL = Config.string('LLM_BASE_URL').pipe(Config.withDefault('http://host.docker.internal:1235/v1'))
const LLM_MODEL = Config.string('LLM_MODEL').pipe(Config.withDefault('local-model'))

export type RecordReplayMode = 'record' | 'replay'

function computeRequestHash(body: Record<string, unknown>): string {
  const model = typeof body['model'] === 'string' ? body['model'] : ''
  const messages =
    Array.isArray(body['messages']) ?
      (body['messages'] as Array<Record<string, unknown>>).map(m => ({
        content: m['content'],
        role: m['role'],
      }))
    : []
  const tools =
    Array.isArray(body['tools']) ?
      [...(body['tools'] as Array<Record<string, unknown>>)].sort((a, b) => {
        const fn = (t: Record<string, unknown>) =>
          ((t['function'] as Record<string, unknown> | undefined)?.['name'] as string | undefined) ?? ''
        return fn(a).localeCompare(fn(b))
      })
    : []
  return createHash('sha256').update(JSON.stringify({ messages, model, tools })).digest('hex')
}

// Promise chaining is intentional — FetchHttpClient.Fetch must satisfy typeof globalThis.fetch.
function makeRecordReplayFetch(
  baseFetch: typeof globalThis.fetch,
  mode: RecordReplayMode,
  cassetteDir: string,
): typeof globalThis.fetch {
  return (input, init) => {
    const rawBody = typeof init?.body === 'string' ? init.body : '{}'
    const body = JSON.parse(rawBody) as Record<string, unknown>
    const hash = computeRequestHash(body)
    const cassettePath = `${cassetteDir}/${hash}.json`

    if (mode === 'replay') {
      // Wrap in Promise.resolve().then() so synchronous throws reject the Promise.
      return Promise.resolve().then(() => {
        const stored = JSON.parse(readFileSync(cassettePath, 'utf8'))
        return Response.json(stored, { status: 200 })
      })
    }

    // record: force temperature=0 + seed=42 for determinism
    const deterministicBody = { ...body, seed: 42, temperature: 0 }
    return baseFetch(input, { ...init, body: JSON.stringify(deterministicBody) }).then(response =>
      response.json().then((responseBody: unknown) => {
        mkdirSync(cassetteDir, { recursive: true })
        writeFileSync(cassettePath, JSON.stringify(responseBody, null, 2))
        return Response.json(responseBody, { status: response.status })
      }),
    )
  }
}

export const RecordReplayLlmProvider = {
  layer: (opts: { mode: RecordReplayMode; cassetteDir: string; baseUrl?: string; model?: string }) =>
    Layer.unwrap(
      Effect.gen(function* () {
        const baseUrl = opts.baseUrl ?? (yield* LLM_BASE_URL)
        const model = opts.model ?? (yield* LLM_MODEL)
        const baseFetch = yield* FetchHttpClient.Fetch
        const fetch = makeRecordReplayFetch(baseFetch, opts.mode, opts.cassetteDir)
        return OpenAiLanguageModel.layer({ model }).pipe(
          Layer.provide(OpenAiClient.layer({ apiUrl: baseUrl })),
          Layer.provide(FetchHttpClient.layer),
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
        )
      }),
    ),
}
