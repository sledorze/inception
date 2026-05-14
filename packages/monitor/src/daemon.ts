/**
 * Monitor daemon core (L3.7, L3.10).
 *
 * Reads events via ObservabilityGateway, randomly selects a subset of sessions
 * that have been evaluated by the Supervisor (have SupervisorTrip events), and
 * independently recomputes signals for those sessions.
 *
 * Divergence = Monitor result disagrees with the presence/absence of a
 * SupervisorTrip event for a given (sessionId, riskId) pair. On divergence,
 * emits a SupervisorDivergence event with actor='monitor' to EventStore.
 */
import { Effect } from 'effect'
import { EventStore } from '@app/host/src/ports/driven/EventStore.ts'
import { ObservabilityGateway } from '@app/host/src/ports/driving/ObservabilityGateway.ts'
import { computeSignals } from './signals.ts'

const RANDOM_SUBSET_FRACTION = 0.5

function selectRandomSubset<T>(items: readonly T[], fraction: number): T[] {
  return items.filter(() => Math.random() < fraction)
}

export const runOneCycle = Effect.gen(function* () {
  const gateway = yield* ObservabilityGateway
  const store = yield* EventStore

  const allEvents = yield* gateway.query({})

  // Group events by sessionId.
  const sessionMap = new Map<string, typeof allEvents>()
  for (const event of allEvents) {
    const existing = sessionMap.get(event.sessionId) ?? []
    sessionMap.set(event.sessionId, [...existing, event])
  }

  // Only evaluate sessions the Supervisor has already evaluated (has any SupervisorTrip).
  const evaluatedSessions = [...sessionMap.entries()].filter(([, events]) =>
    events.some(e => e.kind === 'SupervisorTrip' && e.actor === 'supervisor'),
  )

  const subset = selectRandomSubset(evaluatedSessions, RANDOM_SUBSET_FRACTION)

  const divergences: string[] = []

  for (const [sessionId, sessionEvents] of subset) {
    const monitorResults = computeSignals(sessionId, sessionEvents)

    // Infer Supervisor results from SupervisorTrip events: tripped = trip event exists.
    const supervisorTrippedIds = new Set(
      sessionEvents
        .filter(e => e.kind === 'SupervisorTrip' && e.actor === 'supervisor')
        .map(e => (e.payload as { riskId: string }).riskId),
    )

    for (const monitorResult of monitorResults) {
      const supervisorTripped = supervisorTrippedIds.has(monitorResult.riskId)
      if (monitorResult.tripped === supervisorTripped) {
        continue
      }

      const riskId = monitorResult.riskId
      divergences.push(`${sessionId}:${riskId}`)

      yield* store.append({
        actor: 'monitor',
        correlationId: `monitor-divergence-${riskId}-${sessionId}`,
        kind: 'SupervisorDivergence',
        occurredAt: new Date().toISOString(),
        payload: {
          monitorTripped: monitorResult.tripped,
          monitorValue: monitorResult.currentValue,
          riskId,
          supervisorTripped,
          supervisorValue: monitorResult.currentValue,
        },
        schemaV: 1,
        sessionId,
        storyRef: 'supervision',
      })
    }
  }

  return divergences
})
