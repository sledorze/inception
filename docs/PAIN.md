# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

## P63 — `grantTenant` is on the wrong port — auth ≠ entitlement (SRP violation)

**Severity:** slows
**Symptom:** `AuthGateway` owns `login`/`logout`/`verify` (identity) and now also `grantTenant` (authorization/entitlement). The two concerns have different lifecycles: sessions expire and are GC'd; entitlements are durable and change via admin actions. The adapter (`ScryptAuthGateway`) must therefore manage two mutable in-memory maps (`sessions` + `grants`) and two persistence files (`sessions.json` + `grants.json`). When 12.1 extracts `application/grantTenant.ts`, the application service still calls `AuthGateway.grantTenant` — the wrong-boundary call is just one level higher. The clean model is: `AuthGateway.verify` reconstructs entitlements from a read model (e.g., fold `TenantGranted` events), and `AuthGateway` has no `grantTenant` method at all.
**Candidate fix:** Remove `grantTenant` from `AuthGateway` port. `application/grantTenant.ts` (12.1) emits `TenantGranted` event only. `AuthGateway.verify` reads entitlements by folding `TenantGranted`/`TenantRevoked` events from the EventStore (via a query or a projected read model). The adapter no longer needs to know about tenant grants. Red acceptance test: `AuthGateway.verify` after a `TenantGranted` event returns the updated `tenantIds` without any `grantTenant` call on the port.

---

## P64 — `buildGrantTenant` logic duplicated between `ScryptAuthGateway` and `FakeAuthGateway`

**Severity:** slows
**Symptom:** The "find subject → check membership → update creds → update active sessions" logic is written twice: `ScryptAuthGateway.ts` has `buildGrantTenant` (a builder function), `FakeAuthGateway.ts` has an inlined copy (same algorithm, different field names: `username` vs `subject`, no `grants` map). When the logic changes (e.g., to support tenant revocation) both copies must be updated. This is the second-site infrastructure duplication rule from CLAUDE.md — consolidate now.
**Candidate fix:** If `grantTenant` stays on `AuthGateway` (pre-P63 fix): extract `buildGrantTenant` to a shared module (`src/adapters/driving/grantTenantLogic.ts`) that both adapters import. `FakeCred` and `CredentialEntry` must share a common interface (`{ subject: string; tenantIds?: readonly string[] }`) for the helper to operate on. If P63 lands first, the duplication is deleted rather than consolidated.

---

## P65 — `'__system__'` and `'__tenants__'` magic strings scattered across 4 modules

**Severity:** slows
**Symptom:** `createTenant.ts`, `renameTenant.ts`, `seedDefaultTenant.ts`, and `listTenants.ts` all independently hardcode `tenantId: '__system__'` and `sessionId: makeSessionId('__tenants__')`. There is no canonical definition — a one-character typo in any module silently routes events to a different (non-existent) stream, leaving the tenant registry projection with no events to fold. This is a cross-module contract expressed as a repeated string literal.
**Candidate fix:** Extract `SYSTEM_TENANT_ID = '__system__'` and `TENANTS_SESSION_ID = makeSessionId('__tenants__')` to `domain/tenantRegistry.ts` (or export from `domain/ids.ts`). All four modules import the constants. Red acceptance test: `listTenants` after `createTenant` that uses the wrong constant returns an empty list.

---

## P66 — Business rule "creator gets access" is encoded in the HTTP route handler

**Severity:** annoys
**Symptom:** `createTenantRoute` in `main.ts` calls `createTenant(...)` then `auth.grantTenant(principal.subject, tenantId)` sequentially. The rule "the creator of a tenant is automatically entitled to it" is application business logic, but it lives in the HTTP adapter layer. If the same `createTenant` application service is ever called from another entry point (CLI, seed script, another route), the auto-grant silently does not happen. There is also no atomicity: if `grantTenant` fails after `createTenant` succeeds, the tenant exists in the EventStore but the creator has no entitlement.
**Candidate fix:** `application/createTenant.ts` should accept an optional `creatorSubject` parameter and call `grantTenant` (the new application service from 12.1) internally. The route handler calls one service, gets one result. The auto-grant becomes part of the creation contract and is tested in `createTenant` unit tests, not in HTTP integration tests.

---

## P67 — `renameTenantRoute` checks entitlement inline; inconsistent with `withTenant` pattern

**Severity:** annoys
**Symptom:** `renameTenantRoute` uses `withPrincipal` + a manual `if (!principal.tenantIds.includes(tenantId))` check. Every other tenant-scoped route (`submitGoalRoute`, `sessionsRoute`, `turnsRoute`, `respondRoute`) uses `withTenant` which does the entitlement check and binds `CurrentTenantId` in one step. The inconsistency means `renameTenantRoute` does not bind `CurrentTenantId`, so `renameTenant.ts` cannot use it — it hardcodes `'__system__'` instead (see P65). The two bugs reinforce each other.
**Candidate fix:** Switch `renameTenantRoute` to use `withTenant('enduser')`. `renameTenant.ts` then reads `tenantId` from the path param (the tenant being renamed) — not from `CurrentTenantId`, which scopes the _request_ not the _target_. The guard provides the entitlement check; the route body only needs the rename logic. Add a 403 integration test to the `tenantRoutes.integration.test.ts` suite.

---

## P59 — `grantTenant` emits no event — L1.4 traceability gap

**Severity:** slows
**Symptom:** `ScryptAuthGateway.buildGrantTenant` persists runtime tenant grants to `grants.json` and mutates in-memory sessions, but never calls `EventStore.append`. Granting a tenant to a subject is an access-control change that is invisible to `GET /api/admin/trace`, cannot be replayed, and cannot be audited by the Monitor. Violates L1.4 ("every action by every actor is logged and queryable"). The `grants.json` file is also gitignored, so the grant history is lost on a fresh deploy.
**Candidate fix:** Add `TenantGranted { subject, tenantId }` kind to `domain/events.ts`. Extract `application/grantTenant.ts` that wraps `AuthGateway.grantTenant` + emits the event to `EventStore` under `CurrentTenantId` + `CurrentCorrelationId`. Replace the direct `auth.grantTenant` call in `main.ts`. Add a `TenantGranted` scenario to `L1.4.spec.ts` as the red acceptance test.

---

## P60 — `listTenants` projection has no event versioning and no upcaster path

**Severity:** slows
**Symptom:** `application/listTenants.ts` folds `TenantCreated`/`TenantRenamed` events from scratch on every call. Two gaps: (1) `TenantCreatedPayload` and `TenantRenamedPayload` have no `v` field — when payload shapes evolve there is no upcaster path and the projection will silently misread old events; (2) the projection is O(n) in tenant history; no snapshot mechanism caps it. Greg Young: "every event kind needs a `v` field; upcasters are part of the trace model, not an afterthought."
**Candidate fix:** Add `v: Schema.Literal(1)` to both payload schemas (non-breaking: new required field with default on decode). Add `schemaV` guard in the `listTenants` fold that skips unrecognised versions with a logged warning. Track snapshot need in §12 calibration (trigger when tenant-event count exceeds 10 k).

---

## P61 — Admin grant route accepts phantom `tenantId` without existence check

**Severity:** annoys
**Symptom:** `main.ts` calls `auth.grantTenant(principal.subject, tenantId)` without first verifying that `tenantId` corresponds to a real `TenantCreated` event. A typo or stale id results in a grant to a phantom tenant that persists in `grants.json` and creates a stale entitlement on the principal (the `withTenant` middleware will 403 when the tenant cannot be queried, but the grant record remains).
**Candidate fix:** In the `grantTenant` application service (P59 fix), call `listTenants` first and return a `TenantNotFound` error if the tenantId is absent; surface as HTTP 404 in the route.

---

## P73 — Error-swallowing via `Effect.orDie` in tenant application services

**Severity:** slows
**Symptom:** `createTenant.ts`, `renameTenant.ts`, and `seedDefaultTenant.ts` each end their `EventStore.append` call with `.pipe(Effect.orDie)`. If `append` fails (disk full, schema drift, lock contention), the fiber dies with a Defect — no `…Failed` event is emitted, no structured error reaches the caller, and the failure is invisible to `/api/admin/trace`. Violates L1.4 ("every actor action logged and queryable") and is the opposite of the `GoalFailed` traceability pattern established in 10.15.
**Candidate fix:** Replace `.pipe(Effect.orDie)` with `tapErrorCause` + a typed failure event (e.g., `TenantCreateFailed { tenantId, cause }`) emitted before propagating the error — mirrors the `GoalFailed` pattern from 10.15. Red acceptance test: inject a failing `EventStore` adapter; assert a `TenantCreateFailed` event is emitted and the error is returned as a typed Effect failure (not a Defect).

---

## P75 — `main.ts` cohesion: 815 lines mixing middleware + routes + wiring + boot

**Severity:** slows
**Symptom:** `packages/host/src/main.ts` is 815 lines and mixes four concerns: middleware definitions (`withPrincipal`, `withTenant`, `withRole`), HTTP route handlers for all domains (auth, tenants, sessions, goals, settings, tools), Layer wiring, and the boot sequence. The three middleware functions are defined as inner closures — they cannot be imported by other modules without a circular dependency on `main.ts`. Any route-level refactor requires reading and editing the entire file.
**Candidate fix:** Extract `adapters/driving/http/guards.ts` with the three middleware functions (`withPrincipal`, `withTenant`, `withRole`); group domain routes into separate modules (e.g., `adapters/driving/http/tenantRoutes.ts`, `goalRoutes.ts`); reduce `main.ts` to composition + listen only (≤100 lines). Related to P66/P67 but the concern is module cohesion, not route logic. Red acceptance test: dep-cruiser or grep rule asserts no middleware function is defined in `main.ts`.

---

## P74 — `readonly` type erosion via `mutableCreds` cast + raw header cast in `main.ts`

**Severity:** annoys
**Symptom:** `CredentialEntry` declares `tenantIds?: readonly string[]` but both `ScryptAuthGateway` and `FakeAuthGateway` immediately shadow it with `mutableCreds: CredentialEntry[]` (no `readonly`) and mutate elements via index assignment. The `readonly` annotation is decorative — it does not prevent mutation inside the adapter. Separately, `main.ts` casts `req.headers['x-tenant-id'] as string | undefined`, bypassing schema decode; if the header contains an array (HTTP allows repeated headers), the cast silently coerces it, which may produce a `[object Array]` tenant ID string that passes the entitlement check with no error.
**Candidate fix:** Model the mutable credential state as `Ref<HashMap<string, CredentialEntry>>` (Effect `Ref` + `HashMap`) so mutations go through Effect's controlled state API; `readonly` on `CredentialEntry` then holds structurally. Decode `x-tenant-id` via `Schema.decodeUnknownEffect(Schema.String)` with a typed `BadRequest` error in the `withTenant` middleware. Red acceptance test: `withTenant` receiving a non-string `x-tenant-id` header value returns 400 (not 500 or a silent wrong-tenant pass-through).

---

<!-- Hunt log 2026-05-17
Triggers that fired: explicit /hunt invocation + 5 open PAIN items (≥3 threshold)
Hunt start time: 13:58

Candidates:
  1. Target: bridge-zone.md — "Current bridge zones" table lists 3 files and says "when TODO 10.1
     lands", but TODO 10.1 IS done and 4 files are annotated (CliUserGateway.ts missing from table)
     | Heuristic: #6 stale doc | Output channel: .claude/patterns/bridge-zone.md (table fixed)
  2. Target: enforce-conventions.unit.test.ts line 143 — comment says "RED: both assertions fail on
     current code. Remove .fails when green cycle lands." but P41 is already GREEN (it.fails removed)
     | Heuristic: #6 stale doc | Output channel: enforce-conventions.unit.test.ts (comment updated)
  3. Target: bridge-zone.md not in CLAUDE.md "When in doubt" — relevant whenever an agent encounters
     a Promise/async in src/ and needs to know if it's a legitimate bridge; not discoverable without
     browsing patterns/ manually; P46/P47 both hinge on this annotation mechanism
     | Heuristic: #5 pattern absence + #8 context-priming | Output channel: CLAUDE.md (new entry)

Stopped because: 3 candidates surfaced and landed.
All three resolved in one commit. No new PAIN items (these were direct inline fixes).
-->

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

<!-- Hunt log 2026-05-17 (second pass)
Triggers that fired: explicit /hunt invocation
Hunt start time: 16:05

Candidates:
  1. Target: session-context.sh — when PAIN.md and TODO.md are both empty the hook emits only
     date/branch/status with no orientation; loop-health L6 warning confirms the gap
     | Heuristic: #8 context-priming | Output channel: .claude/hooks/session-context.sh (fallback line added)
  2. Target: @effect-diagnostics strictEffectProvide:off — caused a two-commit round-trip this
     session (removed in 9fd1ca98, restored in c3233cdf); pattern undocumented; tsgo suppression
     distinct from promise-bridge annotation but absent from bridge-zone.md
     | Heuristic: #5 pattern absence | Output channel: .claude/patterns/bridge-zone.md (new section added)
  3. Target: P44 rate-limit HTTP wiring — unit tests prove rate-limiter logic but the wiring in
     main.ts (IP from HttpServerRequest.remoteAddress, 429 + Retry-After header) has no test coverage;
     review flagged; IP fallback to 'unknown' under a proxy would gate all traffic
     | Heuristic: #1 detection-stage drift | Output channel: docs/PAIN.md (new item P49)

Stopped because: 3 candidates surfaced and landed.
-->
