import { randomUUID } from 'node:crypto'
import { Clock, Effect } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { GoalSubmission } from '../ports/driving/UserGateway.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'

// The toolkit is injected by the caller (main.ts or tests) to keep this service
// free of adapter imports (L2.14 application-layer-purity rule).
export const makeSubmitGoal = <Tools extends Record<string, Tool.Any>>(toolkit: LanguageModelNS.ToolkitOption<Tools>) =>
  Effect.fn('application.submitGoal')(function* (s: GoalSubmission) {
    const correlationId = randomUUID()
    const store = yield* EventStore
    const ms = yield* Clock.currentTimeMillis
    yield* store.append({
      actor: 'user',
      correlationId,
      kind: 'GoalSubmitted',
      occurredAt: new Date(ms).toISOString(),
      payload: { goal: s.goal, handleId: s.handleId },
      schemaV: 1,
      sessionId: 'bootstrap',
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

    const ms2 = yield* Clock.currentTimeMillis
    yield* store.append({
      actor: 'host',
      correlationId,
      kind: 'GoalCompleted',
      occurredAt: new Date(ms2).toISOString(),
      payload: { text: response.text },
      schemaV: 1,
      sessionId: 'bootstrap',
      storyRef: 'S1',
    })
  })
