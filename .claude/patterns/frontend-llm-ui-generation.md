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

Import from `@app/design-system`. Installed components:

| Raw HTML element                | Use instead  | Import                                                                                |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `<button>`                      | `<Button>`   | `import { Button } from '@app/design-system/button'`                                  |
| `<input>`                       | `<Input>`    | `import { Input } from '@app/design-system/input'`                                    |
| `<textarea>`                    | `<Textarea>` | `import { Textarea } from '@app/design-system/textarea'`                              |
| `<section>` (structural blocks) | `<Card>`     | `import { Card, CardHeader, CardContent, CardFooter } from '@app/design-system/card'` |

Conditional class composition: `import { cn } from '@app/design-system/utils'` — always use `cn()`, never string concatenation, never template literals for class names.

If a shadcn component is needed that isn't installed yet, say so explicitly and use a placeholder `<div>` — do not invent a new component or use the raw element.

### 1b. Semantic token set (use these, no raw palette)

All tokens are defined in `packages/app/src/index.css` `@theme`. Use the corresponding Tailwind utility — never a raw palette color, never an arbitrary value, never `style={{}}`.

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

Dark mode is automatic: all semantic tokens switch via the `dark` class — the generated UI gets dark mode for free if it uses tokens.

### 1c. Rules the lint gate enforces

The following are hard errors in `packages/app/src/**` and `packages/backoffice/src/**`:

- `design-system/no-raw-interactive-element` — any `<button>`, `<input>`, `<textarea>`, `<select>`, `<section>` in JSX.
- `design-system/no-raw-color-utility` — any raw Tailwind palette class (`bg-red-500`, `text-blue-700`, `border-white`, etc.) in `className` or `cn()`.
- `design-system/no-inline-style` — any `style={{...}}` attribute.

These rules are **off** inside `src/components/ui/` (that's where shadcn wrappers live). Everywhere else they are errors that block commit.

---

## 2. Prompt checklist — use this before every generation request

Copy-paste the block below at the top of any LLM prompt that asks for UI:

```
Stack: React 19, Tailwind v4, shadcn/ui primitives from @app/design-system.
Components available: Button, Input, Textarea, Card (CardHeader/CardContent/CardFooter), cn().
Import paths: '@app/design-system/button', etc.
No new dependencies. No raw HTML <button|input|textarea|section>.
No raw palette colors (bg-red-500, text-blue-700…). Use semantic tokens only:
  bg-background, bg-card, bg-primary, bg-muted, bg-destructive, bg-success,
  text-foreground, text-muted-foreground, text-primary-foreground, text-destructive-foreground,
  border-border, ring-ring.
No inline style={{}}.
Use cn() for all conditional className composition.
Do not generate class names via string concatenation or template literals.

Generate all states: empty, loading, error, success, disabled.
Responsive: mobile-first, works from 375px to 1920px.
Accessible: semantic HTML, ARIA where no native equivalent, keyboard-operable,
  visible focus rings (focus-visible:ring-2 ring-ring), touch targets ≥44px,
  WCAG 2.2 AA contrast.
Real content: use realistic representative text — no "Lorem ipsum", no "Item 1".

One component at a time. I will review and iterate.
```

Customize per task: add the specific component description, the component's props interface, and which states matter most (e.g., "error state is critical — this is a form").

---

## 3. Anti-pattern catalogue — do not ship if any of these are present

### Structural (block commit)

- [ ] Raw `<button>`, `<input>`, `<textarea>`, `<select>`, `<section>` in JSX outside `components/ui/`.
- [ ] Raw palette color in `className` (`bg-red-500`, `text-gray-700`, `border-black`, `text-white`).
- [ ] `style={{...}}` on any element.
- [ ] Dynamically concatenated class name strings (`'text-' + color`, `` `bg-${variant}` ``) — Tailwind's scanner cannot see these; they are never generated.
- [ ] Arbitrary Tailwind values without a theme variable (`p-[13px]`, `w-[37px]`) — use the nearest on-scale value or extend `@theme`.
- [ ] New `import` not in the lockfile without an explicit "add this dependency" approval.

### UX / quality (block review merge)

- [ ] Missing state: any of empty / loading / error / success not handled. (The #1 LLM-UI failure mode — it designs only the happy path.)
- [ ] Placeholder / fake data that hides real density (long names, overflow, edge numbers).
- [ ] No keyboard operability — interactive elements not reachable by Tab, Enter, Space.
- [ ] No focus-visible ring on interactive elements.
- [ ] Responsive blindness — works only at the previewed viewport; breaks on mobile.
- [ ] Generic silent error ("Something went wrong") — user input is lost, no recovery path.
- [ ] Invented or duplicated component instead of using the installed kit.
- [ ] `dangerouslySetInnerHTML` without explicit justification and XSS review.

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

## 5. What the tools bake in — reusable instructions

Best practice instructions extracted from leading tools (v0, Lovable, bolt.new, tldraw):

- **v0:** "Wrap, don't fork shadcn primitives" — customise via `className`, not by modifying the primitive source. "Trained on default shadcn implementations; customisations degrade output quality."
- **Lovable:** "All styling from `index.css` + theme; semantic tokens only; no ad-hoc `text-white`; no inline styles; small focused components."
- **bolt.new:** "State environment constraints upfront"; "prefer pure-JS deps in browser contexts."
- **tldraw make-real:** "Existing code is the absolute source of truth — extend, never re-implement."

The common thread: **specificity replaces taste**. Aesthetic adjectives ("modern", "nice", "clean") produce training-data median output. Constraint vocabulary produces output that passes the gates.

---

## 6. Recommended workflow

```
1. Constrain stack
   Pass the §2 prompt block verbatim. Name framework + pinned versions.
   "No new dependencies without approval."

2. Supply design system as context
   Paste the component inventory (§1a) + token list (§1b) into the prompt.
   "Use only these primitives."

3. Give existing structure as source of truth
   Paste the relevant file tree and any existing components the new one must
   integrate with. "Extend these — do not re-implement them."

4. Specify requirements as hard rules (not wishes)
   Every state (empty / loading / error / success / disabled).
   Viewport range (375px–1920px, mobile-first).
   WCAG 2.2 AA: semantic HTML, ARIA, keyboard nav, focus rings, touch targets ≥44px.
   Real representative content, not Lorem Ipsum.

5. One component at a time
   Ask for layout reasoning before code on complex compositions.
   Never request the whole screen in one shot.

6. Review against gates before accepting output
   □ Run: pnpm oxlint (or the editor hook fires automatically).
   □ Verify: every import exists in pnpm-lock.yaml.
   □ Check: all states rendered, responsive at 375px + 1280px.
   □ Check: keyboard tab order, focus rings, ARIA labels.
   □ Scan: no dangerouslySetInnerHTML, no raw-HTML sink without justification.

7. Iterate structurally via prompt, visually via design mode
   Re-verify states and responsive after each iteration.
   Never merge unreviewed one-shot output.
```

---

## 7. UX/UI rationale appendix

The checklist items above derive from these durable foundations.

**UX (what the interface must do):**

- Nielsen's 10 heuristics — visibility of system status (→ all states required), recognition over recall, error messages with recovery, minimalist design. Jakob's Law: generated UIs should be _conventional_, not novel.
- Don Norman — affordances + signifiers (a button must look pressable); feedback; prevent slips and mistakes.
- Krug — self-evident controls; users scan and satisfice, they don't read.
- Wroblewski — mobile-first; forms: top labels, minimal fields, inline validation, one clear primary action.
- Walter — hierarchy: functional → reliable → usable → pleasurable. Delight comes _after_ the base is solid.
- WCAG 2.2 AA — the non-negotiable floor: visible focus not obscured, target size ≥24×24px, contrast 4.5:1 text / 3:1 UI components, keyboard operability, managed focus on route/modal change.

**UI craft (how it must look):**

- Refactoring UI (Wathan & Schoger) — constrained scales, not freehand values; hierarchy via size/weight/color/space; grayscale-first forces hierarchy through layout, not color.
- 8-point grid — spacing as multiples of 4/8; off-scale values create visual noise.
- Tailwind v4 semantic tokens — the `@theme` variable layer is the design contract; raw palette references bypass it and break dark mode.
- shadcn/ui model — copy-in source, Radix primitives, `cn()` + CVA; small semantic token vocabulary; predictable composition pattern that LLMs can follow reliably.

**Trends (durable in 2025–2026):**

- Semantic tokens over raw palette; OKLCH color; container queries; progressive disclosure; dark mode as a design-system contract; design systems as enforceable code-backed governance over AI output.
- Fads to ignore: heavy kinetic/3D decoration as foundation; "the GUI is dead" narrative.

---

## Related

- `.claude/rules/frontend.md` — shadcn install, `cn()` usage, no `async`/`await`, proxy-module rule (note: paths reference `packages/frontend/` — actual packages are `app`, `backoffice`, `design-system`; treat as equivalent)
- `.claude/patterns/frontend-design-system.md` — how to add a new oxlint rule or migrate a violation
- `.claude/oxlint-plugins/design-system.js` — the three enforcement rules + `COMPONENT_MAP`
- `packages/design-system/src/` — installed component source (`button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `utils.ts`)
- `packages/app/src/index.css` — `@theme` token set (source of truth for semantic tokens)
