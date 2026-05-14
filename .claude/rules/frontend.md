---
paths:
  - 'packages/frontend/**'
---

# Frontend package — operating constraints

## Design system: shadcn/ui + Tailwind v4

**shadcn/ui** is the component library (configured in `components.json`).

- Add a component: `npx shadcn add <name>` — this installs it under `src/components/ui/`.
- Import from the alias: `import { Button } from '@/components/ui/button'`
- Always prefer a shadcn component over a raw HTML element for interactive or layout primitives (Button, Input, Textarea, Card, Badge, etc.).
- Use `cn(...)` from `src/lib/utils.ts` (wraps `clsx` + `tailwind-merge`) for all conditional className composition.
- Do not write inline Tailwind utility soup for things shadcn already provides. Install the component, then extend with `className` only for layout/spacing overrides.

Available base-color: `neutral`. CSS variables are enabled (`cssVariables: true`). Dark-mode via the `dark` class.

## Abstract UI interactions through proxy modules

Never call `fetch`, `localStorage`, `sessionStorage`, DOM APIs (`document.querySelector`, `window.*`), or any browser/platform API directly inside a React component or event handler. Instead, route all such calls through a dedicated module in `src/api/` (for HTTP) or `src/platform/` (for browser APIs).

**Rule:** one module = one concern at the platform boundary.

```
src/
  api/
    toolkit.ts    ← all /api/tools/* calls (one function per tool)
  platform/
    storage.ts    ← localStorage / sessionStorage wrappers (if needed)
```

Components import from these modules; they never `import fetch` or reference `window` directly.

**Why:** swapping the transport (REST → WebSocket, or adding auth headers) touches one file, not every component. Also keeps components pure for testing (mock the proxy, not fetch).

## No async/await

Use Promise chains (`.then().catch()`) instead of `async`/`await` in all frontend source files.

Rationale: keeps the codebase consistent with the host-side rule (Effect over Promise); async functions silently swallow unhandled rejections and complicate React event-handler typing.

**How to apply:** wherever you write `const x = await somePromise`, express it as `.then(x => ...)` instead.

## Test files

- Vitest component tests: `*.test.tsx`
- e2e (Playwright) tests: live in `e2e/` at the repo root, named `*.test.ts`
