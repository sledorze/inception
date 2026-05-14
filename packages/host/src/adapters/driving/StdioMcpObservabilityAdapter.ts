import { Effect, Layer, Schema } from 'effect'
import { McpServer, Tool, Toolkit } from 'effect/unstable/ai'
import { NodeStdio } from '@effect/platform-node'
import { ObservabilityGateway } from '../../ports/driving/ObservabilityGateway.ts'

const ListEventsTool = Tool.make('list-events', {
  description: 'Query events from the event store. Returns matching ObservedEvents.',
  failure: Schema.Struct({ message: Schema.String }),
  failureMode: 'return',
  parameters: Schema.Struct({
    limit: Schema.optional(Schema.Number),
    sessionId: Schema.optional(Schema.String),
    storyRef: Schema.optional(Schema.String),
  }),
  success: Schema.Array(Schema.Unknown),
})

const ReplayTool = Tool.make('replay', {
  description: 'Replay events in append order starting from the given event ID (inclusive).',
  failure: Schema.Struct({ message: Schema.String }),
  failureMode: 'return',
  parameters: Schema.Struct({ fromId: Schema.String }),
  success: Schema.Array(Schema.Unknown),
})

const ObservabilityToolkit = Toolkit.make(ListEventsTool, ReplayTool)

const ObservabilityToolkitLive = ObservabilityToolkit.toLayer(
  Effect.gen(function* () {
    const gw = yield* ObservabilityGateway
    return ObservabilityToolkit.of({
      'list-events': Effect.fn('ObservabilityToolkit.listEvents')(function* (args) {
        return yield* gw
          .query({
            ...(args.limit !== undefined && { limit: args.limit }),
            ...(args.sessionId !== undefined && { sessionId: args.sessionId }),
            ...(args.storyRef !== undefined && { storyRef: args.storyRef }),
          })
          .pipe(Effect.mapError(error => ({ message: String(error.cause) })))
      }),
      replay: Effect.fn('ObservabilityToolkit.replay')(function* ({ fromId }) {
        const collected: unknown[] = []
        yield* gw
          .replay(fromId, e =>
            Effect.sync(() => {
              collected.push(e)
            }),
          )
          .pipe(Effect.mapError(error => ({ message: String(error.cause) })))
        return collected
      }),
    })
  }),
)

// Entry points using Layer.launch + NodeRuntime.runMain must also provide
// Logger.layer([Logger.consolePretty({ stderr: true })]) — stdout is the JSON-RPC channel.
export const StdioMcpObservabilityAdapter = {
  layer: McpServer.toolkit(ObservabilityToolkit).pipe(
    Layer.provideMerge(ObservabilityToolkitLive),
    Layer.provide(McpServer.layerStdio({ name: 'inception-observability', version: '0.1.0' })),
    Layer.provide(NodeStdio.layer),
  ),
}
