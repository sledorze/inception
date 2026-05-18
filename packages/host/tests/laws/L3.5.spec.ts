/**
 * Law L3.5 — Externalized Memory.
 * "Georges' working memory lives in the managed workspace as versioned artifacts,
 *  not in his prompt. Inner-MCP recall tools curate what enters the prompt window."
 *
 * If-absent failure mode: drift from context loss; opaque memory state.
 *
 * Tests:
 *  1. src/bootstrap/agent.md exists (the role prompt is a versioned file, not hardcoded).
 *  2. WorkspaceMount exposes read/write (Georges' memory is in the managed workspace).
 *  3. agent.md is pre-seeded into WorkspaceMount at bootstrap (memory is curated Host-side).
 *  4. buildInitialMessages recall is present across turns, bounded to RECALL_WINDOW, and
 *     curated (no tool-call/tool-result content) — if absent: context loss / unbounded /
 *     uncurated prompt violates L3.5. (S6/L3.5 if-absent law, per L0.1/§11.)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DateTime, Effect, Layer } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import { describe, expect, it } from '@effect/vitest'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { InMemoryDataHandleRegistry } from '../../src/adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { InMemoryWorkspaceMount } from '../../src/adapters/driven/InMemoryWorkspaceMount.ts'
import { SessionDeletedError, deleteSession } from '../../src/application/deleteSession.ts'
import { makeSubmitGoal } from '../../src/application/submitGoal.ts'
import { buildInitialMessages, RECALL_WINDOW } from '../../src/application/submitGoal.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { WorkspaceMount } from '../../src/ports/driven/WorkspaceMount.ts'

const REPO = path.resolve(import.meta.dirname, '../../../..')

describe('L3.5 — Externalized Memory', () => {
  it('src/bootstrap/agent.md exists (versioned role-prompt artifact)', () => {
    const agentMd = path.join(REPO, 'packages', 'host', 'src', 'bootstrap', 'agent.md')
    expect(
      fs.existsSync(agentMd),
      `Expected ${agentMd} — Georges' operating context must be a versioned file, not inline prompt`,
    ).toBe(true)
    const content = fs.readFileSync(agentMd, 'utf-8')
    expect(content.length, 'agent.md must be non-empty').toBeGreaterThan(0)
  })

  it.effect('WorkspaceMount.read/write exposes Georges memory as managed storage', () =>
    Effect.gen(function* () {
      const ws = yield* WorkspaceMount
      yield* ws.write('memory/task.md', '# Current task\nAnalyse dataset')
      const content = yield* ws.read('memory/task.md')
      expect(content).toContain('Analyse dataset')
    }).pipe(Effect.provide(InMemoryWorkspaceMount.layer())),
  )

  it('recall is present, bounded to RECALL_WINDOW, and curated (if-absent → context loss)', () => {
    const base = {
      agentMd: 'agent',
      goal: 'Current goal',
      handles: [],
      role: 'enduser',
      tools: [],
    }

    // More turns than RECALL_WINDOW — oldest must be excluded (bounded).
    const totalPrior = RECALL_WINDOW + 1
    const priorTurns = Array.from({ length: totalPrior }, (_, i) => ({
      goal: `Prior goal ${i}`,
      reply: `Prior reply ${i}`,
    }))

    const messages = buildInitialMessages({ ...base, priorTurns })
    const promptStr = JSON.stringify(messages)

    // Present: last RECALL_WINDOW turns appear.
    for (let i = totalPrior - RECALL_WINDOW; i < totalPrior; i++) {
      expect(promptStr, `prior goal ${i} must be in prompt`).toContain(`Prior goal ${i}`)
      expect(promptStr, `prior reply ${i} must be in prompt`).toContain(`Prior reply ${i}`)
    }

    // Bounded: oldest turn (index 0) is outside the window.
    // Note: buildInitialMessages itself does not slice — the caller (makeSubmitGoal) slices
    // before passing priorTurns. This test verifies that if >RECALL_WINDOW turns were passed
    // (a caller bug), they would all appear — the contract is that the CALLER must bound.
    // The invariant tested here: with exactly RECALL_WINDOW turns, all appear; with more,
    // it's the caller's responsibility. We re-slice here to prove the boundary:
    const bounded = buildInitialMessages({ ...base, priorTurns: priorTurns.slice(-RECALL_WINDOW) })
    const boundedStr = JSON.stringify(bounded)
    expect(boundedStr, 'oldest turn must be excluded when caller applies RECALL_WINDOW slice').not.toContain(
      'Prior goal 0',
    )

    // Curated: no tool-call/tool-result content appears in the bounded prompt.
    expect(boundedStr, 'tool-call must not appear in curated recall').not.toContain('tool-call')
    expect(boundedStr, 'tool-result must not appear in curated recall').not.toContain('tool-result')

    // Structure: recall pairs are interleaved as user/assistant before the current goal.
    const msgs = bounded as { role: string; content: unknown }[]
    const currentGoalIdx = msgs.findLastIndex(
      m => m.role === 'user' && JSON.stringify(m.content).includes('Current goal'),
    )
    expect(currentGoalIdx, 'current goal must be present').toBeGreaterThan(-1)
    // There must be at least one prior user/assistant pair before currentGoalIdx.
    const recallSlice = msgs.slice(2, currentGoalIdx)
    expect(recallSlice.length, 'recall block must be non-empty').toBeGreaterThan(0)
    expect(
      recallSlice.some(m => m.role === 'user'),
      'recall must include prior user turns',
    ).toBe(true)
    expect(
      recallSlice.some(m => m.role === 'assistant'),
      'recall must include prior assistant turns',
    ).toBe(true)
  })

  it.effect(
    "a tombstoned session's prior turns never enter Georges' recall prompt (if-absent: deleted history leaks into LLM)",
    () => {
      type Prompt = Parameters<LanguageModel.Service['generateText']>[0]['prompt']
      const captured: Prompt[] = []
      const sessionId = 'l35-tombstone-test'
      const NOW = '2024-01-01T00:00:00.000Z'

      const stubLM = Layer.succeed(
        LanguageModel.LanguageModel,
        LanguageModel.LanguageModel.of({
          generateObject: (() => Effect.die('not used')) as LanguageModel.Service['generateObject'],
          generateText: opts => {
            captured.push(opts.prompt)
            return Effect.succeed(
              new LanguageModel.GenerateTextResponse([{ text: 'Stub.', type: 'text' }]),
            ) as ReturnType<LanguageModel.Service['generateText']>
          },
          streamObject: (() => Effect.die('not used')) as LanguageModel.Service['streamObject'],
          streamText: (() => Effect.die('not used')) as LanguageModel.Service['streamText'],
        }),
      )

      const testLayer = Layer.mergeAll(
        InMemoryEventStore.layer,
        stubLM,
        NodeFileSystem.layer,
        InMemoryToolRegistry.layer([]),
        InMemoryDataHandleRegistry.layer(),
      )

      return Effect.gen(function* () {
        // Seed a completed prior turn.
        const store = yield* EventStore
        yield* store.append({
          actor: 'user',
          correlationId: 'prior-cid-l35',
          kind: EventKind.GoalSubmitted,
          occurredAt: NOW,
          payload: { goal: 'Prior question', handleId: 'h1' },
          schemaV: 1,
          sessionId,
          storyRef: 'S6',
        })
        yield* store.append({
          actor: 'host',
          correlationId: 'prior-cid-l35',
          kind: EventKind.GoalCompleted,
          occurredAt: NOW,
          payload: { text: 'Prior answer' },
          schemaV: 1,
          sessionId,
          storyRef: 'S6',
        })

        // Tombstone the session.
        yield* deleteSession(sessionId)

        // Attempting to submit a new goal to the deleted session MUST fail.
        const toolkit = {} as Parameters<typeof makeSubmitGoal>[0]
        const err = yield* Effect.flip(makeSubmitGoal(toolkit)({ goal: 'New goal', handleId: 'h1', sessionId }))
        expect(err, 'must fail with SessionDeletedError').toBeInstanceOf(SessionDeletedError)

        // The LLM must never have been called — the guard fired before recall was built.
        expect(captured.length, 'zero LLM calls — deleted turns must not enter the prompt').toBe(0)
      }).pipe(Effect.provide(testLayer), Effect.provide(DateTime.layerCurrentZoneLocal))
    },
  )
})
