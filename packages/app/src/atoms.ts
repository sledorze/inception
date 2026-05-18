import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import { getTenantId } from './api/auth.ts'
import {
  createTenant,
  deleteSession,
  getTurns,
  listSessions,
  listTenants,
  renameTenant,
  respondToGoal,
  sendMessage,
} from './hooks/chat.ts'

export type AsyncView<T> =
  | { readonly _tag: 'Loading'; readonly waiting: boolean }
  | { readonly _tag: 'Error'; readonly message: string; readonly waiting: boolean }
  | { readonly _tag: 'Ready'; readonly value: T; readonly waiting: boolean }

const toView = <T>(result: AsyncResult.AsyncResult<T, string>): AsyncView<T> =>
  AsyncResult.match(result, {
    onFailure: r => ({ _tag: 'Error' as const, message: String(Cause.squash(r.cause)), waiting: r.waiting }),
    onInitial: r => ({ _tag: 'Loading' as const, waiting: r.waiting }),
    onSuccess: r => ({ _tag: 'Ready' as const, value: r.value, waiting: r.waiting }),
  })

const fetchAtom = <T>(fn: () => Promise<T>) => Atom.make(Effect.tryPromise({ catch: e => String(e), try: fn }))

// ── Current tenant (writable — updated by App.tsx on tenant:changed events) ──
export const currentTenantAtom = Atom.make(getTenantId() ?? 'default')

// ── Tenants list ──────────────────────────────────────────────────────────────
export const tenantsAtom = Atom.withReactivity(['tenants'])(fetchAtom(listTenants))
export const tenantsView = Atom.map(tenantsAtom, toView)

// Topic keys for the decoupled Reactivity key-bus. A session's turns live under
// a per-session topic so dispatching in one session never refetches another.
const turnsKey = (sessionId: string) => `turns:${sessionId}`
const sessionsKey = (tenantId: string) => `sessions:${tenantId}`

// ── Sessions list — family keyed by tenantId; key bus is "sessions:<tenantId>" ─
const sessionsAtomFamily = Atom.family((tenantId: string) =>
  Atom.withReactivity([sessionsKey(tenantId)])(fetchAtom(() => listSessions())),
)
const sessionsViewFamily = Atom.family((tenantId: string) => Atom.map(sessionsAtomFamily(tenantId), toView))

export const sessionsAtom = sessionsAtomFamily
export const sessionsView = sessionsViewFamily

// ── Per-session transcript — Atom.family keyed by sessionId, each subscribed ──
// to its own "turns:<id>" topic so it self-refreshes on send/respond.
const turnsAtom = Atom.family((sessionId: string) =>
  Atom.withReactivity([turnsKey(sessionId)])(fetchAtom(() => getTurns(sessionId))),
)
export const turnsView = Atom.family((sessionId: string) => Atom.map(turnsAtom(sessionId), toView))

// AtomRuntime<never> — shares defaultMemoMap with Atom.withReactivity so the
// Reactivity service instance is the same; invalidation reaches the read atoms.
const atomRuntime = Atom.runtime(Layer.empty)

// reactivityKeys is static-only, so per-session invalidation is published
// inside the effect via Reactivity.invalidate (keys derived from the arg).
// Default concurrency = takeLatest (interrupt-prior on re-dispatch).
export const sendGoalAtom = atomRuntime.fn(
  ({ goal, handleId, sessionId }: { sessionId: string; goal: string; handleId: string }) =>
    Effect.gen(function* () {
      const tenantId = getTenantId() ?? 'default'
      const result = yield* Effect.tryPromise({
        catch: e => String(e),
        try: () => sendMessage(sessionId, goal, handleId),
      })
      yield* Reactivity.invalidate([turnsKey(sessionId), sessionsKey(tenantId)])
      return result
    }),
)
export const sendGoalView = Atom.map(sendGoalAtom, toView)

export const respondAtom = atomRuntime.fn(
  ({ answer, correlationId, sessionId }: { sessionId: string; correlationId: string; answer: string }) =>
    Effect.gen(function* () {
      const tenantId = getTenantId() ?? 'default'
      const result = yield* Effect.tryPromise({
        catch: e => String(e),
        try: () => respondToGoal(sessionId, correlationId, answer),
      })
      yield* Reactivity.invalidate([turnsKey(sessionId), sessionsKey(tenantId)])
      return result
    }),
)
export const respondView = Atom.map(respondAtom, toView)

export const deleteSessionAtom = atomRuntime.fn(({ sessionId }: { sessionId: string }) =>
  Effect.gen(function* () {
    const tenantId = getTenantId() ?? 'default'
    yield* Effect.tryPromise({ catch: e => String(e), try: () => deleteSession(sessionId) })
    yield* Reactivity.invalidate([sessionsKey(tenantId), turnsKey(sessionId)])
    return { sessionId }
  }),
)
export const deleteSessionView = Atom.map(deleteSessionAtom, toView)

export const createTenantAtom = atomRuntime.fn(({ id, name }: { id: string; name: string }) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({ catch: e => String(e), try: () => createTenant(id, name) })
    yield* Reactivity.invalidate(['tenants'])
  }),
)
export const createTenantView = Atom.map(createTenantAtom, toView)

export const renameTenantAtom = atomRuntime.fn(({ id, name }: { id: string; name: string }) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({ catch: e => String(e), try: () => renameTenant(id, name) })
    yield* Reactivity.invalidate(['tenants'])
  }),
)
export const renameTenantView = Atom.map(renameTenantAtom, toView)
