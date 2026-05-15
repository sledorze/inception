/**
 * In-process Supervisor adapter (L3.7, bootstrap=true §12).
 *
 * Computes R1, R2, R5 signals from EventStore events. Emits SupervisorTrip
 * events to the store when a threshold is exceeded. Bootstrap thresholds per
 * §3.5 Risk Register.
 *
 * R1 — HandleExhausted proxy (bootstrap): DP composition (1.19) replaces this.
 * R2 — uncorroborated-event ratio per session > 5 % (bootstrap=true).
 * R5 — any SandboxEscapeAttempt event (threshold: > 0, continuous).
 */
import { DateTime, Effect, Layer } from 'effect'
import { EventStore } from '../../ports/driven/EventStore.ts'
import { Supervisor, SupervisorError } from '../../ports/driven/Supervisor.ts'
import type { SignalResult } from '../../ports/driven/Supervisor.ts'

// Bootstrap thresholds (L3.8, bootstrap=true). Values evolve from operation.
const R2_THRESHOLD = 0.05
const R5_THRESHOLD = 0

function computeR1(sessionId: string, events: readonly { kind: string }[]): SignalResult {
  const exhausted = events.filter(e => e.kind === 'HandleExhausted').length
  return {
    currentValue: exhausted,
    riskId: 'R1',
    sessionId,
    threshold: 0,
    tripped: exhausted > 0,
  }
}

function computeR2(
  sessionId: string,
  events: readonly { actor: string; correlationId: string; kind: string }[],
): SignalResult {
  const georgesEvents = events.filter(e => e.actor === 'georges')
  const corroboratedIds = new Set(events.filter(e => e.actor === 'host').map(e => e.correlationId))
  const uncorroborated = georgesEvents.filter(e => !corroboratedIds.has(e.correlationId))
  const ratio = georgesEvents.length > 0 ? uncorroborated.length / georgesEvents.length : 0
  return {
    currentValue: ratio,
    riskId: 'R2',
    sessionId,
    threshold: R2_THRESHOLD,
    tripped: ratio > R2_THRESHOLD,
  }
}

function computeR5(sessionId: string, events: readonly { kind: string }[]): SignalResult {
  const escapeCount = events.filter(e => e.kind === 'SandboxEscapeAttempt').length
  return {
    currentValue: escapeCount,
    riskId: 'R5',
    sessionId,
    threshold: R5_THRESHOLD,
    tripped: escapeCount > R5_THRESHOLD,
  }
}

export const InProcessSupervisor = {
  layer: Layer.effect(
    Supervisor,
    Effect.gen(function* () {
      const store = yield* EventStore

      return Supervisor.of({
        evaluate: sessionId =>
          Effect.gen(function* () {
            const events = yield* store.query({ sessionId })

            const results: SignalResult[] = [
              computeR1(sessionId, events),
              computeR2(sessionId, events),
              computeR5(sessionId, events),
            ]

            for (const result of results) {
              if (result.tripped) {
                const now = DateTime.formatIso(yield* DateTime.now)
                yield* store.append({
                  actor: 'supervisor',
                  correlationId: `supervisor-${result.riskId}-${sessionId}`,
                  kind: 'SupervisorTrip',
                  occurredAt: now,
                  payload: {
                    currentValue: result.currentValue,
                    riskId: result.riskId,
                    threshold: result.threshold,
                  },
                  schemaV: 1,
                  sessionId,
                  storyRef: 'supervision',
                })
                // R5 (sandbox escape) quarantines the session immediately (L2.3).
                if (result.riskId === 'R5') {
                  yield* store.append({
                    actor: 'supervisor',
                    correlationId: `supervisor-quarantine-${sessionId}`,
                    kind: 'SessionQuarantined',
                    occurredAt: now,
                    payload: { reason: 'R5: sandbox escape attempt detected' },
                    schemaV: 1,
                    sessionId,
                    storyRef: 'supervision',
                  })
                }
              }
            }

            return results as readonly SignalResult[]
          }).pipe(Effect.mapError(e => new SupervisorError({ message: String(e) }))),
      })
    }),
  ),
}
