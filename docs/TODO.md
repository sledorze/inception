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
- [todo] **4.2** Versioned capability registry on disk; rollback by version pin.
- [todo] **4.3** First Georges-proposed capability accepted end-to-end.

**Exit:** Georges can grow his own tool surface, gated.

---

## Phase 5 — Outer observability & substrate refinement

- [todo] **5.1** Trace query/replay tool with `storyRef` filtering.
- [todo] **5.2** First prompt/policy refinement driven by an observed pattern (closes S3 loop).
- [todo] **5.3** Quarantine/kill-switch ergonomics (Q8).

**Exit:** Outer feedback loop has demonstrably changed Georges' behaviour at least once based on traces.

---

## Parked / later

- [parked] **P.1** S5 hard code-over-data wall implementation (waits on a clear sensitive-data fixture).
- [parked] **P.2** S6 long-session recall heuristics.
- [parked] **P.3** S9 multi-Georges; revisit only when single-Georges is boring.
- [parked] **P.4** WASM/isolate sandbox upgrade from process-level.

---

## Working notes

- Every phase exits on a _demonstration_, not a checklist completion. If the demo is unconvincing, the phase is not done.
- Stories are the unit of progress. Each phase advances at least one story from "described" to "demonstrated."
