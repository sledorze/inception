# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

<!-- Hunt log 2026-05-15 (third pass)
Triggers that fired: explicit /hunt invocation
Hunt start time: 23:45

Candidates:
  1. Target: tsgo-effect-check.sh grep-whole-file policy → every edit to main.ts / SqliteEventStore.ts
     raises false-positive suppression block (pre-existing legitimate directives)
     | Heuristic: #7 asymmetric feedback + #1 detection-stage drift (check became noise, ignored)
     | Output channel: .claude/hooks/tsgo-effect-check.sh (switched to git diff added-lines only)
     | Bonus: SqliteEventStore.ts schemaSyncInEffect:off suppressions replaced with better-sqlite3
       generic typing — suppressions eliminated rather than whitelisted
  2. Target: No .claude/patterns/schema-decode.md — three-way decode API decision (decodeUnknownEffect /
     decodeUnknownResult / decodeUnknownSync) re-derived each session; this session cost 3 typecheck
     cycles to discover the correct API
     | Heuristic: #5 pattern absence
     | Output channel: .claude/patterns/schema-decode.md (new pattern file)
  3. Target: Law test coverage at 28% (13/39 laws) — pnpm loop:health L3 ⚠ signal; L0.x laws
     (including L0.1 "every law has a test") have zero coverage
     | Heuristic: #9 meta-loop health
     | Output channel: docs/PAIN.md (new item P28; fix > 30 min)

Stopped because: 3 candidates surfaced and landed.
All three resolved: hook fixed inline, pattern created, PAIN item filed as P28.
-->

<!-- Hunt log 2026-05-15 (second pass)
Triggers that fired: explicit /hunt invocation
Hunt start time: 17:20

Candidates:
  1. Target: loop-health.sh — grep -c double-output arithmetic errors + [in-progress] blind spot
     | Heuristic: #9 meta-loop + #6 stale | Output channel: scripts/loop-health.sh (fixed inline)
  2. Target: CLAUDE.md rituals reference [todo] only — misses in-progress item 4.3
     | Heuristic: #6 stale doc + #8 priming | Output channel: CLAUDE.md (2 lines updated)
  3. Target: check-test-conventions.ts runs only in CI — test naming violation invisible until PR
     | Heuristic: #1 detection-stage drift | Output channel: lefthook.yml (conventions step at pre-push)

Stopped because: 3 candidates surfaced and mechanized.
All resolved in commit 24a1c979. No open PAIN items added.
-->

<!-- Hunt log 2026-05-15
Triggers that fired: explicit /hunt invocation
Hunt start time: 17:10

Candidates:
  1. Target: oxlint-check.sh PostToolUse uses root config for frontend files → design-system plugin silently skipped at edit time
     | Heuristic: #1 detection-stage drift | Output channel: .claude/hooks/oxlint-check.sh (fixed inline)
  2. Target: session-context.sh grep [todo] misses [in-progress] items → TODO 4.3 invisible to session hook
     | Heuristic: #6/#8 stale doc + priming | Output channel: .claude/hooks/session-context.sh (fixed inline)
  3. Target: design-system rule extension cycle applied 3× with no pattern reference
     | Heuristic: #5 pattern absence | Output channel: .claude/patterns/frontend-design-system.md (new file)

Stopped because: 3 candidates surfaced and mechanized.
All three findings resolved in commit 5030e00c — no open PAIN items added.
-->

---

## P36 — Frontend components couple data-fetching, state management, and rendering in one unit

**Severity:** slows

**Symptom:** Every component in `packages/app/src/components/` and `packages/backoffice/src/components/` (13 components) imports directly from `../../api/` and owns the full data lifecycle: `useState(null) + apiCall().then(setData).catch(setErr)`. This 5-7 line boilerplate is copy-pasted verbatim across `Metrics`, `PainBoard`, `WorkBoard`, `Patterns`, `Sessions`, `AgentMd`, `Proposals`, `Settings`, `SessionDetail`, `FlagForm`, `CallCapability`, `ReadWorkspace`, `WriteWorkspace`. No `hooks/` abstraction layer exists; no dep-cruiser deny rule blocks the component→api coupling; no rule is violated when a component adds a second API call or manages loading state manually. Testing a component's data loading requires mounting a full React tree with working fetch rather than calling a pure function. The dep-cruiser rule for these packages is a pure allow-all (P37), so violations are invisible to CI.

**Candidate fix:** (a) Extract `useAsyncFetch<T>(fn, deps?)` → `{ data, error, loading, refresh }` — one implementation, all components become 1-line consumers. (b) Add dep-cruiser deny rule `no-frontend-component-api-import`: `packages/(app|backoffice)/src/components/**` may not import `packages/(app|backoffice)/src/api/**` — enforces `hooks/` as the only path from components to API by construction. (c) Migrate all 13 components.

**Acceptance test (red):** `packages/host/tests/unit/depCruiserBoundary.unit.test.ts` — run dep-cruiser on `packages/app/src/components/app/Metrics.tsx` and assert exit code != 0 with `no-frontend-component-api-import` in output. Currently dep-cruiser exits 0 (allow-all) — test FAILS.

---

## P37 — Dep-cruiser `packages/(app|backoffice)` rule is allow-all — no sub-directory boundaries enforced

**Severity:** annoys

**Symptom:** The dep-cruiser config has one entry for app/backoffice internals: `from: packages/(app|backoffice)/src/, to: packages/(app|backoffice)/src/` with no deny rules. There are no restrictions on: `api/ → components/` (reverse dep, creates circular coupling risk), `components/ → api/` (skips the hook layer, P36), or any future `hooks/ → components/` upward dep. The intended architecture — `components` → `hooks` → `api` — has zero graph-level enforcement. Any import topology inside these packages is valid; violations are structurally invisible to CI and code review tooling. Adding a `hooks/` directory does not automatically enforce its role unless a deny rule gates it.

**Candidate fix:** Replace the allow-all entry with explicit deny rules: (a) `components/**` may not import from `api/**` — enforced by P36 fix; (b) `api/**` may not import from `components/**` — closes the reverse-dep gap; (c) add a comment naming `hooks/**` as the mediation layer so future deny rules have a stated rationale. The acceptance test from P36 also covers this item (same deny rule).

---

## P38 — Critical `.claude/patterns/` files are passive docs not surfaced at the point of decision

**Severity:** annoys

**Symptom:** `.claude/patterns/effect-test-pattern.md`, `schema-decode.md`, and `composition-root.md` contain guidance that is re-derived every session it is needed: `schema-decode.md` was created after 3 typecheck cycles spent finding the right decode API (P25 hunt); `composition-root.md` encoding was wrong in 2 sessions caught only at commit time; `effect-test-pattern.md` must be re-read each time a new test layer is started. The `effect-ts` skill fills the same role for Effect APIs and is proactively invocable via `/effect-ts`; CLAUDE.md's "When in doubt" section links to it by decision point. The three pattern files are not referenced in "When in doubt" for their specific decisions and are discovered only if the developer explicitly knows to look. The enforcement gap: a developer about to write `Schema.decodeUnknownSync` or wire a new Layer gets no proactive signal from the toolchain.

**Candidate fix:** `.agents/skills/` requires FleetView project-settings registration to be invocable — new entries there are invisible to Claude Code until registered externally. The always-discoverable mechanism is `.claude/commands/<name>.md` (project-level slash commands, same mechanism as `/hunt`). Promote `effect-test-pattern.md`, `schema-decode.md`, `composition-root.md` to `.claude/commands/effect-test-pattern.md`, etc. — these are immediately invocable as `/effect-test-pattern`, `/schema-decode`, `/composition-root`. Update CLAUDE.md "When in doubt" to name the slash commands at each decision point. The patterns/ files become thin redirects. Validation: grep CLAUDE.md "When in doubt" for the three command names — fails before fix, passes after.

**Acceptance test (red):** `packages/host/tests/unit/enforce-conventions.unit.test.ts` — "P38 red step" describe block asserts `.claude/commands/effect-test-pattern.md`, `schema-decode.md`, and `composition-root.md` exist and that CLAUDE.md "When in doubt" references each slash command name. Currently all six assertions fail (files absent, CLAUDE.md not updated) — test FAILS.

---

## P40 — Cross-package quality standards drift — no single-source enforcement

**Severity:** slows

**Symptom:** `packages/host/`, `packages/app/`, and `packages/backoffice/` have grown independently. Quality gates are applied inconsistently: `packages/host/` has a full oxlint plugin with custom rules, PostToolUse hooks, protocol tests, and a law/coverage ratchet; `packages/app/` and `packages/backoffice/` have a design-system oxlint plugin but no PostToolUse hook, no protocol tests, no mutation score, and no custom PAIN-closure check. There is no single place that declares "every package must have X" — only per-package `.oxlintrc.json` files that drift independently. Concretely: (a) a new package could be added without any lint config and no gate would fire; (b) a rule added to `host/.oxlintrc.json` is not automatically considered for `app/` and `backoffice/`; (c) Turborepo task definitions (`lint:ci`, `typecheck`, `test:coverage:ci`) are per-package and not cross-checked against a baseline contract. The result: quality guarantees degrade as new packages are added.

**Candidate fix:** Extract a `packages/design-system/.oxlintrc-base.json` (shared base config, extended by each package's `.oxlintrc.json` via `"extends": [...]`). Add a `check-package-baseline.sh` lefthook step that verifies every `packages/*/.oxlintrc.json` contains an `"extends"` pointing to the base config — enforces the contract structurally. Separately, gate new package creation: `check-layout.sh` (already checking directory names) can be extended to assert that every new `packages/<name>/` directory has the required quality files (`.oxlintrc.json`, `tsconfig.json`, a test directory).

**Acceptance test (red):** Add `describe.skip('P40 — every package has baseline quality files', ...)` to `packages/host/tests/unit/enforce-conventions.unit.test.ts` — asserts that each `packages/*/.oxlintrc.json` includes an `"extends"` field pointing to the shared base. Currently none of the package oxlint configs use `"extends"` — all assertions fail.
