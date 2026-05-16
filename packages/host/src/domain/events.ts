import { Schema } from 'effect'

// Canonical event kind strings for the EventStore (§9).
// All `store.append({ kind: ... })` and `e.kind === ...` comparisons must use
// these constants so renaming a kind is one change, not a grep hunt.
export const EventKind = {
  // L0.3: emitted on every successful login; payload = {subject, role} — NO token/password.
  Authenticated: 'Authenticated',
  CapabilityProposed: 'CapabilityProposed',
  CapabilityRejected: 'CapabilityRejected',
  ClarifyAnswered: 'ClarifyAnswered',
  ClarifyRequested: 'ClarifyRequested',
  GoalCompleted: 'GoalCompleted',
  GoalSubmitted: 'GoalSubmitted',
  HandleExhausted: 'HandleExhausted',
  Promoted: 'Promoted',
  QuarantineReleased: 'QuarantineReleased',
  RejectionPatternCandidate: 'RejectionPatternCandidate',
  RoleSwitched: 'RoleSwitched',
  SandboxEscapeAttempt: 'SandboxEscapeAttempt',
  SessionQuarantined: 'SessionQuarantined',
  SupervisorDivergence: 'SupervisorDivergence',
  SupervisorTrip: 'SupervisorTrip',
  ToolResultObserved: 'ToolResultObserved',
  UnknownShapeObserved: 'UnknownShapeObserved',
  UserRejected: 'UserRejected',
} as const

export type EventKindType = (typeof EventKind)[keyof typeof EventKind]

// ─── payload schemas ───────────────────────────────────────────────────────────
// Use Schema.decodeUnknown(XxxPayload)(event.payload).pipe(Effect.orDie) at
// every site that reads a stored event's payload field — never `as {…}` casts.

export const GoalSubmittedPayload = Schema.Struct({
  goal: Schema.String,
  handleId: Schema.String,
})

export const GoalCompletedPayload = Schema.Struct({
  text: Schema.String,
})

export const ClarifyRequestedPayload = Schema.Struct({
  question: Schema.String,
})

export const ClarifyAnsweredPayload = Schema.Struct({
  answer: Schema.String,
  question: Schema.String,
})

export const CapabilityProposedPayload = Schema.Struct({
  code: Schema.String,
  description: Schema.String,
  name: Schema.String,
  scope: Schema.Array(Schema.String),
  tests: Schema.String,
})

export const DecisionPayload = Schema.Struct({
  notes: Schema.optional(Schema.String),
  proposalId: Schema.String,
})

export const AuthenticatedPayload = Schema.Struct({
  role: Schema.Literals(['admin', 'enduser']),
  subject: Schema.String,
})

// ─── HTTP request body schemas ─────────────────────────────────────────────────

export const SubmitGoalBody = Schema.Struct({
  goal: Schema.String,
  handleId: Schema.String,
  sessionId: Schema.optional(Schema.String),
})

export const RejectGoalBody = Schema.Struct({
  reason: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
})

export const RespondBody = Schema.Struct({
  answer: Schema.String,
  correlationId: Schema.String,
})
