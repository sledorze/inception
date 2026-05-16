/**
 * Law L3.4 — Bounded Idle Productivity.
 * "Idle ticks (S4) are scheduled and budgeted; mutations during idle stay within
 *  the mutability manifest (L2.2) and still emit events."
 *
 * If-absent failure mode: self-improvement turns into runaway self-modification.
 *
 * Tests:
 *  1. BudgetLedger supports a 'session' scope (idle ticks are budgeted per session).
 *  2. EventStore records events even from idle-mode operations (all mutations are traced).
 *  3. BudgetVectorSchema includes mutations dimension (idle mutations are tracked).
 *
 * NOTE: The idle scheduler (L3.4) is aspirational — the Host does not yet have a
 * scheduled idle-tick runner. These tests verify the budgeting and tracing primitives
 * are in place for when the scheduler is wired.
 */
import { Effect, Layer } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { InMemoryBudgetLedger } from '../../src/adapters/driven/InMemoryBudgetLedger.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { BudgetLedger, BudgetVectorSchema } from '../../src/ports/driven/BudgetLedger.ts'

const testLayer = Layer.mergeAll(InMemoryBudgetLedger.layer, InMemoryEventStore.layer)

describe('L3.4 — Bounded Idle Productivity', () => {
  it('BudgetVectorSchema includes mutations dimension (idle mutations are trackable)', () => {
    const fields = Object.keys(BudgetVectorSchema.fields)
    expect(fields).toContain('mutations')
  })

  it.effect('BudgetLedger supports session scope — idle ticks can be budgeted', () =>
    Effect.gen(function* () {
      const ledger = yield* BudgetLedger
      const scope = { id: 'idle-session-1', type: 'session' as const }
      yield* ledger.debit(scope, { mutations: 3, tokens: 200 })
      const total = yield* ledger.get(scope)
      expect(total.mutations).toBe(3)
      expect(total.tokens).toBe(200)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('EventStore records idle-mode events (all mutations emitted)', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      yield* store.append({
        actor: 'host',
        correlationId: 'idle-tick-1',
        kind: EventKind.AgentMdAmended,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { newHash: 'abc', prevHash: 'xyz', rationale: 'idle improvement' },
        schemaV: 1,
        sessionId: 'idle-session-1',
        storyRef: 'S4',
      })
      const events = yield* store.query({ sessionId: 'idle-session-1' })
      expect(events.some(e => e.kind === EventKind.AgentMdAmended)).toBe(true)
    }).pipe(Effect.provide(testLayer)),
  )
})
