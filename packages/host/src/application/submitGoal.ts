import { DateTime, Effect, Random } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { EventKind } from '../domain/events.ts'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { GoalSubmission } from '../ports/driving/UserGateway.ts'
import { checkQuarantine } from './quarantine.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'

// The toolkit is injected by the caller (main.ts or tests) to keep this service
// free of adapter imports (L2.14 application-layer-purity rule).
export const makeSubmitGoal = <Tools extends Record<string, Tool.Any>>(
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
) =>
  Effect.fn('application.submitGoal')(function* (s: GoalSubmission) {
    const sessionId = s.sessionId ?? 'bootstrap'
    const correlationId = yield* Random.nextUUIDv4
    const store = yield* EventStore

    // L2.3: block cycles for quarantined sessions before touching the LLM.
    yield* checkQuarantine(sessionId)

    yield* store.append({
      actor: 'user',
      correlationId,
      kind: EventKind.GoalSubmitted,
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { goal: s.goal, handleId: s.handleId },
      schemaV: 1,
      sessionId,
      storyRef: 'S1',
    })

    const agentMd = yield* readAgentMd({ path: AGENT_MD_PATH })
    const response = yield* Effect.provideService(
      LanguageModel.generateText({
        prompt: [
          { content: agentMd, role: 'system' },
          { content: [{ text: s.goal, type: 'text' }], role: 'user' },
        ],
        toolkit,
      }),
      CurrentCorrelationId,
      correlationId,
    )

    // Query by correlationId only: ClarifyRequested events are emitted with
    // sessionId='bootstrap' by the toolkit handler (sessionId not yet propagated
    // into tool context). Querying by correlationId is safe — each correlationId
    // is unique per goal submission.
    const events = yield* store.query({ correlationId })
    const clarifyPending = events.some(e => e.kind === EventKind.ClarifyRequested)

    if (!clarifyPending) {
      yield* store.append({
        actor: 'host',
        correlationId,
        kind: EventKind.GoalCompleted,
        occurredAt: DateTime.formatIso(yield* DateTime.now),
        payload: { text: response.text },
        schemaV: 1,
        sessionId,
        storyRef: 'S1',
      })
    }

    return { correlationId, sessionId }
  })
