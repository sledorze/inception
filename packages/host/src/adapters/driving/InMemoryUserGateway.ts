import { Effect, Layer, MutableRef } from 'effect'
import type { CorrelationId, SessionId } from '../../domain/ids.ts'
import { UserGateway } from '../../ports/driving/UserGateway.ts'
import type { GoalSubmission } from '../../ports/driving/UserGateway.ts'

export type RespondedCall = { correlationId: CorrelationId; text: string; sessionId: SessionId }

export const InMemoryUserGateway = {
  /** Convenience layer for callers that don't need postcondition inspection. */
  layer: (goals: readonly GoalSubmission[]) => InMemoryUserGateway.layerWithResponds(goals).layer,

  /**
   * Returns the layer AND a MutableRef holding all `respond` calls so tests can assert postconditions.
   * MutableRef is synchronous — tests read it with `MutableRef.get(responds)` after `respond` resolves.
   */
  layerWithResponds: (goals: readonly GoalSubmission[]) => {
    const responds = MutableRef.make<readonly RespondedCall[]>([])
    const layer = Layer.effect(
      UserGateway,
      Effect.succeed(
        UserGateway.of({
          listen: onGoal =>
            Effect.gen(function* () {
              for (const goal of goals) {
                yield* onGoal(goal)
              }
            }),
          respond: (correlationId, text, sessionId) =>
            Effect.sync(() => MutableRef.update(responds, calls => [...calls, { correlationId, sessionId, text }])),
        }),
      ),
    )
    return { layer, responds }
  },
}
