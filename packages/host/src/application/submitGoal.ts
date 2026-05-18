import { Cause, DateTime, Effect, Option, Random } from 'effect'
import { AiError, LanguageModel } from 'effect/unstable/ai'
import type { LanguageModel as LanguageModelNS, Tool } from 'effect/unstable/ai'
import { EventKind } from '../domain/events.ts'
import { CurrentCorrelationId, CurrentTenantId } from '../domain/tracing.ts'
import { DataHandleRegistry } from '../ports/driven/DataHandle.ts'
import { canonicalJson, EventStore } from '../ports/driven/EventStore.ts'
import { ToolRegistry } from '../ports/driven/ToolRegistry.ts'
import type { GoalSubmission } from '../ports/driving/UserGateway.ts'
import { checkQuarantine } from './quarantine.ts'
import { checkSessionDeleted } from './deleteSession.ts'
import { AGENT_MD_PATH, readAgentMd } from './session.ts'
import { projectSessionTurns } from './sessionTurns.ts'

// Max LLM rounds per goal to prevent infinite tool-call loops.
const MAX_AGENT_ROUNDS = 4

// §12 Bootstrap inventory: S6 session recall window. bootstrap=true; L3.5/S6. SPEC:459-463.
export const RECALL_WINDOW = 3

type MsgEntry = { role: string; content: unknown }

export interface AgentBrief {
  readonly agentMd: string
  readonly goal: string
  readonly role: string
  readonly tools: readonly { name: string; description: string }[]
  readonly handles: readonly { id: string; schema: unknown; redactedSample: unknown }[]
  readonly priorTurns: readonly { goal: string; reply: string }[]
}

// Pure function — testable without Effect context.
// Message layout (most-stable → most-volatile) optimises llama.cpp prefix-KV reuse:
//   [0] system: agent.md verbatim — byte-identical across ALL requests; shared static cache root.
//   [1] system: session brief (role, handle schemas) — volatile per session, stable within it.
//   [2..N] prior turn pairs (user: goal, assistant: reply) — bounded to RECALL_WINDOW; curated
//          (no raw tool rounds) per L3.5/S6; oldest→newest; prefix stable until window slides
//          at >RECALL_WINDOW (drop-oldest); accepted tradeoff at bootstrap N=3.
//   [N+1] user: current goal
//   [N+2+] assistant/tool rounds appended by runAgentLoop (append-only, preserves prefix)
// Tools are passed structurally via the LanguageModel toolkit; prose tool list is intentionally
// absent to keep [1] free of per-registry-call volatility. redactedSample is excluded; the
// model inspects schemas at tool-call time via fetch-handle-shape. canonicalJson ensures
// byte-identical schema rendering regardless of JS key-insertion order.
export const buildInitialMessages = (b: AgentBrief): MsgEntry[] => {
  const handleLines = b.handles.map(h => `- **${h.id}**: schema = ${canonicalJson(h.schema)}`)
  const briefText = [
    '## Session brief',
    '',
    `Your active role in this session is: **${b.role}**`,
    `When calling tools that require a role parameter, always pass role="${b.role}".`,
    '',
    '### Data handles in scope',
    ...handleLines,
    '',
    'IMPORTANT: You MUST call tools to answer — never rely on general knowledge about the data.',
    `Start by calling list-tools with role="${b.role}", then inspect the handle with fetch-handle-shape or run-script.`,
    'If the goal is ambiguous, call `request-clarification` rather than guessing.',
  ].join('\n')

  const recallPairs: MsgEntry[] = b.priorTurns.flatMap(t => [
    { content: [{ text: t.goal, type: 'text' }], role: 'user' },
    { content: [{ text: t.reply, type: 'text' }], role: 'assistant' },
  ])

  return [
    { content: b.agentMd, role: 'system' },
    { content: briefText, role: 'system' },
    ...recallPairs,
    { content: [{ text: b.goal, type: 'text' }], role: 'user' },
  ]
}

// Runs generateText and converts ToolParameterValidationError into a failed tool-result
// message visible to Georges, so he can self-correct on the next round (P54).
// Without this, a missing required param (e.g. "role" on list-tools) surfaces as a 500.
// One recovery attempt only — a second consecutive validation error propagates normally.
//
// Effect.fn cannot wrap this function because TypeScript collapses generic type parameters
// when passing generic functions to higher-order wrappers (Args loses the Tools binding).
// Effect.withSpan is used instead to preserve the tracing span.
const generateWithRecovery = <Tools extends Record<string, Tool.Any>>(
  msgs: readonly MsgEntry[],
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
  correlationId: string,
) => {
  const callLlm = (m: readonly MsgEntry[]) =>
    Effect.provideService(
      LanguageModel.generateText({
        prompt: m as Parameters<typeof LanguageModel.generateText>[0]['prompt'],
        toolkit,
      }),
      CurrentCorrelationId,
      correlationId,
    )

  return callLlm(msgs).pipe(
    Effect.catchCause(cause => {
      const maybeErr = Cause.findErrorOption(cause)
      if (Option.isNone(maybeErr)) {
        return Effect.failCause(cause)
      }
      const err = maybeErr.value
      if (!AiError.isAiError(err) || err.reason._tag !== 'ToolParameterValidationError') {
        return Effect.failCause(cause)
      }
      const reason = err.reason
      return Effect.gen(function* () {
        const syntheticId = yield* Random.nextUUIDv4
        const recovery: readonly MsgEntry[] = [
          ...msgs,
          {
            content: [
              {
                id: syntheticId,
                name: reason.toolName,
                params: reason.toolParams as unknown, // cast: raw JSON from wire; MsgEntry content accepts unknown at this position
                providerExecuted: false,
                type: 'tool-call' as const,
              },
            ],
            role: 'assistant',
          },
          {
            content: [
              {
                id: syntheticId,
                isFailure: true,
                name: reason.toolName,
                result: reason.message,
                type: 'tool-result' as const,
              },
            ],
            role: 'tool',
          },
        ]
        return yield* callLlm(recovery)
      })
    }),
    Effect.withSpan('submitGoal.generateWithRecovery'),
  )
}

// Agentic loop: calls the LLM up to MAX_AGENT_ROUNDS times, appending tool results
// back into the prompt each round. Stops when the model makes no more tool calls or
// calls request-clarification. Models may emit reasoning text alongside tool calls
// (finish_reason=tool_calls) — text alone is not a stop signal.
const runAgentLoop = <Tools extends Record<string, Tool.Any>>(
  brief: AgentBrief,
  toolkit: LanguageModelNS.ToolkitOption<Tools, never, never>,
  correlationId: string,
) =>
  Effect.gen(function* () {
    let messages: MsgEntry[] = buildInitialMessages(brief)

    let response = yield* generateWithRecovery(messages, toolkit, correlationId)

    for (let round = 1; round < MAX_AGENT_ROUNDS; round++) {
      // Stop when no tool calls remain (final answer) or clarification is requested.
      // Note: do NOT stop on non-empty text — the model may emit reasoning text alongside
      // tool calls (finish_reason=tool_calls); stopping early drops those results.
      if (response.toolCalls.length === 0 || response.toolCalls.some(tc => tc.name === 'request-clarification')) {
        break
      }

      // Append the LLM's tool-call round + results, then continue.
      messages = [
        ...messages,
        {
          content: response.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            params: tc.params as unknown,
            providerExecuted: tc.providerExecuted,
            type: 'tool-call' as const,
          })),
          role: 'assistant',
        },
        {
          content: response.toolResults.map(tr => ({
            id: tr.id,
            isFailure: tr.isFailure,
            name: tr.name,
            result: tr.encodedResult,
            type: 'tool-result' as const,
          })),
          role: 'tool',
        },
      ]

      response = yield* generateWithRecovery(messages, toolkit, correlationId)
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
    const tenantId = yield* CurrentTenantId

    // Block deleted sessions before touching the LLM.
    yield* checkSessionDeleted(sessionId)
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
      tenantId,
    })

    const agentMd = yield* readAgentMd({ path: AGENT_MD_PATH })

    // Load prior completed turns for Host-curated session recall (S6/L3.5, §12: RECALL_WINDOW=3).
    // Query after GoalSubmitted append: the current turn has no reply yet, so the flatMap
    // filter excludes it; the correlationId guard is belt-and-braces.
    const priorEvents = yield* store.query({ sessionId })
    const priorTurns = (yield* projectSessionTurns(priorEvents))
      .filter(t => t.correlationId !== correlationId)
      .flatMap(t => (t.reply !== undefined ? [{ goal: t.goal, reply: t.reply }] : []))
      .slice(-RECALL_WINDOW)

    // Build session brief: enumerate available tools and fetch the handle shape.
    // Both ToolRegistry and DataHandleRegistry are driven ports (L2.14-clean).
    const registry = yield* ToolRegistry
    const handleReg = yield* DataHandleRegistry
    const tools = yield* registry.listTools('enduser')
    const handleShape = yield* handleReg.get(s.handleId).pipe(
      Effect.flatMap(h => h.fetchShape()),
      Effect.map(shape => [{ id: s.handleId, redactedSample: shape.redactedSample, schema: shape.schema }]),
      // Degrade gracefully: omit handle from brief if revoked or unavailable.
      Effect.orElseSucceed(() => [] as { id: string; schema: unknown; redactedSample: unknown }[]),
    )

    const brief: AgentBrief = {
      agentMd,
      goal: s.goal,
      handles: handleShape,
      priorTurns,
      role: 'enduser',
      tools: tools.map(t => ({ description: t.description, name: t.name })),
    }

    const response = yield* runAgentLoop(brief, toolkit, correlationId).pipe(
      Effect.onError(cause =>
        DateTime.now.pipe(
          Effect.flatMap(now =>
            store.append({
              actor: 'host',
              correlationId,
              kind: EventKind.GoalFailed,
              occurredAt: DateTime.formatIso(now),
              payload: { detail: Cause.pretty(cause), error: 'agent_loop_failed' },
              schemaV: 1,
              sessionId,
              storyRef: 'S1',
              tenantId,
            }),
          ),
          Effect.orDie,
        ),
      ),
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
        tenantId,
      })
    }

    return { correlationId, sessionId }
  })
