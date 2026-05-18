import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import { deleteSession, getTurns, listSessions, respondToGoal, sendMessage } from './hooks/chat.ts'

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

// Topic keys for the decoupled Reactivity key-bus. A session's turns live under
// a per-session topic so dispatching in one session never refetches another.
const turnsKey = (sessionId: string) => `turns:${sessionId}`
const sessionsKey = 'sessions'

// ── Sessions list — read atom subscribed to the "sessions" topic ─────────────
export const sessionsAtom = Atom.withReactivity([sessionsKey])(fetchAtom(listSessions))
export const sessionsView = Atom.map(sessionsAtom, toView)

// ── Per-session transcript — Atom.family keyed by sessionId, each subscribed ──
// to its own "turns:<id>" topic so it self-refreshes on send/respond.
export const turnsAtom = Atom.family((sessionId: string) =>
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
      const result = yield* Effect.tryPromise({
        catch: e => String(e),
        try: () => sendMessage(sessionId, goal, handleId),
      })
      yield* Reactivity.invalidate([turnsKey(sessionId), sessionsKey])
      return result
    }),
)
export const sendGoalView = Atom.map(sendGoalAtom, toView)

export const respondAtom = atomRuntime.fn(
  ({ answer, correlationId, sessionId }: { sessionId: string; correlationId: string; answer: string }) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        catch: e => String(e),
        try: () => respondToGoal(sessionId, correlationId, answer),
      })
      yield* Reactivity.invalidate([turnsKey(sessionId), sessionsKey])
      return result
    }),
)
export const respondView = Atom.map(respondAtom, toView)

export const deleteSessionAtom = atomRuntime.fn(({ sessionId }: { sessionId: string }) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({ catch: e => String(e), try: () => deleteSession(sessionId) })
    yield* Reactivity.invalidate([sessionsKey, turnsKey(sessionId)])
    return { sessionId }
  }),
)
export const deleteSessionView = Atom.map(deleteSessionAtom, toView)
