import * as Atom from 'effect/unstable/reactivity/Atom'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { getMetrics, getPain, getPatterns, getSessionEvents, getSessions, getWork } from './hooks/admin.ts'
import { listProposals, promoteProposal } from './hooks/proposals.ts'
import type { Proposal } from './hooks/proposals.ts'

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

export const metricsAtom = fetchAtom(getMetrics)
export const painAtom = fetchAtom(getPain)
export const patternsAtom = fetchAtom(getPatterns)
export const sessionsAtom = fetchAtom(getSessions)
export const workAtom = fetchAtom(getWork)

export const metricsView = Atom.map(metricsAtom, toView)
export const painView = Atom.map(painAtom, toView)
export const patternsView = Atom.map(patternsAtom, toView)
export const sessionsView = Atom.map(sessionsAtom, toView)
export const workView = Atom.map(workAtom, toView)

export const sessionEventsAtom = Atom.family((sessionId: string) => fetchAtom(() => getSessionEvents(sessionId)))
export const sessionEventsView = Atom.family((sessionId: string) => Atom.map(sessionEventsAtom(sessionId), toView))

// ── Proposals — read pair + dispatch atom (decoupled via Reactivity key-bus) ──

// Read atom subscribes to the "proposals" topic: self-refreshes when any
// mutation publishes to that key — publisher and subscriber share only the
// string "proposals", no direct import of each other.
export const proposalsAtom = Atom.withReactivity(['proposals'])(fetchAtom(listProposals))
export const proposalsView = Atom.map(proposalsAtom, toView) // AsyncView<readonly Proposal[]>

// AtomRuntime<never> — shares defaultMemoMap with Atom.withReactivity so the
// Reactivity service instance is the same; invalidation from reactivityKeys
// reaches the withReactivity subscription on proposalsAtom.
const atomRuntime = Atom.runtime(Layer.empty)

// Dispatch atom: AtomRuntime.fn with reactivityKeys publishes "proposals" on
// success. Default = takeLatest (interrupt-prior run on re-dispatch —
// stale-write race structurally eliminated).
export const promoteProposalAtom = atomRuntime.fn(
  (id: string) =>
    Effect.tryPromise({
      catch: e => String(e),
      try: () => promoteProposal(id),
    }).pipe(Effect.map(({ version }) => `Promoted → registry v${version}`)),
  { reactivityKeys: ['proposals'] },
)
export const promoteProposalView = Atom.map(promoteProposalAtom, toView) // AsyncView<string>

export type { Proposal }
