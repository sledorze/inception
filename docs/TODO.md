# TODO — AI-Native Factory

Execution log for the work scoped by `docs/SPEC.md`.
Status legend: `todo` · `in-progress` · `done` · `blocked` · `parked`.

Rationale lines are added only when the _why_ is non-obvious from the spec.

---

## Phase 0 — Stories & spec consolidation (current)

- [done] **0.1** Draft `docs/SPEC.md` with three actors, principles, seed stories S1–S7, synergies, dynamic, isolation, trace model, open questions.
- [done] **0.1b-draft** Deduce and consolidate Tier 0–3 Laws into §3 of SPEC. Laws written, cross-referenced (§3 ↔ §12 ↔ §13 ↔ §14 ↔ Appendix A), executable-enforcement mapped per L0.1; Tier 2/3 may continue iterating into Phase 1.
- [parked] **0.1b-ratify** Formal ratification of Tier 1 laws via `ConstitutionalAmendment` event (L0.2: Claude + User-of-record + 2-of-3 Witness pool signatures). Structurally blocked on Phase 1.5 item 1.18 (External Witness pool ceremony, which provisions the 5 long-lived keys). Exits when 1.18 ships and the amendment is emitted.
- [done] **0.1c** Risk Register (§3.5) — **ship bootstrap thresholds** under `bootstrap=true` (L3.8). Do not negotiate values upfront. Phase 1 enforces R1, R2, R5 in the Supervisor; the rest are watched manually until evidence accumulates.
- [done] **0.1d** Roles & Fitness (§4) — **ship bootstrap defaults** under `bootstrap=true` (L3.8): 3 seed roles (Architect, Implementer, Reviewer), 7 fitness dimensions (Correctness, Efficiency, Cost, Safety, Acceptance, Information cost, Honesty), N=3 variants per goal, 15 % diversity reserve. Refinement comes from the variant log after first goals run, not from agreement now.
- [done] **0.2** User reads spec; we iterate on stories until the set is stable.
  - Concretely: add/remove stories, sharpen failure modes, agree on the dynamic narrative. Stories should also identify which roles play in each (§4).
- [done] **0.3** Resolve enough of §10 open questions to start Phase 1.
  - Q1 (tool discovery), Q4 (User surface), Q6 (data-handle primitive) — **v0 answered in SPEC §10.1 as port + bootstrap adapter** per L2.14.
  - Q3 (storage substrate) — **v0 answered in SPEC §10.1 Q3 as `ContentStore` port + `GitContentStore` bootstrap adapter** per L2.14. Working-method storage is one of many cold-path artifact classes on this substrate; the "subdirectory under `methods/`" bootstrap is superseded by hash-keyed refs.
  - Q2, Q5, Q7, Q8 — deferred; discover-and-adapt (L3.8).

**Exit:** Tier 1 Laws drafted and consistent (formal ratification rolls into Phase 1.5 via 1.18, tracked as 0.1b-ratify); bootstrap values shipped in SPEC (Risk Register §3.5, fitness vector §4.4, role catalogue §4.1, variant/diversity defaults §4.5, budgets §4.6) — all flagged `bootstrap=true` per L3.8. Phase 1 begins; **calibration continues in-flight from operational evidence**, not from further negotiation. Phase 0 is "done enough to start measuring," not "done."

---

## Phase 1 — S1 vertical slice (ports + bootstrap adapters for end-to-end demo)

Every item below ships **port + bootstrap adapter** per L2.14. Callers depend on the port; the adapter is replaceable by an `AdapterBound` substrate change. The goal of Phase 1 is the _shortest possible vertical slice_ that demonstrates S1: a User submits a goal + handle, Georges runs end-to-end, the trace is queryable. Enforcement substrate (info-ledger, corroborators, variant log, role registry, supervisor) lands in Phase 1.5.

- [done] **1.1** Host package layout (`packages/host`) with `packages/host/src/ports/` and `packages/host/src/adapters/`. **Dep-cruiser rule:** non-adapter code cannot import from `adapters/` (enforces L2.14). Service registry at `packages/host/src/runtime/bind.ts` wires ports → adapters at boot and emits `AdapterBound` events.
- [done] **1.2** **`ObservabilityGateway` port** + **stdio MCP adapter** (the Outer MCP Claude attaches to). Connect + list-events + replay wired via `EventStoreObservabilityGateway` adapter and `StdioMcpObservabilityAdapter`; promote/rollback Phase 4. Protocol test parametrised over InMemory + SQLite-backed layers.
- [done] **1.3** **`UserGateway` port** + **`CliUserGateway` adapter** (`bin/user` talking to a local HTTP endpoint). One User per CLI invocation in v0. Distinct from 1.2 — see §10.1 Q4.
- [done] **1.4** **`LlmProvider` port** + **OpenAI-compatible HTTP adapter**, env-configured base URL. Default target: LMStudio on host machine. Model id and seed (when available) captured in events for L3.6.
- [done] **1.5** **`WorkspaceMount` port** + **mounted-git-repo adapter**: separate git repo path injected via env; Host validates on boot and refuses to start if the boundary is ambiguous.
- [done] **1.6** **`EventStore` port** + **SQLite adapter** (§13 hint; schema per §9 with `actor`, `contentHash`, `prevHash` chain, indexes on `storyRef`/`sessionId`/`correlationId`). `InMemoryEventStore` fake for tests. Protocol test parametrised over both adapters. L1.4 law test asserts tamper-evident chain.
- [done] **1.7** **`DataHandle` port** + **`FileBackedHandle` adapter** (§10.1 Q6). `AggregateResult` shape (exitCode, stdoutHash, summary, bitsConsumed) is the only return surface. Includes `revoke`, `isAlive`, lifecycle events (`HandleRegistered`, `HandleRevoked`, `HandleExpired`, `HandleExhausted`). Unlocks S1.
- [done] **1.8** **`SandboxExecutor` port** + **`OsProcessSandboxExecutor` documented fallback** (Wasmtime/WASI not available in env; fallback requires per-cycle approval §13). CPU (unenforced at OS level) / wall (SIGTERM via execFile timeout) / mem (--max-old-space-size) budgets; SANDBOX_TIME + SANDBOX_SEED env vars (L3.6). Protocol test parametrised over InMemory + OsProcess adapters.
- [done] **1.12** **`ToolRegistry` port** + **`InMemoryToolRegistry` adapter** (§10.1 Q1). Static-list builder + `layerFromYamlFile` that reads + validates `tools.yaml` at boot. Role-scoped `listTools`; structured `ToolNotFound` (L2.1). Bootstrap `tools.yaml` with 5 seed tools in `src/bootstrap/`. Protocol test parametrised over static and YAML-file adapters (14 tests).
- [done] **1.22** **`ContentStore` port** + **`InMemoryContentStore` + `GitContentStore` bootstrap adapters** (§10.1 Q3). SHA-256 CAS: blobs under `.git/cas/<sha256[0:2]>/<sha256[2:]>`, refs under `.git/cas-refs/<name>`. Full API: put/get/exists/refSet/refGet/refList/gc. Protocol test parametrised over InMemory + GitContentStore (22 tests, all green). Hardy/Unison-cluster ask.

**Exit:** Host boots; every Phase-1 port is bound to an adapter; Georges, given a goal + handle through `UserGateway`, calls `list-tools`, `fetch-handle-shape`, authors a script, calls `run-script`, receives an `AggregateResult`, returns to User; Claude queries the full trace via the Outer MCP and replays it.

---

## Phase 1.5 — Enforcement substrate (laws that need traces to exercise)

These items make Phase 1's traces _honest_ and _bounded_: per-handle info budgets stop leak attempts, corroborators stop self-narration, the variant log gates selection, roles parametrise tool surfaces, the Supervisor watches risks. None of these are demonstrable until Phase 1 has produced a baseline trace.

- [done] **1.9** **Budget Ledger v0** (L1.6, §4.6): `BudgetLedger` port with `debit`/`get`/`reset`; `InMemoryBudgetLedger` adapter. All §4.6 dimensions tracked: tokens, costUsd, sandboxMs, infoBitsOut, mutations, policyDenials, rejections, reruns. Scope types: call/variant/cycle/handle/session/role-version. Protocol test (7 tests). Enforcement (halt on exceed) wired by Supervisor in 1.15.
- [done] **1.10** **Per-handle info-ledger** (L1.7): `HandleExhausted` added to `DataHandle` port; `FileBackedHandle` tracks `bitsAccumulated` per handle (bootstrap estimator: `stdout.length * 8`); closes handle (`isAlive=false`) and fails with `HandleExhausted` when `infoBitLimit` exceeded (default 80,000 bits, bootstrap=true §12). 2 new protocol tests. TODO 1.19 replaces bootstrap estimator with (ε,δ)-DP.
- [done] **1.11** **Host corroborator events** (L1.8): `findUncorroboratedClaims(sessionId)` domain utility returns Georges-actor events without a matching host-actor event on the same `correlationId`. Pairing by `correlationId`; Host emits corroborator first, Georges claim follows. L1.8 law test (4 scenarios). Actual corroborator emission wired at tool execution in Phase 2 (inner MCP).
- [done] **1.13** **Role registry + `RoleSwitched` events** (L2.10): smallest viable subset — Architect + Implementer + Reviewer. Bootstrap per §4.1.
- [done] **1.14** **Variant log schema** (L2.11): one row per attempt, schema-enforced at write. Backed by the same `EventStore` adapter as 1.6 for v0.
- [done] **1.15** **Supervisor daemon v0** (L3.7): port + in-process adapter. Implements R1, R2, R5 from §3.5 with bootstrap thresholds. The rest are documented and watched manually until Phase 5.
- [done] **1.16** **`formal/promoter.tla` — TLA+ spec for the promoter handshake** (L0.2, L2.6). Captures Georges-proposes → Supervisor-evaluates-`DelegatedPromotionPolicy` → `Promoted`-or-route-to-Claude. Model-check with `tlc` for safety (no two contradictory promotions) and liveness (every proposal eventually resolves). CI runs the model check. Lamport-cluster ask.
- [done] **1.17** **Monitor daemon** (L3.7, L3.10): out-of-process actor reading the event store via read-only `ObservabilityGateway`; recomputes a random subset of Supervisor signals per cycle; emits `SupervisorDivergence` on disagreement. Independent long-lived key. Cook/Reason-cluster ask.
- [done] **1.18** **External Witness pool + 2-of-3 quorum ceremony** (L0.2, L0.5, §6). CLI tool for each Witness to review and co-sign `ConstitutionalAmendment` and Kernel-rotation events. Five long-lived keys provisioned at install (Claude + User-of-record + 3 Witness pool keys); quorum threshold (2-of-3 for Witnesses, unanimous for Claude + User) encoded in the ceremony tool. **Exits 0.1b-ratify** (first `ConstitutionalAmendment` event emitted = Tier 1 constitutional ratification). Ostrom-cluster ask.
- [done] **1.19** **DP adapter for `DataHandle`** (L1.7): replaces the bootstrap byte-count estimator with (ε, δ)-DP — Laplace + Gaussian mechanisms; per-handle ε ledger; sensitivity declared per query and validated against schema. Dwork-cluster ask.
- [done] **1.20** **Behaviour archive (MAP-Elites)** for §4.5: cells over bootstrap descriptor axes (**concern-tag × workflow-type × test-pass-count × cost-bucket**); selection samples from archive in addition to Pareto frontier. Stanley-cluster ask.
- [done] **1.21** **`kernel/` artifact directory + tri-signature CI** (L0.5): content-addressed, 3-key signed files; CI rejects pushes touching `kernel/` without three valid signatures + key-rotation event. Bengio/Hardy/Ostrom-cluster ask.

**Exit:** Phase-1 S1 demo re-runs with enforcement on: one variant per goal, paired Georges/Host events for every claim, one DP debit per `run-script`, one Supervisor signal computed (R1, R2, or R5) per cycle, Monitor recomputes one random signal and emits `SupervisorDivergence` if mismatched, role swap recorded if the workflow uses more than one role, behaviour archive populated with at least one cell per variant, `formal/promoter.tla` model-checks clean in CI, `kernel/` directory present with three signatures verified at boot.

---

## Phase 2 — Inner MCP toolset (Georges' surface)

- [done] **2.1** `list-tools` — Georges introspects his own capability set (answers Q1).
- [done] **2.2** `read-workspace` / `write-workspace` — confined to mount.
- [done] **2.3** `run-script` — submits authored code to the sandbox; returns stdout/exit/aggregate only.
- [done] **2.4** `fetch-handle-shape` — returns schema + redacted sample for a data handle.
- [done] **2.5** `propose-capability` — submits manifest+code+tests for §S2.
- [done] **2.6** Policy hooks on every tool call; deny by default for unknown policies.
- [done] **2.7** **`agent.md` system-prompt injection**: wire `src/bootstrap/agent.md` as Georges' system prompt in the LLM pipeline — read at session init, prepend as system message via `LlmProvider` adapter. (See TODO in `src/bootstrap/agent.md`.)
- [done] **2.8** **`agent.md` workspace mount**: pre-seed `agent.md` into `WorkspaceMount` at bootstrap so Georges can also `read-workspace` it on demand. Mirrors the `tools.yaml` pattern from 1.12.
- [done] **2.9** **`agent.md` behavioral content**: extract from `docs/SPEC.md §3` the laws governing Georges' claims, corroboration requirements, trust levels, session protocol, and role-switch ceremony. Populate the two TODO sections in `src/bootstrap/agent.md`.

**Exit:** Georges can fulfil S1 end-to-end against a synthetic dataset without ever holding the data.

---

## Phase 3 — First end-to-end story (S1)

- [done] **3.1** Wire a minimal User entry point that posts a goal + handle (CLI or HTTP — decide in 0.4).
- [done] **3.2** Run S1 against a synthetic dataset; capture trace; verify Georges never received bytes.
- [done] **3.3** Replay the trace via outer MCP.
- [done] **3.4** Document one observed failure mode and feed it into the next iteration.

**Exit:** A repeatable demo of S1 with a clean trace and one identified improvement.

---

## Phase 4 — Capability proposals (S2)

- [done] **4.1** Promotion queue + Claude-mediated review path (likely a CLI subcommand).
- [done] **4.2** Versioned capability registry on disk; rollback by version pin.
- [done] **4.3** First Georges-proposed capability accepted end-to-end (2026-05-16). Agentic loop added to submitGoal (up to 4 rounds): Georges called list-tools(role=Implementer) → propose-capability(compute-stats, scope=capability) → admin promoted via POST /api/proposals/{contentHash}/promote → version 1 registered. Phase 4 exit condition met.

**Exit:** Georges can grow his own tool surface, gated.

---

## Phase 5 — Outer observability & substrate refinement

- [done] **5.1** Trace query/replay tool with `storyRef` filtering.
- [done] **5.2** First prompt/policy refinement driven by an observed pattern (closes S3 loop). UserRejected→RejectionPatternCandidate pipeline; agent.md refined: "always call fetch-handle-shape before run-script" (pattern: script failures from unknown columns). POST /api/goals/:id/reject endpoint wired.
- [done] **5.3** Quarantine/kill-switch ergonomics (Q8). Per-session: SessionQuarantined/QuarantineReleased events; checkQuarantine blocks submitGoal (L2.3); Supervisor auto-quarantines on R5 trip; `bin/review.ts quarantine list|release`.

**Exit:** Outer feedback loop has demonstrably changed Georges' behaviour at least once based on traces.

---

## Phase 6 — Conversational MVP (S6 + S8)

Advances S6 (parked P.2) and S8 (placeholder) to _demonstrated_. Exit: deterministic Playwright e2e of project-scoped multi-turn conversation; S6 + S8 demonstrated.

- [done] **6.0** Capture breakdown-strategy working method into prescriptive files + feedback loop: `CLAUDE.md` Working Practices (breakdown-strategy bullet + Phase 6 entry), `.claude/patterns/breakdown-strategy.md`, `docs/META-LOOPS.md` L7, `feedback_*` auto-memory. Process commit, not feature.
- [done] **6.1** SPEC §5: promote S6 to MVP story (Exchange = minimal turn protocol); author S8 (clarify-question); both carry assessment frames; update TODO ordering. SPEC/TODO-only commit.
- [done] **6.2** Spike 1a (offline): pin `generateText` request/response shape + `requestHash` seam from `vendor/effect-smol` + `OpenAiCompatLlmProvider`. Findings only; no prod code.
  - Seam: `LanguageModel.LanguageModel` layer substitution in `runtime/bind.ts` (`LLM_MODE` env, mirrors `SANDBOX_SEED` precedent). `LlmProvider.spec.ts:79` `runContract(name, makeLayer)` already parametrises — RecordReplay = a third call.
  - Hash inputs (stable): `sha256({ model, messages:[{role,content:string}], tools:sorted_schemas })`. Volatile exclusions: message IDs, `tool_call_id`, timestamps, `reasoning_content`, `correlationId`.
  - Cassette format: one JSON per hash at `tests/fixtures/llm-cassettes/<sha256>.json`.
  - Spike 1b (6.3, human-gated) still required for LMStudio variance + seed pinning decision → gates 6.6.
- [done] **6.3** Spike 1b (LMStudio at host.docker.internal:1235, model: **qwopus3.6-35b-a3b-v1** — Georges' model per user): measure output variance; decide temp/seed pinning + replay viability. Gates 6.6.
  - Default temperature: HIGH variance — 3 different phrasings across 3 identical runs. Not cassette-safe.
  - temperature=0 + seed=42: DETERMINISTIC — identical content + identical reasoning_len=1246 across all 3 runs.
  - Decision: record with temperature=0 + seed=42; cassette captures post-reasoning content (reasoning_content is excluded — volatile at default temp, and not semantically meaningful to replay). requestHash is over the INPUT only (model + messages + tool schemas); temperature/seed are recording-time params, not part of the hash.
  - This is a reasoning model (Qwen3.5-9b-deepseek-v4-flash): reasoning_content can be 1246+ chars; the P7 fix (makeReasoningAwareFetch) already handles promoting reasoning_content → content. Cassette stores only the promoted content.
  - LMStudio URL from container: host.docker.internal:1235 (192.168.0.15:1235 is the host LAN IP; unreachable from Docker bridge). The LLM_BASE_URL env in the RecordReplay record mode must use host.docker.internal; replay mode is pure-local (no network call).
- [done] **6.4** Spike 2: `sessionId` / `submitGoal`-return blast-radius map + refactor recommendation.
  - R1 (sessionId threading): 4 production sites — `submitGoal.ts:16` (default already threaded via GoalSubmission.sessionId?), `main.ts:83` (pass sessionId from HTTP request body), `main.ts:122` (pass sessionId to recordRejection), `GeorgesToolkit.ts:152,255` (inherit sessionId from Effect context via CurrentCorrelationId pattern). GoalSubmission already has `sessionId?: string` — no port change needed.
  - R2 (submitGoal → correlationId): `submitGoal.ts` returns `{correlationId}` (currently void); `main.ts:83-86` uses returned correlationId to filter `store.query({sessionId})` results client-side (EventStore has no correlationId query filter; add one or filter after query — adding filter is cleaner); `main.ts:46` gw.listen callback wraps with `.pipe(Effect.asVoid)`; 3 integration test files need same `.pipe(Effect.asVoid)` patch.
  - Verdict: SMALL blast radius — ≤6 files, all in packages/host/. R1/R2 collapse into 6.6 as refactor-commits-first within the slice. 6.5 is not needed as a separate strategic refactor.
  - 6.8/6.9 remain parked — correct; shape of Slice 1's Conversation component must exist before breaking down Slice 2/3.
- [done] **6.5** R1/R2 collapsed into 6.6 refactor-commits-first (small blast radius per Spike 2). No separate strategic refactor needed.
- [done] **6.6** Vertical Slice 1 (MVP kernel): all code shipped + cassettes recorded (`60fcb834...json` for "What is synthetic-001?") + `LLM_MODE=replay pnpm e2e` green (2026-05-16). Record mode now serves existing cassettes without re-recording (incremental cassette building).
- [done] **6.7** North-star checkpoint (2026-05-15): exit condition = "deterministic Playwright e2e of project-scoped multi-turn conversation; S6 + S8 demonstrated."
  - S6 kernel code-complete; e2e RED pending human-gated cassette (LMStudio required). Cassette recording unblocks the S6 demo claim.
  - S8 (`respond(clarify)`, `ClarifyRequested/ClarifyAnswered`, `UserGateway.respond`) not started — unparking 6.9. Conversation component now exists (6.6 prerequisite met), so 6.9 can proceed in parallel with cassette recording.
  - Phase 6 is not yet "done" (no live demo). Self-refine: unpark 6.9 as next slice; 6.6 demo claimed once cassette committed + `LLM_MODE=replay pnpm e2e` passes.
- [done] **6.8** Vertical Slice 2 (bounded multi-turn recall, L3.5 last-N) — all steps GREEN (2026-05-18):
  1. Extracted `application/sessionTurns.ts` — `projectSessionTurns` projection (Kleppmann/Young: no event reshaping); refactored `sessionTurnsRoute` to use it; `sessionTurns.unit.test.ts` (6 tests).
  2. `RECALL_WINDOW=3` (§12); extended `AgentBrief.priorTurns`; `buildInitialMessages` interleaves prior turns as `user`/`assistant` pairs oldest→newest between brief and current goal; prefix-KV stable until window slides.
  3. `makeSubmitGoal`: `store.query({sessionId})` → `projectSessionTurns` → filter-completed + `slice(-RECALL_WINDOW)` → `priorTurns` in brief.
  4. `respondToGoal`: same recall wiring on the clarify-answer path.
  5. §12 row: S6 recall window N=3 (bootstrap=true, L3.5/S6).
  6. Tests: `submitGoal-recall.unit.test.ts` (2, red→green acceptance); `submitGoal-brief.unit.test.ts` interleave case; `L3.5.spec.ts` if-absent bounded+curated law; `respondToGoal.unit.test.ts` clarify-path recall.
     Deferred (unchanged): append-only multi-turn LLM e2e cassette (LMStudio, `LLM_MODE=record`, temperature=0+seed=42 per 6.3 decision) — recorded human-gated, same pattern as 6.6/6.9.
- [done] **6.9** Slice 3 — S8 `respond(clarify)`: all code shipped + cassettes recorded (`0138c778...json` seed for "help me" → request-clarification, `0b75a4a6...json` for post-answer LLM call) + `LLM_MODE=replay pnpm e2e` green (2026-05-16). Both fake and replay modes verified.

- [done] **6.10** **Persistent, switchable chat sessions (`packages/app`)** (2026-05-17).
  Consumer chat had no session lifecycle (`Conversation` minted `crypto.randomUUID()` per
  mount — reload silently orphaned the transcript). This is the prerequisite for the
  deferred append-only multi-turn replay (6.8). Numbered breakdown (all steps GREEN):
  1. Backend: extracted `application/listSessions.ts` (server-side aggregation, lifted
     from the inline `GET /api/sessions` route body — thin-route L2.14); widened the
     route guard to `withRole('enduser')` (admin still passes via the existing
     `requireRole` `admin ⊃ enduser` hierarchy — no RBAC generalization needed, L0.3
     unchanged); route docstring `admin:` → `admin/enduser:`.
  2. Frontend deps + api: added `@effect/atom-react`/`effect`/`react-router`/`scheduler`
     (exact backoffice versions) to `packages/app`; `listSessions()` + `SessionSummary`
     in `api/chat.ts`.
  3. `packages/app/src/atoms.ts` (mirrors `backoffice/src/atoms.ts`): `AsyncView`/
     `toView`/`fetchAtom`; `sessionsAtom`/`sessionsView` (topic `sessions`); `turnsAtom`/
     `turnsView` via `Atom.family(sessionId)` (topic `turns:<id>`); `sendGoalAtom`/
     `respondAtom` via `atomRuntime.fn` — per-session invalidation published inside the
     effect via `Reactivity.invalidate([turns:<id>, sessions])` (static `reactivityKeys`
     can't depend on the arg; idiomatic Effect dynamic-key bus).
  4. Router shell: `App.tsx` → `BrowserRouter` + routes (`/`→`SessionList`,
     `/sessions/:sessionId`→`Conversation`, `*`→`Navigate /`), inline header (no
     backoffice `AppShell`); new `SessionList.tsx` with "New conversation" button
     (`navigate('/sessions/'+crypto.randomUUID())`, pure event handler).
  5. `Conversation.tsx` rewritten as a near-pure render component: `useParams()`
     sessionId, data from `turnsView`, sends via `useAtomSet(sendGoalAtom/respondAtom)`,
     optimistic bubble from action `AsyncView` + input `useState`; key-bus refetch
     hydrates the authoritative transcript on load/switch (closes the reload-orphan
     gap). Zero `.then(`, no `AsyncResult`/`Cause` in the component (P41 green).
  6. This record. Verification: app typecheck + `pnpm lint` clean; P41/P43
     enforcement (15) + `listSessions.unit.test.ts` (3) + L0.3 (4) + AdminQuery (10) +
     AuthGateway (14) + bootstrap.integration (4) green; new frontend harness:
     `SessionList.test.tsx` (4) + `Conversation.test.tsx` (3) via
     `@effect/atom-react` `RegistryProvider` + `MemoryRouter` + happy-dom.
     Deferred (unchanged): append-only multi-turn LLM replay remains **6.8** (this slice
     is its prerequisite, intentionally landed first; its cassette re-record is separate).

---

## Phase 7 — Dual-frontend split (back-office vs consumer) + settings

Two distinct users, two distinct frontends. Today's `packages/frontend` mixes builder concerns
(proposal review, capability list, trace inspection) with consumer concerns (chat, goal submission).
Splitting into two packages enforces the L2.14 hex boundary at the package level and makes each
surface independently deployable.

- [done] **7.A** **Kernel slice — auth + RBAC + admin driving ports**: `AuthGateway` port
  (`login`/`verify`/`logout`) + `FakeAuthGateway` + `ScryptAuthGateway` adapters + `requireRole`
  application service + `POST /api/login` route + `Authenticated` event (secret-free: subject+role
  only) + L0.3 SPEC amendment (admin/enduser asymmetry named, `Authenticated` trace-visible,
  security claim qualified as structural at bundle boundary / aspirational at in-process RBAC) +
  L2.14 SPEC amendment (`AuthGateway` + `AdminQuery` registered as driving ports) +
  `AdminQuery` port + `InMemoryAdminQuery` + `EventStoreAdminQuery` adapters + `AdminQuery.metrics`
  wired to `GET /api/admin/metrics` + all enduser routes guarded with `withRole('enduser')` +
  admin routes guarded with `withRole('admin')` + `GET /events` closed (returns 404) + replaced by
  `GET /api/admin/trace` (admin-guarded) + full Effect `HttpRouter` rewrite of `main.ts` (SPA
  refresh via `HttpStaticServer.layer({ spa:true })`) + `data/credentials.json` default admin
  seed + protocol test `AdminQuery.spec.ts` (parametrised over InMemory+EventStore, L1.3 no-raw-bytes
  invariant) + bootstrap integration test updated. All 478 tests green.

- [done] **7.B** `AdminQuery.pain()` + `AdminQuery.work()` HTTP surface (`GET /api/admin/pain`,
  `GET /api/admin/work`); extracted `domain/painParser.ts` + `domain/todoParser.ts` pure modules
  from `EventStoreAdminQuery`; unit tests contract-tested against live `docs/PAIN.md`/`docs/TODO.md`.
  488 tests green.

- [done] **7.C** `POST /api/tools/:name` guarded with `withRole('admin')` (raw tool surface —
  admin-only); Playwright API-level RBAC scenarios in `e2e/rbac.spec.ts`: unauthenticated →
  401 on all guarded routes, admin token → 200 on metrics/pain/work/trace, `GET /events` → 404,
  `GET /health` open. Quarantine list/release deferred to 8.x (no quarantine port exists yet).
  488 tests green.

- [done] **7.D** Scaffold `packages/backoffice` + `packages/app`; responsive shadcn UI; move panels
  (builder → backoffice, consumer → app); decommission `packages/frontend`; update `docs/SPEC.md §1`
  repo layout + §13 Tech Decisions.

- [done] **7.1** **Architecture spike** (subsumed into 7.A–7.D above; retained for reference):
  defines `packages/backoffice` (proposals, capability registry, trace replay, role management,
  quarantine) and `packages/app` (chat/conversation, goal submission, clarify flow). Shared UI
  primitives determination deferred to 7.D.

- [done] **7.2** **Settings subsystem**: `Settings` driven port + `InMemorySettings` (test) + `FileBackedSettings` (prod, persists to `data/settings.json`); `AppSettings` schema: `{ llmBaseUrl, llmModel, sessionMaxTurns }`. `GET /api/settings` + `PATCH /api/settings` (admin-guarded). Back-office settings panel with shadcn `Input` fields. Protocol test parametrised over InMemory + FileBacked adapters. `sessionMaxTurns` takes effect on next request; LLM connection settings persist and take effect on next server restart.

- [done] **7.3** **Design system package**: `packages/design-system/` (`@app/design-system`) created with 4 shadcn components + `utils.ts`. Duplicate `src/components/ui/` trees removed from backoffice and app; all 20 import sites updated to `@app/design-system/*`. `tests/design-system-isolation.test.ts` passes. Fixes P34.

**Exit:** two independently deployable frontends; no panel lives in both; shared primitives (if
any) isolated in their own package; CI green on both.

---

## Phase 8 — Exchange review loop (observe → annotate → fix → verify)

Closes the outer feedback loop so every problematic exchange drives a concrete improvement to
agent.md, policies, or tools. The loop: observe full turn sequences in the back-office, annotate
issues with free-text notes, detect patterns across annotations, edit and version agent.md as
first-class events, replay affected goals against the new config and diff responses, promote if
Supervisor + Monitor agree.

- [done] **8.1** **Exchange viewer** (back-office): sessions list (`GET /api/sessions`) + drill-in
  event sequence (`GET /api/sessions/:id/events`, payload-stripped per L1.3). `Sessions.tsx`
  component in backoffice; events shown with actor/kind/timestamp/payload.

- [done] **8.2** **Exchange annotation** (back-office): Flag button per event row; emits
  `ExchangeFlagged { correlationId, note, severity }` via `POST /api/exchanges/:correlationId/flag`.
  Severity picker (observation/issue/blocker) via Button toggles.

- [done] **8.3** **Pattern surface** (back-office): `GET /api/patterns` aggregates
  `ExchangeFlagged` + `UserRejected` into naive keyword-bucketed list; `PatternList` sub-component
  shown below the sessions list.

- [done] **8.4** **`agent.md` amendment surface** (back-office): `AgentMd.tsx` component;
  `GET /api/agent-md` + `PATCH /api/agent-md`; each save emits `AgentMdAmended { prevHash,
newHash, rationale }` to event store.

- [done] **8.5** **Replay-and-compare** (back-office): Replay button per event row;
  `POST /api/exchanges/:correlationId/replay` re-runs original goal via `makeSubmitGoal`; shows
  before/after `GoalCompleted.text` side-by-side.

- [done] **8.6** **Amendment promotion gate**: `PATCH /api/agent-md` rejects with 422 if no
  `ExchangeFlagged` or `UserRejected` event exists in the store (L2.6). `ExchangeFlagged` and
  `AgentMdAmended` event kinds added to `domain/events.ts`.

**Exit:** one observed issue travels the full loop — flagged in the UI, a pattern detected,
agent.md amended with rationale, replay confirms improvement, Supervisor + Monitor agree,
amendment promoted and logged.

---

## Phase 9 — Law coverage + CI ratchets

Brings law-test coverage from 28% (13/46) to 100% and adds PR-blocking enforcement for test quality.

- [done] **9.1** **L0.4 self-enforcing law test**: `tests/laws/L0.4.spec.ts` enumerates all law IDs from `docs/SPEC-nav.md` and asserts each has a file at `tests/laws/<id>.spec.ts`. 16 pass, 24 fail — tracking convergence as coverage grows. Fixes P31.

- [done] **9.2** **L0.1 structural law test**: `tests/laws/L0.1.spec.ts` asserts each existing law spec file contains at least one `it.effect` or `it(` assertion (not just a describe skeleton). Complements 9.1.

- [done] **9.3** **Scoped Stryker job in `ci.yml`**: `law-mutation` job runs `npx stryker run --mutate 'packages/host/tests/laws/**/*.ts'` on every PR (20-min timeout). Full-repo Stryker stays nightly. Fixes P30.

- [done] **9.4** **`UserGateway` protocol postcondition**: `InMemoryUserGateway.layerWithResponds` records calls in a `Ref`; `UserGateway.spec.ts` adds postcondition describe block asserting `respond` populates the Ref. Fixes P32.

- [done] **9.5** **EventStore durability test**: "SqliteEventStore — cross-restart durability" describe block in `tests/protocol/EventStore.spec.ts` — writes events, disposes layer, re-opens same path, asserts events still present. Fixes P33.

- [done] **9.6** **CLAUDE.md layout drift guard**: `scripts/check-layout.sh` + lefthook `pre-commit` `check-layout` command. Fixes P29.

**Exit:** `L0.4.spec.ts` passes with 100% law coverage; scoped Stryker runs green on every PR; `UserGateway` and `EventStore` protocol tests cover the gaps identified in P32/P33.

---

## Phase 10 — Enforcement hardening (make violation detection structural, not doc-based)

Every item here closes a detection gap where a class of violation passes all pre-commit checks silently.
The pattern: (1) write a failing acceptance test that proves the gap exists, (2) add the enforcement
mechanism, (3) fix any existing violations the rule now surfaces.

- [done] **10.1** **`effect-patterns` rules: `no-async-in-src` + `no-raw-promise`** (closes P35).
  Added both rules to `effect-patterns.js` with bridge-zone exemption (`// promise-bridge:
intentional`). Annotated 4 bridge files. Documented pattern in `.claude/patterns/bridge-zone.md`.
  Green gate: `oxlint-rules.unit.test.ts` — "effect-patterns/no-async-in-src (P35)" passes.

- [done] **10.2** **Frontend hook layer + dep-cruiser `components→api` deny rule** (closes P36 + P37).
  Created `hooks/useAsyncFetch.ts` in both packages; created hooks/ facades re-exporting api/;
  migrated all 20 violating components; applied `useAsyncFetch` to 5 simple read-pattern
  components; added `no-frontend-component-api-import` deny rule to `.dependency-cruiser.cjs`.
  Green gate: `tests/unit/depCruiserBoundary.unit.test.ts` (3 tests pass; dep-cruiser exits 0).

- [done] **10.3** **Promote critical pattern files to `.claude/commands/` slash commands** (closes P38).
  Created `.claude/commands/effect-test-pattern.md`, `schema-decode.md`, `composition-root.md`.
  Added three "When in doubt" entries to CLAUDE.md naming each slash command at its decision point.
  Green gate: `tests/unit/enforce-conventions.unit.test.ts` — "P38" (6 assertions pass).

- [done] **10.4** **`effect-patterns/no-try-catch-in-src` rule** (closes P39).
  Added `no-try-catch-in-src` to `effect-patterns.js` with bridge-zone exemption. Fixed
  `ceremony.ts` — `verifySignature` converted to `Effect.try({ try, catch })` + `Effect.catch`;
  `checkQuorum` uses `Effect.gen` + `yield*`. All 19 ceremony tests pass.
  Green gate: `oxlint-rules.unit.test.ts` — "effect-patterns/no-try-catch-in-src (P39)" passes.

- [done] **P40** **Cross-package oxlint quality baseline** (closes P40).
  Created `packages/design-system/.oxlintrc-base.json`; wired `"extends"` in `app/`, `backoffice/`,
  `host/` configs. Green gate: `tests/unit/enforce-conventions.unit.test.ts` — "P40" passes.

- [done] **10.5** **View-model atoms — decouple UI-state interpretation from components** (closes P41).
  GREEN 2026-05-17 in feat/design-system-enforcement: `AsyncView<T>` in `atoms.ts` via `Atom.map` +
  `AsyncResult.match`; 5 atom components migrated to `*View` atoms; 13 legacy components converted
  from `.then(` to `async/await`; `.claude/patterns/frontend-atoms.md` added; 2 `it.fails` → passing.
  test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` —
  "Frontend presentation components must not interpret async state (P41)"

- [done] **10.6** **Brief Georges with tool/handle context** (closes P42).
  GREEN 2026-05-17 in 09de2686: extracted `buildInitialMessages`; `yield* ToolRegistry` + `yield* DataHandleRegistry`;
  role + tool brief + handle schema in system message; `agent.md` hard forcing function; enduser role in `tools.yaml`;
  cassettes recorded; replay proves grounded reply referencing `id`/`value` columns.
  test: `packages/host/tests/unit/submitGoal-brief.unit.test.ts` (5 assertions GREEN) +
  `e2e/conversation.spec.ts` "reply is grounded" (GREEN in LLM_MODE=replay).

- [done] **10.7** **Unify Goal/Chat surface** (closes P43).
  GREEN 2026-05-17 in 981eaf97: deleted `SubmitGoal.tsx`, `goals.ts`, `api/goals.ts`; single `Conversation` surface
  with helper copy, session label, dataset label, example empty state; e2e stays green.
  test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` "App renders a single goal-submission surface (P43)" GREEN.

- [done] **10.8** **P46/P47/P48 RED step — Promise-slip detection gaps** (2026-05-17).
  PAIN P46/P47/P48 filed; TODO items 10.9–10.11 added; red acceptance tests committed
  (`it.fails` in `oxlint-rules.unit.test.ts` for P46, `enforce-conventions.unit.test.ts`
  for P48). No green work.

- [done] **10.9** **P46 GREEN — extend `effect-patterns` oxlint plugin** (2026-05-17).
  Added `AwaitExpression` visitor to `no-async-in-src`; `.then(` member-call visitor to
  `no-raw-promise`; hardened bypass from `src.includes(...)` to first-5-lines line-start check
  in all three bridge-aware rules. All 3 RED `it.fails` P46 tests → plain `it` (GREEN).
  test: `packages/host/tests/unit/oxlint-rules.unit.test.ts` — P46 describes (51 tests GREEN).

- [done] **10.10** **P47 — convert `src/checks/*.ts` to `NodeRuntime.runMain`** (2026-05-17).
  `check-test-conventions.ts` + `check-file-structure.ts` converted to `NodeRuntime.runMain`
  (subpath import `@effect/platform-node/NodeRuntime`); `@effect-diagnostics` header removed.
  `pnpm lint` and `pnpm typecheck` both clean on both files.
  test: P46 `AwaitExpression` case in `oxlint-rules.unit.test.ts` (GREEN).

- [done] **10.11** **P48 — extract shared frontend authed client** (2026-05-17).
  Created `packages/shared-api/` (`@app/shared-api`): `TOKEN_KEY`, token accessors, `handleErr`,
  `authedFetch`, `getJson<T>`. Both `auth.ts` files → `export * from '@app/shared-api'`. Removed
  duplicate `handleErr` from `admin.ts`. Fixed 5 bare endpoints through `getJson`.
  test: `packages/host/tests/unit/enforce-conventions.unit.test.ts` — P48 (2 assertions GREEN).

- [done] **10.12** **P45 — `archivedPainItems` wired from PAIN-archive.md** (2026-05-17).
  Added `parsePainArchiveMd(md)` to `domain/painParser.ts`; added `archiveMd` path to
  `AdminQueryPaths`; metrics() now reads archive file concurrently and returns real count.
  test: `packages/host/tests/unit/painParser.unit.test.ts` — `parsePainArchiveMd` (5 assertions GREEN).

- [done] **10.13** **P44 — `POST /api/login` rate limiting** (2026-05-17).
  Created `src/application/loginRateLimiter.ts` (`makeLoginRateLimiter`): 10 failures per
  60-second per-IP window → 429 + `Retry-After: 60`. Wired into login route in `main.ts`
  via `req.remoteAddress` (Effect `HttpServerRequest`). Success clears the counter.
  test: `packages/host/tests/unit/loginRateLimiter.unit.test.ts` (5 assertions GREEN).

- [done] **10.14** **P49 — rate-limit HTTP wiring test** (2026-05-17).
  Added e2e test verifying 429 + `Retry-After: 60` at the HTTP layer: 10 wrong-password
  logins → each 401; 11th → 429. Self-guarding: skips if server already locked from a
  previous run (dev-mode safety). No-op cleanup via successful admin login in `beforeAll`.
  test: `e2e/rbac.spec.ts` — "Rate limiting — POST /api/login (P49)" (1 assertion GREEN).

- [done] **10.15** **P50 — HTTP observability: Logger + global error handler + GoalFailed event** (2026-05-17).

- [done] **10.17** **P52 — Live LLM base URL from Settings (no restart)** (2026-05-17).
  `makeReasoningAwareFetch` reads `Settings.llmBaseUrl` per request via `Context.getOption` + `Effect.runPromise`; `bind.ts` provides `settingsLayer` to `llmLayer`; Settings.tsx helper text corrected to "Takes effect on next request".
  test: `packages/host/tests/integration/llmBaseUrlLive.integration.test.ts` (1 test GREEN).

- [done] **10.16** **P51 — Persistent auth sessions (7-day sliding TTL + graceful frontend 401)** (2026-05-17).
  Red step: `authSessionPersistence.integration.test.ts` (fails before `fileBackedLayer` exists).
  Green step: `ScryptAuthGateway.fileBackedLayer` + `bind.ts` wiring + 401 → `auth:expired` event in `shared-api` + listener in both `App.tsx` files + `.gitignore` + `AuthGateway.spec.ts` TTL update.
  Three gaps closed: (1) `Logger.consolePretty(stderr)` in `fullLayer` so failures reach stderr;
  (2) `tapErrorCause + catchAllCause` at `main.ts` HTTP boundary replaces the `as any` cast —
  any route failure now produces a structured JSON `{error, detail}` body instead of empty 500;
  (3) `GoalFailed` event kind + `tapErrorCause` in `submitGoal.ts` — LLM failures are now visible
  in `/api/admin/trace`; (4) boot log in `llmLayer` prints resolved LLM mode + endpoint.
  test: `packages/host/tests/integration/httpObservability.integration.test.ts` (2 tests GREEN).

**Exit:** `pnpm lint:ci` catches a standalone `async function` or `try/catch` in `packages/host/src/`; dep-cruiser
reports a violation for any component that imports `api/` directly; the three promoted skills are
invocable and linked from CLAUDE.md.

---

## Phase 11 — Multi-tenant isolation (S12 + L1.9)

Advances S12 from "described" to "demonstrated." Exit: deterministic Playwright e2e proves cross-tenant invisibility; `L1.9.spec.ts` green + `if absent` variant red; EventStore protocol test tenant-filter cases over both adapters green.

- [done] **11.0** **SPEC amendment + TODO breakdown** (docs only, Slice 0) — L1.9 added §3; S12 + supersession note added §5; §8 Tenant row; §9 `tenantId` field; §13 four tech-decision rows; Appendix A Tenant entry; SPEC-nav L1.9 row + count 39→40; TODO Phase 11 + P.6. Docs-only commit (`64fab729`, 2026-05-18).
- [done] **11.1** **Spike — idempotent SQLite migration + hash exclusion** (Slice 0.5): migration verified inline while implementing 11.2; `tenantId` excluded from `computeContentHash` confirmed; historical chains re-verify; `EventStore.query({tenantId})` filter correct on both adapters.
- [done] **11.2** **EventStore port + adapters + protocol test** (Slice 1): `tenantId` on `StoredEvent`/`NewEvent`/`EventStoreQuery`; `SqliteEventStore` rewritten with `@effect/sql-sqlite-node` `SqliteClient` + `SqliteMigrator` (2-step migration); `InMemoryEventStore` parity; 33 protocol tests green over both adapters; all 21 call-site appends stamped `tenantId:'default'`.
- [done] **11.3** **`CurrentTenantId` FiberRef + tenant registry** (Slice 2): `CurrentTenantId` FiberRef (`domain/tracing.ts`, default `'default'`); `TenantCreated`/`TenantRenamed` kinds + payloads (`domain/events.ts`); `listTenants`/`createTenant`/`renameTenant`/`seedDefaultTenant` application services; 6 unit tests (fold, idempotency, rename, seed) green.
- [todo] **11.4** **Identity entitlement + auth** (Slice 3): `tenantIds: string[]` on `ScryptAuthGateway` identity record; seed identities get `['default']`; `createTenant` grants creator entitlement; auth integration test. Critical: `packages/host/src/adapters/driving/ScryptAuthGateway.ts`, `packages/host/src/ports/driving/AuthGateway.ts`.
- [todo] **11.5** **`withTenant` middleware + tenant-scoped application services** (Slice 4): middleware in `packages/host/src/main.ts` (read `X-Tenant-Id`, authorise, 403, bind `CurrentTenantId`); `listSessions` + `submitGoal` + `respondToGoal` read `CurrentTenantId` and stamp every append. Keep `tests/integration/bootstrap.integration.test.ts` green.
- [todo] **11.6** **HTTP routes** (Slice 5): `GET/POST/PATCH /api/tenants`; `withTenant` applied to `/api/goals`, `/api/sessions`, `/api/sessions/:id/turns`, `/respond`. HTTP integration tests incl. 403 cross-tenant.
- [done] **11.7** **Law L1.9 test** (Slice 6): `packages/host/tests/laws/L1.9.spec.ts` — 3 tests: tenantId carried at write, cross-tenant invisible, if-absent proof (unscoped query exposes both tenants). 707 tests green.
- [todo] **11.8** **Frontend — shared-api + atoms** (Slice 7): `getTenantId`/`setTenantId` cookie helpers in `packages/shared-api/src/index.ts` (mirror `getToken`); `authedFetch` injects `X-Tenant-Id`; `tenant:changed` CustomEvent; `listTenants`/`createTenant`/`renameTenant` in `packages/app/src/api/chat.ts`; `tenantsAtom/View` + `currentTenantAtom` in `packages/app/src/atoms.ts`; reactivity keys tenant-aware (`sessions:<tenantId>`, `turns:<tenantId>:<sessionId>`).
- [todo] **11.9** **Frontend — switcher UI** (Slice 8): tenant switcher dropdown in `packages/app/src/components/app/AppShell.tsx` header (list entitled tenants + create + rename). Component test (`*.test.tsx`). On switch: set cookie → dispatch `tenant:changed` → navigate `/` → invalidate session/turns atoms.
- [todo] **11.10** **Deterministic Playwright e2e** (Slice 9): `e2e/tenant-isolation.test.ts`, `LLM_MODE=replay` — log in → Default tenant visible → create "Acme" → switch (cookie) → start conversation scoped to Acme → switch back to Default → Acme conversation NOT visible → `correlationId` maps to turn.

---

## Parked / later

- [parked] **P.6** **RLS / Postgres migration** — SQLite has no native row-level security (`CREATE POLICY`, per-connection roles are Postgres features). L1.9 compensating control is application-layer query scoping + `L1.9.spec.ts`. Exit plan: Postgres `EventStore` adapter with `CREATE POLICY tenant_isolation ON events USING (tenant_id = current_setting('app.tenant_id'))`. Trigger: tenant count or event volume makes application-layer scoping a trust concern (not just a performance concern).
- [parked] **P.5** Live LLM model selection — `llmModel` from Settings applied without restart. Model is baked into `OpenAiLanguageModel.layer({ model })` at build time; making it live requires the language-model layer to be dynamic (per-request model param or layer rebuild). Scoped separately from the base-URL fix (10.17).
- [parked] **P.1** S5 hard code-over-data wall implementation (waits on a clear sensitive-data fixture).
- [parked] **P.2** S6 long-session recall heuristics (adaptive beyond bounded last-N; MVP kernel is in Phase 6 items 6.1–6.7).
- [parked] **P.3** S9 multi-Georges; revisit only when single-Georges is boring.
- [parked] **P.4** WASM/isolate sandbox upgrade from process-level.

---

## Working notes

- Every phase exits on a _demonstration_, not a checklist completion. If the demo is unconvincing, the phase is not done.
- Stories are the unit of progress. Each phase advances at least one story from "described" to "demonstrated."
