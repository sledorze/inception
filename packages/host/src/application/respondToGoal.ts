import { DateTime, Effect, Option, Random, Schema } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { ClarifyRequestedPayload, EventKind, GoalSubmittedPayload } from '../domain/events.ts'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { DataHandleRegistry } from '../ports/driven/DataHandle.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { StoredEvent } from '../ports/driven/EventStore.ts'
import { ToolRegistry } from '../ports/driven/ToolRegistry.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'
import { buildInitialMessages, RECALL_WINDOW } from './submitGoal.ts'
import { projectSessionTurns } from './sessionTurns.ts'
import { checkSessionDeleted } from './deleteSession.ts'

export class ClarifyNotFoundError extends Schema.TaggedErrorClass<ClarifyNotFoundError>()(
  '@app/host/ClarifyNotFoundError',
  { correlationId: Schema.String },
) {}

// Returns decoded { goal, handleId, question } wrapped in Some, or None when either event is absent.
// Malformed payloads are defects (die), not business errors.
const findClarifyContext = (
  events: readonly StoredEvent[],
): Effect.Effect<Option.Option<{ readonly goal: string; readonly handleId: string; readonly question: string }>> => {
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
      Option.some({ goal: goalPayload.goal, handleId: goalPayload.handleId, question: clarifyPayload.question }),
    ),
  )
}

export const makeRespondToGoal = <Tools extends Record<string, Tool.Any>>(
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
) =>
  Effect.fn('application.respondToGoal')(function* (correlationId: string, answer: string, sessionId: string) {
    const store = yield* EventStore
    // Block deleted sessions before appending.
    yield* checkSessionDeleted(sessionId)
    // Query by correlationId only: ClarifyRequested uses sessionId='bootstrap' (toolkit context).
    const events = yield* store.query({ correlationId })

    const ctxOpt = yield* findClarifyContext(events)
    if (Option.isNone(ctxOpt)) {
      return yield* new ClarifyNotFoundError({ correlationId })
    }

    const { goal, handleId, question } = ctxOpt.value

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

    // Load prior completed turns for Host-curated session recall (S6/L3.5, §12: RECALL_WINDOW=3).
    const priorEvents = yield* store.query({ sessionId })
    const priorTurns = (yield* projectSessionTurns(priorEvents))
      .filter(t => t.correlationId !== correlationId)
      .flatMap(t => (t.reply !== undefined ? [{ goal: t.goal, reply: t.reply }] : []))
      .slice(-RECALL_WINDOW)

    // Rebuild the same brief as submitGoal so the model has full tool/handle context
    // on the clarification-answer turn (same root cause as P42 if omitted).
    const registry = yield* ToolRegistry
    const handleReg = yield* DataHandleRegistry
    const tools = yield* registry.listTools('enduser')
    const handleShape = yield* handleReg.get(handleId).pipe(
      Effect.flatMap(h => h.fetchShape()),
      Effect.map(shape => [{ id: handleId, redactedSample: shape.redactedSample, schema: shape.schema }]),
      Effect.orElseSucceed((): { id: string; schema: unknown; redactedSample: unknown }[] => []),
    )
    const initialMessages = buildInitialMessages({
      agentMd,
      goal,
      handles: handleShape,
      priorTurns,
      role: 'enduser',
      tools: tools.map(t => ({ description: t.description, name: t.name })),
    })

    const newCorrelationId = yield* Random.nextUUIDv4
    const response = yield* Effect.provideService(
      LanguageModel.generateText({
        prompt: [
          ...initialMessages,
          { content: question, role: 'assistant' },
          { content: [{ text: answer, type: 'text' }], role: 'user' },
        ] as Parameters<typeof LanguageModel.generateText>[0]['prompt'], // cast: array literal doesn't satisfy Effect AI's Prompt union; same pattern as submitGoal.ts
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
