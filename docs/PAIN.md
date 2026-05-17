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

---

## P44 — `POST /api/login` has no rate limiting (brute-force possible)

**Severity:** slows (security gap before external deployment)

**Symptom:** `POST /api/login` in `main.ts` has no throttle, delay, or account-lockout after
failed attempts. `scryptSync` slows each individual check (~100 ms) but does not prevent parallel
brute-force. For the prototype this is acceptable, but it blocks any external deployment.

**Candidate fix:** In-process per-IP attempt counter in the auth middleware (`withRole` / `login`
application service) with a configurable window and lockout threshold. Or: defer to an ingress-layer
rate limiter (nginx/Caddy). File a TODO for Phase 8 (outer observability) or Phase 11 security hardening.

**Acceptance test.** Integration test: send N+1 login attempts with wrong password and assert the
N+1th returns 429 or has a measurable delay — cite in PAIN closure.

---

## P46 — `effect-patterns` oxlint plugin misses top-level `await` and `.then/.catch` chaining

**Severity:** slows (hard rule advertised as enforced; violations ship silently)

**Symptom:** `noAsyncInSrc` in `.claude/oxlint-plugins/effect-patterns.js` has no
`AwaitExpression` visitor, so `await expr` at module scope (or anywhere outside an explicitly
`async`-flagged function) is never flagged. `noRawPromise` has no MemberExpression-call visitor,
so `.then(` / `.catch(` / `.finally(` promise-chaining is never reported. The
`// promise-bridge: intentional` bypass is checked via `src.includes(...)` over the entire raw
source — a match anywhere in the file (string literal, far-from-scope comment) silences the rule
file-wide, contrary to the message's claim of "at file scope."

**Candidate fix (oxlint rule, PostToolUse latency):**

1. `noAsyncInSrc` — add `AwaitExpression(node)` visitor; report unless the enclosing function is
   the `try`/`catch` callback of an `Effect.tryPromise` or `Effect.promise` call.
2. `noRawPromise` — add a `CallExpression` visitor that walks the callee: if the callee is a
   MemberExpression with a non-computed `.then` / `.catch` / `.finally` property, report; also
   report computed `Promise['resolve']` and Identifier references that alias `Promise`.
3. Bypass hardening — replace `src.includes('// promise-bridge: intentional')` with a check
   that the marker is a leading line-comment before the first statement (using
   `context.sourceCode.getCommentsBefore(firstToken)` or first-token range inspection). A marker
   buried in a string literal or trailing comment must not silence the file.
4. Confirm `packages/host/.oxlintrc.json` Block 0 glob (`**/src/**/*.ts`) covers `src/checks/`.

**Acceptance test.** `packages/host/tests/unit/oxlint-rules.unit.test.ts` —
`describe('effect-patterns/no-async-in-src — top-level await (P46)')`: assert `exitCode !== 0`
on a fixture containing `await expr` at module scope; `describe('effect-patterns/no-raw-promise
— .then chaining (P46)')`: assert `exitCode !== 0` on `p.then(() => {})` and assert a bypass
marker embedded in a string literal does **not** silence the rule. Currently `it.fails` (RED);
remove `.fails` in green commit.
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — P46 describes (RED).

---

## P47 — two `src/checks/*.ts` CLI scripts use unannotated top-level `await Effect.runPromise`

**Severity:** slows (genuine hard-rule violation, invisible to all tooling today)

**Symptom:** `packages/host/src/checks/check-test-conventions.ts:68` and
`packages/host/src/checks/check-file-structure.ts:79` both end with:

```ts
await Effect.runPromise(program.pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))))
```

The file header carries `/** @effect-diagnostics strictEffectProvide:off */` but no
`// promise-bridge: intentional`. They are CLI entry scripts (morally equivalent to `main.ts`)
but not compliant with the Effect-over-Promise hard rule. Invisible because the P46 gap
(`AwaitExpression` visitor missing) means oxlint never fires. Once P46 is fixed these two files
will be flagged until converted.

**Candidate fix:** Replace the `await Effect.runPromise(...)` tail in both files with:

```ts
program.pipe(Effect.provide(Layer.mergeAll(...)), NodeRuntime.runMain)
```

using `import * as NodeRuntime from '@effect/platform-node/NodeRuntime'` (subpath import per
`host-package.md` to avoid the barrel's `@effect/cluster` side-effect). Remove the `@effect-
diagnostics` header; no `// promise-bridge` needed for this pattern.

**Acceptance test.** `packages/host/tests/unit/oxlint-rules.unit.test.ts` — add a case after P46
green: lint a fixture containing `await Effect.runPromise(...)` at module scope and assert
`exitCode !== 0`; lint the real `check-test-conventions.ts` path (relative to fixture root) after
conversion and assert `exitCode === 0`. The P46 `AwaitExpression` test already covers the
detection side; P47's green test proves conversion eliminates the flag.
test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — P46 AwaitExpression case covers RED.

---

## P45 — `archivedPainItems` always returns 0 (PAIN-archive.md not parsed)

**Severity:** annoys

**Symptom:** `EventStoreAdminQuery.metrics()` hardcodes `archivedPainItems: 0` with a TODO comment.
The backoffice metrics panel always shows 0 archived items regardless of how many have been closed.

**Candidate fix:** Add `parsePainArchiveMd` domain function (similar to `parsePainMd`); parse
`PAIN-archive.md` for FIXED items and return the count. The `AdminQueryPaths` struct already has the
slot for the archive path.

**Acceptance test.** Unit test for `parsePainArchiveMd` asserting it counts `## P…` entries that
contain a `FIXED` line — cite in PAIN closure.

---

## P48 — frontend api layer: `handleErr` ×3, duplicated `authedFetch`/`TOKEN_KEY`, 5 endpoints skip error handling

**Severity:** annoys (correctness bug + AL.7 duplication in the frontend api layer)

**Symptom:** `handleErr` (the function that throws on non-2xx responses) is declared
byte-identically in three separate files:

- `packages/backoffice/src/api/auth.ts` (source)
- `packages/app/src/api/auth.ts` (copy)
- `packages/backoffice/src/api/admin.ts:67` (local re-declaration)

`authedFetch`, `TOKEN_KEY`, and the token accessor functions (`getToken`/`setToken`/`clearToken`)
are duplicated across `packages/app/src/api/auth.ts` and `packages/backoffice/src/api/auth.ts`.
`getMetrics`, `getPain`, `getWork` (`admin.ts` ~lines 25–32), `listProposals`, and `callTool`
call `authedFetch(...).then(r => r.json())` **without `handleErr`** — a non-2xx response is
parsed as JSON and surfaces as a confusing parse error rather than the server's error message.

**Candidate fix:** extract a shared authed client (`packages/frontend-api/` workspace or a
shared module imported by both packages) owning `TOKEN_KEY`, token accessors, `authedFetch`,
`handleErr`, and a single `getJson<T>(url, init)` that always pipes through `handleErr` before
decoding. Route the 5 bare endpoints through `getJson`. Guard against re-duplication with an
acceptance test.

**Acceptance test.** `packages/host/tests/unit/enforce-conventions.unit.test.ts` — add
`it.fails('handleErr is declared in exactly one api file', ...)` scanning `packages/*/src/api/`
for `const handleErr` or `function handleErr` and asserting exactly one match (currently fails
because three files define it). Currently `it.fails` (RED); remove `.fails` in green commit.
test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` — "Frontend api layer: handleErr declared in exactly one file (P48)" (RED).
