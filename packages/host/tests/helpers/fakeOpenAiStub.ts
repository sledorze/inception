/**
 * Effect-native fake OpenAI-compatible HTTP server for integration tests.
 *
 * Uses NodeHttpServer.layerTest (Effect's test HTTP server) — no direct
 * import of node:http or node:net. Lifecycle is managed by Effect's Scope.
 *
 * Primary usage — makeLlmStubLayer bundles the stub server + OpenAI client:
 *
 *   const llmLayer = makeLlmStubLayer([
 *     { status: 200, body: TOOL_CALL_BODY },
 *     { status: 200, body: TEXT_BODY },
 *   ])
 *   layer(Layer.mergeAll(toolkitLayers, llmLayer))('suite', it => {
 *     it.effect('test', () => Effect.gen(function*() { ... }))
 *   })
 *
 * Responses are served round-robin — index wraps around at end of array.
 *
 * noContentLengthFetchLayer rationale:
 *   HttpClientRequest.setBody writes content-length into request headers.
 *   Node.js fetch ALSO computes content-length from the body and appends it.
 *   WHATWG Headers joins the two values as "N, M" (comma-separated), which
 *   undici@8.2.0 rejects as an invalid content-length. Stripping the header
 *   before fetch lets Node.js compute it exactly once from the body.
 */
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { NodeHttpServer } from '@effect/platform-node'
import { Context, Effect, Layer, Ref } from 'effect'
import {
  FetchHttpClient,
  Headers,
  HttpClient,
  HttpClientRequest,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http'
import type { ServeError } from 'effect/unstable/http/HttpServerError'

export interface StubResponse {
  readonly status: number
  readonly body: string
}

export class FakeOpenAiStub extends Context.Service<FakeOpenAiStub, { readonly url: string }>()(
  'test/FakeOpenAiStub',
) {}

export const FakeOpenAiStubLive = (responses: readonly StubResponse[]): Layer.Layer<FakeOpenAiStub, ServeError> =>
  Layer.effect(
    FakeOpenAiStub,
    Effect.gen(function* () {
      const server = yield* HttpServer.HttpServer
      const indexRef = yield* Ref.make(0)

      // Use server.serve() directly — avoids Layer.build memomap lookup which would
      // create a second server (NodeHttpServer.layerTest uses Layer.fresh, bypassing memo).
      // Read body via req.text (NodeStream.toString + Effect.callback) — this does NOT
      // add a scope finalizer that destroys the IncomingMessage socket, unlike req.stream
      // (Stream.runDrain closes the channel scope → readableToPullUnsafe finalizer →
      // IncomingMessage.destroy() → TCP RST before response is written).
      yield* server.serve(
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest
          yield* req.text
          const i = yield* Ref.modify(indexRef, n => [n, n + 1])
          const r = responses[i % responses.length] ?? responses[0] ?? { body: '{}', status: 200 }
          return HttpServerResponse.text(r.body, { contentType: 'application/json', status: r.status })
        }),
      )

      const address = server.address
      const host =
        address._tag === 'TcpAddress' ?
          address.hostname === '0.0.0.0' ?
            '127.0.0.1'
          : address.hostname
        : '127.0.0.1'
      const port = address._tag === 'TcpAddress' ? address.port : 0

      return { url: `http://${host}:${port}` }
    }),
  ).pipe(Layer.provide(NodeHttpServer.layerTest))

// Strips content-length before fetch so Node.js computes it exactly once from the body.
const noContentLengthFetchLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const base = yield* HttpClient.HttpClient
    return HttpClient.mapRequest(base, req =>
      HttpClientRequest.makeWith(
        req.method,
        req.url,
        req.urlParams,
        req.hash,
        Headers.remove(req.headers, 'content-length'),
        req.body,
      ),
    )
  }),
).pipe(Layer.provide(FetchHttpClient.layer))

/** Combines stub server + OpenAI client in one layer. Responses are served round-robin. */
export const makeLlmStubLayer = (responses: readonly StubResponse[]) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const { url } = yield* FakeOpenAiStub
      return OpenAiLanguageModel.layer({ model: 'stub' }).pipe(
        Layer.provide(OpenAiClient.layer({ apiUrl: url })),
        Layer.provide(noContentLengthFetchLayer),
      )
    }),
  ).pipe(Layer.provide(FakeOpenAiStubLive(responses)))
