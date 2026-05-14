import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export class PolicyDenied extends Schema.TaggedErrorClass<PolicyDenied>()('@app/host/PolicyDenied', {
  reason: Schema.String,
  toolName: Schema.String,
}) {}

export class PolicyGate extends Context.Service<
  PolicyGate,
  {
    // Returns void if the tool is permitted; fails with PolicyDenied if not.
    readonly check: (toolName: string) => Effect.Effect<void, PolicyDenied>
    // Explicitly permits a tool name (used at bootstrap and by future promotion path).
    readonly permit: (toolName: string) => Effect.Effect<void>
  }
>()('@app/host/PolicyGate') {}
