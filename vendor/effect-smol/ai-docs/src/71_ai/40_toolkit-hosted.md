# Hosting a Toolkit as a service layer (`failureMode: 'return'`)

This pattern applies when you own both the toolkit definition AND the handlers —
i.e., you are building the **server side** of an MCP-style tool surface, not
consuming one from a language model.

---

## 1. Declare tools with `failureMode: 'return'`

```typescript
import { Tool, Toolkit } from 'effect/unstable/ai'
import { Schema } from 'effect'

const ToolFailure = Schema.Struct({ message: Schema.String })

export const EchoTool = Tool.make('echo', {
  description: 'Echoes a message back.',
  failure: ToolFailure,
  failureMode: 'return',     // ← required if the handler can ever call Effect.fail()
  parameters: Schema.Struct({ message: Schema.String }),
  success: Schema.Struct({ echo: Schema.String }),
})

export const DivideTool = Tool.make('divide', {
  description: 'Divides two numbers. Fails if divisor is zero.',
  failure: ToolFailure,
  failureMode: 'return',
  parameters: Schema.Struct({ dividend: Schema.Number, divisor: Schema.Number }),
  success: Schema.Struct({ quotient: Schema.Number }),
})
```

**Without `failureMode: 'return'`:** a handler that calls `Effect.fail()` becomes an
uncaught stream defect — the stream errors out and the caller sees a crash, not a
structured error. Always add `failureMode: 'return'` when a tool can fail structurally
(permission denied, resource not found, validation error, etc.).

---

## 2. Group into a Toolkit

```typescript
export const DemoToolkit = Toolkit.make(EchoTool, DivideTool)
// DemoToolkit is also the Context.Tag you yield to access handlers.
```

---

## 3. Implement handlers with `toLayer`

```typescript
import { Clock, Effect } from 'effect'

export const DemoToolkitLive = DemoToolkit.toLayer(
  Effect.gen(function* () {
    // Acquire shared services here (database, external API, etc.)
    // const db = yield* DatabaseService

    return DemoToolkit.of({
      // Keys must match Tool names exactly — TypeScript enforces this.
      // Use Effect.fn for named spans.
      divide: Effect.fn('DemoToolkit.divide')(function* ({ dividend, divisor }) {
        if (divisor === 0) {
          return yield* Effect.fail({ message: 'division by zero' })
        }
        return { quotient: dividend / divisor }
      }),

      echo: Effect.fn('DemoToolkit.echo')(function* ({ message }) {
        const ms = yield* Clock.currentTimeMillis
        return { echo: `[${new Date(ms).toISOString()}] ${message}` }
      }),
    })
  }),
)
```

---

## 4. Dispatch via `toolkit.handle`

```typescript
import { Option, Stream } from 'effect'

const callTool = (name: string, params: Record<string, unknown>) =>
  Effect.gen(function* () {
    const toolkit = yield* DemoToolkit
    const stream = yield* toolkit.handle(name as 'echo', params as { message: string })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })
```

The returned `HandlerResult` is:

```
{ isFailure: false, result: <success value> }   // normal path
{ isFailure: true,  result: <failure value> }   // Effect.fail() path (failureMode:'return')
```

Both cases arrive as a normal stream item — the stream itself never errors.

---

## 5. Wire layers

```typescript
import { Layer } from 'effect'

const appLayer = DemoToolkitLive.pipe(
  // Provide every service DemoToolkitLive requires:
  Layer.provide(SomeDatabaseLayer),
)
```

In tests, yield `DemoToolkit` (the Context.Tag) inside `layer(appLayer)(...)` and call
`toolkit.handle(...)` directly — no HTTP or MCP transport needed.

---

## Decision rule for `failureMode`

| Scenario | Value |
|---|---|
| Tool can return structured errors (permission denied, not found, invalid input) | `'return'` |
| Handler bugs should crash loudly (internal invariant violations) | `'error'` (default) |

In `packages/host`, ALL tools use `'return'` because the inner MCP surface is expected
to surface structured errors back to Georges rather than crash.
