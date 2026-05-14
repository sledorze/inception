# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

## P1 — Layer wiring fan-out (severity: blocks work)

**Symptom.** Adding a new dependency to `GeorgesToolkitLive` (e.g., `DataHandleRegistry`) requires
manually updating every test file that composes it. Failure is a runtime "Service not found:
@app/host/DataHandleRegistry" with no compile-time signal.

**Encountered in.** L1.1.spec.ts, L2.1.spec.ts after TODO 2.3 added `DataHandleRegistry` to
`GeorgesToolkitLive`.

**Candidate fix.** Check if a newer v4 beta makes `Layer.provide` type-error on missing
requirements. Until then, the `makeToolkitComponents` helper (partial mitigation) is in place —
only one file needs updating when `GeorgesToolkitLive` gains a new dependency.

---

## P2 — `Effect.catchTags` key mismatch is a silent runtime failure (severity: blocks work)

**Symptom.** `Schema.TaggedErrorClass` sets `_tag` to the full namespaced ID (e.g.,
`'@app/host/HandleRevoked'`). `Effect.catchTags({...})` silently ignores keys that don't match
the exact `_tag`. No TypeScript error; the unhandled branch propagates as a defect.

**Encountered in.** `run-script` handler; initial `catchTags` used short names
(`'HandleRevoked'`), causing the error to leak uncaught.

**Candidate fix.** Export `_tag` values as named constants from port files and use `[TAG]: ...`
in `catchTags` (see `.claude/rules/host-package.md` consolidation patterns). For systematic
enforcement: oxlint custom rule that asserts `catchTags` keys match a known registry.

---

## P3 — `sort-keys` lint rule on handler objects (severity: annoys)

**Symptom.** `Toolkit.of({...})` and any multi-key object literal requires alphabetically sorted
keys. Easy to add a new tool handler in the "logical" order (read → write → run) rather than
lexicographic order; discovered only on `pnpm lint`.

**Encountered in.** `GeorgesToolkit.ts` after adding `run-script` after `write-workspace`.

**Candidate fix.** Enable `sort-keys` in `oxlint-autofix.sh` so the lefthook pre-commit pass
corrects it automatically instead of blocking. Check oxlint docs for `--fix` support on
`sort-keys`.

---

## P6 — `replace_all: true` blast radius on Edit tool (severity: blocks work)

**Symptom.** A broad `replace_all: true` substitution (e.g., `err` → `error`) silently corrupts
unrelated identifiers (`console.error` → `console.erroror`). Requires reading the entire file
after every broad edit to catch collisions.

**Encountered in.** `packages/host/src/main.ts` during `catch-error-name` lint fix.

**Candidate fix.** Avoid `replace_all: true` on short tokens. Prefer targeted single-occurrence
edits or use regex-aware replacement only when the pattern is unambiguous. For lint autofixes,
let `oxlint-autofix.sh` do the rename rather than doing it manually.

---

## P8 — Test breakage detected at push, not commit (severity: slows)

**Symptom.** A code change that breaks a test is only caught at pre-push
(`pnpm turbo run test:coverage:ci`), not at pre-commit. A commit can introduce
a test-breaking change and the developer only discovers it when the push hook
fires — by which point context has shifted and the failure is further from the cause.

**Encountered in.** cycle-hunt dogfood pass 2026-05-14.

**Candidate fix.** Add `vitest run --changed --passWithNoTests` scoped to `packages/host/`
as a pre-commit hook command. Dry-run: `pnpm vitest run --changed HEAD --passWithNoTests`.
Must complete in < 30 s for most edits; gate on the full suite staying pre-push only.
Heuristic surfaced: detection-stage drift (`.claude/patterns/cycle-hunt.md` heuristic #1).
