import { Data, DateTime, Effect, Random } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'

export class ClarifyNotFoundError extends Data.TaggedError('@app/host/ClarifyNotFoundError')<{
  correlationId: string
}> {}

export const makeRespondToGoal = <Tools extends Record<string, Tool.Any>>(
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
) =>
  Effect.fn('application.respondToGoal')(function* (correlationId: string, answer: string, sessionId: string) {
    const store = yield* EventStore
    const events = yield* store.query({ correlationId, sessionId })

    const goalEvent = events.find(e => e.kind === 'GoalSubmitted')
    const clarifyEvent = events.findLast(e => e.kind === 'ClarifyRequested')

    if (goalEvent === undefined || clarifyEvent === undefined) {
      return yield* Effect.fail(new ClarifyNotFoundError({ correlationId }))
    }

    const { goal } = goalEvent.payload as { goal: string }
    const { question } = clarifyEvent.payload as { question: string }

    yield* store.append({
      actor: 'user',
      correlationId,
      kind: 'ClarifyAnswered',
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
      kind: 'GoalCompleted',
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { text: response.text },
      schemaV: 1,
      sessionId,
      storyRef: 'S8',
    })

    return { correlationId, sessionId }
  })
