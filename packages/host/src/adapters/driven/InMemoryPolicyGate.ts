import { Effect, Layer } from 'effect'
import { PolicyDenied, PolicyGate } from '../../ports/driven/PolicyGate.ts'

export const InMemoryPolicyGate = {
  layer: (permitted: readonly string[] = []): Layer.Layer<PolicyGate> =>
    Layer.effect(
      PolicyGate,
      Effect.sync(() => {
        const allowed = new Set<string>(permitted)
        return PolicyGate.of({
          check: toolName =>
            allowed.has(toolName) ?
              Effect.void
            : Effect.fail(
                new PolicyDenied({
                  reason: 'no active policy permits this tool',
                  toolName,
                }),
              ),
          permit: toolName =>
            Effect.sync(() => {
              allowed.add(toolName)
            }),
        })
      }),
    ),
}
