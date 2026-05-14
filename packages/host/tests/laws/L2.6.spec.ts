/**
 * Law L2.6 — Single Promoter per Scope.
 * "Each substrate scope has exactly one promoter role. Georges proposes;
 *  Claude (or a delegated policy) promotes. A proposal is never self-promoted."
 *
 * If-absent failure mode: Georges can unilaterally add capabilities — the
 * factory's tool surface grows without oversight, audit trail, or blast-radius
 * control. The entire promotion handshake (§S2, formal/promoter.tla) collapses.
 *
 * Tests:
 *  1. propose-capability appends a CapabilityProposed event to the store.
 *  2. propose-capability returns a non-empty proposalId (the event contentHash).
 *  3. The CapabilityProposed event has actor='georges', not 'host'.
 *  4. propose-capability fails with a structured error for invalid JSON manifest.
 *  5. propose-capability fails for a manifest missing required fields.
 *  6. propose-capability is denied for Reviewer (L2.2 enforcement).
 *  7. propose-capability emits a ToolResultObserved corroborator event (L1.8 wiring).
 */
import { Effect, Layer, Option, Stream } from 'effect'
import { expect, layer } from '@effect/vitest'
import type { ToolEntry } from '../../src/adapters/driven/InMemoryToolRegistry.ts'
import { GeorgesToolkit } from '../../src/adapters/driving/GeorgesToolkit.ts'
import { EventStore } from '../../src/ports/driven/EventStore.ts'
import { makeToolkitComponents } from '../helpers/toolkitLayer.ts'

// ─── tools ───────────────────────────────────────────────────────────────────

const TOOLS: readonly ToolEntry[] = [
  { description: 'Discovers available tools.', inputSchema: { type: 'object' }, name: 'list-tools', roles: [] },
  {
    description: 'Proposes a capability for promotion.',
    inputSchema: { type: 'object' },
    name: 'propose-capability',
    roles: ['Implementer'],
  },
  {
    description: 'Reads a file.',
    inputSchema: { type: 'object' },
    name: 'read-workspace',
    roles: ['Architect', 'Implementer', 'Reviewer'],
  },
]

// ─── layer wiring ─────────────────────────────────────────────────────────────

const { storeLayer, toolkitLayer } = makeToolkitComponents(TOOLS)
const testLayer = Layer.mergeAll(toolkitLayer, storeLayer)

// ─── helpers ──────────────────────────────────────────────────────────────────

const VALID_MANIFEST = JSON.stringify({
  description: 'Deduplicates records in a dataset.',
  name: 'dedupe',
  scope: 'capability',
  version: '0.1.0',
})

const callPropose = (manifest: string, role = 'Implementer') =>
  Effect.gen(function* () {
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle('propose-capability', {
      code: 'module.exports = () => {}',
      manifest,
      role,
      tests: 'assert(true)',
    })
    const last = yield* Stream.runLast(stream)
    return Option.getOrThrow(last)
  })

// ─── tests ────────────────────────────────────────────────────────────────────

layer(testLayer)('L2.6 — Single Promoter per Scope', it => {
  it.effect('propose-capability appends a CapabilityProposed event', () =>
    Effect.gen(function* () {
      yield* callPropose(VALID_MANIFEST)
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      expect(events.some(e => e.kind === 'CapabilityProposed')).toBeTruthy()
    }),
  )

  it.effect('propose-capability returns a non-empty proposalId (the event contentHash)', () =>
    Effect.gen(function* () {
      const result = yield* callPropose(VALID_MANIFEST)
      expect(result.isFailure).toBeFalsy()
      const { proposalId } = result.result as { proposalId: string }
      expect(typeof proposalId).toBe('string')
      expect(proposalId.length).toBeGreaterThan(0)
    }),
  )

  it.effect('CapabilityProposed event has actor="georges" (Georges proposes, Claude promotes)', () =>
    Effect.gen(function* () {
      yield* callPropose(VALID_MANIFEST)
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      const proposal = events.find(e => e.kind === 'CapabilityProposed')
      expect(proposal?.actor).toBe('georges')
    }),
  )

  it.effect('propose-capability fails with structured error for invalid JSON manifest', () =>
    Effect.gen(function* () {
      const result = yield* callPropose('not-valid-json')
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain('not valid JSON')
    }),
  )

  it.effect('propose-capability fails for manifest missing required fields', () =>
    Effect.gen(function* () {
      const result = yield* callPropose(JSON.stringify({ name: 'oops' }))
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain('manifest validation failed')
    }),
  )

  it.effect('propose-capability is denied for Reviewer (L2.2 enforcement)', () =>
    Effect.gen(function* () {
      const result = yield* callPropose(VALID_MANIFEST, 'Reviewer')
      expect(result.isFailure).toBeTruthy()
      expect((result.result as { message: string }).message).toContain('Permission denied')
    }),
  )

  it.effect('propose-capability emits a ToolResultObserved corroborator event (L1.8 wiring)', () =>
    Effect.gen(function* () {
      yield* callPropose(VALID_MANIFEST)
      const store = yield* EventStore
      const events = yield* store.query({ sessionId: 'bootstrap' })
      expect(
        events.some(
          e =>
            e.kind === 'ToolResultObserved' &&
            e.actor === 'host' &&
            (e.payload as { toolName: string }).toolName === 'propose-capability',
        ),
      ).toBeTruthy()
    }),
  )
})
