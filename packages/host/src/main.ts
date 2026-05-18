// promise-bridge: intentional — top-level await at entry point; rt.runPromise bridges the runtime
/**
 * Application entry point.
 * HTTP routing via Effect HttpRouter (higher-level than raw node:http).
 * SPA fallback via HttpStaticServer (spa:true → page refresh works).
 *
 *   GET  /health                              — readiness probe (no auth)
 *   POST /api/login                           — obtain an auth session token
 *   POST /api/goals                           — enduser: submit a goal
 *   POST /api/goals/:id/reject                — enduser: reject a goal
 *   GET  /api/sessions/:id/turns              — enduser: conversation history
 *   POST /api/sessions/:id/respond            — enduser: answer clarification
 *   GET  /api/proposals                       — admin: list pending proposals
 *   POST /api/proposals/:id/promote           — admin: promote a proposal
 *   POST /api/tools/:name                     — admin: invoke a toolkit tool (internal)
 *   GET  /api/admin/metrics                   — admin: loop health
 *   GET  /api/admin/pain                      — admin: open PAIN items
 *   GET  /api/admin/work                      — admin: TODO work items
 *   GET  /api/admin/trace                     — admin: event trace (replaces GET /events)
 *   GET  /api/sessions                        — admin/enduser: list all sessions with metadata (S8)
 *   GET  /api/sessions/:id/events             — admin: raw events for a session (S8)
 *   POST /api/exchanges/:id/flag              — admin: flag an exchange with a note (S8)
 *   GET  /api/patterns                        — admin: naively-bucketed rejection patterns (S8)
 *   GET  /api/agent-md                        — admin: read current agent.md (S8)
 *   PATCH /api/agent-md                       — admin: amend agent.md with rationale (S8)
 *   POST /api/exchanges/:id/replay            — admin: replay a goal under current agent.md (S8)
 *   GET  /api/settings                         — admin: read runtime settings
 *   PATCH /api/settings                        — admin: patch runtime settings
 *   GET  /events                              — 404 (leak closed)
 *   GET  /*                                   — static SPA (spa:true makes refresh work)
 */
import { createHash } from 'node:crypto'
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createServer } from 'node:http'
import * as NodeHttpServer from '@effect/platform-node/NodeHttpServer'
import {
  Cause,
  Config,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  ManagedRuntime,
  Option,
  Random,
  Schema,
  Stream,
} from 'effect'
import * as HttpRouter from 'effect/unstable/http/HttpRouter'
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest'
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse'
import * as HttpStaticServer from 'effect/unstable/http/HttpStaticServer'
import {
  AmendAgentMdBody,
  ClarifyAnsweredPayload,
  ClarifyRequestedPayload,
  EventKind,
  FlagExchangeBody,
  GoalCompletedPayload,
  GoalSubmittedPayload,
  RejectGoalBody,
  RespondBody,
  SubmitGoalBody,
} from './domain/events.ts'
import { listSessions } from './application/listSessions.ts'
import { makeSubmitGoal } from './application/submitGoal.ts'
import { makeRespondToGoal } from './application/respondToGoal.ts'
import { recordRejection } from './application/rejectionPattern.ts'
import { registerCapability } from './application/registerCapability.ts'
import { listPendingProposals, promoteProposal } from './application/reviewProposals.ts'
import { login } from './application/login.ts'
import { makeLoginRateLimiter } from './application/loginRateLimiter.ts'
import { requireRole } from './application/authorize.ts'
import { AGENT_MD_PATH } from './application/session.ts'
import { EventStore } from './ports/driven/EventStore.ts'
import type { StoredEvent } from './ports/driven/EventStore.ts'
import type { AppSettings } from './ports/driven/Settings.ts'
import { AppSettingsSchema, Settings } from './ports/driven/Settings.ts'
import type { AdminQueryError } from './ports/driving/AdminQuery.ts'
import { AdminQuery } from './ports/driving/AdminQuery.ts'
import type { AuthGateway } from './ports/driving/AuthGateway.ts'
import { InvalidCredentialsTag, SessionExpiredTag, SessionNotFoundTag } from './ports/driving/AuthGateway.ts'
import { GeorgesToolkit, fullLayer } from './runtime/bind.ts'
import { UserGateway } from './ports/driving/UserGateway.ts'

// URL-based path avoids node:path import (P24).
const DIST = new URL('../../app/dist', import.meta.url).pathname

// ─── RBAC guard ───────────────────────────────────────────────────────────────

const extractBearer = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const auth = (req.headers['authorization'] as string | undefined) ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : undefined
})

/** Returns 401/403 when auth fails; otherwise runs the handler. */
const withRole =
  (role: 'admin' | 'enduser') =>
  <E, R>(
    handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest | AuthGateway> =>
    Effect.gen(function* () {
      const token = yield* extractBearer
      return yield* requireRole(token, role).pipe(
        Effect.matchEffect({
          onFailure: err =>
            Effect.succeed(
              err._tag === SessionNotFoundTag || err._tag === SessionExpiredTag ?
                HttpServerResponse.text('unauthorized', { status: 401 })
              : HttpServerResponse.text('forbidden', { status: 403 }),
            ),
          onSuccess: () => handler,
        }),
      )
    })

// ─── Route helpers ────────────────────────────────────────────────────────────

const jsonOk = (data: unknown): HttpServerResponse.HttpServerResponse => HttpServerResponse.jsonUnsafe(data)

const textErr = (msg: string, status: number): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.text(msg, { status })

// Parse the request JSON body against a schema; returns null on parse failure.
const parseBody = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
): Effect.Effect<A | null, never, HttpServerRequest.HttpServerRequest | RD> =>
  HttpServerRequest.schemaBodyJson(schema).pipe(Effect.orElseSucceed(() => null))

// ─── Routes ───────────────────────────────────────────────────────────────────

const LoginBody = Schema.Struct({ password: Schema.String, username: Schema.String })

// Shorthand for the common admin GET → AdminQuery method → jsonOk pattern (4 routes use it).
const adminGet = (path: `/${string}`, query: Effect.Effect<unknown, AdminQueryError, AdminQuery>) =>
  HttpRouter.add('GET', path, withRole('admin')(query.pipe(Effect.map(jsonOk))))

const healthRoute = HttpRouter.add('GET', '/health', Effect.succeed(HttpServerResponse.text('ok')))

// Per-IP login rate limiter: 10 failures per 60-second window → 429 (P44).
const loginRateLimiter = makeLoginRateLimiter()

const loginRoute = HttpRouter.add(
  'POST',
  '/api/login',
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const ip = Option.getOrElse(req.remoteAddress, () => 'unknown')

    if (loginRateLimiter.check(ip)) {
      return HttpServerResponse.text('too many requests', { headers: { 'Retry-After': '60' }, status: 429 })
    }

    const body = yield* parseBody(LoginBody)
    if (body === null) {
      return textErr('missing username or password', 422)
    }
    return yield* login(body.username, body.password).pipe(
      Effect.matchEffect({
        onFailure: err =>
          Effect.sync(() => {
            if (err._tag === InvalidCredentialsTag) {
              loginRateLimiter.recordFailure(ip)
              return textErr('invalid credentials', 401)
            }
            return textErr('server error', 500)
          }),
        onSuccess: session =>
          Effect.sync(() => {
            loginRateLimiter.recordSuccess(ip)
            return jsonOk(session)
          }),
      }),
    )
  }),
)

const submitGoalRoute = HttpRouter.add(
  'POST',
  '/api/goals',
  withRole('enduser')(
    Effect.gen(function* () {
      const body = yield* parseBody(SubmitGoalBody)
      if (body === null) {
        return textErr('missing or invalid goal/handleId', 422)
      }
      const { goal, handleId, sessionId: reqSessionId } = body
      const toolkit = yield* GeorgesToolkit
      const sessionId = reqSessionId ?? (yield* Random.nextUUIDv4)
      const { correlationId } = yield* makeSubmitGoal(toolkit)({ goal, handleId, sessionId })
      const store = yield* EventStore
      const events = yield* store.query({ correlationId })
      const clarifyEvent = events.findLast(e => e.kind === EventKind.ClarifyRequested)
      if (clarifyEvent !== undefined) {
        const { question } = yield* Schema.decodeUnknownEffect(ClarifyRequestedPayload)(clarifyEvent.payload).pipe(
          Effect.orDie,
        )
        return jsonOk({ clarifyQuestion: question, correlationId, sessionId })
      }
      const completedEvent = events.findLast(e => e.kind === EventKind.GoalCompleted)
      const completedPayload =
        completedEvent !== undefined ?
          yield* Schema.decodeUnknownEffect(GoalCompletedPayload)(completedEvent.payload).pipe(Effect.orDie)
        : undefined
      return jsonOk({ correlationId, sessionId, ...completedPayload })
    }),
  ),
)

const rejectGoalRoute = HttpRouter.add(
  'POST',
  '/api/goals/:correlationId/reject',
  withRole('enduser')(
    Effect.gen(function* () {
      const { correlationId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ correlationId: Schema.String }))
      const body = yield* parseBody(RejectGoalBody)
      const { reason = 'no reason given', sessionId = 'bootstrap' } = body ?? {}
      yield* recordRejection({ correlationId, reason, sessionId, storyRef: 'S3' })
      return HttpServerResponse.empty({ status: 204 })
    }),
  ),
)

const sessionTurnsRoute = HttpRouter.add(
  'GET',
  '/api/sessions/:sessionId/turns',
  withRole('enduser')(
    Effect.gen(function* () {
      const { sessionId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ sessionId: Schema.String }))
      const store = yield* EventStore
      const events = yield* store.query({ sessionId })
      const goals = new Map<string, string>()
      const replies = new Map<string, string>()
      const clarifyQuestions = new Map<string, string>()
      const clarifyAnswers = new Map<string, string>()
      const order: string[] = []
      for (const e of events) {
        if (e.kind === EventKind.GoalSubmitted) {
          const p = yield* Schema.decodeUnknownEffect(GoalSubmittedPayload)(e.payload).pipe(Effect.orDie)
          goals.set(e.correlationId, p.goal)
          order.push(e.correlationId)
        } else if (e.kind === EventKind.GoalCompleted) {
          const p = yield* Schema.decodeUnknownEffect(GoalCompletedPayload)(e.payload).pipe(Effect.orDie)
          replies.set(e.correlationId, p.text)
        } else if (e.kind === EventKind.ClarifyAnswered) {
          const p = yield* Schema.decodeUnknownEffect(ClarifyAnsweredPayload)(e.payload).pipe(Effect.orDie)
          clarifyAnswers.set(e.correlationId, p.answer)
        } else if (e.kind === EventKind.ClarifyRequested) {
          // Collect inline — avoids N+1 store.query calls per turn.
          const p = yield* Schema.decodeUnknownEffect(ClarifyRequestedPayload)(e.payload).pipe(Effect.orDie)
          clarifyQuestions.set(e.correlationId, p.question)
        }
      }
      let idx = 0
      const turns = order
        .filter(cid => replies.has(cid) || clarifyQuestions.has(cid))
        .map(cid => {
          const turn: Record<string, unknown> = { correlationId: cid, goal: goals.get(cid) ?? '', turnIndex: idx++ }
          const reply = replies.get(cid)
          const clarifyQuestion = clarifyQuestions.get(cid)
          const clarifyAnswer = clarifyAnswers.get(cid)
          if (reply !== undefined) {
            turn['reply'] = reply
          }
          if (clarifyQuestion !== undefined) {
            turn['clarifyQuestion'] = clarifyQuestion
          }
          if (clarifyAnswer !== undefined) {
            turn['clarifyAnswer'] = clarifyAnswer
          }
          return turn
        })
      return jsonOk(turns)
    }),
  ),
)

const sessionRespondRoute = HttpRouter.add(
  'POST',
  '/api/sessions/:sessionId/respond',
  withRole('enduser')(
    Effect.gen(function* () {
      const body = yield* parseBody(RespondBody)
      if (body === null) {
        return textErr('missing correlationId or answer', 422)
      }
      const { sessionId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ sessionId: Schema.String }))
      const { correlationId, answer } = body
      const toolkit = yield* GeorgesToolkit
      const result = yield* makeRespondToGoal(toolkit)(correlationId, answer, sessionId)
      return jsonOk(result)
    }),
  ),
)

const listProposalsRoute = HttpRouter.add(
  'GET',
  '/api/proposals',
  withRole('admin')(
    Effect.gen(function* () {
      const proposals = yield* listPendingProposals
      return jsonOk(proposals)
    }),
  ),
)

const promoteProposalRoute = HttpRouter.add(
  'POST',
  '/api/proposals/:proposalId/promote',
  withRole('admin')(
    Effect.gen(function* () {
      const { proposalId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ proposalId: Schema.String }))
      yield* promoteProposal(proposalId, undefined)
      const version = yield* registerCapability(proposalId)
      return jsonOk({ version })
    }),
  ),
)

const adminMetricsRoute = adminGet(
  '/api/admin/metrics',
  Effect.flatMap(AdminQuery, q => q.metrics()),
)
const adminPainRoute = adminGet(
  '/api/admin/pain',
  Effect.flatMap(AdminQuery, q => q.pain()),
)
const adminWorkRoute = adminGet(
  '/api/admin/work',
  Effect.flatMap(AdminQuery, q => q.work()),
)
const adminTraceRoute = adminGet(
  '/api/admin/trace',
  Effect.flatMap(AdminQuery, q => q.trace({})),
)

const toolRoute = HttpRouter.add(
  'POST',
  '/api/tools/:toolName',
  withRole('admin')(
    Effect.gen(function* () {
      const { toolName } = yield* HttpRouter.schemaPathParams(Schema.Struct({ toolName: Schema.String }))
      const params = yield* parseBody(Schema.Unknown)
      const toolkit = yield* GeorgesToolkit
      const stream = yield* toolkit.handle(toolName as 'list-tools', params as { role: string })
      const last = yield* Stream.runLast(stream)
      return jsonOk(Option.getOrNull(last))
    }),
  ),
)

// ─── S8: Exchange review loop routes ─────────────────────────────────────────

const listSessionsRoute = HttpRouter.add('GET', '/api/sessions', withRole('enduser')(Effect.map(listSessions, jsonOk)))

const sessionEventsRoute = HttpRouter.add(
  'GET',
  '/api/sessions/:sessionId/events',
  withRole('admin')(
    Effect.gen(function* () {
      const { sessionId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ sessionId: Schema.String }))
      const store = yield* EventStore
      const events = yield* store.query({ sessionId })
      // Strip raw payload bytes — return kind/actor/correlationId/occurredAt/id but not payload (L1.3).
      // Include payload only for display-safe kinds (not handle bytes).
      return jsonOk(
        events.map(e => ({
          actor: e.actor,
          correlationId: e.correlationId,
          id: e.id,
          kind: e.kind,
          occurredAt: e.occurredAt,
          payload:
            (
              e.kind === EventKind.GoalSubmitted ||
              e.kind === EventKind.GoalCompleted ||
              e.kind === EventKind.ClarifyRequested ||
              e.kind === EventKind.ClarifyAnswered ||
              e.kind === EventKind.ExchangeFlagged
            ) ?
              e.payload
            : '[redacted]',
          sessionId: e.sessionId,
        })),
      )
    }),
  ),
)

const flagExchangeRoute = HttpRouter.add(
  'POST',
  '/api/exchanges/:correlationId/flag',
  withRole('admin')(
    Effect.gen(function* () {
      const { correlationId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ correlationId: Schema.String }))
      const body = yield* parseBody(FlagExchangeBody)
      if (body === null) {
        return textErr('missing note or severity', 422)
      }
      const store = yield* EventStore
      // Find the sessionId for this correlationId.
      const events = yield* store.query({ correlationId })
      const firstEvent = events[0]
      if (firstEvent === undefined) {
        return textErr('exchange not found', 404)
      }
      yield* store.append({
        actor: 'claude',
        correlationId,
        kind: EventKind.ExchangeFlagged,
        occurredAt: DateTime.formatIso(yield* DateTime.now),
        payload: { correlationId, note: body.note, severity: body.severity },
        schemaV: 1,
        sessionId: firstEvent.sessionId,
        storyRef: 'S8',
      })
      return HttpServerResponse.empty({ status: 204 })
    }),
  ),
)

const PatternPayload = Schema.Struct({
  note: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
})
const PATTERN_MAX_EXAMPLES = 5

const patternsRoute = HttpRouter.add(
  'GET',
  '/api/patterns',
  withRole('admin')(
    Effect.gen(function* () {
      const store = yield* EventStore
      const events = yield* store.query({})
      const flagged = events.filter(e => e.kind === EventKind.ExchangeFlagged || e.kind === EventKind.UserRejected)
      // Group by first 5 words of note/reason (naive bucketing).
      const buckets = new Map<
        string,
        { key: string; count: number; examples: string[]; firstSeen: string; lastSeen: string }
      >()
      for (const e of flagged) {
        const p = Schema.decodeUnknownOption(PatternPayload)(e.payload).pipe(
          Option.getOrElse(() => ({ note: undefined, reason: undefined })),
        )
        const text = p.note ?? p.reason ?? ''
        const key = text.split(/\s+/).slice(0, 5).join(' ').toLowerCase()
        const bucket = buckets.get(key)
        if (bucket === undefined) {
          buckets.set(key, {
            count: 1,
            examples: [e.correlationId],
            firstSeen: e.occurredAt,
            key,
            lastSeen: e.occurredAt,
          })
        } else {
          bucket.count++
          if (
            e.correlationId !== bucket.examples[bucket.examples.length - 1] &&
            bucket.examples.length < PATTERN_MAX_EXAMPLES
          ) {
            bucket.examples.push(e.correlationId)
          }
          if (e.occurredAt > bucket.lastSeen) {
            bucket.lastSeen = e.occurredAt
          }
        }
      }
      return jsonOk([...buckets.values()].toSorted((a, b) => b.count - a.count))
    }),
  ),
)

const agentMdGetRoute = HttpRouter.add(
  'GET',
  '/api/agent-md',
  withRole('admin')(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const content = yield* fs.readFileString(AGENT_MD_PATH)
      return jsonOk({ content })
    }),
  ),
)

const agentMdPatchRoute = HttpRouter.add(
  'PATCH',
  '/api/agent-md',
  withRole('admin')(
    Effect.gen(function* () {
      const body = yield* parseBody(AmendAgentMdBody)
      if (body === null) {
        return textErr('missing content or rationale', 422)
      }

      // 8.6: require at least one ExchangeFlagged or UserRejected event as rationale.
      const store = yield* EventStore
      const allEvents = yield* store.query({})
      const hasRationale = allEvents.some(
        e => e.kind === EventKind.ExchangeFlagged || e.kind === EventKind.UserRejected,
      )
      if (!hasRationale) {
        return textErr('amendment requires at least one flagged exchange or user rejection as rationale (L2.6)', 422)
      }

      const fs = yield* FileSystem.FileSystem
      const prevContent = yield* fs.readFileString(AGENT_MD_PATH)
      const prevHash = createHash('sha256').update(prevContent).digest('hex')
      const newHash = createHash('sha256').update(body.content).digest('hex')

      yield* fs.writeFileString(AGENT_MD_PATH, body.content)

      yield* store.append({
        actor: 'claude',
        correlationId: yield* Random.nextUUIDv4,
        kind: EventKind.AgentMdAmended,
        occurredAt: DateTime.formatIso(yield* DateTime.now),
        payload: { newHash, patternIds: body.patternIds ?? [], prevHash, rationale: body.rationale },
        schemaV: 1,
        sessionId: 'admin',
        storyRef: 'S8',
      })

      return jsonOk({ newHash, prevHash })
    }),
  ),
)

// Decode the text field from a GoalCompleted event, or null when the event is absent.
const extractCompletedText = (event: StoredEvent | undefined) =>
  event === undefined ?
    Effect.succeed<string | null>(null)
  : Schema.decodeUnknownEffect(GoalCompletedPayload)(event.payload).pipe(
      Effect.orDie,
      Effect.map(p => p.text),
    )

const replayExchangeRoute = HttpRouter.add(
  'POST',
  '/api/exchanges/:correlationId/replay',
  withRole('admin')(
    Effect.gen(function* () {
      const { correlationId } = yield* HttpRouter.schemaPathParams(Schema.Struct({ correlationId: Schema.String }))
      const store = yield* EventStore
      const events = yield* store.query({ correlationId })
      const goalEvent = events.find(e => e.kind === EventKind.GoalSubmitted)
      if (goalEvent === undefined) {
        return textErr('original goal not found', 404)
      }
      const { goal, handleId } = yield* Schema.decodeUnknownEffect(GoalSubmittedPayload)(goalEvent.payload).pipe(
        Effect.orDie,
      )
      const originalText = yield* extractCompletedText(events.findLast(e => e.kind === EventKind.GoalCompleted))

      // Re-run with a fresh correlationId.
      const replaySessionId = `replay-${correlationId.slice(0, 8)}`
      const toolkit = yield* GeorgesToolkit
      const result = yield* makeSubmitGoal(toolkit)({ goal, handleId, sessionId: replaySessionId })
      const newEvents = yield* store.query({ correlationId: result.correlationId })
      const newText = yield* extractCompletedText(newEvents.findLast(e => e.kind === EventKind.GoalCompleted))

      return jsonOk({ after: newText, before: originalText, replayCorrelationId: result.correlationId })
    }),
  ),
)

// ─── Settings routes ─────────────────────────────────────────────────────────

const settingsGetRoute = HttpRouter.add(
  'GET',
  '/api/settings',
  withRole('admin')(
    Effect.gen(function* () {
      const settings = yield* Settings
      const current = yield* settings.get()
      return jsonOk(current)
    }),
  ),
)

// Each field optional; Schema.optional encodes presence/absence under exactOptionalPropertyTypes.
const PartialAppSettingsSchema = Schema.Struct({
  llmBaseUrl: Schema.optional(AppSettingsSchema.fields.llmBaseUrl),
  llmModel: Schema.optional(AppSettingsSchema.fields.llmModel),
  sessionMaxTurns: Schema.optional(AppSettingsSchema.fields.sessionMaxTurns),
})

const settingsPatchRoute = HttpRouter.add(
  'PATCH',
  '/api/settings',
  withRole('admin')(
    Effect.gen(function* () {
      const body = yield* parseBody(PartialAppSettingsSchema)
      // Drop keys whose value is undefined before passing to patch (exactOptionalPropertyTypes
      // means Partial<AppSettings> has absent keys, not undefined-valued keys).
      const updates = Object.fromEntries(
        Object.entries(body ?? {}).filter(([, v]) => v !== undefined),
      ) as Partial<AppSettings> // cast: Object.fromEntries loses key specificity; filter above removed undefined values
      const settings = yield* Settings
      const updated = yield* settings.patch(updates)
      return jsonOk(updated)
    }),
  ),
)

// Closed leak — GET /events is replaced by guarded /api/admin/trace.
const closedLeakRoute = HttpRouter.add('GET', '/events', Effect.succeed(textErr('not found', 404)))

// SPA static files — spa:true means unmatched paths serve index.html (refresh works).
// HttpStaticServer.layer adds GET /* to the router directly.
// Fallback to a 503 if the frontend hasn't been built yet (PlatformError → caught → fallback).
const spaRoute = HttpStaticServer.layer({ root: DIST, spa: true }).pipe(
  Layer.catchTag('PlatformError', () =>
    HttpRouter.add('GET', '/*', Effect.succeed(textErr('app not built — run pnpm build:app in packages/app', 503))),
  ),
)

// ─── Compose all routes ───────────────────────────────────────────────────────

const allRoutes = Layer.mergeAll(
  healthRoute,
  loginRoute,
  submitGoalRoute,
  rejectGoalRoute,
  sessionTurnsRoute,
  sessionRespondRoute,
  listProposalsRoute,
  promoteProposalRoute,
  adminMetricsRoute,
  adminPainRoute,
  adminWorkRoute,
  adminTraceRoute,
  toolRoute,
  listSessionsRoute,
  sessionEventsRoute,
  flagExchangeRoute,
  patternsRoute,
  agentMdGetRoute,
  agentMdPatchRoute,
  replayExchangeRoute,
  settingsGetRoute,
  settingsPatchRoute,
  closedLeakRoute,
  spaRoute,
)

// ─── Runtime setup ────────────────────────────────────────────────────────────

const rt = ManagedRuntime.make(fullLayer.pipe(Layer.provideMerge(NodeHttpServer.layerHttpServices)))

const PORT = await rt.runPromise(Config.int('PORT').pipe(Config.withDefault(3000)))

// Start the UserGateway listener as a background fiber — processes goals on :3001.
rt.runFork(
  Effect.gen(function* () {
    const gw = yield* UserGateway
    const toolkit = yield* GeorgesToolkit
    yield* gw.listen(submission => makeSubmitGoal(toolkit)(submission).pipe(Effect.asVoid, Effect.orDie))
  }),
)

// Compile routes into an HTTP effect.
// Effect.scoped handles the Scope requirement of Layer.build inside toHttpEffect.
// The app services (AuthGateway, EventStore, etc.) are provided at request time by the runtime.
// The router build effect type is opaque; we must cast. The error channel is unknown here
// because toHttpEffect's inner type is not exported — we handle it immediately via catchCause below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @effect-diagnostics-next-line anyUnknownInErrorContext:off
const httpAppRaw = (await rt.runPromise(
  HttpRouter.toHttpEffect(allRoutes).pipe(Effect.scoped) as any, // cast: toHttpEffect return type too narrow for runPromise generic; re-typed below
)) as Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, HttpServerRequest.HttpServerRequest> // cast: runtime type of the resolved Effect; matches httpAppRaw usage

// Global error handler: log the full cause to stderr and return a structured JSON 500 body.
// This replaces the previous empty-body 500 that gave users no diagnostic information (P50).
const httpApp: Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest> =
  httpAppRaw.pipe(
    Effect.onError(cause => Effect.logError(Cause.pretty(cause))),
    Effect.catchCause(cause =>
      Effect.succeed(
        HttpServerResponse.jsonUnsafe({ detail: Cause.pretty(cause), error: 'internal_error' }, { status: 500 }),
      ),
    ),
  )

// makeHandler requires a Scope to manage per-request resource cleanup.
// We reuse the ManagedRuntime's root scope so handler lifetimes are bound to the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = await (rt.runPromise(NodeHttpServer.makeHandler(httpApp, { scope: rt.scope }) as any) as Promise<
  // cast: makeHandler generic doesn't accept typed httpApp directly; any bridges the Effect AI type gap
  Parameters<typeof createServer>[0]
>)

const server = createServer(handler)
server.listen(PORT, () => {
  process.stdout.write(`host server on :${String(PORT)}\n`)
})

process.on('SIGTERM', () => {
  server.close()
  rt.dispose().catch(() => {
    /* ignore dispose errors on shutdown */
  })
})
