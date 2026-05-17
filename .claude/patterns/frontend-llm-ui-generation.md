---
name: frontend-llm-ui-generation
description: How to prompt an LLM to generate UI that passes the design-system enforcement gates first time — constraints, checklist, anti-patterns, and the rationale behind each rule
---

# Pattern: Prompting LLMs to generate frontend UI

**Bias:** React + Tailwind v4 + shadcn/ui (`@app/design-system`)  
**Enforcement:** `.claude/oxlint-plugins/design-system.js` — three rules that fire at four gates (editor, pre-commit, CI, fixture test). The goal of this pattern is to avoid tripping those gates in the first place.

---

## When to read

Before generating a new component, screen, or layout section in `packages/app/` or
`packages/backoffice/` via any AI tool or model. Also before writing a prompt for
Georges, v0, Claude Artifacts, Lovable, bolt.new, or any similar tool targeting this
codebase.

---

## 1. The repo's hard constraints — quote these verbatim in every prompt

### 1a. Component inventory (use these, add nothing)

Import from `@app/design-system`. The kit is intentionally minimal — each entry is a
subpath export from `packages/design-system/src/` (no barrel root; no `@/components/ui/`):

| Raw HTML element                | Use instead  | Import                                                   |
| ------------------------------- | ------------ | -------------------------------------------------------- |
| `<button>`                      | `<Button>`   | `import { Button } from '@app/design-system/button'`     |
| `<input>`                       | `<Input>`    | `import { Input } from '@app/design-system/input'`       |
| `<textarea>`                    | `<Textarea>` | `import { Textarea } from '@app/design-system/textarea'` |
| `<section>` (structural blocks) | `<Card>`     | `import { Card } from '@app/design-system/card'`         |

`Card` exports only `Card` — no subcomponents (`CardHeader`, `CardContent`, etc.) exist yet.
If a subcomponent is needed, add it to `packages/design-system/src/card.tsx` first.

Conditional class composition: `import { cn } from '@app/design-system/utils'` — always
use `cn()`, never string concatenation, never template literals for class names.

If a primitive doesn't exist yet, use a plain `<div>` as a placeholder and flag the gap
explicitly — do not invent a new component or use the raw element.

### 1b. Semantic token set (use these, no raw palette)

All tokens are defined in `packages/app/src/index.css` `@theme`. Use the corresponding
Tailwind utility — never a raw palette color, never an arbitrary value, never `style={{}}`.

| Semantic intent      | Token → utility                                              |
| -------------------- | ------------------------------------------------------------ |
| Page background      | `bg-background` / `text-foreground`                          |
| Card / panel surface | `bg-card` / `text-card-foreground`                           |
| Primary action       | `bg-primary` / `text-primary-foreground`                     |
| Secondary / ghost    | `bg-secondary` / `text-secondary-foreground`                 |
| Muted / subdued      | `bg-muted` / `text-muted-foreground`                         |
| Accent highlight     | `bg-accent` / `text-accent-foreground`                       |
| Error / danger       | `bg-destructive` / `text-destructive-foreground`             |
| Success / positive   | `bg-success` / `text-success-foreground`                     |
| Borders              | `border-border`                                              |
| Focus rings          | `ring-ring`                                                  |
| Border-radius scale  | `rounded` (= `--radius: 0.5rem`), `rounded-md`, `rounded-lg` |

**Target state — not yet wired:** design for dark mode by using only the semantic tokens
above (never hardcode colors). When `.dark` CSS overrides are added to `@theme` the UI
will switch automatically — today only the light `@theme` block exists.

### 1c. Rules the lint gate enforces

Hard errors in `.tsx` files under `**/src/**` in both packages (exact glob:
`**/src/**/*.tsx`, off for `**/src/components/ui/**/*.tsx`):

- `design-system/no-raw-interactive-element` — any `<button>`, `<input>`, `<textarea>`, `<select>`, `<section>` in JSX.
- `design-system/no-raw-color-utility` — any raw Tailwind palette class (`bg-red-500`, `text-blue-700`, `border-white`, etc.) in `className` or `cn()`.
- `design-system/no-inline-style` — any `style={{...}}` attribute.

Off inside `**/src/components/ui/**/*.tsx` (shadcn wrappers legitimately use the raw
primitives they wrap). Everywhere else they block commit.

---

## 2. Prompt checklist — use this before every generation request

Copy-paste the block below at the top of any LLM prompt that asks for UI:

```
Stack: React 19, Tailwind v4, shadcn/ui primitives from @app/design-system.
Components available: Button, Input, Textarea, Card, cn().
  Card exports only <Card> — no CardHeader/CardContent/CardFooter yet.
Import paths: '@app/design-system/button', '@app/design-system/card', etc.
  Do NOT use @/components/ui/ — that path does not exist.
No new dependencies. No raw HTML <button|input|textarea|section>.
No raw palette colors (bg-red-500, text-blue-700…). Use semantic tokens only:
  bg-background, bg-card, bg-primary, bg-muted, bg-destructive, bg-success,
  text-foreground, text-muted-foreground, text-primary-foreground,
  text-destructive-foreground, border-border, ring-ring.
No inline style={{}}.
Use cn() for all conditional className composition.
Do not generate class names via string concatenation or template literals.

Data flow: no fetch/localStorage/DOM in components. Route all side effects
  through hooks/ + atoms (never import from src/api/ in components).

Generate all states: empty, loading, error, success, disabled.
Responsive: mobile-first, works from 375px to 1920px.
Accessible: semantic HTML, ARIA where no native equivalent, keyboard-operable,
  visible focus rings (focus-visible:ring-2 ring-ring), touch targets ≥44px,
  WCAG 2.2 AA contrast. Give every interactive element an accessible name.
  Associate every form control with a <label> (htmlFor/id).
Testable: drive all state from props; no Date.now()/Math.random() in render;
  data-testid only for dynamic list rows where role+name is insufficient.
Conventional: prefer the pattern users already know — labelled forms with
  inline validation, toast for success, skeletons for loading, focus-trapped
  dialogs, undo over confirm for reversible actions.
Real content: use realistic representative text — no "Lorem ipsum", no "Item 1".

One component at a time. I will review and iterate.
```

Customize per task: add the specific component description, the component's props
interface, and which states matter most (e.g., "error state is critical — this is a form").

---

## 3. Anti-pattern catalogue — do not ship if any of these are present

### Structural (block commit)

- [ ] Raw `<button>`, `<input>`, `<textarea>`, `<select>`, `<section>` in JSX outside `components/ui/`.
- [ ] Raw palette color in `className` (`bg-red-500`, `text-gray-700`, `border-black`, `text-white`).
- [ ] `style={{...}}` on any element.
- [ ] Dynamically concatenated class name strings (`'text-' + color`, `` `bg-${variant}` ``) — Tailwind's scanner cannot see these; they are never generated.
- [ ] Arbitrary Tailwind values without a theme variable (`p-[13px]`, `w-[37px]`) — use the nearest on-scale value or extend `@theme`.
- [ ] New `import` not in the lockfile without explicit approval.
- [ ] Component importing from `src/api/` directly (dep-cruiser `no-frontend-component-api-import`) — data goes through `hooks/` + `atoms.ts`.
- [ ] `import { Card, CardHeader, … }` — subcomponents don't exist yet; only `Card` is exported.

### UX / quality (block review merge)

- [ ] Missing state: any of empty / loading / error / success not handled. (The #1 LLM-UI failure mode.)
- [ ] Placeholder / fake data that hides real density (long names, overflow, edge numbers).
- [ ] No keyboard operability — interactive elements not reachable by Tab, Enter, Space.
- [ ] No focus-visible ring on interactive elements.
- [ ] Responsive blindness — works only at the previewed viewport; breaks on mobile.
- [ ] Generic silent error ("Something went wrong") — user input is lost, no recovery path.
- [ ] Invented or duplicated component instead of using the installed kit.
- [ ] `dangerouslySetInnerHTML` without explicit justification and XSS review.
- [ ] Novel interaction pattern for a solved problem — use the conventional pattern (§6).

---

## 4. Concerns that MUST be considered

**Security**

- **Slopsquatting / hallucinated packages** (~20% of LLM-suggested package names don't exist; recurring ones are registrable attack targets). Verify every generated `import` against `pnpm-lock.yaml`. Do not run `pnpm install <package>` from AI output without a human check.
- **Prompt injection via rendered user content** (OWASP LLM01:2025). If the component displays user-supplied text, do not pipe that content through the model and never set it via `dangerouslySetInnerHTML`.
- **XSS via generated markup** — treat any generated raw-HTML sink as a mandatory review gate before merge.

**Design-system drift**

The enforcement rules catch violations mechanically, but only after the code exists. A component that uses `bg-gray-100` instead of `bg-muted` will fail commit — costing a re-generation cycle. Front-loading the constraints (§1 + §2) eliminates this.

**Non-determinism**

The same prompt produces different UIs across sessions. Treat every piece of generated UI as a draft. The review gates (lint, a11y, states, responsive) are the artifacts of record — not the first output.

**Context truncation**

Long components get truncated at the model's context limit. Accessibility attributes and error states are the first to be dropped. One component at a time is the mitigation.

**License / IP**

Generated asset code (SVGs, illustrations, copied component patterns) carries provenance risk. Prefer generating from the existing kit over accepting novel asset code.

---

## 5. Data flow & testability

### Data flow (enforced by dependency-cruiser)

Components must not call `fetch`, `localStorage`, or any DOM/timer API directly. They
must not import from `src/api/` — forbidden by the `no-frontend-component-api-import`
dep-cruiser rule. Data flows through:

```
src/hooks/      ← React hooks that consume atoms
src/atoms.ts    ← @effect/atom-react atom definitions
src/api/        ← HTTP calls, imported by atoms/hooks only
src/platform/   ← browser API wrappers, imported by atoms/hooks only
```

Generated components receive all data and callbacks as props. `useAsyncFetch` is also
forbidden (`no-useAsyncFetch-import`); use the `@effect/atom-react` + atoms pattern.

This separation is also the **unit-test seam**: a test passes fakes as props and never
touches the network.

### Testability

**The convergence:** accessible markup _is_ testable markup. `getByRole` and
`getByLabel` (Testing Library + Playwright) read the same accessibility tree that
assistive technology consumes. If the markup is accessible, it's queryable; if it
can't be reached by role, the UI is both inaccessible and untestable.

**Query priority (Testing Library / Playwright):**

1. `getByRole` — the vast majority of interactive elements when they have accessible names
2. `getByLabelText` — form controls with associated labels
3. `getByText` / `getByPlaceholder` — display text
4. `getByTestId` — last resort only for dynamic list rows with no stable accessible name

**Prompt-level testability requirements:**

- Every interactive element has an accessible name (visible label, `aria-label`, or `<label>`).
- Every form control is associated with a `<label>` via `htmlFor`/`id`.
- All state enters via props — empty/loading/error/success reachable by prop change alone.
- No `Date.now()`, `Math.random()`, or real timers in render.
- `data-testid` added **only** for dynamic list rows/containers lacking a stable role.
- Content is queryable in a settled state — not gated solely behind animations or unresolved async.
- Views addressable by route/URL (required for Playwright e2e addressability).

---

## 6. Conventional patterns — make it feel at home

**Why convention matters:** Users spend most of their time on _other_ sites (Jakob's
Law). Their interaction expectations are pre-formed. A conventional UI costs zero
learning; a novel one taxes every interaction. LLMs left unconstrained invent
interactions for solved problems — generating technically-valid, accessible, tokenised
UI that still feels alien. Instruct the model to use these patterns, not invent alternatives:

### Navigation & layout

- **App shell**: persistent primary nav (top or left), logo top-left → home link, current location indicated (active nav + breadcrumbs), browser back works.
- **Content width**: max ~65ch for reading content; responsive grid for data-dense views.

### Forms

- Label above field; required fields marked; primary action bottom-right (full-width on mobile).
- Validate on blur and on submit — not per-keystroke.
- Error adjacent to the offending field + a summary; **preserve user input on error** (never wipe the form).
- Enter submits single-input forms.

### Feedback & status

- **Toast** for transient success/non-blocking confirmations; **inline** for contextual errors.
- **Skeleton loaders** for content; spinner only for actions.
- Never the "nothing happened" void after a click — confirm every action with visible feedback.

### Empty states

- Distinguish first-run (explain + primary CTA), filtered-empty ("no results for X"), error-empty (retry). A blank panel is not an empty state.

### Tables & lists

- Column headers (sortable with affordance indicator); row hover; stated pagination or infinite-scroll; sticky header on long lists.

### Dialogs & sheets

- Focus trap; ESC + click-outside close for non-destructive; **return focus to trigger** on close; no stacked dialogs. Mobile → bottom sheet / full-screen.

### Destructive actions

- Name the object in the confirmation. Prefer **undo-via-toast** over a confirm dialog where reversible. Type-to-confirm only for truly irreversible high-risk actions.

### Search & command

- Search top-right or top-center. `⌘K` / `Ctrl+K` command palette is an expected power-user affordance.

### Affordances & hierarchy

- Links look like links; buttons look like buttons. Unambiguous primary / secondary / tertiary hierarchy. Clickable cards show hover. Icons paired with visible text labels.

### Microcopy

- Button verbs match the action ("Save changes", not "OK"). Errors say _what_ + _how to fix_. Consistent terminology. Sentence case for UI labels.

### Continuity & deep links

- Remember filters and sort; scroll restoration; "unsaved changes" guard; state deep-linkable via URL (also the Playwright e2e addressability requirement).

### SPA accessibility

- Focus moves to the new view on route change.
- Async updates announced via `aria-live` regions (toast, loading completion, errors).
- Skip-to-content link at the top of the app shell.

### Motion

- Purposeful, 150–250ms, never blocks input. Honor `prefers-reduced-motion`. No content gated solely behind animation (must reach a settled queryable state).

### Error taxonomy

- Network error: retry + preserve input. Validation: adjacent to field, not a toast. Permission (403): explain + next step. Not found (404): navigation back. Server error (500): safe retry + contact path.

### Responsive interaction

- Thumb zones on mobile; no hover-only affordances on touch; correct `inputmode`/`type` attributes (`type="email"`, `inputmode="numeric"`).

### AI-native trust (specific to this app)

- Always surface what the AI did; let the user inspect and undo it.
- Prefer reversible actions. Show confidence level, source, and provenance.
- UI must surface trace-derived results — never invented confidence.

---

## 7. What the tools bake in — reusable instructions

Best practice instructions extracted from leading tools (v0, Lovable, bolt.new, tldraw):

- **v0:** "Wrap, don't fork shadcn primitives" — customise via `className`, not by modifying the primitive source.
- **Lovable:** "All styling from `index.css` + theme; semantic tokens only; no ad-hoc `text-white`; no inline styles; small focused components."
- **bolt.new:** "State environment constraints upfront"; "prefer pure-JS deps in browser contexts."
- **tldraw make-real:** "Existing code is the absolute source of truth — extend, never re-implement."

The common thread: **specificity replaces taste**. Aesthetic adjectives ("modern", "nice", "clean") produce training-data median output. Constraint vocabulary produces output that passes the gates.

---

## 8. Recommended workflow

```
1. Constrain stack
   Pass the §2 prompt block verbatim. Name framework + pinned versions.
   "No new dependencies without approval."

2. Supply design system as context
   Paste the component inventory (§1a) + token list (§1b) into the prompt.
   "Use only these primitives. Do NOT use @/components/ui/."

3. Give existing structure as source of truth
   Paste the relevant file tree and any existing components the new one must
   integrate with. "Extend these — do not re-implement them."

4. Specify requirements as hard rules (not wishes)
   Every state (empty / loading / error / success / disabled).
   Viewport range (375px–1920px, mobile-first).
   WCAG 2.2 AA: semantic HTML, ARIA, keyboard nav, focus rings, touch targets ≥44px.
   Real representative content, not Lorem Ipsum.
   Data via hooks/atoms — no fetch/api/ in components.
   Conventional patterns from §6.

5. One component at a time
   Ask for layout reasoning before code on complex compositions.
   Never request the whole screen in one shot.

6. Review against gates before accepting output
   □ Run: pnpm oxlint (or the editor hook fires automatically).
   □ Verify: every import exists in pnpm-lock.yaml AND is a valid @app/design-system subpath.
   □ Check: all states rendered, responsive at 375px + 1280px.
   □ Check: keyboard tab order, focus rings, ARIA labels, label-control association.
   □ Check: no component imports src/api/ directly.
   □ Scan: no dangerouslySetInnerHTML, no raw-HTML sink without justification.
   □ Confirm: conventional pattern used (§6) — no novel interactions invented.

7. Iterate structurally via prompt, visually via design mode
   Re-verify states and responsive after each iteration.
   Never merge unreviewed one-shot output.
```

---

## 9. UX/UI rationale appendix

**UX (what the interface must do):**

- Nielsen's 10 heuristics — visibility of system status (→ all states required), recognition over recall, error messages with recovery, minimalist design. Jakob's Law: generated UIs should be _conventional_, not novel — expectations are pre-formed on other sites.
- Don Norman — affordances + signifiers (a button must look pressable); feedback; prevent slips and mistakes.
- Krug — self-evident controls; users scan and satisfice, they don't read.
- Wroblewski — mobile-first; forms: top labels, minimal fields, inline validation, one clear primary action.
- Walter — hierarchy: functional → reliable → usable → pleasurable. Delight comes _after_ the base is solid.
- WCAG 2.2 AA — the non-negotiable floor: visible focus not obscured, target size ≥24×24px, contrast 4.5:1 text / 3:1 UI components, keyboard operability, managed focus on route/modal change.

**Testability (why it converges with accessibility):**

- Testing Library (Kent C. Dodds): "The more your tests resemble the way your software is used, the more confidence they can give you." Query by role, then label — `getByTestId` is a last resort.
- Playwright: user-facing locators (`getByRole` reads the accessibility tree), web-first assertions, test isolation.
- The convergence: fix inaccessible markup and you fix untestable markup — one requirement, two payoffs.

**UI craft (how it must look):**

- Refactoring UI (Wathan & Schoger) — constrained scales, not freehand values; hierarchy via size/weight/color/space; grayscale-first forces hierarchy through layout, not color.
- 8-point grid — spacing as multiples of 4/8; off-scale values create visual noise.
- Tailwind v4 semantic tokens — the `@theme` variable layer is the design contract; raw palette references bypass it.
- shadcn/ui model — copy-in source, Radix primitives, `cn()` + CVA; small semantic token vocabulary; predictable composition LLMs can follow reliably.

**Trends (durable in 2025–2026):**

- Semantic tokens over raw palette; OKLCH color; container queries; progressive disclosure; design systems as enforceable code-backed governance over AI output.
- Fads to ignore: heavy kinetic/3D decoration as foundation; "the GUI is dead" narrative.

---

## Related

- `.claude/rules/frontend.md` — **stale**: `paths: ['packages/frontend/**']` doesn't match actual packages (`app`, `backoffice`, `design-system`); body's proxy-module guidance (`src/api/` from components) contradicts the enforced dep-cruiser rule. Use `.dependency-cruiser.cjs` as the authoritative data-flow contract until frontend.md is corrected.
- `.claude/patterns/frontend-design-system.md` — how to add a new oxlint rule or migrate a violation
- `.claude/oxlint-plugins/design-system.js` — the three enforcement rules + `COMPONENT_MAP`
- `.dependency-cruiser.cjs` — enforced import boundaries: `no-frontend-component-api-import` (components → `src/api/` forbidden), `no-useAsyncFetch-import`, `design-system-pure` (design-system is a leaf package)
- `packages/design-system/src/` — component source (`button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `utils.ts`). Each exports one named component + `cn`.
- `packages/app/src/index.css` — `@theme` token set (source of truth; light mode only today)
