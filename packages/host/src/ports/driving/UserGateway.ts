import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export interface GoalSubmission {
  readonly goal: string
  readonly handleId: string
  readonly sessionId?: string
}

export class UserGatewayError extends Schema.TaggedErrorClass<UserGatewayError>()('@app/host/UserGatewayError', {
  cause: Schema.Defect,
}) {}

export class UserGateway extends Context.Service<
  UserGateway,
  {
    readonly listen: <R>(
      onGoal: (submission: GoalSubmission) => Effect.Effect<void, never, R>,
    ) => Effect.Effect<void, UserGatewayError, R>
    readonly respond: (correlationId: string, text: string, sessionId: string) => Effect.Effect<void, UserGatewayError>
  }
>()('@app/host/ports/driving/UserGateway') {}
