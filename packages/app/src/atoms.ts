import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import { getTenantId } from './api/auth.ts'
import { deleteSession, getTurns, listSessions, listTenants, respondToGoal, sendMessage } from './hooks/chat.ts'

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

// ── Sessions list — family keyed by tenantId; key bus is "sessions:<tenantId>" ─
const sessionsAtomFamily = Atom.family((tenantId: string) =>
  Atom.withReactivity([`sessions:${tenantId}`])(fetchAtom(() => listSessions())),
)
const sessionsViewFamily = Atom.family((tenantId: string) => Atom.map(sessionsAtomFamily(tenantId), toView))

export const sessionsAtom = sessionsAtomFamily
export const sessionsView = sessionsViewFamily

// ── Per-session transcript — family keyed by "tenantId:sessionId" ─────────────
// String key prevents cross-tenant cache sharing without object-equality issues.
const turnsAtomFamily = Atom.family((key: string) =>
  Atom.withReactivity([`turns:${key}`])(fetchAtom(() => getTurns(key.slice(key.indexOf(':') + 1)))),
)
const turnsViewFamily = Atom.family((key: string) => Atom.map(turnsAtomFamily(key), toView))

export const turnsView = (tenantId: string, sessionId: string) => turnsViewFamily(`${tenantId}:${sessionId}`)

// AtomRuntime<never> — shares defaultMemoMap with Atom.withReactivity so the
// Reactivity service instance is the same; invalidation reaches the read atoms.
const atomRuntime = Atom.runtime(Layer.empty)

export const sendGoalAtom = atomRuntime.fn(
  ({ goal, handleId, sessionId }: { sessionId: string; goal: string; handleId: string }) =>
    Effect.gen(function* () {
      const tenantId = getTenantId() ?? 'default'
      const result = yield* Effect.tryPromise({
        catch: e => String(e),
        try: () => sendMessage(sessionId, goal, handleId),
      })
      yield* Reactivity.invalidate([`turns:${tenantId}:${sessionId}`, `sessions:${tenantId}`])
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
      yield* Reactivity.invalidate([`turns:${tenantId}:${sessionId}`, `sessions:${tenantId}`])
      return result
    }),
)
export const respondView = Atom.map(respondAtom, toView)

export const deleteSessionAtom = atomRuntime.fn(({ sessionId }: { sessionId: string }) =>
  Effect.gen(function* () {
    const tenantId = getTenantId() ?? 'default'
    yield* Effect.tryPromise({ catch: e => String(e), try: () => deleteSession(sessionId) })
    yield* Reactivity.invalidate([`sessions:${tenantId}`, `turns:${tenantId}:${sessionId}`])
    return { sessionId }
  }),
)
export const deleteSessionView = Atom.map(deleteSessionAtom, toView)
