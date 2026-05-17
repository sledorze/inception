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

### 3. User-triggered actions — async/await, not .then()

```tsx
// BAD — promise chain in component body
const load = () => {
  getAgentMd()
    .then(r => setContent(r.content))
    .catch(e => setErr(String(e)))
}

// GOOD — async/await with try/finally
const load = async () => {
  setLoading(true)
  try {
    setContent((await getAgentMd()).content)
  } catch (e: unknown) {
    setErr(String(e))
  } finally {
    setLoading(false)
  }
}
```

## Boundary enforcement

`packages/host/tests/unit/enforce-conventions.unit.test.ts` — "Frontend presentation components must not interpret async state (P41)" — two assertions:

1. No component `.tsx` imports or calls `AsyncResult.isSuccess`, `AsyncResult.isFailure`, `Cause.squash`, or imports from `effect/unstable/reactivity/AsyncResult`.
2. No component `.tsx` contains `.then(` (promise chaining).

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
