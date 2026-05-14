/**
 * Registers a promoted capability into the versioned CapabilityRegistry (4.2).
 *
 * L2.9: provenance — CapabilityEntry carries the proposalId (contentHash of the
 * CapabilityProposed event that was promoted).
 */
import { Clock, Effect } from 'effect'
import { CapabilityRegistry } from '../ports/driven/CapabilityRegistry.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

interface ProposalPayload {
  code: string
  description: string
  name: string
  scope: readonly string[]
  tests: string
}

/** Looks up the CapabilityProposed event by proposalId and writes it to the registry. Returns the new version. */
export const registerCapability = (proposalId: string): Effect.Effect<number, never, EventStore | CapabilityRegistry> =>
  Effect.gen(function* () {
    const store = yield* EventStore
    const all = yield* store.query({}).pipe(Effect.orDie)
    const proposal = all.find(e => e.kind === 'CapabilityProposed' && e.contentHash === proposalId)
    if (proposal === undefined) {
      return yield* Effect.die(`proposal not found: ${proposalId}`)
    }

    const payload = proposal.payload as ProposalPayload
    const ms = yield* Clock.currentTimeMillis
    const registry = yield* CapabilityRegistry

    return yield* registry
      .register({
        code: payload.code,
        description: payload.description,
        name: payload.name,
        promotedAt: new Date(ms).toISOString(),
        proposalId,
        scope: payload.scope,
        tests: payload.tests,
      })
      .pipe(Effect.orDie)
  }).pipe(Effect.withSpan('Registry.registerCapability'))
