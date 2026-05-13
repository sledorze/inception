import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface GoalSubmission {
  readonly goal: string
  readonly handleId: string
}

export class UserGatewayError extends Schema.TaggedErrorClass<UserGatewayError>()('@app/host/UserGatewayError', {
  cause: Schema.Defect,
}) {}

export class UserGateway extends Context.Service<
  UserGateway,
  {
    readonly listen: (
      onGoal: (submission: GoalSubmission) => Effect.Effect<void>,
    ) => Effect.Effect<void, UserGatewayError>
  }
>()('@app/host/UserGateway') {}
