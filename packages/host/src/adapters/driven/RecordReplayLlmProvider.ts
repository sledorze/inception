/**
 * LLM adapter: record/replay/fake cassette provider for deterministic testing.
 *
 * Record mode: delegates to the underlying OpenAI-compat endpoint with
 * temperature=0 + seed=42, writes each response to a cassette file keyed by
 * a stable request hash (model + messages[].{role,content} + tools sorted by name).
 *
 * Replay mode: serves responses from cassette files; fails loudly on a miss.
 *
 * Fake mode: returns canned responses without any file I/O or network calls.
 *   - If the last user message is "help me" and there are no tool-result messages
 *     in the history, returns a request-clarification tool call.
 *   - Otherwise returns a plain text reply.
 *   Used by playwright.config.ts webServer by default (LLM_MODE=fake).
 *
 * Volatile fields excluded from the hash: message IDs, tool_call_id,
 * timestamps, reasoning_content, correlationId.
 *
 * Used by: runtime/bind.ts (LLM_MODE=record|replay|fake env); LlmProvider.spec.ts.
 * FileSystem is used for cassette I/O (no node:fs import — Effect-clean).
 */
import { Config, Effect, FileSystem, Layer } from 'effect'
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { FetchHttpClient } from 'effect/unstable/http'
import { createHash } from 'node:crypto'

const LLM_BASE_URL = Config.string('LLM_BASE_URL').pipe(Config.withDefault('http://host.docker.internal:1235/v1'))
const LLM_MODEL = Config.string('LLM_MODEL').pipe(Config.withDefault('local-model'))

export type RecordReplayMode = 'record' | 'replay' | 'fake'

function makeFakeResponse(body: Record<string, unknown>): Response {
  const messages = Array.isArray(body['messages']) ? (body['messages'] as Array<Record<string, unknown>>) : []
  const hasToolResult = messages.some(m => m['role'] === 'tool')
  const userMsgs = messages.filter(m => m['role'] === 'user')
  const lastUserContent = String(userMsgs.at(-1)?.['content'] ?? '')
    .toLowerCase()
    .trim()

  const callClarify = !hasToolResult && userMsgs.length === 1 && lastUserContent === 'help me'
  const responseBody =
    callClarify ?
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            index: 0,
            message: {
              content: null,
              role: 'assistant',
              tool_calls: [
                {
                  function: {
                    arguments: '{"question":"What specifically do you need help with?"}',
                    name: 'request-clarification',
                  },
                  id: 'call_fake001',
                  type: 'function',
                },
              ],
            },
          },
        ],
        created: 1_700_000_000,
        id: 'fake-tool-001',
        model: 'fake',
        object: 'chat.completion',
        usage: { completion_tokens: 15, prompt_tokens: 10, total_tokens: 25 },
      }
    : {
        choices: [
          {
            finish_reason: 'stop',
            index: 0,
            message: {
              content: 'This is a deterministic fake LLM response for e2e testing.',
              role: 'assistant',
            },
          },
        ],
        created: 1_700_000_000,
        id: 'fake-text-001',
        model: 'fake',
        object: 'chat.completion',
        usage: { completion_tokens: 10, prompt_tokens: 10, total_tokens: 20 },
      }
  return new Response(JSON.stringify(responseBody), { headers: { 'Content-Type': 'application/json' }, status: 200 })
}

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

// @effect/platform FetchHttpClient sends the body as Uint8Array, not a plain string.
// This helper decodes it correctly so the hash (and fake-mode detection) work.
function decodeBody(init: RequestInit | undefined): string {
  const body = init?.body
  if (typeof body === 'string') return body
  if (body instanceof Uint8Array) return new TextDecoder().decode(body)
  return '{}'
}

// Promise chaining is intentional — FetchHttpClient.Fetch must satisfy typeof globalThis.fetch.
// `fs` is the concrete FileSystem instance yielded from the layer build; its methods return
// Effect<A, E, never> (no context requirement) so Effect.runPromise runs them without a full runtime.
function makeRecordReplayFetch(
  baseFetch: typeof globalThis.fetch,
  mode: RecordReplayMode,
  cassetteDir: string,
  fs: FileSystem.FileSystem,
): typeof globalThis.fetch {
  return (input, init) => {
    const rawBody = decodeBody(init)
    const body = JSON.parse(rawBody) as Record<string, unknown>
    const hash = computeRequestHash(body)
    const cassettePath = `${cassetteDir}/${hash}.json`

    if (mode === 'fake') {
      return Promise.resolve(makeFakeResponse(body))
    }

    if (mode === 'replay') {
      return Effect.runPromise(fs.readFileString(cassettePath).pipe(Effect.orDie)).then(
        content => new Response(content, { headers: { 'Content-Type': 'application/json' }, status: 200 }),
      )
    }

    // record: force temperature=0 + seed=42 for determinism; write raw response text to cassette.
    const deterministicBody = { ...body, seed: 42, temperature: 0 }
    return baseFetch(input, { ...init, body: JSON.stringify(deterministicBody) }).then(response =>
      response.text().then(text =>
        Effect.runPromise(
          fs.makeDirectory(cassetteDir, { recursive: true }).pipe(
            Effect.flatMap(() => fs.writeFileString(cassettePath, text)),
            Effect.orDie,
          ),
        ).then(() => new Response(text, { headers: { 'Content-Type': 'application/json' }, status: response.status })),
      ),
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
        const fs = yield* FileSystem.FileSystem
        const fetch = makeRecordReplayFetch(baseFetch, opts.mode, opts.cassetteDir, fs)
        return OpenAiLanguageModel.layer({ model }).pipe(
          Layer.provide(OpenAiClient.layer({ apiUrl: baseUrl })),
          Layer.provide(FetchHttpClient.layer),
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
        )
      }),
    ),
}
