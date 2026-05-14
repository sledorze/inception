import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface ToolDescriptor {
  readonly name: string
  readonly description: string
  readonly inputSchema: unknown
}

export class ToolNotFound extends Schema.TaggedErrorClass<ToolNotFound>()('@app/host/ToolNotFound', {
  name: Schema.String,
}) {}

export class ToolRegistry extends Context.Service<
  ToolRegistry,
  {
    readonly listTools: (role: string) => Effect.Effect<readonly ToolDescriptor[]>
    readonly get: (name: string) => Effect.Effect<ToolDescriptor, ToolNotFound>
  }
>()('@app/host/ports/driven/ToolRegistry') {}
