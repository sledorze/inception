/**
 * Regression guard — Schema.decodeUnknownEffect boundaries (2026-05-15).
 *
 * Each test submits a malformed event payload and asserts the Effect dies with a defect.
 * If any call site is reverted to an `as` cast, the function silently accepts the
 * malformed data and likely succeeds — making this test FAIL, catching the regression.
 *
 * Covered boundaries:
 *   registerCapability    — CapabilityProposedPayload
 *   listPendingProposals  — DecisionPayload (Promoted / CapabilityRejected events)
 *   makeRespondToGoal     — ClarifyRequestedPayload + GoalSubmittedPayload
 */
import { describe, expect, it } from '@effect/vitest'
import { Cause, Effect, Exit, Layer, Result } from 'effect'
import { InMemoryCapabilityRegistry } from '../../src/adapters/driven/InMemoryCapabilityRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { registerCapability } from '../../src/application/registerCapability.ts'
import { makeRespondToGoal } from '../../src/application/respondToGoal.ts'
import { listPendingProposals } from '../../src/application/reviewProposals.ts'
import { EventKind } from '../../src/domain/events.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const storeOnly = InMemoryEventStore.layer
const fullLayer = Layer.mergeAll(InMemoryEventStore.layer, InMemoryCapabilityRegistry.layer)

const isDie = (exit: Exit.Exit<unknown, unknown>): boolean =>
  Exit.isFailure(exit) && Result.isSuccess(Cause.findDefect(exit.cause))

const appendEvent = (
  kind: string,
  payload: unknown,
  correlationId = 'test-cid',
): Effect.Effect<{ contentHash: string }, never, EventStore> =>
  Effect.gen(function* () {
    const store = yield* EventStore
    return yield* store.append({
      actor: 'host',
      correlationId,
      kind,
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload,
      schemaV: 1,
      sessionId: 'test-session',
      storyRef: 'S2',
    })
  })

describe('Schema decode boundary — malformed payloads cause defects', () => {
  describe('registerCapability — CapabilityProposedPayload', () => {
    it.effect('dies when payload is missing required fields (code, description, scope, tests)', () =>
      Effect.gen(function* () {
        const { contentHash } = yield* appendEvent(EventKind.CapabilityProposed, {
          name: 'hello', // missing code, description, scope, tests
        })
        const exit = yield* Effect.exit(registerCapability(contentHash))
        expect(isDie(exit)).toBe(true)
      }).pipe(Effect.provide(fullLayer)),
    )

    it.effect('dies when scope is a string instead of an array', () =>
      Effect.gen(function* () {
        const { contentHash } = yield* appendEvent(EventKind.CapabilityProposed, {
          code: 'x',
          description: 'y',
          name: 'z',
          scope: 'capability', // string, not array — was the pre-fix shape
          tests: 't',
        })
        const exit = yield* Effect.exit(registerCapability(contentHash))
        expect(isDie(exit)).toBe(true)
      }).pipe(Effect.provide(fullLayer)),
    )
  })

  describe('listPendingProposals — DecisionPayload', () => {
    it.effect('dies when Promoted event payload is missing proposalId', () =>
      Effect.gen(function* () {
        yield* appendEvent(EventKind.CapabilityProposed, {
          code: 'x',
          description: 'y',
          name: 'z',
          scope: ['s'],
          tests: 't',
        })
        yield* appendEvent(EventKind.Promoted, {
          badField: 'no-proposalId-here', // missing proposalId
        })
        const exit = yield* Effect.exit(listPendingProposals)
        expect(isDie(exit)).toBe(true)
      }).pipe(Effect.provide(storeOnly)),
    )

    it.effect('dies when CapabilityRejected event payload is missing proposalId', () =>
      Effect.gen(function* () {
        yield* appendEvent(EventKind.CapabilityProposed, {
          code: 'x',
          description: 'y',
          name: 'z',
          scope: ['s'],
          tests: 't',
        })
        yield* appendEvent(EventKind.CapabilityRejected, {
          notes: 'some note', // missing proposalId
        })
        const exit = yield* Effect.exit(listPendingProposals)
        expect(isDie(exit)).toBe(true)
      }).pipe(Effect.provide(storeOnly)),
    )
  })

  describe('makeRespondToGoal — ClarifyRequestedPayload + GoalSubmittedPayload', () => {
    it.effect('dies when ClarifyRequested payload is missing question field', () =>
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append({
          actor: 'user',
          correlationId: 'test-cid',
          kind: EventKind.GoalSubmitted,
          occurredAt: '2026-01-01T00:00:00.000Z',
          payload: { goal: 'do something', handleId: 'h1' },
          schemaV: 1,
          sessionId: 'test-session',
          storyRef: 'S1',
        })
        yield* store.append({
          actor: 'host',
          correlationId: 'test-cid',
          kind: EventKind.ClarifyRequested,
          occurredAt: '2026-01-01T00:00:00.000Z',
          payload: { badField: 'no question here' }, // missing question
          schemaV: 1,
          sessionId: 'test-session',
          storyRef: 'S8',
        })
        const toolkit = {} as Parameters<typeof makeRespondToGoal>[0]
        const exit = yield* Effect.exit(makeRespondToGoal(toolkit)('test-cid', 'my answer', 'test-session'))
        expect(isDie(exit)).toBe(true)
      }).pipe(Effect.provide(storeOnly)),
    )

    it.effect('dies when GoalSubmitted payload is missing goal field', () =>
      Effect.gen(function* () {
        const store = yield* EventStore
        yield* store.append({
          actor: 'user',
          correlationId: 'test-cid',
          kind: EventKind.GoalSubmitted,
          occurredAt: '2026-01-01T00:00:00.000Z',
          payload: { handleId: 'h1' }, // missing goal field
          schemaV: 1,
          sessionId: 'test-session',
          storyRef: 'S1',
        })
        yield* store.append({
          actor: 'host',
          correlationId: 'test-cid',
          kind: EventKind.ClarifyRequested,
          occurredAt: '2026-01-01T00:00:00.000Z',
          payload: { question: 'which approach?' },
          schemaV: 1,
          sessionId: 'test-session',
          storyRef: 'S8',
        })
        const toolkit = {} as Parameters<typeof makeRespondToGoal>[0]
        const exit = yield* Effect.exit(makeRespondToGoal(toolkit)('test-cid', 'my answer', 'test-session'))
        expect(isDie(exit)).toBe(true)
      }).pipe(Effect.provide(storeOnly)),
    )
  })
})
