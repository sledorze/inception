# Interactive Project Setup

This template ships with **all features included**. On first use, the AI assistant reads this file and walks the developer through feature selection — removing what's not needed.

## How It Works

1. The developer creates a new repo from this template
2. On first interaction, the AI reads this file
3. The AI asks about each feature group below (in order)
4. Based on answers, the AI removes unwanted files and config
5. The AI deletes this `.template/` directory when done

> **AI assistant**: Go through each feature section below in order. Ask the developer a clear yes/no question for each. Apply the "If NO" instructions for declined features. At the end, delete the `.template/` directory and update the README.

---

## 1. Project Identity

**Ask**: "What's the project name? (used in package.json and README)"

- Update `name` in `package.json` and all `packages/*/package.json` files
- Update the title and description in `README.md`
- Update `project_name` in `.serena/project.yml`

---

## 2. Effect v4 Backend

**Ask**: "Do you want an Effect v4 backend with typed services, Schema validation, and dependency injection?"

**If YES**:

- Add `effect`, `@effect/vitest`, `@effect/platform-node-shared` to `package.json` dependencies (pin to exact beta version, add to the syncpack beta-pinning semver group in `.syncpackrc`)
- Keep the Effect-specific sections in `CLAUDE.md`
- Ask follow-up: "Do you want SQLite persistence with Effect SQL?"
  - **If YES**: Add `@effect/sql-sqlite-node` and `better-sqlite3` to dependencies; add `better-sqlite3` to `pnpm.onlyBuiltDependencies`
  - **If NO**: Skip those dependencies

**If NO**:

- Keep `packages/backend/src/example.ts` and `packages/backend/src/example.unit.test.ts` as plain TypeScript
- Do not add any Effect packages

---

## 3. Frontend (React + Vite + Tailwind CSS v4)

**Ask**: "Do you want a React frontend with Vite, Tailwind CSS v4, and shadcn/ui components?"

**If YES**:

- Keep the `packages/frontend/` directory and all its contents
- Keep frontend-related scripts in `package.json`: `build:frontend`, `dev:frontend`
- Keep frontend devDependencies: `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `vite`, `react`, `react-dom`, `shadcn`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `happy-dom`, `@testing-library/*`, `@types/react`, `@types/react-dom`
- Keep `vitest.stryker-frontend.config.ts` and `stryker.frontend.config.json`
- Keep `tsc --noEmit -p packages/frontend/tsconfig.json` in the typecheck script
- Keep frontend sections in `CLAUDE.md`

**If NO**:

- Remove the entire `packages/frontend/` directory
- Remove from `package.json` scripts: `build:frontend`, `dev:frontend`
- Remove frontend devDependencies (listed above) and runtime deps
- Remove `vitest.stryker-frontend.config.ts`, `stryker.frontend.config.json`
- Remove `packages/frontend/src/**` patterns from `vitest.config.ts`
- Remove `tsc --noEmit -p packages/frontend/tsconfig.json` from typecheck script
- Remove frontend sections from `CLAUDE.md`
- Remove the `packages/frontend` entry from `pnpm-workspace.yaml`

---

## 4. E2E Testing (Playwright)

**Ask**: "Do you want end-to-end browser testing with Playwright?"

**If YES**:

- Keep `playwright.config.ts`, `e2e/` directory
- Uncomment the `webServer` section in `playwright.config.ts` and set the command to start your server
- Unskip the example test in `e2e/example.spec.ts`
- Keep `@playwright/test` devDependency
- Keep `test:e2e` script in `package.json`
- Keep the `e2e` step in `lefthook.yml` pre-push
- Keep the `e2e` job in `.github/workflows/ci.yml`

**If NO**:

- Remove `playwright.config.ts`, `e2e/` directory
- Remove `@playwright/test` from devDependencies
- Remove `test:e2e` script from `package.json`
- Remove the `e2e` command from `lefthook.yml` pre-push section
- Remove the `e2e` job from `.github/workflows/ci.yml`

---

## 5. Test Convention Enforcement

**Ask**: "Do you want to enforce test file naming conventions? (e.g., `*.unit.test.ts` vs `*.integration.test.ts` with import restrictions)"

**If YES**:

- Keep `packages/backend/src/checks/check-test-conventions.ts` and `TestConventionChecker.ts`
- Keep `check:test-conventions` script in `package.json`
- Keep `&& node --import tsx packages/backend/src/checks/check-test-conventions.ts` in the `lint` and `lint:ci` scripts
- Customize the `forbiddenImportPatterns` in `TestConventionChecker.ts` for the project's needs

**If NO**:

- Remove `packages/backend/src/checks/` directory
- Remove `check:test-conventions` script from `package.json`
- Remove the test-conventions check from the `lint` and `lint:ci` scripts

---

## 6. GitHub Actions CI Pipeline

**Ask**: "Do you want a GitHub Actions CI pipeline? (lint, format, typecheck, test, e2e, security scans)"

**If YES**:

- Keep `.github/workflows/ci.yml`
- Review jobs and remove any that correspond to declined features (e2e, frontend typecheck, etc.)

**If NO**:

- Remove `.github/workflows/` directory entirely

---

## 7. Mutation Testing Enhancements

**Ask**: "Do you want enhanced mutation testing? (incremental mode, changed-files-only in pre-push, daily score alerting)"

**If YES**:

- Keep `scripts/stryker-changed.sh`
- Keep `stryker:changed` script in `package.json`
- Keep the enhanced `stryker.config.json` (incremental, ignoreStatic)
- Keep the stryker step in `lefthook.yml` pre-push
- Ask follow-up: "Do you want daily mutation score reporting via GitHub Issues?"
  - **If YES**: Keep `.github/workflows/mutation-report.yml`
  - **If NO**: Remove `.github/workflows/mutation-report.yml`

**If NO**:

- Remove `scripts/stryker-changed.sh`
- Remove `stryker:changed` script from `package.json`
- Revert `stryker.config.json` to basic config (remove `incremental`, `ignoreStatic`, `incrementalFile`)
- Simplify the stryker step in `lefthook.yml` to just `pnpm stryker`
- Remove `.github/workflows/mutation-report.yml`

---

## 8. Pre-push Quality Gate

**Ask**: "Do you want a pre-push hook that runs typecheck + tests before every push?"

**If YES**:

- Keep the `pre-push` section in `lefthook.yml`
- The merge-main step auto-merges `origin/main` to catch conflicts early
- Adjust the commands based on which features were selected above

**If NO**:

- Remove (or comment out) the entire `pre-push` section in `lefthook.yml`

---

## 9. Coverage Thresholds

**Ask**: "Do you want enforced code coverage thresholds? (tests fail if coverage drops below configured percentages)"

**If YES**:

- Uncomment the `coverage.thresholds` section in `vitest.config.ts`
- Starting thresholds: lines 50%, statements 50%, functions 40%, branches 30%
- Increase as the project matures

**If NO**:

- Keep the `coverage.thresholds` section commented out in `vitest.config.ts`

---

## Cleanup

After all features are configured:

1. Remove the `.template/` directory
2. Run `pnpm install` to update the lockfile
3. Run `pnpm lint` and `pnpm typecheck` to verify everything is clean
4. Create an initial commit with the configured project
