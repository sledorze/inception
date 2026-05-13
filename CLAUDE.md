# AI Brief — devcontainer-claude-template

This document is your primary context for working in this codebase. Read it fully before writing any code. It explains **what this template is**, **why each tool was chosen**, and **how to work effectively** within it.

## What This Template Is

A production-ready TypeScript monorepo starter for **backend + frontend projects developed with an AI coding agent** (you). It is opinionated about tooling, quality gates, and workflow — not about application logic.

When a developer forks this template, they get:

- A working pnpm workspace (`packages/backend` + `packages/frontend`)
- A strict linting, formatting, and type-checking pipeline
- A mutation-tested test suite wired to CI
- A pre-push hook that prevents regressions from landing
- A Claude Code hook that prevents you from bypassing safety checks
- A session hook that injects date, branch, and git status at every session start
- A path-scoped rules system (`.claude/rules/`) for domain-specific AI context
- A dependency graph guardian (dependency-cruiser) ready to be configured

Your job is to help the developer build their product **inside** this structure — replacing the example code with real application code while respecting the quality gates.

---

## Repository Structure

```
packages/
  backend/        Node.js backend (TypeScript, no bundler)
    src/
      example.ts            Replace with your application code
      example.unit.test.ts  Replace with your tests
    package.json
    tsconfig.json
  frontend/       React + Vite + Tailwind CSS v4
    src/
      main.tsx    Entry point — replace with your app
      index.css   Tailwind import — extend here
    index.html
    package.json
    tsconfig.json
    vite.config.ts
scripts/
  stryker-changed.sh  Run mutation testing on changed files only
.claude/
  hooks/block-no-verify.sh   Blocks --no-verify in AI agent Bash calls
  hooks/session-context.sh   Injects date, branch, git status at session start
  hooks/oxlint-autofix.sh    Auto-fixes safe oxlint violations after every edit
  hooks/oxlintrc-autofix.json  Restricted config for safe cosmetic rules only
  rules/                     Path-scoped AI context files (see below)
  settings.json              Claude Code hook config
.github/workflows/
  ci.yml              PR checks (lint, typecheck, test, security)
  mutation-report.yml Nightly full mutation report
```

---

## First Steps When Adopting This Template

1. **Rename the project**: change `"name": "my-project"` in `package.json` and `packages/*/package.json` to your project name.
2. **Update `.serena/project.yml`**: set `project_name` to match.
3. **Replace example code**: delete `packages/backend/src/example*.ts` and start building your backend. Keep the `.unit.test.ts` naming convention (see below).
4. **Replace the frontend scaffold**: update `packages/frontend/src/main.tsx` with your React app.
5. **Run `pnpm install`** to install all dependencies.
6. **Wire dependency rules**: when your codebase grows, add `forbidden` rules to `.dependency-cruiser.cjs` to prevent coupling between layers.

---

## Toolchain — What, Why, and How

### pnpm Workspaces

Two packages share a single `node_modules` via `pnpm-workspace.yaml`. The root `package.json` holds all dev tooling; `packages/*/package.json` declare application dependencies.

**Why workspaces over a flat structure?** Backend and frontend have different runtimes, different TypeScript configs (`nodenext` module resolution vs `bundler`), and different test environments. Keeping them in separate packages lets tools like `tsc`, `vitest`, and Stryker scope themselves correctly. It also prevents accidental Node.js imports (`node:fs`, `node:path`) from leaking into frontend code — the `import/no-nodejs-modules` oxlint rule enforces this at the file level, and the workspace boundary makes it structural.

### Turborepo

`turbo.json` defines the inputs and outputs for every task. When you run `pnpm turbo run lint typecheck`, Turbo hashes the input files and skips tasks whose inputs haven't changed since the last run. CI jobs restore the `.turbo/cache` directory via `actions/cache`, so a second run on the same PR (e.g. after a minor fix) completes in seconds.

**Why Turborepo over just running scripts?** The overhead of running `tsc`, `oxlint`, and `prettier` on every CI push adds up. Once your codebase has more than ~50 files, incremental caching pays back immediately. The `turbo.json` in this template is intentionally minimal — only root-level tasks (`//#...`) are defined, because workspace packages don't have their own turbo tasks yet. Extend it as your packages grow.

**Key tasks:**

| Script              | What Turbo tracks                            |
| ------------------- | -------------------------------------------- |
| `lint:ci`           | All TS/TSX source files + `.oxlintrc.json`   |
| `typecheck`         | All source files + both `tsconfig.json`s     |
| `format:check:ci`   | All formatted files + Prettier config        |
| `deps:check`        | All source files + `.dependency-cruiser.cjs` |
| `syncpack:check:ci` | All `package.json` files + `.syncpackrc`     |
| `test:coverage:ci`  | All source files + `vitest.config.ts`        |

### oxlint (strict mode)

All five oxlint severity categories are set to `error`. This is intentional — warnings are noise that developers learn to ignore. If a rule produces false positives, it should be explicitly disabled with a comment, not demoted to a warning.

**Rules explicitly disabled** (and why):

- `func-names`, `func-style` — Effect generators require anonymous function syntax
- `max-lines`, `max-lines-per-function`, `max-params` — arbitrary limits that fight large domain models
- `no-magic-numbers`, `no-ternary`, `no-nested-ternary` — too noisy for typical TypeScript
- `sort-imports` — conflicts with Prettier's import ordering; use `typescript/consistent-type-imports` instead
- `unicorn/filename-case`, `unicorn/no-null` — this codebase uses `null` for optional DB fields
- `react/react-in-jsx-scope` — not needed with modern JSX transform
- `import/no-nodejs-modules` is **enabled** globally but **off** for `packages/backend/**` — frontend code must not import Node.js built-ins, but backend code may

**The `sort-keys: error` rule** is on. Object keys must be sorted alphabetically. This prevents diff noise on config objects and makes code review easier. Prettier handles everything else.

### lefthook

Three hook groups:

- **`pre-commit`** (parallel): gitleaks, hadolint, oxlint auto-fix, Prettier auto-fix, syncpack check. Runs on staged files only, fast.
- **`ci`** (parallel): check-only versions of the above, no auto-fix. Used in CI via `lefthook run ci` if needed.
- **`pre-push`** (piped, sequential): merge origin/main → typecheck + tests. This is the quality gate before code leaves your machine.

**Why piped for pre-push?** The `merge-main` step must complete before `checks` runs — you want to typecheck the merged result, not your branch in isolation. Piped mode stops the chain if any step fails.

**The merge-main step** fetches and merges `origin/main` before running checks. This catches conflicts before CI does. It only runs on non-main branches; pushing to main skips it.

### dependency-cruiser

`.dependency-cruiser.cjs` starts with an empty `forbidden: []` array. Add rules as your architecture develops to prevent coupling regressions.

**Why it's included from day one** — it's much easier to add a rule when you're designing a boundary than to untangle violations six months later. Common rules to add:

- Services must not import from other services' internal files
- Frontend components must not import backend-only modules
- Test infrastructure files must not form import cycles with each other

The two commented examples in the file show how to prevent test barrel re-exports and enforce per-entity event imports. Copy and adapt.

### syncpack

Keeps dependency versions consistent across all `package.json` files in the workspace. The `semverGroups` config has a pre-configured (empty) **beta-pinning group** at the top. If you use a library that ships prerelease versions (e.g. Effect, Next.js canary), add the package names to the `dependencies` array of that group to pin them to exact versions instead of a caret range.

**Why exact pinning for prereleases?** Caret ranges like `"effect": "^4.0.0-beta.25"` can resolve to a newer beta that broke something. Exact pins make upgrades intentional.

### Stryker (mutation testing)

Mutation testing answers the question: "do my tests actually detect bugs, or do they just pass?" Stryker introduces small code mutations (e.g. `>` → `>=`, `true` → `false`) and checks whether your tests catch them.

**Why two configs?** Backend and frontend have different test environments (Node vs happy-dom). Running them in a shared vitest config with `perTest` coverage analysis causes environment collisions. Separate configs isolate them.

**Why a scheduled `mutation-report.yml` instead of PR CI?** A full mutation run is slow (minutes to tens of minutes on a mature codebase). Running it on every PR wastes CI minutes and blocks developers. The nightly schedule gives you a weekly health signal without blocking PRs. In CI for PRs, use `pnpm stryker:changed` to scope mutation testing to changed files only — this is fast enough to be useful.

**Thresholds:** `break: 60, high: 80, low: 70`. These are tighter than Stryker's defaults. Treat them as a ratchet — only increase, never decrease. If a PR drops below `break`, add tests before merging.

### Claude Code hooks (`.claude/hooks/`)

**`block-no-verify.sh`** intercepts every `Bash` tool call and blocks any command containing `--no-verify`. This prevents you (the AI agent) from bypassing the pre-push hook.

**Why this exists** — AI agents sometimes reach for `git push --no-verify` when a pre-push hook fails, treating it as an obstacle rather than a signal. The hook was introduced after discovering this pattern. Pre-push hooks exist to protect the main branch; bypassing them defeats the point. If a hook fails, investigate and fix the root cause instead.

**`session-context.sh`** fires at `SessionStart` and injects the current date, branch name, and dirty/unpushed status into context. This ensures you never reason from a stale mental model of what branch you're on or whether there are uncommitted changes.

**`oxlint-autofix.sh`** fires after every `Edit` or `Write` tool call on a `.ts/.tsx/.js/.jsx` file. It runs oxlint with `--fix-dangerously` using a restricted config (`oxlintrc-autofix.json`) that only enables safe cosmetic rules — `curly`, `eqeqeq`, `prefer-template`, `consistent-type-imports`, and a few others. Destructive rules like `no-unused-vars` are explicitly off. The hook always exits 0 and never blocks an edit.

### Path-scoped rules (`.claude/rules/`)

Files in `.claude/rules/` are **loaded automatically by Claude Code** when you work with files matching their `paths:` frontmatter — you do not need to read them manually.

```markdown
---
paths:
  - 'packages/backend/src/billing/**'
---

# Billing domain constraints

...
```

Rules load **additively** — multiple files load when their `paths:` patterns overlap. Use this to layer context progressively without polluting CLAUDE.md with domain detail.

**The inverse rule: path breadth determines content depth.**

- Wide path (`packages/backend/**`) → 3–5 lines max, only universal invariants
- Mid path (`packages/backend/src/billing/**`) → 10–20 lines, domain constraints
- Narrow path (`**/*.migration.ts`) → as rich as needed, loaded rarely

**Rules files aid the work, not just restrict it.** Enforcement rules ("no raw SQL") are only half the value. The other half is contextual guidance: how to debug failures in this domain, what tools to reach for, what the common pitfalls are.

**What belongs in a rules file vs `CLAUDE.md`:**

- `CLAUDE.md` — applies everywhere, always loaded, must stay short
- Rules file — applies only to matching paths; safe to be specific because it won't pollute unrelated work

When you find yourself writing an exception ("...except in billing"), that exception is a separate rules file scoped to billing — not an inline caveat here.

---

## Working Practices

### Plan Before Building

For any task touching 3+ files or introducing a new pattern, enter plan mode first. Lay out the approach and check for simpler alternatives before writing code.

### Vertical Feature Slices

Every task should traverse the full stack — from frontend UI to backend logic to data persistence. No horizontal tasks ("create all the models", "add all the routes"). Each slice delivers one working, testable behaviour end-to-end.

### Behaviour-Driven Development (BDD)

Start from the observable behaviour. Write the test, then implement. Each task maps to a concrete user-visible outcome, not an implementation detail.

### Strategic Refactors

A refactor is only valid as preparation for an upcoming slice. It must state what it prepares and how it reduces blast radius. Never merge refactors and new behaviour in the same commit.

### Spikes for Unknowns

When a task has unclear feasibility, create a time-boxed spike first. Spikes produce findings and a recommendation — no production code. Implementation follows after the spike resolves the uncertainty.

### Test Naming Convention

Backend test files must be named `*.unit.test.ts` or `*.integration.test.ts` — never bare `*.test.ts`. This allows tools to scope correctly (e.g. Stryker's `mutate` excludes test files by pattern).

Frontend test files use `*.test.tsx` or `*.test.ts`.

### Witness the Automation

Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` locally and **see the output** before pushing. Don't assume CI will catch issues. The pre-push hook runs these automatically, but run them yourself too — it's faster to iterate locally than to wait for CI.

### Never Lower Coverage Thresholds

If a change drops coverage below the configured threshold, add tests. Coverage thresholds are a ratchet — only tighten, never loosen.

### Minimize Dependency Fan-Out

Before creating or modifying a shared file (utility, type barrel, service), check how many files already import it (`find_referencing_symbols`). A file imported by 10+ modules is a hub — changes to it force retesting everything. Either keep hubs stable or split them by domain boundary.

---

## CI Pipeline

Three jobs run in parallel on every PR:

| Job        | What it runs                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `checks`   | `lint:ci` + `typecheck` + `format:check:ci` + `deps:check` + `syncpack:check:ci` via Turborepo |
| `test`     | `test:coverage:ci` via Turborepo, uploads coverage artifact, posts PR comment                  |
| `security` | gitleaks (secret scanning) + hadolint (Dockerfile linting)                                     |

All three jobs cache `.turbo/cache` keyed by `github.ref` + `github.sha` with fallback to `github.ref` and then `refs/heads/main`. This means a second push on the same PR restores the previous run's cache, and all PRs can seed from main's cache.

The mutation report runs **nightly** as a separate workflow (`mutation-report.yml`) — not on PRs.

---

## Key Files to Customise

| File                              | What to change                                            |
| --------------------------------- | --------------------------------------------------------- |
| `package.json`                    | Project name, add application dependencies                |
| `packages/backend/src/example.ts` | Delete and replace with your backend code                 |
| `packages/frontend/src/main.tsx`  | Replace with your React app                               |
| `.dependency-cruiser.cjs`         | Add `forbidden` rules as your architecture solidifies     |
| `.syncpackrc`                     | Add prerelease package names to the beta-pinning group    |
| `stryker.config.json`             | Add app-specific exclusions to `mutate`                   |
| `stryker.frontend.config.json`    | Add app-specific exclusions                               |
| `scripts/stryker-changed.sh`      | Add project-specific exclusion patterns                   |
| `.serena/project.yml`             | Set `project_name`                                        |
| `.claude/rules/`                  | Add path-scoped rules files as your codebase grows        |
| `CLAUDE.md`                       | Replace this document with your project-specific AI brief |
