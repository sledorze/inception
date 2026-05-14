import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Effect, Layer } from 'effect'
import { z } from 'zod'
import { ObservabilityGateway } from '../../ports/driving/ObservabilityGateway.ts'
import type { ObservedEvent } from '../../ports/driving/ObservabilityGateway.ts'

const listEventsSchema = {
  limit: z.number().int().positive().optional(),
  sessionId: z.string().optional(),
  storyRef: z.string().optional(),
}

const replaySchema = {
  fromId: z.string(),
}

const textContent = (text: string) => ({ content: [{ text, type: 'text' as const }] })

export const StdioMcpObservabilityAdapter = {
  layer: Layer.effectDiscard(
    Effect.gen(function* () {
      const gw = yield* ObservabilityGateway

      const mcp = new McpServer({ name: 'inception-observability', version: '0.1.0' })

      mcp.registerTool(
        'list-events',
        {
          description: 'Query events from the event store. Returns a JSON array of ObservedEvent matching the filter.',
          inputSchema: listEventsSchema,
        },
        async args =>
          Effect.runPromise(
            gw
              .query({
                ...(args.limit !== undefined && { limit: args.limit }),
                ...(args.sessionId !== undefined && { sessionId: args.sessionId }),
                ...(args.storyRef !== undefined && { storyRef: args.storyRef }),
              })
              .pipe(
                Effect.map(events => textContent(JSON.stringify(events, null, 2))),
                Effect.catch(error => Effect.succeed({ ...textContent(String(error)), isError: true as const })),
              ),
          ),
      )

      mcp.registerTool(
        'replay',
        {
          description: 'Replay events in append order starting from the given event ID (inclusive).',
          inputSchema: replaySchema,
        },
        async args => {
          const collected: ObservedEvent[] = []
          // @effect-diagnostics-next-line runEffectInsideEffect:off
          return Effect.runPromise(
            gw
              .replay(args.fromId, e => Effect.sync(() => collected.push(e)))
              .pipe(
                Effect.map(() => textContent(JSON.stringify(collected, null, 2))),
                Effect.catch(error => Effect.succeed({ ...textContent(String(error)), isError: true as const })),
              ),
          )
        },
      )

      const transport = new StdioServerTransport()
      // @effect-diagnostics-next-line unknownInEffectCatch:off
      yield* Effect.tryPromise({
        catch: cause => cause,
        try: () => mcp.connect(transport),
      })

      yield* Effect.addFinalizer(() =>
        Effect.tryPromise({
          catch: () => null,
          try: () => mcp.close(),
        }).pipe(Effect.ignore),
      )
    }),
  ),
}
