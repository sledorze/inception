/**
 * Integration test for registerCapability (4.2).
 *
 * Verifies that a CapabilityProposed event is promoted into the CapabilityRegistry
 * and that the version increments correctly.
 */
import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { InMemoryCapabilityRegistry } from '../../src/adapters/driven/InMemoryCapabilityRegistry.ts'
import { InMemoryEventStore } from '../../src/adapters/driven/InMemoryEventStore.ts'
import { registerCapability } from '../../src/application/registerCapability.ts'
import { CapabilityRegistry } from '../../src/ports/driven/CapabilityRegistry.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'

const testLayer = Layer.mergeAll(InMemoryEventStore.layer, InMemoryCapabilityRegistry.layer)

const PROPOSAL_PAYLOAD = {
  code: 'function hello() { return 42; }',
  description: 'Returns 42.',
  name: 'hello',
  scope: ['Implementer'],
  tests: "it('works', () => expect(hello()).toBe(42))",
}

describe(registerCapability, () => {
  it.effect('promotes a CapabilityProposed event into the registry at version 1', () =>
    Effect.gen(function* () {
      const store = yield* EventStore
      const appendResult = yield* store.append({
        actor: 'host',
        correlationId: 'test-corr',
        kind: 'CapabilityProposed',
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: PROPOSAL_PAYLOAD,
        schemaV: 1,
        sessionId: 'test-session',
        storyRef: 'S2',
      })
      const proposalId = appendResult.contentHash

      const version = yield* registerCapability(proposalId)
      expect(version).toBe(1)

      const registry = yield* CapabilityRegistry
      const caps = yield* registry.list()
      expect(caps).toHaveLength(1)
      expect(caps[0]?.name).toBe('hello')
      expect(caps[0]?.proposalId).toBe(proposalId)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('dies when the proposalId does not exist', () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(registerCapability('nonexistent-hash'))
      expect(result._tag).toBe('Failure')
    }).pipe(Effect.provide(testLayer)),
  )
})
