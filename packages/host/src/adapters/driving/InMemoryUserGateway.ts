import { Effect, Layer } from 'effect'
import { UserGateway } from '../../ports/driving/UserGateway.ts'
import type { GoalSubmission } from '../../ports/driving/UserGateway.ts'

export const InMemoryUserGateway = {
  layer: (goals: readonly GoalSubmission[]) =>
    Layer.effect(
      UserGateway,
      Effect.succeed(
        UserGateway.of({
          listen: onGoal =>
            Effect.gen(function* () {
              for (const goal of goals) {
                yield* onGoal(goal)
              }
            }),
        }),
      ),
    ),
}
