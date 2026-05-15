import { DateTime, Effect, Random } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { GoalSubmission } from '../ports/driving/UserGateway.ts'
import { checkQuarantine, SessionQuarantinedError } from './quarantine.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'

export { SessionQuarantinedError }

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
      kind: 'GoalSubmitted',
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

    yield* store.append({
      actor: 'host',
      correlationId,
      kind: 'GoalCompleted',
      occurredAt: DateTime.formatIso(yield* DateTime.now),
      payload: { text: response.text },
      schemaV: 1,
      sessionId,
      storyRef: 'S1',
    })
  })
