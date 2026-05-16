/**
 * Application entry point.
 * HTTP routing via Effect HttpRouter (higher-level than raw node:http).
 * SPA fallback via HttpStaticServer (spa:true → page refresh works).
 *
 *   GET  /health                      — readiness probe (no auth)
 *   POST /api/login                   — obtain an auth session token
 *   POST /api/goals                   — enduser: submit a goal
 *   POST /api/goals/:id/reject        — enduser: reject a goal
 *   GET  /api/sessions/:id/turns      — enduser: conversation history
 *   POST /api/sessions/:id/respond    — enduser: answer clarification
 *   GET  /api/proposals               — admin: list pending proposals
 *   POST /api/proposals/:id/promote   — admin: promote a proposal
 *   POST /api/tools/:name             — invoke a toolkit tool (internal)
 *   GET  /api/admin/metrics           — admin: loop health
 *   GET  /api/admin/trace             — admin: event trace (replaces GET /events)
 *   GET  /events                      — 404 (leak closed)
 *   GET  /*                           — static SPA (spa:true makes refresh work)
 */
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createServer } from 'node:http'
import * as NodeHttpServer from '@effect/platform-node/NodeHttpServer'
import { Config, Effect, Layer, ManagedRuntime, Option, Random, Schema, Stream } from 'effect'
import * as HttpRouter from 'effect/unstable/http/HttpRouter'
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest'
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse'
import * as HttpStaticServer from 'effect/unstable/http/HttpStaticServer'
import {
  ClarifyAnsweredPayload,
  ClarifyRequestedPayload,
  EventKind,
  GoalCompletedPayload,
  GoalSubmittedPayload,
  RejectGoalBody,
  RespondBody,
  SubmitGoalBody,
} from './domain/events.ts'
import { makeSubmitGoal } from './application/submitGoal.ts'
import { makeRespondToGoal } from './application/respondToGoal.ts'
import { recordRejection } from './application/rejectionPattern.ts'
import { registerCapability } from './application/registerCapability.ts'
import { listPendingProposals, promoteProposal } from './application/reviewProposals.ts'
import { login } from './application/login.ts'
import { requireRole } from './application/authorize.ts'
import { EventStore } from './ports/driven/EventStore.ts'
import { AdminQuery } from './ports/driving/AdminQuery.ts'
import { SessionExpiredTag, SessionNotFoundTag } from './ports/driving/AuthGateway.ts'
import { GeorgesToolkit, fullLayer } from './runtime/bind.ts'
import { UserGateway } from './ports/driving/UserGateway.ts'

// URL-based path avoids node:path import (P24).
const DIST = new URL('../../frontend/dist', import.meta.url).pathname

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
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest> =>
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
    }) as Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest>

// ─── Route helpers ────────────────────────────────────────────────────────────

const jsonOk = (data: unknown): HttpServerResponse.HttpServerResponse => HttpServerResponse.jsonUnsafe(data)

const textErr = (msg: string, status: number): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.text(msg, { status })

// Parse the request JSON body against a schema; returns null on parse failure.
const parseBody = <A>(schema: Schema.Schema<A>) =>
  HttpServerRequest.schemaBodyJson(schema).pipe(Effect.orElseSucceed(() => null as A | null))

// ─── Routes ───────────────────────────────────────────────────────────────────

const healthRoute = HttpRouter.add('GET', '/health', Effect.succeed(HttpServerResponse.text('ok')))

const loginRoute = HttpRouter.add(
  'POST',
  '/api/login',
  Effect.gen(function* () {
    const LoginBody = Schema.Struct({ password: Schema.String, username: Schema.String })
    const body = yield* parseBody(LoginBody)
    if (body === null) return textErr('missing username or password', 422)
    return yield* login(body.username, body.password).pipe(
      Effect.matchEffect({
        onFailure: err =>
          Effect.succeed(
            err._tag === '@app/host/InvalidCredentials' ?
              textErr('invalid credentials', 401)
            : textErr('server error', 500),
          ),
        onSuccess: session => Effect.succeed(jsonOk(session)),
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
      if (body === null) return textErr('missing or invalid goal/handleId', 422)
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
        }
      }
      for (const cid of order) {
        const cidEvents = yield* store.query({ correlationId: cid })
        const ce = cidEvents.findLast(e => e.kind === EventKind.ClarifyRequested)
        if (ce !== undefined) {
          const p = yield* Schema.decodeUnknownEffect(ClarifyRequestedPayload)(ce.payload).pipe(Effect.orDie)
          clarifyQuestions.set(cid, p.question)
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
      if (body === null) return textErr('missing correlationId or answer', 422)
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

const adminMetricsRoute = HttpRouter.add(
  'GET',
  '/api/admin/metrics',
  withRole('admin')(
    Effect.gen(function* () {
      const adminQuery = yield* AdminQuery
      const metrics = yield* adminQuery.metrics()
      return jsonOk(metrics)
    }),
  ),
)

const adminTraceRoute = HttpRouter.add(
  'GET',
  '/api/admin/trace',
  withRole('admin')(
    Effect.gen(function* () {
      const adminQuery = yield* AdminQuery
      const events = yield* adminQuery.trace({})
      return jsonOk(events)
    }),
  ),
)

const toolRoute = HttpRouter.add(
  'POST',
  '/api/tools/:toolName',
  Effect.gen(function* () {
    const { toolName } = yield* HttpRouter.schemaPathParams(Schema.Struct({ toolName: Schema.String }))
    const params = yield* parseBody(Schema.Unknown)
    const toolkit = yield* GeorgesToolkit
    const stream = yield* toolkit.handle(toolName as 'list-tools', params as { role: string })
    const last = yield* Stream.runLast(stream)
    return jsonOk(Option.getOrNull(last))
  }),
)

// Closed leak — GET /events is replaced by guarded /api/admin/trace.
const closedLeakRoute = HttpRouter.add('GET', '/events', Effect.succeed(textErr('not found', 404)))

// SPA static files — spa:true means unmatched paths serve index.html (refresh works).
// HttpStaticServer.layer adds GET /* to the router directly.
// Fallback to a 503 if the frontend hasn't been built yet (PlatformError → caught → fallback).
const spaRoute = HttpStaticServer.layer({ root: DIST, spa: true }).pipe(
  Layer.catchTag('PlatformError', () =>
    HttpRouter.add(
      'GET',
      '/*',
      Effect.succeed(textErr('frontend not built — run pnpm build in packages/frontend', 503)),
    ),
  ),
)

// ─── Compose all routes ───────────────────────────────────────────────────────

const allRoutes: Layer.Layer<never, never, never> = Layer.mergeAll(
  healthRoute,
  loginRoute,
  submitGoalRoute,
  rejectGoalRoute,
  sessionTurnsRoute,
  sessionRespondRoute,
  listProposalsRoute,
  promoteProposalRoute,
  adminMetricsRoute,
  adminTraceRoute,
  toolRoute,
  closedLeakRoute,
  spaRoute,
) as Layer.Layer<never, never, never>

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpApp = (await rt.runPromise(HttpRouter.toHttpEffect(allRoutes).pipe(Effect.scoped) as any)) as Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  unknown,
  HttpServerRequest.HttpServerRequest
>

// makeHandler requires a Scope to manage per-request resource cleanup.
// We reuse the ManagedRuntime's root scope so handler lifetimes are bound to the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = await (rt.runPromise(NodeHttpServer.makeHandler(httpApp, { scope: rt.scope }) as any) as Promise<
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
