import { Effect, Schema } from 'effect'
import {
  ClarifyAnsweredPayload,
  ClarifyRequestedPayload,
  EventKind,
  GoalCompletedPayload,
  GoalSubmittedPayload,
} from '../domain/events.ts'
import type { StoredEvent } from '../ports/driven/EventStore.ts'

export interface SessionTurn {
  readonly correlationId: string
  readonly turnIndex: number
  readonly goal: string
  readonly reply?: string
  readonly clarifyQuestion?: string
  readonly clarifyAnswer?: string
}

// Projection of a sessionId event chain into ordered SessionTurns (Kleppmann/Young: no event reshaping).
// Shared between sessionTurnsRoute (HTTP display) and multi-turn recall in submitGoal/respondToGoal (L3.5).
export const projectSessionTurns = Effect.fn('application.projectSessionTurns')(function* (
  events: readonly StoredEvent[],
) {
  const goals = new Map<string, string>()
  const replies = new Map<string, string>()
  const clarifyQuestions = new Map<string, string>()
  const clarifyAnswers = new Map<string, string>()
  const order: string[] = []

  for (const e of events) {
    if (e.kind === EventKind.GoalSubmitted) {
      const p = yield* Schema.decodeUnknownEffect(GoalSubmittedPayload)(e.payload).pipe(Effect.orDie)
      goals.set(e.correlationId, p.goal)
      order.push(e.correlationId)
    } else if (e.kind === EventKind.GoalCompleted) {
      const p = yield* Schema.decodeUnknownEffect(GoalCompletedPayload)(e.payload).pipe(Effect.orDie)
      replies.set(e.correlationId, p.text)
    } else if (e.kind === EventKind.ClarifyAnswered) {
      const p = yield* Schema.decodeUnknownEffect(ClarifyAnsweredPayload)(e.payload).pipe(Effect.orDie)
      clarifyAnswers.set(e.correlationId, p.answer)
    } else if (e.kind === EventKind.ClarifyRequested) {
      // Collect inline — avoids N+1 store.query calls per turn.
      const p = yield* Schema.decodeUnknownEffect(ClarifyRequestedPayload)(e.payload).pipe(Effect.orDie)
      clarifyQuestions.set(e.correlationId, p.question)
    }
  }

  let idx = 0
  return order
    .filter(cid => replies.has(cid) || clarifyQuestions.has(cid))
    .map(cid => {
      const turn: SessionTurn = {
        correlationId: cid,
        goal: goals.get(cid) ?? '',
        turnIndex: idx++,
        ...(replies.has(cid) ? { reply: replies.get(cid) as string } : {}),
        ...(clarifyQuestions.has(cid) ? { clarifyQuestion: clarifyQuestions.get(cid) as string } : {}),
        ...(clarifyAnswers.has(cid) ? { clarifyAnswer: clarifyAnswers.get(cid) as string } : {}),
      }
      return turn
    })
})
