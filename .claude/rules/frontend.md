---
paths:
  - 'packages/app/**'
  - 'packages/backoffice/**'
  - 'packages/design-system/**'
---

# Frontend packages — operating constraints

Applies to `packages/app/`, `packages/backoffice/`, and `packages/design-system/`.

## Design system: @app/design-system + Tailwind v4

Primitives live in `packages/design-system/src/` and are published as subpath exports
from the `@app/design-system` package. There is no `src/components/ui/` directory and
no shadcn CLI in this repo — primitives are hand-maintained in the design-system package.

- **Import via subpath:** `import { Button } from '@app/design-system/button'`
- **Never** use `@/components/ui/button` — that path does not resolve (no `src/components/ui/` exists).
- Available primitives: `button` → `Button`; `card` → `Card`; `input` → `Input`; `textarea` → `Textarea`; `utils` → `cn`.
- Always prefer a design-system primitive over a raw HTML element. The oxlint plugin enforces this at commit time.
- Use `cn(...)` from `@app/design-system/utils` (`clsx` + `tailwind-merge`) for all conditional className composition.
- Extend via `className` only for layout/spacing overrides — do not fork primitive source files.
- Use semantic tokens from `@theme` (`bg-background`, `bg-card`, `text-muted-foreground`, etc.) — never raw palette colors.

If a primitive doesn't exist yet: add it to `packages/design-system/src/` and export it
from the package's `exports` map in `packages/design-system/package.json`.

## Data flow (enforced by dependency-cruiser)

Components must not call `fetch`, `localStorage`, `sessionStorage`, DOM APIs, or any
platform API directly. The enforced data-flow layering is:

```
src/hooks/      ← React hooks that consume atoms
src/atoms.ts    ← @effect/atom-react atom definitions (imports api/ and platform/)
src/api/        ← HTTP calls — imported by atoms/hooks ONLY, never by components
src/platform/   ← browser API wrappers — imported by atoms/hooks ONLY
```

The `no-frontend-component-api-import` dependency-cruiser rule **forbids** components
from importing `src/api/` directly. The `no-useAsyncFetch-import` rule forbids
`useAsyncFetch` — use the `@effect/atom-react` + atoms pattern.

Components receive all data and side-effect callbacks as props. This keeps components
pure and unit-testable without any network setup.

## No promise chaining in components — mutations go through action atoms

Frontend presentation components must not contain `.then()`/`.catch()` promise chains or
ad-hoc imperative re-fetch workflows. All async data flow is mediated by `@effect/atom-react`
atoms defined in `src/atoms.ts`:

- **Reads:** `fetchAtom(fn)` + `Atom.map(_, toView)` read-atom pair; components use
  `useAtomValue(xView)` + `useAtomRefresh(xAtom)`.
- **Mutations:** writable action atoms via `AtomRuntime.fn` (the dispatch primitive);
  components dispatch with `useAtomSet(actionAtom)` (fire-and-forget `(arg)=>void`) and
  render the action's mapped `AsyncView`. Dependent-list invalidation is a Reactivity
  `reactivityKeys` topic published on success — never an imperative `.then(relist).then(setState)`
  chain in the component.

See `.claude/patterns/frontend-atoms.md` for the full recipe including the decoupled
key-bus pattern and the `takeLatest` concurrency guarantee. Enforced by the P41 assertions
in `packages/host/tests/unit/enforce-conventions.unit.test.ts` (no component `.tsx` may
contain `.then(` or interpret `AsyncResult`/`Cause` directly).

Rationale: the host-side "Effect over Promise" rule's frontend analogue is "atoms over
imperative Promise workflows." `async`/`await` is acceptable inside `atoms.ts` bridge glue
(`Effect.tryPromise({ try: async () => … })`) but never as control flow in a component body.

## Test files

- Vitest component tests: `*.test.tsx`
- e2e (Playwright) tests: live in `e2e/` at the repo root, named `*.test.ts`
