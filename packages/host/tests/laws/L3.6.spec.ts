/**
 * Law L3.6 — Trace Sufficiency for Replay.
 * "From the event trace alone, Claude can re-run a cycle with the same inputs to within
 *  LLM non-determinism. Model id, seed, sandbox wall-clock, and PRNG seed are all logged."
 *
 * If-absent failure mode: failures cannot be reproduced; outer loop cannot debug.
 *
 * Tests:
 *  1. StoredEvent carries sessionId (replay anchor for the session).
 *  2. StoredEvent carries correlationId (per-goal replay key).
 *  3. StoredEvent carries occurredAt (temporal anchor for replay ordering).
 *  4. The RecordReplayLlmProvider cassette system exists (replay infrastructure is in place).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const REPO = path.resolve(import.meta.dirname, '../../../..')
const testLayer = InMemoryEventStore.layer

describe('L3.6 — Trace Sufficiency for Replay', () => {
  it('RecordReplayLlmProvider.ts exists (cassette-based replay infrastructure)', () => {
    const rrProvider = path.join(REPO, 'packages', 'host', 'src', 'adapters', 'driven', 'RecordReplayLlmProvider.ts')
    expect(
      fs.existsSync(rrProvider),
      `Expected ${rrProvider} — L3.6 requires cassette-based replay infrastructure`,
    ).toBe(true)
  })

  it.effect('StoredEvent carries sessionId (replay anchor for the session)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'user',
        correlationId: 'c-replay-1',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { goal: 'replay test', handleId: 'h1' },
        schemaV: 1,
        sessionId: 'session-replay-42',
        storyRef: 'S1',
      })
      expect(stored.sessionId).toBe('session-replay-42')
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('StoredEvent carries correlationId (per-goal replay key)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'user',
        correlationId: 'goal-corr-replay',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { goal: 'another replay test', handleId: 'h2' },
        schemaV: 1,
        sessionId: 'session-r2',
        storyRef: 'S1',
      })
      expect(stored.correlationId).toBe('goal-corr-replay')
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('StoredEvent carries occurredAt (temporal anchor for replay ordering)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const stored = yield* store.append({
        actor: 'user',
        correlationId: 'c-ts-1',
        kind: EventKind.GoalSubmitted,
        occurredAt: '2026-05-16T12:00:00.000Z',
        payload: { goal: 'ordering test', handleId: 'h3' },
        schemaV: 1,
        sessionId: 'session-r3',
        storyRef: 'S1',
      })
      expect(stored.occurredAt).toBe('2026-05-16T12:00:00.000Z')
    }).pipe(Effect.provide(testLayer)),
  )
})
