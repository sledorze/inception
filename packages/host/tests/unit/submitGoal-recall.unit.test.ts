/**
 * Acceptance test — bounded Host-curated last-N session recall (TODO 6.8 / S6 / L3.5).
 *
 * RED on the original 3-message buildInitialMessages; GREEN after the recall wiring lands.
 *
 * Invariants verified:
 *  (a) last RECALL_WINDOW prior goals and replies appear in the prompt
 *  (b) oldest turn (beyond the window) does NOT appear
 *  (c) recall pairs appear before the current goal (user/assistant pairs in order)
 *  (d) no tool-call / tool-result content in the recall block (curation, L3.5)
 */
import { describe, expect, it } from '@effect/vitest'
import { DateTime, Effect, Layer } from 'effect'
import { LanguageModel } from 'effect/unstable/ai'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { InMemoryDataHandleRegistry } from '../../src/adapters/driven/InMemoryDataHandleRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { InMemoryToolRegistry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { makeSubmitGoal, RECALL_WINDOW } from '../../src/application/submitGoal.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const NOW = '2024-01-01T00:00:00.000Z'

type Prompt = Parameters<LanguageModel.Service['generateText']>[0]['prompt']

// Returns a LanguageModel layer that records every prompt passed to generateText.
const makeCapturingLayer = (captured: Prompt[]) =>
  Layer.succeed(
    LanguageModel.LanguageModel,
    LanguageModel.LanguageModel.of({
      generateObject: (() => Effect.die('not used')) as LanguageModel.Service['generateObject'],
      generateText: opts => {
        captured.push(opts.prompt)
        return Effect.succeed(
          new LanguageModel.GenerateTextResponse([{ text: 'Stub reply.', type: 'text' }]),
        ) as ReturnType<LanguageModel.Service['generateText']>
      },
      streamObject: (() => Effect.die('not used')) as LanguageModel.Service['streamObject'],
      streamText: (() => Effect.die('not used')) as LanguageModel.Service['streamText'],
    }),
  )

// Seed N completed turns (GoalSubmitted + GoalCompleted) into the store for a given sessionId.
const seedCompletedTurns = (sessionId: string, count: number) =>
  Effect.gen(function* () {
    const store = yield* EventStore
    for (let i = 0; i < count; i++) {
      const cid = `prior-cid-${i}`
      yield* store.append({
        actor: 'user',
        correlationId: cid,
        kind: EventKind.GoalSubmitted,
        occurredAt: NOW,
        payload: { goal: `Prior goal ${i}`, handleId: 'h1' },
        schemaV: 1,
        sessionId,
        storyRef: 'S6',
      })
      yield* store.append({
        actor: 'host',
        correlationId: cid,
        kind: EventKind.GoalCompleted,
        occurredAt: NOW,
        payload: { text: `Prior reply ${i}` },
        schemaV: 1,
        sessionId,
        storyRef: 'S6',
      })
    }
  })

const makeTestLayer = (captured: Prompt[]) =>
  Layer.mergeAll(
    InMemoryEventStore.layer,
    makeCapturingLayer(captured),
    NodeFileSystem.layer,
    InMemoryToolRegistry.layer([]),
    InMemoryDataHandleRegistry.layer(),
  )

describe('makeSubmitGoal — bounded recall (6.8 / S6 / L3.5)', () => {
  it.effect('prompt contains last RECALL_WINDOW prior turns and omits older ones', () => {
    const captured: Prompt[] = []
    const sessionId = 'recall-test-session'
    const totalPrior = RECALL_WINDOW + 1 // one beyond the window

    return Effect.gen(function* () {
      yield* seedCompletedTurns(sessionId, totalPrior)

      const toolkit = {} as Parameters<typeof makeSubmitGoal>[0]
      yield* makeSubmitGoal(toolkit)({ goal: 'Current goal', handleId: 'h1', sessionId })

      expect(captured.length).toBeGreaterThan(0)
      const prompt = captured[0]
      const promptStr = JSON.stringify(prompt)

      // (a) last RECALL_WINDOW turns must be present
      for (let i = totalPrior - RECALL_WINDOW; i < totalPrior; i++) {
        expect(promptStr, `prior goal ${i} missing`).toContain(`Prior goal ${i}`)
        expect(promptStr, `prior reply ${i} missing`).toContain(`Prior reply ${i}`)
      }

      // (b) the oldest turn (index 0) is outside the window and must NOT appear
      expect(promptStr, 'oldest turn (beyond window) must be excluded').not.toContain('Prior goal 0')

      // (c) recall pairs appear before the current goal
      const messages = prompt as { role: string; content: unknown }[]
      const currentGoalIdx = messages.findLastIndex(
        m => m.role === 'user' && JSON.stringify(m.content).includes('Current goal'),
      )
      expect(currentGoalIdx, 'current goal must be present').toBeGreaterThan(-1)
      const oldestRecallIdx = messages.findIndex(
        m => m.role === 'user' && JSON.stringify(m.content).includes(`Prior goal ${totalPrior - RECALL_WINDOW}`),
      )
      expect(oldestRecallIdx, 'prior goal must appear before current goal').toBeLessThan(currentGoalIdx)

      // (d) no tool-call / tool-result content in the recall block (curation, L3.5)
      const recallSlice = messages.slice(2, currentGoalIdx)
      for (const m of recallSlice) {
        const c = JSON.stringify(m.content)
        expect(c, 'tool-call content must not appear in recall').not.toContain('tool-call')
        expect(c, 'tool-result content must not appear in recall').not.toContain('tool-result')
      }
    }).pipe(Effect.provide(makeTestLayer(captured)), Effect.provide(DateTime.layerCurrentZoneLocal))
  })

  it.effect('first turn (no prior history) produces exactly 3 messages: [system, system, user]', () => {
    const captured: Prompt[] = []

    return Effect.gen(function* () {
      const toolkit = {} as Parameters<typeof makeSubmitGoal>[0]
      yield* makeSubmitGoal(toolkit)({ goal: 'First turn goal', handleId: 'h1', sessionId: 'fresh-session' })

      expect(captured.length).toBeGreaterThan(0)
      const messages = captured[0] as { role: string }[]
      expect(messages).toHaveLength(3)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('system')
      expect(messages[2].role).toBe('user')
    }).pipe(Effect.provide(makeTestLayer(captured)), Effect.provide(DateTime.layerCurrentZoneLocal))
  })
})
