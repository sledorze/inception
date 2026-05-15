---
name: lint-test-pattern
description: What to assert in lint-enforcement (oxlint probe) tests — behaviour, not prose
---

# Pattern: lint enforcement test assertions

**Enforced by:** code review + this pattern  
**Context:** `packages/host/tests/unit/oxlint-rules.unit.test.ts` (and any future per-package equivalent added per P25)

---

## The rule

Assert **behaviour** (rule fires, process exits non-zero), never **prose** (message content).

### ❌ Wrong — asserting message text

```ts
expect(stdout).toContain('FileSystem') // testing our own config string
expect(stdout).toContain(expected) // same problem via table-driven variable
```

Why wrong:

- The custom `message` field in `.oxlintrc.json` is documentation, not behaviour.
  Changing `"Use FileSystem"` to `"Use FS"` leaves the rule working identically.
- Different output formatters (default vs GitHub Actions annotation format) include or
  drop the `message` field. Tests asserting message text break in CI unless you add
  environment workarounds that themselves become maintenance burden.

### ✅ Correct — asserting behaviour

```ts
const { exitCode, stdout } = lint(probePath, src)
expect(exitCode).not.toBe(0) // rule fired
expect(stdout).toContain('node:fs') // the offending import name appears (rule identifies it)
```

The two behavioural invariants worth asserting:

1. `exitCode !== 0` — the rule causes lint to fail.
2. `stdout.toContain(moduleName)` — the output identifies the specific import that
   violated the rule (lets a developer understand the output without reading config).

Do NOT assert the rule name string (e.g. `'no-restricted-imports'`) unless testing that
a rule fires vs. a different rule — the rule name appears in both formatters.

---

## Environment independence

The `lint()` helper must not depend on the process environment format. oxlint
auto-detects `GITHUB_ACTIONS=true` and switches to annotation format. Do not work
around this by stripping env vars — instead, fix the assertions to be format-agnostic
(i.e., assert behaviour, which appears in all formatters).

```ts
// No env stripping needed when assertions are format-agnostic:
const result = spawnSync(OXLINT_BIN, ['--config', configPath, relPath], {
  cwd: FIXTURE_DIR,
  encoding: 'utf8',
})
```

---

## What the formatter-independence breakdown looks like

| What you assert                            | Default format | GitHub annotation format | Correct? |
| ------------------------------------------ | -------------- | ------------------------ | -------- |
| `exitCode !== 0`                           | ✅             | ✅                       | ✅       |
| `toContain('node:fs')`                     | ✅             | ✅                       | ✅       |
| `toContain('no-restricted-imports')`       | ✅             | ✅ (in `title=`)         | ✅       |
| `toContain('FileSystem')` (custom message) | ✅             | ❌ (dropped)             | ❌       |

---

## The three-commit anti-pattern (how this was discovered)

1. Test written asserting `toContain('FileSystem')` — passes locally.
2. CI fails: GitHub Actions format drops the custom message → add `GITHUB_ACTIONS: undefined` workaround.
3. Realise the assertion tests config prose, not behaviour → remove `expected` field and workaround in one refactor.

Total: 3 commits, 2 reversals, 1 merge conflict. Avoided by asserting behaviour from the start.
