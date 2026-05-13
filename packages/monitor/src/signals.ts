/**
 * Monitor signal computation — independent of the Host Supervisor (L3.7).
 *
 * This module reimplements R1/R2/R5 from scratch using only the ObservedEvent
 * shape from ObservabilityGateway. It MUST NOT import from
 * packages/host/src/adapters/ or packages/host/src/domain/ — that would
 * defeat the purpose of having an independent trust domain.
 *
 * Bootstrap thresholds mirror §3.5 + §12 (bootstrap=true, L3.8).
 * Values are intentionally duplicated from InProcessSupervisor to make
 * divergence detectable if either side changes threshold without the other.
 */
import type { ObservedEvent } from '@app/host/src/ports/driving/ObservabilityGateway.ts'

export interface MonitorSignal {
  readonly currentValue: number
  readonly riskId: string
  readonly sessionId: string
  readonly threshold: number
  readonly tripped: boolean
}

// Bootstrap thresholds (L3.8, bootstrap=true). Keep in sync with §12.
const R2_THRESHOLD = 0.05
const R5_THRESHOLD = 0
const R1_THRESHOLD = 0

function r1(events: readonly ObservedEvent[]): number {
  return events.filter(e => e.kind === 'HandleExhausted').length
}

function r2(events: readonly ObservedEvent[]): number {
  const georgesEvents = events.filter(e => e.actor === 'georges')
  const corroboratedIds = new Set(events.filter(e => e.actor === 'host').map(e => e.correlationId))
  const uncorroborated = georgesEvents.filter(e => !corroboratedIds.has(e.correlationId))
  return georgesEvents.length > 0 ? uncorroborated.length / georgesEvents.length : 0
}

function r5(events: readonly ObservedEvent[]): number {
  return events.filter(e => e.kind === 'SandboxEscapeAttempt').length
}

export const computeSignals = (sessionId: string, events: readonly ObservedEvent[]): readonly MonitorSignal[] => {
  const r1Value = r1(events)
  const r2Value = r2(events)
  const r5Value = r5(events)

  return [
    { currentValue: r1Value, riskId: 'R1', sessionId, threshold: R1_THRESHOLD, tripped: r1Value > R1_THRESHOLD },
    { currentValue: r2Value, riskId: 'R2', sessionId, threshold: R2_THRESHOLD, tripped: r2Value > R2_THRESHOLD },
    { currentValue: r5Value, riskId: 'R5', sessionId, threshold: R5_THRESHOLD, tripped: r5Value > R5_THRESHOLD },
  ]
}
