/**
 * S3 / 5.2 — Rejection pattern detection.
 *
 * Records a UserRejected event and, once N rejections accumulate on the same
 * storyRef, emits RejectionPatternCandidate for Claude to mine out-of-band
 * and refine the agent prompt or a policy.
 *
 * Bootstrap threshold: N=3 (§12, bootstrap=true). Changes via L3.8 calibration.
 */
import { DateTime, Effect } from 'effect'
import { EventKind } from '../domain/events.ts'
import { EventStore } from '../ports/driven/EventStore.ts'

const REJECTION_THRESHOLD = 3

export const recordRejection = Effect.fn('rejectionPattern.recordRejection')(function* ({
  correlationId,
  reason,
  sessionId,
  storyRef,
}: {
  correlationId: string
  reason: string
  sessionId: string
  storyRef: string
}) {
  const store = yield* EventStore
  const now = DateTime.formatIso(yield* DateTime.now)

  yield* store.append({
    actor: 'user',
    correlationId,
    kind: EventKind.UserRejected,
    occurredAt: now,
    payload: { reason },
    schemaV: 1,
    sessionId,
    storyRef,
  })

  // Count UserRejected events for this storyRef across all sessions.
  const allEvents = yield* store.query({ storyRef })
  const rejectionCount = allEvents.filter(e => e.kind === EventKind.UserRejected).length
  const candidateAlreadyEmitted = allEvents.some(e => e.kind === EventKind.RejectionPatternCandidate)

  if (rejectionCount >= REJECTION_THRESHOLD && !candidateAlreadyEmitted) {
    yield* store.append({
      actor: 'host',
      correlationId: `rejection-pattern-${storyRef}`,
      kind: EventKind.RejectionPatternCandidate,
      occurredAt: now,
      payload: { rejectionCount, storyRef },
      schemaV: 1,
      sessionId,
      storyRef,
    })
  }
})
