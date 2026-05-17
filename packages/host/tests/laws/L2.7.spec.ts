/**
 * Law L2.7 — Idempotent Proposals.
 * "Capability proposals are content-addressed (hash of manifest + code + tests).
 *  Re-proposing identical content is a no-op."
 *
 * If-absent failure mode: proposal spam under Georges' loops.
 *
 * Tests:
 *  1. Re-proposing identical manifest+code+tests returns the same proposalId.
 *  2. Only one CapabilityProposed event is stored for identical content.
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

const TOOLS: readonly ToolEntry[] = [
  { description: 'Lists tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Proposes a capability.',
    inputSchema: { type: 'object' },
    name: 'propose-capability',
    roles: ['Implementer'],
  },
]

const { storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS)
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer)

const MANIFEST = JSON.stringify({ description: 'Dedupe rows.', name: 'dedupe', scope: 'capability', version: '0.1.0' })
const CODE = 'module.exports = () => {}'
const TESTS = 'assert(true)'

const callPropose = () =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle('propose-capability', {
      code: CODE,
      manifest: MANIFEST,
      role: 'Implementer',
      tests: TESTS,
    })
    const last = yield* Stream.runLast(stream)
    const result = Option.getOrThrow(last)
    return (result.result as { proposalId: string }).proposalId
  })

describe('L2.7 — Idempotent Proposals', () => {
  it.effect('re-proposing identical content returns the same proposalId', () =>
    Effect.gen(function* () {
      const id1 = yield* callPropose()
      const id2 = yield* callPropose()
      expect(id1).toBe(id2)
      expect(typeof id1).toBe('string')
      expect(id1.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(testLayer)),
  )

  it.effect('only one CapabilityProposed event is stored for identical content', () =>
    Effect.gen(function* () {
      yield* callPropose()
      yield* callPropose()
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const proposals = events.filter(e => e.kind === 'CapabilityProposed')
      expect(proposals).toHaveLength(1)
    }).pipe(Effect.provide(testLayer)),
  )
})
