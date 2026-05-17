/**
 * P52 acceptance test — live LLM base URL rewrite from Settings.
 *
 * RED on current code: the bridge ignores Settings.llmBaseUrl; the request hits the dead
 * boot URL → connection refused (TransportError).
 * GREEN after fix: the bridge reads Settings.llmBaseUrl per request and rewrites the URL.
 */
import { createServer } from 'node:http'
import { Effect, Layer } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { afterAll, beforeAll, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { FileBackedSettings } from '../../src/adapters/driven/FileBackedSettings.ts'
import { OpenAiCompatLlmProvider } from '../../src/adapters/driven/OpenAiCompatLlmProvider.ts'
import { Settings } from '../../src/ports/driven/Settings.ts'

// ─── stub OpenAI server ───────────────────────────────────────────────────────

const STUB_CONTENT = 'Hello from live-URL stub.'

const makeStubCompletion = () => ({
  choices: [{ finish_reason: 'stop', index: 0, message: { content: STUB_CONTENT, role: 'assistant' } }],
  created: Math.floor(Date.now() / 1000),
  id: 'chatcmpl-stub-live',
  model: 'stub-model',
  object: 'chat.completion',
  usage: { completion_tokens: 5, prompt_tokens: 10, total_tokens: 15 },
})

let stubServer: ReturnType<typeof createServer>
let stubBaseUrl: string
// Timestamp-based path — no node:crypto or node:os imports needed.
const settingsPath = `/tmp/llm-url-live-settings-${Date.now()}.json`

// Dead boot URL: connection will be refused until the bridge rewrites it.
const DEAD_BOOT_URL = 'http://127.0.0.1:1/v1'

beforeAll(
  () =>
    new Promise<void>(resolve => {
      stubServer = createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(makeStubCompletion()))
      })
      stubServer.listen(0, '127.0.0.1', () => {
        const addr = stubServer.address() as { port: number }
        stubBaseUrl = `http://127.0.0.1:${addr.port}/v1`
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

// ─── acceptance test ──────────────────────────────────────────────────────────

it.effect('reads llmBaseUrl from Settings per request — no server restart needed (P52)', () => {
  // Shared layer: built once, provides Settings to both the LLM bridge and the outer Effect.gen.
  // Effect deduplicates layers by identity — the same Ref is shared across both uses.
  const sharedSettingsLayer = FileBackedSettings.layer(settingsPath).pipe(Layer.provide(NodeFileSystem.layer))

  return Effect.gen(function* () {
    // Patch Settings to point at the stub server (simulates the user changing the URL in the backoffice).
    const settingsSvc = yield* Settings
    yield* settingsSvc.patch({ llmBaseUrl: stubBaseUrl })

    // Generate text — should hit the stub server (via the live URL from Settings), NOT the dead boot URL.
    const response = yield* LanguageModel.generateText({ prompt: 'Say hello.' })
    expect(response.text).toBe(STUB_CONTENT)
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        // LLM layer with dead boot URL; Settings provided so the bridge can rewrite per request.
        OpenAiCompatLlmProvider.layer({ baseUrl: DEAD_BOOT_URL }).pipe(
          Layer.provide(InMemoryEventStore.layer),
          Layer.provide(sharedSettingsLayer),
        ),
        // Expose Settings to the outer Effect.gen so we can call patch() before generateText.
        sharedSettingsLayer,
      ),
    ),
  )
})
