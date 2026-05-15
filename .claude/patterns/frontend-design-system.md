---
name: frontend-design-system
description: How to add a new design-system lint rule, wire it, test it, and migrate existing violations — the full extension recipe
---

# Pattern: Frontend design-system rule extension

**Enforced by:** oxlint (4-gate: PostToolUse hook, pre-commit lefthook, lint:ci, fixture test)  
**Law:** §2.13 (Code economy) — enforce at lint layer, not vitest grep  
**Feedback memory:** `enforce_at_lint_layer.md` — "enforce X" → custom oxlint rule; never a vitest grep

Applied 3× across 2 sessions (interactive elements, color utilities, section→Card). Captured here so the next agent skips the derivation.

---

## When to add a rule

One of:

- A raw HTML element that shadcn/ui wraps (interactive or structural)
- A CSS concern that bypasses the `@theme` token set (raw palette colors, inline styles)
- Any pattern where the violation is mechanically detectable in JSX and has a clear fix

Do NOT add rules for heuristic patterns with high false-positive risk ("bordered div should be Card") — precision over recall.

---

## Extension recipe (4 steps)

### Step 1 — Add the rule to `.claude/oxlint-plugins/design-system.js`

**For a new element mapping** — add to `COMPONENT_MAP`:

```js
const COMPONENT_MAP = {
  // existing entries…
  select: { component: 'Select', from: '@/components/ui/select', install: 'select' },
  // new entry:
  dialog: { component: 'Dialog', from: '@/components/ui/dialog', install: 'dialog' },
}
```

**For a new attribute rule** — add a new `create(context)` visitor:

```js
/** @type {import('eslint').Rule.RuleModule} */
const noRawFoo = {
  create(context) {
    return {
      JSXAttribute(node) {
        // detect the pattern, then:
        context.report({ message: '...actionable invite...', node })
      },
    }
  },
  meta: { docs: { description: '...' }, type: 'problem' },
}
```

Export it in the plugin object at the bottom:

```js
const plugin = {
  meta: { name: 'design-system' },
  rules: {
    'no-foo': noRawFoo,
    // … existing rules
  },
}
```

**Diagnostic message must include:**

1. What was found and why it's wrong
2. What to use instead (with import path)
3. Install command if the component might not be present (`npx shadcn add <slug>`)
4. Rule rationale link: `Rule rationale: .claude/rules/frontend.md.`

### Step 2 — Wire in `packages/frontend/.oxlintrc.json`

Add to BOTH overrides (error on app code, off on ui/ internals):

```json
{
  "overrides": [
    {
      "files": ["**/src/**/*.tsx"],
      "rules": {
        "design-system/no-foo": "error"   ← add here
      }
    },
    {
      "files": ["**/src/components/ui/**/*.tsx"],
      "rules": {
        "design-system/no-foo": "off"     ← and here
      }
    }
  ]
}
```

### Step 3 — Add fixture tests to `packages/host/tests/unit/oxlint-rules.unit.test.ts`

Minimum matrix per rule (follow `lint-test-pattern.md` — assert BEHAVIOUR, not prose):

```ts
describe('design-system/no-foo — description', () => {
  it('raw <foo> in src/ → error', () => {
    const { stdout } = lint(
      'packages/frontend/src/ProbeFoo.tsx',
      `export const X = () => <foo>x</foo>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).toContain('no-foo')
  })

  it('shadcn <Foo> in src/ → allowed', () => {
    const { stdout } = lint(
      'packages/frontend/src/ProbeFooOk.tsx',
      `import { Foo } from '@/components/ui/foo'\nexport const X = () => <Foo>x</Foo>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).not.toContain('no-foo')
  })

  it('raw <foo> in src/components/ui/ → allowed (shadcn wraps it)', () => {
    const { stdout } = lint(
      'packages/frontend/src/components/ui/probe-foo.tsx',
      `export const X = () => <foo>x</foo>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).not.toContain('no-foo')
  })

  it('diagnostic invites the shadcn component', () => {
    const { stdout } = lint(
      'packages/frontend/src/ProbeFooMsg.tsx',
      `export const X = () => <foo>x</foo>\n`,
      FRONTEND_CONFIG,
    )
    expect(stdout).toContain('<Foo>')
    expect(stdout).toContain('npx shadcn add foo')
  })
})
```

The `FRONTEND_CONFIG` constant is already defined in the file:

```ts
const FRONTEND_CONFIG = join(REPO_ROOT, 'packages', 'frontend', '.oxlintrc.json')
```

The `beforeAll` creates `packages/frontend/src/components/ui/` in the fixture dir.

### Step 4 — Find and fix existing violations, then verify

```bash
# Find all violations in the frontend src
./node_modules/.bin/oxlint --config packages/frontend/.oxlintrc.json packages/frontend/src

# Migrate: replace raw elements with shadcn equivalents
# If the shadcn component isn't installed yet:
cd packages/frontend && npx shadcn@latest add <slug> && cd ../..

# Re-run until clean
./node_modules/.bin/oxlint --config packages/frontend/.oxlintrc.json packages/frontend/src
# → Found 0 warnings and 0 errors.
```

---

## Scope boundary: what the rule skips

`src/components/ui/**/*.tsx` is excluded — shadcn components legitimately use the raw primitives they wrap. The second override in `.oxlintrc.json` handles this (Step 2 above).

---

## Files touched per extension

| File                                                    | Change                              |
| ------------------------------------------------------- | ----------------------------------- |
| `.claude/oxlint-plugins/design-system.js`               | Add rule or COMPONENT_MAP entry     |
| `packages/frontend/.oxlintrc.json`                      | Wire rule in both overrides         |
| `packages/host/tests/unit/oxlint-rules.unit.test.ts`    | Add describe block with 3-4 cases   |
| `packages/frontend/src/main.tsx` (or other views)       | Migrate existing violations         |
| `packages/frontend/src/index.css` (if new token needed) | Add `--color-<token>` to `@theme`   |
| `packages/frontend/src/components/ui/<slug>.tsx`        | Install via `npx shadcn add <slug>` |

---

## Related

- `.claude/rules/frontend.md` — shadcn/ui install, cn() usage, semantic token catalogue
- `.claude/patterns/lint-test-pattern.md` — assert behaviour (exitCode/rule-name), not prose
- `packages/frontend/src/index.css` — current `@theme` token set
- `packages/host/tests/unit/oxlint-rules.unit.test.ts` — all fixture tests live here
