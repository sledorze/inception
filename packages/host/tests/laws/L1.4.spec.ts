/**
 * Law L1.4 — Tamper-Evident Trace.
 * "Every event carries contentHash + prevHash forming a per-session content-hash chain
 *  that is tamper-evident by construction." (§9, L1.4)
 *
 * If-absent failure mode: a mutated event would not be detectable during replay.
 * This test asserts the chain can be verified, and that mutation breaks verification.
 */
import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { computeContentHash, EventStore } from '../../src/ports/driven/EventStore.ts'
import type { NewEvent, StoredEvent } from '../../src/ports/driven/EventStore.ts'

const baseEvent = (sessionId: string): NewEvent => ({
  actor: 'user' as const,
  correlationId: randomUUID(),
  kind: 'GoalSubmitted',
  occurredAt: new Date().toISOString(),
  payload: { goal: 'test' },
  schemaV: 1,
  sessionId,
  storyRef: 'S1',
})

/** Verify the hash chain of a sequence of events. Returns false on first broken link. */
function verifyChain(events: readonly StoredEvent[]): boolean {
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (!event) {
      return false
    }
    // Each event's contentHash must match the §9 formula for its business fields.
    const expected = computeContentHash({
      actor: event.actor,
      correlationId: event.correlationId,
      kind: event.kind,
      occurredAt: event.occurredAt,
      payload: event.payload,
      schemaV: event.schemaV,
      sessionId: event.sessionId,
      storyRef: event.storyRef,
    })
    if (event.contentHash !== expected) {
      return false
    }
    // prevHash must point to the previous event's contentHash (or 'genesis').
    const expectedPrev = i === 0 ? 'genesis' : (events[i - 1]?.contentHash ?? 'genesis')
    if (event.prevHash !== expectedPrev) {
      return false
    }
  }
  return true
}

const append = (event: NewEvent) =>
  Effect.gen(function* () {
    const s = yield* EventStore
    return yield* s.append(event)
  })

const run = <A>(eff: Effect.Effect<A, unknown, EventStore>) =>
  Effect.runPromise(Effect.provide(eff, InMemoryEventStore.layer))

describe('L1.4 — tamper-evident hash chain', () => {
  it('an untampered chain verifies successfully', async () => {
    const session = randomUUID()
    const events = await run(
      Effect.all([append(baseEvent(session)), append(baseEvent(session)), append(baseEvent(session))]),
    )
    expect(verifyChain(events)).toBeTruthy()
  })

  it('mutating payload breaks the hash chain (tamper detection)', async () => {
    const session = randomUUID()
    const [a, b] = await run(Effect.all([append(baseEvent(session)), append(baseEvent(session))]))

    // Simulate tampering: mutate the payload of the first event.
    const tampered = [{ ...a, payload: { goal: 'TAMPERED' } }, b] as const
    expect(verifyChain(tampered)).toBeFalsy()
  })

  it('mutating prevHash breaks the chain', async () => {
    const session = randomUUID()
    const [a, b] = await run(Effect.all([append(baseEvent(session)), append(baseEvent(session))]))

    const tampered = [a, { ...b, prevHash: 'deadbeef' }] as const
    expect(verifyChain(tampered)).toBeFalsy()
  })
})
