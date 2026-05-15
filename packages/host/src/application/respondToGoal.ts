import { DateTime, Effect, Option, Random, Schema } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { ClarifyRequestedPayload, EventKind, GoalSubmittedPayload } from '../domain/events.ts'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { StoredEvent } from '../ports/driven/EventStore.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'

export class ClarifyNotFoundError extends Schema.TaggedErrorClass<ClarifyNotFoundError>()(
  '@app/host/ClarifyNotFoundError',
  { correlationId: Schema.String },
) {}

// Returns decoded { goal, question } wrapped in Some, or None when either event is absent.
// Malformed payloads are defects (die), not business errors.
const findClarifyContext = (
  events: readonly StoredEvent[],
): Effect.Effect<Option.Option<{ readonly goal: string; readonly question: string }>> => {
  const goalEvent = events.find(e => e.kind === EventKind.GoalSubmitted)
  const clarifyEvent = events.findLast(e => e.kind === EventKind.ClarifyRequested)
  if (goalEvent === undefined || clarifyEvent === undefined) {
    return Effect.succeed(Option.none())
  }
  return Effect.all({
    clarifyPayload: Schema.decodeUnknownEffect(ClarifyRequestedPayload)(clarifyEvent.payload).pipe(Effect.orDie),
    goalPayload: Schema.decodeUnknownEffect(GoalSubmittedPayload)(goalEvent.payload).pipe(Effect.orDie),
  }).pipe(
    Effect.map(({ goalPayload, clarifyPayload }) =>
      Option.some({ goal: goalPayload.goal, question: clarifyPayload.question }),
    ),
  )
}

export const makeRespondToGoal = <Tools extends Record<string, Tool.Any>>(
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
) =>
  Effect.fn('application.respondToGoal')(function* (correlationId: string, answer: string, sessionId: string) {
    const store = yield* EventStore
    // Query by correlationId only: ClarifyRequested uses sessionId='bootstrap' (toolkit context).
    const events = yield* store.query({ correlationId })

    const ctxOpt = yield* findClarifyContext(events)
    if (Option.isNone(ctxOpt)) {
      return yield* new ClarifyNotFoundError({ correlationId })
    }

    const { goal, question } = ctxOpt.value

    yield* store.append({
      actor: 'user',
      correlationId,
      kind: EventKind.ClarifyAnswered,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { answer, question },
      schemaV: 1,
      sessionId,
      storyRef: 'S8',
    })

    const agentMd = yield* readAgentMd({ path: AGENT_MD_PATH })
    const newCorrelationId = yield* Random.nextUUIDv4
    const response = yield* Effect.provideService(
      LanguageModel.generateText({
        prompt: [
          { content: agentMd, role: 'system' },
          { content: goal, role: 'user' },
          { content: question, role: 'assistant' },
          { content: answer, role: 'user' },
        ],
        toolkit,
      }),
      CurrentCorrelationId,
      newCorrelationId,
    )

    yield* store.append({
      actor: 'host',
      correlationId,
      kind: EventKind.GoalCompleted,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { text: response.text },
      schemaV: 1,
      sessionId,
      storyRef: 'S8',
    })

    return { correlationId, sessionId }
  })
