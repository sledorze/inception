import { Schema } from 'effect'

// Canonical event kind strings for the EventStore (§9).
// All `store.append({ kind: ... })` and `e.kind === ...` comparisons must use
// these constants so renaming a kind is one change, not a grep hunt.
export const EventKind = {
  // L0.3: emitted on every successful login; payload = {subject, role} — NO token/password.
  Authenticated: 'Authenticated',
  AgentMdAmended: 'AgentMdAmended',
  CapabilityProposed: 'CapabilityProposed',
  CapabilityRejected: 'CapabilityRejected',
  ClarifyAnswered: 'ClarifyAnswered',
  ClarifyRequested: 'ClarifyRequested',
  ExchangeFlagged: 'ExchangeFlagged',
  GoalCompleted: 'GoalCompleted',
  GoalFailed: 'GoalFailed',
  GoalSubmitted: 'GoalSubmitted',
  HandleExhausted: 'HandleExhausted',
  Promoted: 'Promoted',
  QuarantineReleased: 'QuarantineReleased',
  RejectionPatternCandidate: 'RejectionPatternCandidate',
  RoleSwitched: 'RoleSwitched',
  SandboxEscapeAttempt: 'SandboxEscapeAttempt',
  ScriptExecuted: 'ScriptExecuted',
  SessionDeleted: 'SessionDeleted',
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

export const GoalFailedPayload = Schema.Struct({
  detail: Schema.String,
  error: Schema.String,
})

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

export const ExchangeFlaggedPayload = Schema.Struct({
  correlationId: Schema.String,
  note: Schema.String,
  severity: Schema.Literals(['observation', 'issue', 'blocker']),
})

export const AgentMdAmendedPayload = Schema.Struct({
  newHash: Schema.String,
  patternIds: Schema.optional(Schema.Array(Schema.String)),
  prevHash: Schema.String,
  rationale: Schema.String,
})

export const ScriptExecutedPayload = Schema.Struct({
  exitCode: Schema.Number,
  handleId: Schema.String,
  role: Schema.String,
  script: Schema.String,
  summary: Schema.String.check(Schema.isMaxLength(512)),
})

export const SessionDeletedPayload = Schema.Struct({
  sessionId: Schema.String,
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

export const FlagExchangeBody = Schema.Struct({
  note: Schema.String,
  severity: Schema.Literals(['observation', 'issue', 'blocker']),
})

export const AmendAgentMdBody = Schema.Struct({
  content: Schema.String,
  patternIds: Schema.optional(Schema.Array(Schema.String)),
  rationale: Schema.String,
})
