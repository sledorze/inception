# Frontend atoms — view-model pattern

## Rule

**Presentation components must not interpret async state.** All `AsyncResult`/`Cause` handling belongs in `atoms.ts` (or a package-level `atoms.ts`). Components consume a typed view-model and render only.

## Pattern

### 1. `atoms.ts` — define the view-model type and derived atoms

```ts
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Cause from 'effect/Cause'

export type AsyncView<T> =
  | { readonly _tag: 'Loading'; readonly waiting: boolean }
  | { readonly _tag: 'Error'; readonly message: string; readonly waiting: boolean }
  | { readonly _tag: 'Ready'; readonly value: T; readonly waiting: boolean }

const toView = <T>(result: AsyncResult.AsyncResult<T, string>): AsyncView<T> =>
  AsyncResult.match(result, {
    onInitial: r => ({ _tag: 'Loading' as const, waiting: r.waiting }),
    onFailure: r => ({ _tag: 'Error' as const, message: String(Cause.squash(r.cause)), waiting: r.waiting }),
    onSuccess: r => ({ _tag: 'Ready' as const, value: r.value, waiting: r.waiting }),
  })

export const metricsAtom = fetchAtom(getMetrics) // raw atom for useAtomRefresh
export const metricsView = Atom.map(metricsAtom, toView) // view-model atom for useAtomValue
```

### 2. Components — consume the view-model, never AsyncResult

```tsx
import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { metricsAtom, metricsView } from '../../atoms.ts'

export function Metrics() {
  const view = useAtomValue(metricsView) // typed: AsyncView<LoopHealth>
  const refresh = useAtomRefresh(metricsAtom)

  const health = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null
  const loading = view.waiting

  // render only — no AsyncResult/Cause imports
}
```

### 3. Mutation atoms — the dispatch half

A user-triggered mutation is a **writable action atom** built with `AtomRuntime.fn`. It is the
Flux/Redux dispatch contract: write side = the action argument, read side = the action's own
`AsyncResult` (pending / error / success). Components dispatch via `useAtomSet` (fire-and-forget,
never `mode:"promise"`) and render the action state via a mapped `AsyncView`.

**Decoupling rule:** dependent read atoms subscribe to a Reactivity topic key. The mutation
publishes to the same key on success. Publisher and subscriber share **only the string key** —
neither imports the other. This is Redux's `put`/`take` seam.

**Concurrency:** `AtomRuntime.fn` default = `takeLatest` (interrupt-prior run on re-dispatch).
The stale-write race is structurally eliminated, not handled by discipline.

```ts
// atoms.ts — mutation atom publishing to the "proposals" Reactivity topic
//
// AtomRuntime<never> shares defaultMemoMap with Atom.withReactivity so the same
// Reactivity instance is used; invalidation from reactivityKeys reaches the
// withReactivity subscription on proposalsAtom.
const atomRuntime = Atom.runtime(Layer.empty)

export const promoteProposalAtom = atomRuntime.fn(
  (id: string) =>
    Effect.tryPromise({
      try: () => promoteProposal(id),
      catch: e => String(e),
    }).pipe(Effect.map(({ version }) => `Promoted → registry v${version}`)),
  { reactivityKeys: ['proposals'] },
)
export const promoteProposalView = Atom.map(promoteProposalAtom, toView) // AsyncView<string>

// Read atom subscribing to the same topic — self-refreshes on publish:
export const proposalsAtom = Atom.withReactivity(['proposals'])(fetchAtom(listProposals))
export const proposalsView = Atom.map(proposalsAtom, toView) // AsyncView<readonly Proposal[]>
```

```tsx
// component — render only, no .then(), no AsyncResult interpretation
const promote = useAtomSet(promoteProposalAtom) // (id: string) => void
const promoteView = useAtomValue(promoteProposalView) // AsyncView<string>
const listView = useAtomValue(proposalsView) // AsyncView<readonly Proposal[]>
const refresh = useAtomRefresh(proposalsAtom)

const msg =
  promoteView._tag === 'Error' ? promoteView.message
  : promoteView._tag === 'Ready' ? promoteView.value
  : null

// <Button disabled={promoteView.waiting} onClick={() => promote(id)}>
// No .then(), no useState for data or messages, no re-fetch chain.
```

**Backend stays source of truth.** The key-bus invalidation triggers a re-fetch
(`GET /api/proposals`) — the frontend is a pull-based reactive read-model. Client-authoritative
event logs (LiveStore) are rejected: they violate L1.1 (Mediation) and L1.4 (Traceability).

**Deferred: watcher/saga substrate.** `PubSub` + `forkScoped` + `Stream.switchMap` are
intentionally NOT adopted until ≥3 cross-cutting subscribers or a live-feed story exists. When
that need is real, `EventStore.replay` is the backend seam (cursor-based tail over `rowid`).

## Boundary enforcement

`packages/host/tests/unit/enforce-conventions.unit.test.ts` — "Frontend presentation components must not interpret async state (P41)" — two assertions:

1. No component `.tsx` imports or calls `AsyncResult.isSuccess`, `AsyncResult.isFailure`, `Cause.squash`, or imports from `effect/unstable/reactivity/AsyncResult`.
2. No component `.tsx` contains `.then(` (promise chaining). Mutations must route through `AtomRuntime.fn` action atoms dispatched via `useAtomSet` — never an imperative `.then().then(setState)` chain.

These run on every CI pass. Adding a new component that violates either will fail the suite.

## `waiting` flag

`AsyncView<T>` carries `waiting: boolean` on all three states. This mirrors `AsyncResult`'s `.waiting` property, which is `true` while a background re-fetch is in progress (the atom has a cached value but is refreshing). Use it to disable Refresh buttons:

```tsx
<Button disabled={view.waiting} onClick={refresh}>
  {view.waiting ? 'Loading…' : 'Refresh'}
</Button>
```

## Atom refresh wiring

`Atom.map` produces a read-only derived atom. To trigger a re-fetch, call `useAtomRefresh` on the **raw** atom, not the view atom:

```tsx
const refresh = useAtomRefresh(metricsAtom) // correct
const refresh = useAtomRefresh(metricsView) // wrong — view has no fetch to re-run
```
