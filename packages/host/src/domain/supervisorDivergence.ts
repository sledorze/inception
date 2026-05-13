/**
 * Monitor divergence detection (L3.7, L3.10).
 *
 * When the Monitor recomputes Supervisor signals independently and disagrees,
 * this function emits a SupervisorDivergence event to the EventStore. The event
 * escalates to the External Witness pool (§6, L3.10).
 *
 * The Monitor (packages/monitor/, TODO 1.17) calls this from its own trust
 * domain after computing signals via the read-only ObservabilityGateway.
 * In tests, the Monitor computation is injected directly.
 */
import { Effect } from 'effect'
import { EventStore } from '../ports/driven/EventStore.ts'
import type { SignalResult } from '../ports/driven/Supervisor.ts'

export const checkSupervisorDivergence = (
  sessionId: string,
  supervisorResults: readonly SignalResult[],
  monitorResults: readonly SignalResult[],
): Effect.Effect<readonly string[], never, EventStore> =>
  Effect.gen(function* () {
    const store = yield* EventStore
    const divergences: string[] = []

    for (const supervisorResult of supervisorResults) {
      const monitorResult = monitorResults.find(r => r.riskId === supervisorResult.riskId)
      if (monitorResult === undefined) {
        continue
      }
      if (monitorResult.tripped === supervisorResult.tripped) {
        continue
      }

      const riskId = supervisorResult.riskId
      divergences.push(riskId)
      yield* store.append({
        actor: 'monitor',
        correlationId: `monitor-divergence-${riskId}-${sessionId}`,
        kind: 'SupervisorDivergence',
        occurredAt: new Date().toISOString(),
        payload: {
          monitorTripped: monitorResult.tripped,
          monitorValue: monitorResult.currentValue,
          riskId,
          supervisorTripped: supervisorResult.tripped,
          supervisorValue: supervisorResult.currentValue,
        },
        schemaV: 1,
        sessionId,
        storyRef: 'supervision',
      })
    }

    return divergences
  })
