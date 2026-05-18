import type { Effect } from 'effect'
import { Context, Schema } from 'effect'
import type { CorrelationId, HandleId, SessionId } from '../../domain/ids.ts'

export interface GoalSubmission {
  readonly goal: string
  readonly handleId: HandleId
  readonly sessionId?: SessionId
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
    readonly respond: (
      correlationId: CorrelationId,
      text: string,
      sessionId: SessionId,
    ) => Effect.Effect<void, UserGatewayError>
  }
>()('@app/host/ports/driving/UserGateway') {}
