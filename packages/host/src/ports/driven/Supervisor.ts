/**
 * Supervisor driven port (L3.7).
 *
 * The Supervisor computes live risk signals from the event store at declared
 * cadences, emits trip events, and returns signal results. Phase 1.5 implements
 * R1, R2, and R5 with bootstrap thresholds (§3.5, L3.8 bootstrap=true).
 *
 * The Monitor (1.17) independently recomputes a subset of signals from a
 * separate trust domain; SupervisorDivergence events escalate to the External
 * Witness pool (L3.10).
 */
import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export const SignalResultSchema = Schema.Struct({
  // Computed value of the metric (e.g. ratio, count).
  currentValue: Schema.Number,
  // R1 | R2 | R5 in Phase 1.5; more in later phases.
  riskId: Schema.String,
  sessionId: Schema.String,
  threshold: Schema.Number,
  tripped: Schema.Boolean,
})

export type SignalResult = typeof SignalResultSchema.Type

export class SupervisorError extends Schema.TaggedErrorClass<SupervisorError>()('@app/host/SupervisorError', {
  message: Schema.String,
}) {}

export class Supervisor extends Context.Service<
  Supervisor,
  {
    // Compute all implemented risk signals for a session and emit trip events
    // to EventStore for any that exceed their threshold.
    readonly evaluate: (sessionId: string) => Effect.Effect<readonly SignalResult[], SupervisorError>
  }
>()('@app/host/ports/driven/Supervisor') {}
