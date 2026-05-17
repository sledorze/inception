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

## No async/await

Use Promise chains (`.then().catch()`) instead of `async`/`await` in all frontend source files.

Rationale: consistency with the host-side rule (Effect over Promise); async functions
silently swallow unhandled rejections and complicate React event-handler typing.

## Test files

- Vitest component tests: `*.test.tsx`
- e2e (Playwright) tests: live in `e2e/` at the repo root, named `*.test.ts`
