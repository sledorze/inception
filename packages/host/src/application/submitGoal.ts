import { DateTime, Effect, Random } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { EventKind } from '../domain/events.ts'
import { CurrentCorrelationId } from '../domain/tracing.ts'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { GoalSubmission } from '../ports/driving/UserGateway.ts'
import { checkQuarantine } from './quarantine.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'

// Max LLM rounds per goal to prevent infinite tool-call loops.
const MAX_AGENT_ROUNDS = 4

// Agentic loop: calls the LLM up to MAX_AGENT_ROUNDS times, appending tool results
// back into the prompt when the LLM returns only tool calls with no text content.
// Stops early when: (a) LLM returns non-empty text, (b) request-clarification is called,
// or (c) no tool calls remain.
// This enables patterns like list-tools → propose-capability within a single goal.
const runAgentLoop = <Tools extends Record<string, Tool.Any>>(
  agentMd: string,
  goal: string,
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
  correlationId: string,
) =>
  Effect.gen(function* () {
    type MsgEntry = { role: string; content: unknown }
    let messages: MsgEntry[] = [
      { content: agentMd, role: 'system' },
      { content: [{ text: goal, type: 'text' }], role: 'user' },
    ]

    let response = yield* Effect.provideService(
      LanguageModel.generateText({
        // Cast is sound: the array literal is Iterable<MessageEncoded>-compatible.
        // The schema decoder in Prompt.make validates at runtime.
        prompt: messages as Parameters<typeof LanguageModel.generateText>[0]['prompt'],
        toolkit,
      }),
      CurrentCorrelationId,
      correlationId,
    )

    for (let round = 1; round < MAX_AGENT_ROUNDS; round++) {
      // Stop when the LLM produced text, made no tool calls, or asked for clarification.
      if (
        response.text.trim() !== '' ||
        response.toolCalls.length === 0 ||
        response.toolCalls.some(tc => tc.name === 'request-clarification')
      ) {
        break
      }

      // Append the LLM's tool-call round + results, then continue.
      messages = [
        ...messages,
        {
          content: response.toolCalls.map(tc => ({
            type: 'tool-call' as const,
            id: tc.id,
            name: tc.name,
            params: tc.params as unknown,
            providerExecuted: tc.providerExecuted,
          })),
          role: 'assistant',
        },
        {
          content: response.toolResults.map(tr => ({
            type: 'tool-result' as const,
            id: tr.id,
            name: tr.name,
            result: tr.encodedResult,
            isFailure: tr.isFailure,
          })),
          role: 'tool',
        },
      ]

      response = yield* Effect.provideService(
        LanguageModel.generateText({
          prompt: messages as Parameters<typeof LanguageModel.generateText>[0]['prompt'],
          toolkit,
        }),
        CurrentCorrelationId,
        correlationId,
      )
    }

    return response
  })

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
    const response = yield* runAgentLoop(agentMd, s.goal, toolkit, correlationId)

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
