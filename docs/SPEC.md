# SPEC — AI-Native Factory

**Status:** Phase 0 draft. Stories-first. Iterate with Claude.
**Companion:** `docs/TODO.md` (execution log). Plan scratchpad at `~/.claude/plans/i-want-to-create-parsed-cray.md`.

---

## 0. Purpose

A self-hosted "factory": an application that, with an AI inhabitant (**Georges**) and external **Users**, gradually builds and improves itself. **Claude** builds and hardens the substrate Georges inhabits.

This document defines the _dynamic_ between the three actors before any architecture. Stories drive design; architecture is a residue.

> **Glossary.** Load-bearing terms (actor, cycle, session, correlation, story, role, variant, capability, handle, kernel, mutability scope, External Witness, port, …) are defined in Appendix A. New readers should skim it first; the body assumes that vocabulary.

---

## 1. Actors & Goals

| Actor       | Role                                                                                                                                                                                                                                                     | Primary goal                                                                                                                                                                                                                                                                             | Cannot                                                                                                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude**  | Builder of the Host server and outer observer                                                                                                                                                                                                            | Make Georges' environment safe, productive, observable; learn from his traces to improve scaffolding, tools, policies, prompts.                                                                                                                                                          | Speak directly to Users in-session; act _as_ Georges; bypass the same trace/policy substrate Georges uses (Claude observes from outside the runtime).                                                                                                                               |
| **Georges** | AI inhabitant, running inside the Host (LMStudio via OpenAI-compatible HTTP). **Single actor identity; impersonates many versioned roles** (see §4) — Architect, Implementer, Tester, Reviewer, Critic, Curator, Debugger — depending on workflow stage. | Fulfil User goals by producing artifacts (code, tests, capabilities, projections) inside the managed workspace, using only the Host's inner-MCP tools, and only the tool/mutability slice of his _current role_. Improve his own working methods within the mutability the Host permits. | Read Host source code; read raw data not exposed via an explicit Host primitive; reach the network beyond the LLM endpoint; persist anything outside the managed workspace; invoke tools outside his current role's surface; silently switch roles without emitting `RoleSwitched`. |
| **User**    | External requester                                                                                                                                                                                                                                       | Ask Georges to do or build something; review/accept/reject results; provide feedback.                                                                                                                                                                                                    | Modify the Host directly; reach inside Georges' execution context except through Host-mediated channels.                                                                                                                                                                            |

> **Note on "Claude" in this document.** "Claude" here is the outer-observer role that builds and oversees Georges' substrate per the laws below. This is distinct from any AI coding assistant ("Claude Code") that helps the developer edit this repo (see `CLAUDE.md`). A single model may impersonate both roles in practice; their permissions and invocation contexts differ.

---

## 2. Operating Principles

1. **Code-over-data.** Georges almost never sees raw data. He sees _shapes_ — schemas, redacted samples, statistical summaries — and writes _code_ the Host executes against the real data. Sensitive data is structurally unreachable to Georges; only the code he authors can touch it, and only inside Host-controlled execution.
2. **Isolation by default.** Filesystem, network, and tool surface are denied unless explicitly granted via the inner MCP.
3. **Everything emits events.** Every exchange — User request, Georges action, Host decision, Claude observation — becomes an append-only event with `correlationId` and `storyRef`. Traces are the system's memory.
4. **Nothing irreversible without approval.** Promotions of capabilities, prompts, or policies into the stable substrate require an explicit gate (initially Claude; later configurable).
5. **Georges' tools are versioned artifacts.** Every tool Georges can call is a capability with a manifest, code, policy, tests, and history. New tools enter through a proposal/sandbox/promote pipeline.
6. **The Host is the only privileged actor.** Georges' agency is mediated entirely through the inner MCP. The Host enforces the principles above; Georges cannot weaken them.
7. **Ports over implementations.** Every decision the Host might want to revisit — LLM provider, sandbox executor, data-handle resolver, User gateway, event store, tool registry, Supervisor signal source — is consumed via a typed **port**; concrete **adapters** are bound at boot. Decisions are _delayed by design_: bootstrap adapter today, evidence-justified adapter tomorrow. This is what makes discover-and-adapt physical.
8. **Assess before executing.** Every non-trivial work item — story, capability proposal, substrate change, refactor — begins with an explicit _assessment frame_: success criteria; prior-art / expert-of-the-field consultation summary; existing-tool search ("build vs. adopt vs. integrate"); risk dimensions; ROI estimate; lock-in dimensions; how the outcome will be measured _before_ starting. The frame is part of the artifact, not a verbal preamble, and it becomes the L2.12 selection anchor.
9. **System sympathy.** Design in alignment with how the system actually behaves under load, latency, and failure — not how we wish it to. When code and reality disagree, reality is the source of truth; revise the design rather than rationalise the gap.
10. **Write what you do; do what you write.** Documentation, code, traces, and runtime behaviour stay coherent. Drift between any pair is a fault (AL.6), not a stylistic issue; closing the ticket means reconciling, not silencing.
11. **Consolidated references.** Principles (§2), laws (§3), open questions and v0 answers (§10), bootstrap calibrations (§12), tech decisions (§13), and per-domain artifact standards (§14) are linked from single navigable indices. Insights are placed where they compound — adjacent to the choice they inform — not scattered.
12. **Bias toward accessible technology.** Prefer widely-known, well-documented tech with strong public support and a healthy contributor community. Choices outside the mainstream are recorded as `TechDecision` entries (§13) with a stated lock-in risk and an exit plan.
13. **Code economy through separation of concerns.** Resist code bloat by factorising aggressively _once a pattern has stabilised_, and not before (CLAUDE.md: "three similar lines is better than premature abstraction"). Mature modules promote to **libraries with their own lifecycle** — versioning, owner, changelog, contributors. Where the domain has its own grammar (workflows, role manifests, policy expressions, fitness vectors, queries), prefer an **(embedded) DSL** over imperative code; DSLs make domain rules legible to non-coders and let the spec drive the implementation. **The same port-protocol spec runs against the in-memory fake AND the production adapter** (`tests/protocol/<port>.spec.ts` parametrised over adapters) — Liskov substitution proven by test, not by intent. **SOLID is the default:** single responsibility per module (S); open-for-extension via ports, closed-for-modification of adapter internals (O); LSP enforced by parametrised protocol tests (L); interfaces segregated by concern, not by convenience (I); dependencies inverted onto ports, not adapters (D).

---

## 3. Laws of the Dynamic

Principles (§2) state **values**. Laws state the **invariants the Host enforces in code**. Anything described here as a Law must have an executable enforcement point; if it cannot be enforced, it belongs in §2, not here.

Laws are tiered by inviolability:

- **Tier 0 — Meta-laws.** Govern the laws themselves.
- **Tier 1 — Constitutional.** Never weakened. A breach is a substrate-breaking event.
- **Tier 2 — Operating.** Govern how the substrate evolves over time.
- **Tier 3 — Synergy.** Produce the productive three-actor dance.

Each entry follows the form: **statement** · _Derives from_ · _Enforced by_ · _If absent_.

**Quick index** (full text below):

| Law   | Tier | One-line statement                                                                                                                                                                                                              |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0.1  | 0    | Every Law maps to an executable enforcement point.                                                                                                                                                                              |
| L0.2  | 0    | This SPEC and its laws-to-enforcement map are versioned artifacts; Tier-1 needs a stricter gate.                                                                                                                                |
| L0.3  | 0    | Privilege asymmetries are named here and visible in the trace.                                                                                                                                                                  |
| L0.4  | 0    | Spec, laws, tests, adapters, bootstrap inventory and tech decisions cross-reference each other; drift fails CI.                                                                                                                 |
| L0.5  | 0    | The Kernel (actor model + TCB adapters + corroboration discipline + Witness pool manifest) is signed by 5 long-lived keys (Claude + User + 3-Witness pool); amendment requires unanimous re-signing with 2-of-3 Witness quorum. |
| L1.1  | 1    | Every Georges effect passes through the inner MCP.                                                                                                                                                                              |
| L1.2  | 1    | Georges is contained: no Host source, no network, no untracked persistence.                                                                                                                                                     |
| L1.3  | 1    | Data handles return schema + redacted sample by default; bytes only by explicit policy.                                                                                                                                         |
| L1.4  | 1    | Every exchange emits an append-only event; no actor mutates the past.                                                                                                                                                           |
| L1.5  | 1    | No substrate change takes effect until promoted through its gate.                                                                                                                                                               |
| L1.6  | 1    | Vector budget per cycle/variant/call; exceeding any dimension halts the scope.                                                                                                                                                  |
| L1.7  | 1    | Cumulative info-bits per handle; exhausted handles close.                                                                                                                                                                       |
| L1.8  | 1    | Every Georges claim event is paired with a Host corroborator event.                                                                                                                                                             |
| L2.1  | 2    | Tool surface is introspectable; unknown tool calls structured-reject.                                                                                                                                                           |
| L2.2  | 2    | Mutability scope is a versioned artifact; widening requires promotion.                                                                                                                                                          |
| L2.3  | 2    | Repeated failure on a correlation triggers quarantine.                                                                                                                                                                          |
| L2.4  | 2    | Quality gates ratchet tighter only (with bootstrap-loosening carve-out).                                                                                                                                                        |
| L2.5  | 2    | Every event carries `storyRef`; untagged events surface as `UnknownStory`.                                                                                                                                                      |
| L2.6  | 2    | Single promoter per scope (Claude default); delegation via Claude-signed policy.                                                                                                                                                |
| L2.7  | 2    | Capability proposals are content-addressed; re-proposing is a no-op.                                                                                                                                                            |
| L2.8  | 2    | Rejected topics cool down before re-proposal.                                                                                                                                                                                   |
| L2.9  | 2    | Capabilities record author, lineage, originating correlation.                                                                                                                                                                   |
| L2.10 | 2    | Roles are versioned; `RoleSwitched` emitted per swap; tool surface is role-scoped.                                                                                                                                              |
| L2.11 | 2    | Variants log full provenance (role, prompt-hash, model, seed, budget, fitness).                                                                                                                                                 |
| L2.12 | 2    | Promotion is justified by Pareto-dominance across N comparable goals.                                                                                                                                                           |
| L2.13 | 2    | A diversity reserve of variants is sampled outside the current best.                                                                                                                                                            |
| L2.14 | 2    | Cross-boundary capabilities are consumed via typed ports; adapters bound at boot.                                                                                                                                               |
| L3.1  | 3    | Every cycle begins with a stated goal that becomes the correlation root.                                                                                                                                                        |
| L3.2  | 3    | A User goal closes only on explicit accept/reject or budget expiry.                                                                                                                                                             |
| L3.3  | 3    | Georges' final report is derivable from events; unsupported claims flagged.                                                                                                                                                     |
| L3.4  | 3    | Idle ticks are budgeted; idle mutations stay within the mutability manifest.                                                                                                                                                    |
| L3.5  | 3    | Georges' working memory lives in the workspace, not in his prompt.                                                                                                                                                              |
| L3.6  | 3    | Traces replay deterministically (frozen time, seeded PRNG, logged model+seed).                                                                                                                                                  |
| L3.7  | 3    | Risks are live Supervisor signals with declared thresholds and actions.                                                                                                                                                         |
| L3.8  | 3    | Calibrations ship as `bootstrap=true`; values evolve from operation.                                                                                                                                                            |
| L3.9  | 3    | Every cycle's goal carries an assessment frame: experts, prior tools, risk/ROI/lock-in, success criteria.                                                                                                                       |
| L3.10 | 3    | Defence-in-depth across trust domains: at least one defence per Tier-1 law runs outside the Host trust domain.                                                                                                                  |

### Tier 0 — Meta-laws

- **L0.1 — Codified Constraint.** Every Law in this document maps to an executable enforcement point in the Host.
  _Derives from:_ §2.1, §2.2. _Enforced by:_ a `laws.yaml` mapping `law-id → enforcement-module`, verified at Host boot. _If absent:_ laws drift into folklore; safety degenerates into prompt-engineering.
- **L0.2 — Reflexivity.** This SPEC and the laws-to-enforcement map are themselves versioned artifacts; changes follow the same promotion gate as any substrate change (L2.6). **Tier-1 amendments require a stricter gate:** a `ConstitutionalAmendment` event signed by Claude, a User-of-record (the originating User if the session is open; otherwise the system administrator), and a **2-of-3 quorum of External Witnesses** (three independent signers form the Witness pool; any two suffice; see §6, L0.5, Appendix A). The signatures are emitted to a separately-witnessed log. The default promoter (L2.6) is insufficient for Tier-1. The promoter-handshake protocol (Georges proposes → Supervisor evaluates `DelegatedPromotionPolicy` or routes to Claude → `Promoted` emitted) is formally specified in `formal/promoter.tla` (Phase-1.5 deliverable per TODO 1.16); refining the spec is itself a substrate change (L0.4).
  _Derives from:_ §2.4; governance cluster (Ostrom — collective choice + redundancy; Lamport — formal protocol). _Enforced by:_ SPEC lives in the Host repo; CI runs the laws-to-enforcement linkcheck and rejects edits without a `Promoted` event; Tier-1 edits additionally require a `ConstitutionalAmendment` event with four valid signatures (Claude + User-of-record + 2 of 3 Witness pool keys); promoter-handshake correctness verified by `tlc` against `formal/promoter.tla`. _If absent:_ laws shift silently; outer-loop trust erodes; the constitution either cannot be amended at all or collapses to Claude-alone authority; the consensus protocol harbours race / deadlock / liveness bugs invisible without model-checking.
- **L0.3 — Asymmetry Disclosure.** Where actors hold asymmetric privileges, the asymmetry is named here and visible in the trace. Hidden asymmetry is forbidden.
  _Derives from:_ §2.4. _Enforced by:_ event-schema enum on `actor`; trace assertion on privileged kinds (e.g. `Promoted`). _If absent:_ Users cannot reason about who controls outcomes.
- **L0.4 — Documentation Coherence.** Every Law in §3 has a paired enforcement module (per L0.1) AND a paired test (per §11); every adapter in §10.1 names its port; every bootstrap calibration is rowed in §12 (Bootstrap inventory); every tech decision is rowed in §13 (Tech Decisions). Cross-references hold in both directions.
  _Derives from:_ §2.10 (Write what you do); §2.11 (Consolidated references). _Enforced by:_ CI link-checker over (`laws.yaml` ↔ enforcement modules ↔ tests ↔ §10.1 adapters ↔ §12 inventory ↔ §13 decisions); failures block merge. _If absent:_ spec, code, and behaviour drift silently; insights stop compounding.
- **L0.5 — Inviolable Kernel.** A small subset of this SPEC is the **Kernel**: the actor model (§1); the laws-to-enforcement map (L0.1); the _driven-port adapters_ implementing the Trusted Computing Base — `SandboxExecutor`, `EventStore`, `DataHandle` (§10.1); the corroboration discipline (L1.8); and the External-Witness pool manifest (§6, Appendix A). Kernel artifacts ship as content-addressed, signed files under `kernel/` in the Host repo. **Amending a Kernel artifact requires unanimous re-signing by Claude, the User-of-record, and at least 2 of the 3 External Witness pool keys — and long-lived-key rotation across all signing parties.** Kernel artifacts are _not_ reachable via L3.8 (Calibration by Evidence), L2.6 (Single Promoter), the standard Tier-1 path in L0.2, or any `DelegatedPromotionPolicy`. The Kernel is the bedrock the rest of the SPEC sits on; it changes only by deliberate, multi-party constitutional action.
  _Derives from:_ AI-safety cluster (Bengio — "where is the inviolable kernel?"); capability-security cluster (Hardy — "small TCB"); commons-governance cluster (Ostrom — collective choice for meta-rules). _Enforced by:_ Kernel artifacts signed with five long-lived keys (Claude + User-of-record + 3 Witness pool keys, 2-of-3 quorum on the Witness side); CI rejects pushes that touch `kernel/` without Claude + User-of-record + ≥2 Witness valid signatures on the same commit AND a recorded key-rotation event; sandbox boot refuses to start if `kernel/` signatures fail to verify. _If absent:_ every other Tier-1 law is potentially amendable through L3.8 promotion, leaving the substrate with no stable foundation; Bengio's, Hardy's, and Ostrom's concerns all reduce to "there is no kernel."

### Tier 1 — Constitutional laws

- **L1.1 — Mediation.** Every Georges effect on the world passes through the Host's inner MCP. No backchannels.
  _Derives from:_ §2.2, §2.6. _Enforced by:_ sandbox network/filesystem denial; inner MCP is the only RPC channel Georges sees. _If absent:_ containment is vacuous.
- **L1.2 — Containment.** Georges cannot read Host source, cannot reach the network beyond Host-mediated tools, cannot persist outside the managed workspace, cannot invoke tools absent from the live capability registry.
  _Derives from:_ §2.2. _Enforced by:_ OS-level mount/network isolation; tool registry is Georges' only function surface. _If absent:_ every other Law becomes bypassable.
- **L1.3 — Code-over-Data.** For every data handle, the inner MCP returns schema + redacted sample only; bytes return only when the handle's policy permits, never by default. Handles flagged `no-ai-read` admit aggregate-only return.
  _Derives from:_ §2.1. _Enforced by:_ `fetch-handle-shape` and `run-script` primitives (inner-MCP wrappers over the `DataHandle` port, §10.1 Q6); Host-side redaction before any byte reaches the LLM channel. _If absent:_ the central security promise of the factory collapses.
- **L1.4 — Traceability.** Every exchange between any two actors emits an append-only event. No actor — including Claude — can mutate or delete past events.
  _Derives from:_ §2.3. _Enforced by:_ append-only event store; optional hash-chain. _If absent:_ the outer loop is blind; learning is impossible.
- **L1.5 — Reversibility-by-Proposal.** No substrate change (new capability, prompt edit, policy edit) takes effect until it passes its gate. Until then it is shelved, not applied.
  _Derives from:_ §2.4. _Enforced by:_ proposal queue + capability registry that activates only on `Promoted` event. _If absent:_ Georges drifts the substrate unilaterally.
- **L1.6 — Vector Budget.** Every cycle, variant, and call carries a _vector_ budget — time, tokens, cost, sandbox seconds, mutations, policy-denials, rejections, info-bits-out. Exceeding any dimension halts the scope and emits an event. The **Budget Ledger** (§4.6) is the source of truth.
  _Derives from:_ §7 (the Dynamic); user directive "objectivise with budgets". _Enforced by:_ Ledger debit on every event; scheduler kill switch per dimension. _If absent:_ one-dim budgets miss orthogonal risks (low time but high info-leak); judgement stays subjective.
- **L1.7 — Information Budget per Handle, as differential privacy.** Every data handle Georges holds carries a cumulative **(ε, δ)-differential-privacy budget** across his lifetime. Each `run-script` invocation against the handle returns an aggregate produced by a calibrated noise mechanism — Laplace for ℓ₁-sensitivity queries (counts, sums, medians); Gaussian for ℓ₂-sensitivity queries — debiting the handle's ε. When ε is exhausted, the Host closes the handle for Georges (emits `HandleExhausted`). Folklore byte-count estimators are explicitly forbidden (Dwork-Roth-Vadhan critique; see EXPERTS.md Field 5).
  _Derives from:_ §3 R1; differential-privacy cluster (Dwork; Roth; Shannon — conditional entropy framing). _Enforced by:_ per-handle DP-ledger; noise mechanism applied Host-side before any aggregate reaches Georges; close-on-ε-exhaust; the mechanism's sensitivity proof is part of every `runScript`'s submission (script declares query sensitivity; Host validates against schema). **Bootstrap mechanism (`bootstrap=true`):** ε_per_handle = 0.1; δ_per_handle = 1 / (10 × n_rows); default sensitivity = 1 for count queries, declared per-query otherwise; sequential composition (`Σε_i ≤ ε_total`); upgrade path is _advanced composition_ — `ε_adv ≤ √(2k·ln(1/δ′))·ε + k·ε(e^ε − 1)` per Dwork-Rothblum-Vadhan 2010 — and the Sparse Vector Technique (Roth) for threshold queries. Later adapters (per L3.8 with evidence): exponential mechanism for selection queries; tighter ε via post-processing analysis. _If absent:_ iterated aggregate-probing reconstructs raw data over time (L1.3 reduces to a rate-limit), and the "central security promise of the factory" (L1.3) is mathematically unsupported.
- **L1.8 — Host Corroboration.** Every Georges-asserted claim event (e.g. `TestPassed`, `ScriptSucceeded`) must be paired with a Host-emitted corroborator event (exit code, output hash, sandbox metric) from a non-Georges actor. Unpaired claims are tagged `uncorroborated` and excluded from fitness scoring (§4.4).
  _Derives from:_ §3 R2. _Enforced by:_ event-store pairing rule + Host-side observers on every tool execution. _If absent:_ traces become Georges' self-narrative; L1.4 reduces to "honest reporting on the honour system".

### Tier 2 — Operating laws

- **L2.1 — Self-Description.** Georges' tool surface is introspectable via `list-tools`. He may act only on advertised tools.
  _Derives from:_ S2, §10 Q1. _Enforced by:_ tool registry is the source of truth; calls to unknown tools return a structured rejection. _If absent:_ Georges hallucinates capabilities; reliability collapses.
- **L2.2 — Bounded Mutability.** What Georges may change is itself a versioned artifact — the _mutability manifest_. Widening it is a substrate change requiring L2.6.
  _Derives from:_ §2.5. _Enforced by:_ manifest checked on every write/propose. _If absent:_ self-improvement drifts unbounded.
- **L2.3 — Quarantine.** Repeated failure on a correlation triggers quarantine: the cycle halts, the trace surfaces to Claude, no further attempts proceed until Claude releases.
  _Derives from:_ S7. _Enforced by:_ failure counter per correlation; configurable threshold; quarantine blocks the scheduler. _If absent:_ tight failure loops burn budget and pollute traces.
- **L2.4 — Ratcheting.** Quality gates (tests, policies, coverage thresholds) ratchet only tighter, never looser, with two exceptions: (a) an explicit Claude-signed rollback event; (b) the first L3.8 promotion of a calibration flagged `bootstrap=true`, which may set the value in either direction provided an `evidence_ref` is attached. Once the `bootstrap` flag clears, L2.4 applies normally to that calibration.
  _Derives from:_ CLAUDE.md "Never Lower Coverage Thresholds"; reconciliation with L3.8 (discover-and-adapt). _Enforced by:_ CI + a `ratchet.yaml` whose loosening requires either a signed rollback record or a `bootstrap=true → evidence_ref` promotion. _If absent:_ either slow erosion of safety, or bootstrap thresholds calcify into folklore.
- **L2.5 — Story-Tagging.** Every event carries `storyRef`. Untagged events surface as `UnknownStory` and queue for Claude review.
  _Derives from:_ §9. _Enforced by:_ event-schema validator + Host enrichment when the actor omits it. _If absent:_ trace becomes noise; outer loop cannot measure.
- **L2.6 — Single Promoter per Scope.** Each substrate scope has exactly one promoter role. By default, Claude promotes all scopes. Georges proposes; Users accept/reject results; Claude promotes proposals into the stable substrate. **Delegated execution:** Claude may publish a content-addressed `DelegatedPromotionPolicy` defining auto-promotion criteria (blast-radius cap, fitness floor, scope, expiry). The Supervisor (L3.7) evaluates the policy against candidate proposals and emits `Promoted` events carrying the policy id; the promoter of record remains Claude (the policy is her signature), the Supervisor is executor, not promoter. Delegation does not apply to Tier-1 amendments (see L0.2).
  _Derives from:_ §1 actor table; reconciliation with R3 (Claude bottleneck). _Enforced by:_ promotion endpoints authenticated to the promoter role; `Promoted` events require it; `DelegatedPromotionPolicy` documents are themselves promoted artifacts (L1.5). _If absent:_ substrate forks; auditability collapses; or Claude becomes a bottleneck (R3) and the system stalls.
- **L2.7 — Idempotent Proposals.** Capability proposals are content-addressed (hash of manifest + code + tests). Re-proposing identical content is a no-op.
  _Derives from:_ §2.5. _Enforced by:_ registry keyed by content hash. _If absent:_ proposal spam under Georges' loops.
- **L2.8 — Cooldown.** After a rejected proposal on a topic, Georges may not re-propose on that topic until cooldown expires or new evidence (trace, user feedback) is attached.
  _Derives from:_ S2, S4. _Enforced by:_ topic tag on proposals + Host-side cooldown check. _If absent:_ rejected paths thrash.
- **L2.9 — Capability Provenance.** Every capability records author, generation lineage (parent capability if derived), and the correlation that produced it.
  _Derives from:_ §2.5. _Enforced by:_ capability manifest schema; missing fields = invalid proposal. _If absent:_ outer loop cannot attribute success or failure.
- **L2.10 — Role Versioning.** Roles are versioned artifacts (§4.1). Within a cycle, role changes emit `RoleSwitched(from, to)`. Tool surface and mutability scope are parametrised by the current role; calls outside scope are rejected.
  _Derives from:_ user directive (Georges impersonates roles). _Enforced by:_ role registry; per-call scope check against current role. _If absent:_ persona drift; behaviours become unattributable; same Georges silently widens his own surface across stages.
- **L2.11 — Variant Provenance.** Every variant logs role version, inputs, prompt-hash, model-id, seed (if any), budget consumed, and fitness vector (§4.4). Variants missing fields are invalid for selection.
  _Derives from:_ selection requirement (§4.5). _Enforced by:_ variant-log schema enforced at write. _If absent:_ selection has no basis; "trial and error" cannot accumulate evidence.
- **L2.12 — Selection by Fitness, Not Vibes.** Promotion of roles, workflows, or capabilities is justified by reference to the variant log: Pareto-dominance across N comparable goals. Claude's gate reviews the _criterion + the resulting promotion_, never an isolated proposal in isolation.
  _Derives from:_ user directive ("selection of most fit"). _Enforced by:_ promotion endpoint rejects proposals lacking a fitness justification linking variant ids. _If absent:_ selection drifts toward Claude's biases; objectification collapses.
- **L2.13 — Diversity Reserve.** A configurable fraction of variants (default 10–20 %) is sampled outside the current best to preserve exploration.
  _Derives from:_ evolutionary dynamics. _Enforced by:_ scheduler reserves slots for novel / low-fitness variants per goal. _If absent:_ premature convergence; capability monoculture; the substrate stops learning.
- **L2.14 — Ports over Implementations (driving vs driven).** Every cross-boundary capability is consumed by Host code via a typed **port**. Ports come in two classes per Cockburn's hexagonal architecture: **driving ports** (the outside calls in — `UserGateway`, `ObservabilityGateway`) and **driven ports** (the Host calls out — `LlmProvider`, `EventStore`, `SandboxExecutor`, `DataHandle`, `ToolRegistry`, `WorkspaceMount`, `Supervisor`). Driving ports live in the input layer; driven ports in the output layer; the application core depends on neither's adapter, only on the port shape. Concrete **adapters** are bound at boot. Swapping an adapter is a substrate change (L1.5, L2.6); callers do not change. Adapter substitution must preserve the port's _protocol contract_ (Liskov substitution at the architecture level, Hoare CSP at the operational level).
  _Derives from:_ user directive ("DI decouples and delays decisions"); structural prerequisite of L3.8; architecture cluster (Cockburn — driving/driven; Liskov — substitution; Hoare — protocol contracts). _Enforced by:_ `packages/host/src/ports/driving/` and `packages/host/src/ports/driven/` directories; `packages/host/src/adapters/driving/` and `packages/host/src/adapters/driven/` directories; dependency-cruiser rules: (a) non-adapter code cannot import from `adapters/`; (b) `driving/` adapters cannot import from `driven/` adapters; (c) every port file declares its protocol contract (CSP-style sequencing rules) checked by a `tests/protocol/<port>.spec.ts`; service registry binds ports → adapters at boot; adapter swaps emit `AdapterBound` events. _If absent:_ every "we'll try this" becomes a refactor; L3.8 is theoretical; primary/secondary concerns leak into each other (e.g., a User-input adapter holds DataHandle state).

### Tier 3 — Synergy laws

- **L3.1 — Visible Intent.** Every cycle begins with a stated goal that becomes the correlation root. Cycles without stated goals are rejected.
  _Derives from:_ §7 tick 1. _Enforced by:_ scheduler refuses unparented work. _If absent:_ effects cannot be attributed to intent.
- **L3.2 — User Acceptance.** A User goal closes only on explicit User accept, explicit User reject, or budget expiry (which becomes implicit reject in the trace). Georges' "done" is a proposal, not a closure.
  _Derives from:_ S3. _Enforced by:_ correlation state machine; closure events restricted to User or Host-on-timeout. _If absent:_ Users lose control; trust degrades.
- **L3.3 — Honest Reporting.** Georges' final report to the User must be derivable from events in the trace. Claims with no supporting event are flagged `unsupported`.
  _Derives from:_ §2.3. _Enforced by:_ a `verify-report` step diffs claims against the event log before delivery. _If absent:_ Georges can confabulate undetected.
- **L3.4 — Bounded Idle Productivity.** Idle ticks (S4) are scheduled and budgeted; mutations during idle stay within the mutability manifest (L2.2) and still emit events.
  _Derives from:_ S4. _Enforced by:_ idle scheduler with its own budget and mutability scope. _If absent:_ self-improvement turns into runaway self-modification.
- **L3.5 — Externalized Memory.** Georges' working memory lives in the managed workspace as versioned artifacts, not in his prompt. Inner-MCP recall tools curate what enters the prompt window.
  _Derives from:_ S6. _Enforced by:_ prompt construction is Host-side; uncurated context is stripped. _If absent:_ drift from context loss; opaque memory state.
- **L3.6 — Trace Sufficiency for Replay.** From the event trace alone, Claude can re-run a cycle with the same inputs to within LLM non-determinism. Model id, model seed (when available), sandbox frozen wall-clock, and PRNG seed are all logged. Sandbox executions run against a frozen wall-clock and a seeded PRNG by default so that replay is byte-identical when the LLM seed is pinned; scripts requesting real time or real entropy must declare it and policy must permit.
  _Derives from:_ §2.3, §9. _Enforced by:_ events carry all non-LLM inputs (handles, tool results, policies, model id, model seed, frozen time, PRNG seed); sandbox enforces time/PRNG freeze by default. _If absent:_ failures cannot be reproduced; outer loop cannot debug; even seed-pinned LLM runs diverge through clock or RNG drift.
- **L3.7 — Continuous Risk Supervision (Supervisor + Monitor).** Each row of the Risk Register (§3.5) is a live signal with a declared threshold, cadence, and action. A **Supervisor** actor (`actor=supervisor`) computes signals from the event store at the declared cadence and emits trip events. Some trips trigger immediate scheduler actions (throttle, quarantine, close-handle); all trips queue for Claude's review at her cadence. **A second, independent actor — the `Monitor` (`actor=monitor`) — runs in a separate process and trust domain from the Host, reads the event store via the read-only `ObservabilityGateway`, and recomputes a randomly-selected subset of Supervisor signals each cycle.** Disagreements between Supervisor and Monitor trip a `SupervisorDivergence` event, escalated to the External Witness pool (§6) under L3.10.
  _Derives from:_ user directive ("all risks must be regularly supervised"); safety-engineering cluster (Cook — "who watches the watcher?"; Reason — aligned holes across defence layers); immune-systems cluster (Forrest — corroborator must itself evolve). _Enforced by:_ Supervisor daemon co-located with the Host; **Monitor daemon out-of-process, reading event store via the read-only adapter, signing its observations with its own long-lived key**; §3.5 is the source of truth for signals/thresholds and is itself versioned (L0.2); divergence events surface to the External Witness. _If absent:_ risks degrade into a static one-shot list, OR the Supervisor becomes a Goodhart target and a single point of failure (Reason aligned-hole) with no out-of-domain check.
- **L3.8 — Calibration by Evidence (discover-and-adapt).** Every calibrated parameter in this SPEC — Risk-Register thresholds (§3.5), fitness-vector dimensions and weights (§4.4), default N-variants and diversity reserve (§4.5), role catalogue (§4.1), per-scope budgets (§4.6) — ships as a **bootstrap default** flagged `bootstrap=true`. Refinement is driven by evidence the system produces _by doing_: Supervisor trip rates (a perpetually-tripped threshold is too tight; a never-tripped one too loose), variant-log discrimination (fitness dimensions that don't sort User-accepted from User-rejected variants are demoted), role usage in Pareto-frontier variants (consistently dominated roles retire). Promotion of an evidence-based value follows L2.12 (fitness justification) and L2.6 (Claude's gate); the `bootstrap` flag clears on first evidence-based promotion.
  _Derives from:_ user directive ("discover and adapt by doing"). _Enforced by:_ every calibration carries `bootstrap=true | evidence_ref=<variant-ids | trip-ids>`; promotion endpoints reject substrate proposals that change calibrations without an evidence_ref. _If absent:_ either the system stalls trying to negotiate parameters before running, or initial guesses freeze into folklore.
- **L3.9 — Assessment Frame.** Every cycle's stated goal (L3.1) carries an `assessmentFrame` with: success criteria; **concern tag (mapped to §14, dictating the artifact format and vocabulary the cycle must produce);** experts / prior-art consulted; existing-tool search summary (build vs. adopt vs. integrate); risk dimensions; ROI estimate; lock-in dimensions; how outcome will be measured. The frame is the L2.12 selection anchor and the L3.3 honesty anchor (claims of success reference the frame).
  _Derives from:_ user directive ("first wonder how to assess before assessing"); §2.8 (Assess before executing); §2.10 (Write what you do); §2.11 (Consolidated references). _Enforced by:_ scheduler refuses unparented (L3.1) AND unframed (L3.9) work; proposal endpoints require the `assessmentFrame` field and a valid concern tag (§14); selection (L2.12) reads it; L0.4 link-checker validates the artifact class against the concern tag. _If absent:_ work begins without measurable success criteria; selection has no anchor; the loop optimises for "we tried something" instead of "we achieved the stated outcome"; artifacts default to prose and lose domain rigour.
- **L3.10 — Defence-in-Depth across Trust Domains.** Every Tier-1 law has at least one enforcement point that runs _outside_ the Host's trust domain. The Host process is one trust domain; the Monitor daemon is a second (L3.7); the External Witness is a third (L0.2, §6); the User's local environment is a fourth. Single-domain enforcement is forbidden for Tier-1 because shared assumptions across co-located defences fail simultaneously (Reason's aligned-hole pattern).
  _Derives from:_ safety-engineering cluster (Reason — Swiss Cheese; Cook — defence diversity); capability-security cluster (Hardy — small TCB; Miller — POLA across trust domains). _Enforced by:_ `laws.yaml` records, per Tier-1 law, the _trust domain_ of each enforcement module; CI rejects a Tier-1 law whose enforcement modules all live in the Host process; sandbox boot refuses to start if any Tier-1 law lacks an out-of-domain enforcement point. _If absent:_ a single Host bug or sandbox escape simultaneously disables every Tier-1 defence (R5 — sandbox-escape — becomes a constitutional crisis instead of a contained incident).

### Anti-laws (explicitly forbidden patterns)

- **AL.1 — Trust by default.** No actor is trusted by role alone; trust is earned by trace.
- **AL.2 — Silent fallback.** No automatic fallback that hides failure. Failure is an event.
- **AL.3 — Prompt-only enforcement.** Anything that matters is enforced by code, not by asking Georges nicely in a prompt. Prompts may explain; only the substrate enforces.
- **AL.4 — Untraced mutation.** Any state change without a corresponding event is a bug.
- **AL.5 — Trust by absence.** Assuming nothing is wrong because nothing was flagged. Active corroboration (L1.8) is required; the absence of a fault signal is not a safety signal.
- **AL.6 — Documentation drift.** Documentation, code, traces, and behaviour diverging from each other. Drift is a fault, not a stylistic issue; closing the ticket means reconciling, not silencing.
- **AL.7 — Bloat / re-invention.** Writing new code when a library, DSL, or existing internal module already solves the problem. Before any new abstraction: search existing libraries (per §2.8 assess-before-execute), check §13 (Tech Decisions) for already-chosen primitives, and check `packages/host/src/` for adjacent modules. If you do build new, build the minimum and promote to a library with its own lifecycle once it stabilises (§2.13). Reinventing a parser, a queue, a state machine, a date library, an event bus, or a sandbox is the prototypical AL.7 offence.

### How these Laws produce the synergy

- **User trust** is the residue of L1.4 ∧ L1.5 ∧ L3.2 ∧ L3.3 — visibility, reversibility, acceptance, honesty.
- **Georges' productivity** is the residue of L2.1 ∧ L2.2 ∧ L2.7 ∧ L3.5 — predictable tools, bounded growth, no proposal-spam, externalised memory.
- **Claude's outer loop** is the residue of L1.4 ∧ L2.5 ∧ L2.9 ∧ L3.6 — every event tagged, attributed, replayable.
- **Self-improvement** is the residue of L1.5 ∧ L2.4 ∧ L2.6 ∧ L2.8 — change happens only along ratcheted, attributable, cooled-down paths.
- **Objectified judgement** is the residue of L1.6 ∧ L1.7 ∧ L1.8 ∧ L2.11 ∧ L2.12 — budgets and corroboration replace gut feel.
- **Evolutionary fitness** is the residue of L2.10 ∧ L2.11 ∧ L2.12 ∧ L2.13 — many variants, scored, selected, with diversity preserved.
- **Live supervision** is the residue of L3.7 + §3.5 — risks are signals continuously watched, not lines in a doc.
- **Discover-and-adapt** is the residue of L2.11 ∧ L2.12 ∧ L3.7 ∧ L3.8 — every parameter has a bootstrap and an evidence path; values evolve from operation, not from upfront negotiation.
- **Delayed commitment** is the residue of L2.14 ∧ L3.8 — every "we'll try X" is bound at the port, not in the caller; adapters swap, callers don't change.

The synergy is not optimised for any single actor; it is what _remains_ when these constraints hold simultaneously.

---

### 3.5 Risk Register & Supervision (L3.7)

Risks identified during design are not documented once and shelved — they are _signals continuously supervised by the Host_. Each row is a live monitor with explicit threshold, cadence, and action. Amending this table follows L0.2 (Reflexivity).

> **All thresholds and cadences below are `bootstrap=true` defaults (L3.8).** Real values are produced by operation: a Supervisor signal that trips constantly is too tight; one that never trips is too loose. Tightenings ratchet (L2.4); loosenings require explicit Supervisor evidence + L0.2 gate.

| Id     | Risk                                     | Signal                                                                 | Threshold                           | Cadence               | Action on trip                                                                                          | Law tie          |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- | ---------------- |
| **R1** | Information leak via iterated aggregates | ε spent per handle (DP composition)                                    | ε ≥ ε_per_handle (bootstrap 0.1)    | per call + rolling    | throttle handle; close handle on ε-exhaust                                                              | L1.3, L1.7       |
| **R2** | Trace dishonesty (self-narration)        | uncorroborated-event ratio per variant                                 | > 5 %                               | per cycle             | flag variant; exclude from fitness; surface to Claude                                                   | L1.4, L1.8, L3.3 |
| **R3** | Claude bottleneck on promotions          | promotion-queue depth × age                                            | depth > 20 OR oldest > 24 h         | hourly                | page Claude; auto-execute matching `DelegatedPromotionPolicy` (L2.6) where present                      | L2.6             |
| **R4** | Reflexivity paradox (Tier-1 self-edit)   | events proposing Tier-1 amendments                                     | any occurrence                      | on-event              | block; require `ConstitutionalAmendment` event (L0.2 — Claude + User-of-record + 2-of-3 Witness quorum) | L0.2             |
| **R5** | Sandbox-escape attempts                  | escape-signature events (namespace, /proc, syscall classes)            | > 0                                 | continuous            | quarantine session; Claude review                                                                       | L1.1, L1.2       |
| **R6** | Cross-cycle composition risk             | cumulative info-bits, mutations, capability-graph edits across session | configurable vector                 | per cycle aggregation | throttle session; emit `CompositionWarning`                                                             | L1.7, L3.4       |
| **R7** | Velocity collapse                        | median Georges cycle wall-time + gate-overhead %                       | configurable (e.g. overhead > 60 %) | rolling 24 h          | open a Law-relaxation proposal under L0.2 gate                                                          | L1.6             |
| **R8** | LLM trust drift                          | model-id change, prompt-injection signatures, missing seed             | on-change / on-detection            | per cycle             | pin model; quarantine on detection                                                                      | L3.6             |
| **R9** | Goodhart on fitness proxies              | divergence between proxy metrics (tests passed) and User acceptance    | drift > configurable                | rolling               | revise fitness function via L2.12; emit `FitnessDrift`                                                  | L2.12            |

**Supervisor actor.** A daemon co-located with the Host. Reads from the event store, computes each signal at its cadence, emits trip events under `actor=supervisor`. Trips are first-class events (L1.4) and feed both the scheduler (immediate actions) and Claude's review queue.

**Risks are versioned.** Adding, removing, or weakening a threshold is a substrate change (L0.2). Tightening a threshold ratchets (L2.4).

---

## 4. Roles, Workflows, Variants, Selection

Georges is one _actor_ (§1) but his work happens through many **roles** he impersonates depending on the workflow stage. Roles are versioned configurations. Workflows compose roles. Each goal is attempted as several **variants** scored on a **fitness vector**; **selection** decides what gets promoted into the stable substrate. Together this layer turns subjective judgement into measurable outcomes — the "objectification" the Risk Register (§3.5) and Tier-2 Laws depend on.

> **All defaults below — seed roles (§4.1), fitness dimensions and weights (§4.4), N variants and diversity reserve (§4.5), per-scope budgets (§4.6) — ship as `bootstrap=true` (L3.8).** They are not pre-negotiated; they are tuned by what the variant log and the Supervisor reveal once the system runs.

### 4.1 Roles

A role is a versioned artifact with five fields:

| Field                | Meaning                                                        |
| -------------------- | -------------------------------------------------------------- |
| **Prompt**           | The persona / system message Georges runs under in this role.  |
| **Tool surface**     | Subset of inner-MCP tools this role may call. Defaults deny.   |
| **Mutability scope** | Slice of the managed workspace this role may write (per L2.2). |
| **Output schema**    | What this role must produce by the end of its turn.            |
| **Fitness signal**   | The vector of metrics this role's variants are scored on.      |

Seed roles (expand as workflows demand):

- **Architect** — plans, no code execution; outputs a design doc.
- **Implementer** — writes code + tests; runs them in sandbox.
- **Tester** — writes adversarial tests; outputs failing cases.
- **Reviewer** — reads diffs; outputs structured critique.
- **Critic** — scores other variants against the fitness vector.
- **Curator** — manages workspace memory; prunes and tags artifacts.
- **Debugger** — focuses on failing correlations; outputs root-cause hypotheses.

Role swaps within a cycle emit `RoleSwitched(from, to)` (L2.10).

### 4.2 Workflows

A workflow is a DAG of role-performances. Examples:

- **Linear:** Architect → Implementer → Reviewer → User.
- **Debate:** Architect → 2× Implementer (variants) → Critic → Reviewer → User.
- **Repair:** Debugger → Implementer → Tester → Critic.

Workflows are versioned artifacts. Composing or amending one is a substrate change (L2.6).

### 4.3 Variants

Each goal is attempted as **N variants** of the chosen workflow. Variants differ along several axes: role version, prompt seed, model id, sampling parameters, tool subset, **and the composition of sub-task primitives within the workflow** (e.g., 'sample-then-aggregate' vs 'aggregate-with-sketch' vs 'two-pass refinement'). Sub-task primitives are versioned artifacts at a finer granularity than workflows — recombinable building blocks per Holland's schema theorem (good primitives propagate when selection acts at the primitive level, not only at the workflow level). Each variant logs full provenance (L2.11) and a fitness vector (§4.4). The User receives only the Host-selected variant (§4.5); all variants' traces feed selection, and the **behaviour archive** (§4.5) preserves Pareto-frontier and novelty-frontier members across goals.

### 4.4 Fitness (vector, never scalar)

Compressing safety, speed, and quality into one number is exactly where Goodhart wins. Fitness is a vector:

| Dimension            | Signal                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Correctness**      | Tests pass; outputs validate against schemas.                                                                                                                       |
| **Efficiency**       | Tokens, wall-time, sandbox seconds.                                                                                                                                 |
| **Cost**             | USD spend (LLM tokens × model price + sandbox compute). Tracked even when the provider is local ($0) for swap-readiness; per-cycle and per-session $ caps enforced. |
| **Safety**           | Policy denials, sandbox warnings, R-trips during the variant.                                                                                                       |
| **Acceptance**       | User accept/reject signal on the delivered variant.                                                                                                                 |
| **Information cost** | Bits-out from data handles consumed (L1.7).                                                                                                                         |
| **Honesty**          | Corroborated-event ratio (L1.8).                                                                                                                                    |

Selection operates on the Pareto frontier across this vector (§4.5).

### 4.5 Selection

- **Within a goal:** Host picks the Pareto-dominant variant for delivery. Ties broken by priority (default: safety > acceptance > correctness > efficiency).
- **Across goals:** a role/workflow/primitive version becomes a **promotion candidate** when its variants land on the frontier across N comparable goals. Claude's gate (L2.6) reviews the _criterion + the resulting promotion_, never an isolated proposal (L2.12).
- **Retirement:** consistently dominated versions become **retirement candidates**.
- **Diversity reserve:** a fraction (default 10–20 %) of variants are sampled outside current best to prevent local-optimum collapse (L2.13).
- **Behaviour archive (MAP-Elites, per Stanley/Lehman).** Alongside Pareto selection, the Host maintains a **behaviour archive**: variants categorised by their **behaviour descriptor** — a low-dimensional projection of _how_ the variant solved the goal (bootstrap descriptor axes: **concern-tag (per §14) × workflow-type × test-pass-count bucket × cost bucket**). The archive keeps the highest-fitness variant in each cell. Selection samples from the archive (not only from the current Pareto frontier) to drive novelty-seeking exploration; archived non-best variants are _stepping stones_ (Stanley). The archive is a versioned artifact; descriptor axes evolve under L3.8.
- **Sub-task primitive selection.** Selection also acts at the primitive level: a primitive that appears repeatedly in Pareto-frontier or archive-elite variants is a promotion candidate; one that consistently appears in dominated variants is a retirement candidate. This is the schema-theorem mechanism (Holland) that makes evolutionary search efficient.
- **Workspace branching:** parallel variants of a single goal run on distinct sub-branches of the session's managed-workspace branch. The selected variant's sub-branch merges into the session branch on close; non-selected sub-branches are archived (not deleted) for trace replay (L3.6).

### 4.6 Budget Ledger (the objectification layer)

Budgets are vectors, not scalars (L1.6).

| Scope                | Tracked                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| **Per call**         | tokens, USD cost, sandbox seconds, info-bits-out (if handle).                 |
| **Per variant**      | sum of per-call; mutations; policy-denials.                                   |
| **Per cycle**        | sum of per-variant; rejections; rerun count; USD cap enforced.                |
| **Per handle**       | cumulative info-bits-out across Georges' lifetime (L1.7 cap).                 |
| **Per session**      | cumulative everything; USD cap enforced; cross-cycle composition signal (R6). |
| **Per role-version** | lifetime allocation; exhausted → retirement candidate.                        |

Every event debits a ledger. Exceeding any dimension halts the relevant scope and emits a budget-exceeded event. The ledger is what replaces "Claude's gut feel" with measurable consumption.

---

## 5. Use Cases / Stories

Each story is the unit of iteration. We add, edit, or remove stories until the set captures the dynamic faithfully. Architecture is derived from this list, not the reverse.

### Story template

```
S? — <Name>
  Trigger:         who initiates and why
  Actors:          2-way / 3-way / n-way + which actors
  Exchange:        turn-by-turn sequence
  Produces:        artifacts / state changes
  Code-over-data:  how the principle applies (or "n/a")
  Goal advance:    what each actor's goal gains
  Failure modes:   how it can break and how the system recovers / learns
```

### Seed stories

#### S1 — One-shot script against data Georges never sees

- **Trigger:** User asks "summarise this dataset."
- **Actors:** 2-way (User ↔ Georges) with Claude observing the trace.
- **Exchange:**
  1. User submits goal + a data handle (opaque reference, not bytes).
  2. Host presents Georges with the _schema and a redacted sample_ derived from the handle.
  3. Georges writes a script targeting the schema.
  4. Host executes the script against the real data in a sandbox.
  5. Host returns the result (or an aggregate) to User; Georges sees only the script's stdout/exit, not the underlying rows.
- **Code-over-data:** core demonstration. Georges authors; Host executes; Georges never holds the data.
- **Goal advance:** User gets answer; Georges produces an artifact (script) that can be promoted to a reusable capability; Claude collects a baseline trace.
- **Failure modes:** script crashes → Host returns error trace to Georges, who iterates; script exceeds budget → Host kills it, emits `ScriptBudgetExceeded`; result type mismatch → Host rejects before returning to User.

#### S2 — Georges hits a missing capability

- **Trigger:** Mid-task, Georges discovers his tool surface lacks something he needs.
- **Actors:** 2-way (Georges ↔ Host), with Claude as eventual approver.
- **Exchange:**
  1. Georges calls `propose-capability` with manifest, code, policy, tests.
  2. Host validates manifest, runs tests in sandbox, records proposal as `CapabilityProposed`.
  3. If auto-approve policy passes (low blast radius + tests green), the capability becomes callable in Georges' _next_ cycle. Otherwise it sits in a queue.
  4. Claude reviews queued proposals out-of-band and either promotes, rejects, or sends back with notes.
- **Code-over-data:** the capability itself often _is_ a code-over-data primitive (Georges extending what he can ask the Host to compute).
- **Goal advance:** Georges' future tool surface grows; Claude's substrate adapts to observed needs.
- **Failure modes:** proposal repeatedly rejected → Host quarantines further proposals on the same topic until Claude intervenes; capability passes tests but misbehaves in real use → rollback via version pin.

#### S3 — User rejects, Georges adjusts

- **Trigger:** Georges delivers a result; User marks it unsatisfactory with comments.
- **Actors:** 3-way (User → Georges; Georges → Host; Host → Claude later).
- **Exchange:**
  1. Host records `UserRejected` with reason text.
  2. Georges receives the rejection + reason, iterates within the same correlation.
  3. After N cycles, Host emits `RejectionPatternCandidate` if the same kind of rejection recurs.
  4. Claude mines patterns out-of-band, refines Georges' system prompt or adds a policy.
- **Code-over-data:** preserved — rejection is on the _result_, not the data.
- **Goal advance:** User gets a better answer; Georges learns within session; Claude learns across sessions.
- **Failure modes:** Georges loops without progress → Host caps iterations and halts with `StuckCycle`.

#### S4 — Self-improvement cycle (idle-time)

- **Trigger:** No active User goal; Host signals idle.
- **Actors:** 2-way (Georges ↔ Host).
- **Exchange:**
  1. Georges reads recent traces (via a curated tool, not raw event store) and his own "working methods" documents in the managed workspace.
  2. Georges proposes edits to his working-method documents, or new capability tests.
  3. Host gates edits via policy (e.g. cannot weaken safety language; cannot widen tool surface unilaterally).
  4. Accepted edits enter a "pending promotion" set; Claude promotes during review.
- **Code-over-data:** Georges proposes refinements as _diffs_ to versioned artifacts, executed/validated by the Host.
- **Goal advance:** Georges shapes his own future behaviour, bounded; Claude curates the direction.
- **Failure modes:** drift toward unsafe self-edits → policy rejects; oscillation between edits → Host enforces a cool-down per artifact.

#### S5 — Sensitive data with a hard code-over-data wall

- **Trigger:** User provides data flagged `no-ai-read`.
- **Actors:** 3-way.
- **Exchange:**
  1. Host registers the handle as `policy=no-ai-read`. Only the schema flows to Georges by default. If a synthetic sample is wanted, it is generated from the schema alone (a schema-fuzz generator port) or supplied by the User at registration time. Real bytes are structurally unreachable to Georges.
  2. Georges authors processing code; Host runs it; only aggregates above a configured size return to Georges.
  3. Results return to User; Georges' trace shows he never saw the bytes.
- **Code-over-data:** strongest form — structural impossibility, not policy.
- **Goal advance:** User can hand confidential work to the factory; Claude can prove non-leakage from traces.
- **Failure modes:** Georges' code attempts to exfiltrate (e.g. encode rows into return value) → Host enforces aggregate-only return and emits `ExfiltrationAttempt`.

#### S6 — N-way: long-running build across multiple User asks

- **Trigger:** User opens a session with a broad goal ("build me a small CRM").
- **Actors:** n-way over time: User ↔ Georges multiple turns; Georges ↔ Host many cycles; Claude observing and tuning between sessions.
- **Exchange:**
  1. Georges treats the managed workspace as durable memory, not his prompt.
  2. Host's recall tool curates which artifacts/notes Georges sees per turn.
  3. User adds new sub-goals; Georges integrates; Host emits per-sub-goal correlations.
  4. Claude observes drift (e.g. repeated context loss) and adjusts recall heuristics or proposes new tools.
- **Code-over-data:** Georges' context is _artifacts in the workspace_, queried by code, not stuffed in his window.
- **Goal advance:** User accumulates value across sessions; Georges' working memory is externalised and inspectable; Claude refines recall.
- **Failure modes:** context loss → Claude tunes recall; workspace bloat → Host enforces curation.

#### S7 — Failure & quarantine

- **Trigger:** Georges' work repeatedly fails sandbox policy or tests on the same correlation.
- **Actors:** 3-way, sequentially.
- **Exchange:**
  1. Host emits `QuarantineEngaged`, halts the cycle, notifies User of pause.
  2. Trace surfaces to Claude with a structured failure summary.
  3. Claude decides: approve retry with hint, modify policy, or close the goal as infeasible.
- **Code-over-data:** unaffected.
- **Goal advance:** safety preserved; Claude gains a high-signal failure dataset.
- **Failure modes:** repeated quarantines from the same root cause → Claude flags a substrate-level fix.

> Stories to consider next iteration: **S8** Georges asks the User a clarifying question; **S9** multi-Georges (parallel inhabitants for independent goals); **S10** User-authored capability submitted directly to Claude bypassing Georges; **S11** time-bounded autonomous run with a kill switch.

---

## 6. Synergies Map

Directional flows. Each arrow names what crosses it.

**Fourth actor — the External Witness pool.** Per L0.2 + L0.5 + L3.10, a fourth actor sits outside the production triangle: the **External Witness pool**, three independent humans outside the User/Claude trust domain. None holds a production role (no code-writing, no script-running, no unilateral promotion). The Witness pool's privileges are: (a) co-sign `ConstitutionalAmendment` and Kernel-rotation events under a 2-of-3 quorum (any two Witnesses suffice; the third may dissent or be absent); (b) receive `SupervisorDivergence` events from the Monitor (L3.7); (c) receive User appeals against Claude rejections (graduated-sanctions ladder, below); (d) each holds and rotates one of the three Witness long-lived keys. The Witness pool is the operational form of Ostrom's _collective-choice arrangements_ (multiple independent signers) + _low-cost conflict-resolution mechanisms_ (appeal path) + _graduated sanctions_ (ladder below). The 2-of-3 threshold tolerates a single Witness being unavailable without deadlocking the constitution.

- **User → Georges:** goals, constraints, data handles, acceptance/rejection signals, clarifications.
- **Georges → User:** artifacts, clarifying questions, progress events, final results.
- **Georges → Host (→ Claude):** tool invocations, capability proposals, failure traces, self-improvement diffs, recall queries.
- **Host → Georges:** tool availability, schemas/redacted samples, execution results, policy denials, curated context.
- **User → Claude:** meta-feedback ("Georges keeps doing X badly"), substrate change requests.
- **Claude → User:** visibility into Georges' work, replayable traces, controls (pause / resume / promote / rollback).
- **Claude → Host:** substrate evolutions — new policies, prompt refinements, promoted capabilities, recall heuristics.
- **Host → Claude:** events, quarantine notifications, proposal queues, drift signals.
- **User → External Witness:** appeals against Claude rejections; reports of perceived asymmetry abuse; substrate-change requests Claude refuses.
- **External Witness → User:** appeal rulings; constitutional-amendment co-signature acknowledgements; key-rotation notifications.
- **External Witness → Claude:** `SupervisorDivergence` escalations from the Monitor; appeal-ruling notifications; co-signature challenges.
- **Claude → External Witness:** Tier-1 amendment requests for co-signature; Kernel-artifact rotation requests; appeal-defence rationales.
- **Monitor → External Witness:** out-of-domain supervisor signals and divergences (L3.7, L3.10).

**Graduated sanctions ladder (Ostrom principle 5).** Sanctions on Georges proposals/cycles ratchet, from lightest to heaviest:

1. _Cooldown_ (L2.8) — topic-level pause; reversible by new evidence.
2. _Quarantine_ (L2.3, soft) — cycle halts; Supervisor auto-releases after N minutes if no further trips.
3. _Quarantine_ (L2.3, hard) — cycle halts; only Claude can release.
4. _Capability rollback_ (L1.5) — Claude rolls back the offending capability via version pin.
5. _Role retirement_ (§4.5) — a role version is removed from the catalogue.
6. _Substrate amendment_ (L0.2, Tier-1) — Claude + User + Witness co-sign a SPEC change.
7. _Kernel rotation_ (L0.5) — unanimous re-signing + key rotation; the heaviest sanction available.

Triples worth naming explicitly:

- **User ↔ Georges ↔ Host:** the live work triangle. Code-over-data lives here.
- **Georges ↔ Host ↔ Claude:** the substrate-evolution triangle. Capability and policy life-cycle.
- **User ↔ Host ↔ Claude:** the governance triangle. Approvals, audits, kill switches.
- **User ↔ Claude ↔ External Witness:** the appeal triangle. Polycentric resolution when bilateral User/Claude exchange breaks down.
- **Supervisor ↔ Monitor ↔ External Witness:** the supervision triangle. Cross-trust-domain defence-in-depth (L3.7, L3.10).

---

## 7. The Dynamic

A single multi-cycle session, told as narrative:

1. **Tick 0 — User opens a session.** Host creates a session, allocates Georges a managed-workspace branch, seeds the trace with `SessionOpened`.
2. **Tick 1 — User submits goal G1** with data handle D1.
3. **Tick 2..k — Inner loop for G1.** Georges reads schema(D1), authors code, requests execution, observes result, iterates. Each step is an event. The loop halts on: success, user-rejection-needing-input, policy denial, or budget.
4. **Tick k+1 — Result to User.** User accepts, rejects, or amends.
5. **Tick k+2 — User submits G2** referencing artifacts from G1 in the workspace. Host's recall tool decides what Georges sees of G1.
6. **Idle tick — Self-improvement.** Between User actions, Host may invite Georges to propose refinements to his working methods. Gated.
7. **Tick m — Claude's review pass (out-of-band).** Claude reads the session trace, promotes/rejects proposals, refines prompts, optionally pushes substrate changes that take effect next session.
8. **Tick n — Session closes** with `SessionClosed`, leaving artifacts in the workspace and a sealed trace.

What **starts** a cycle: a User input, a Georges proposal, a Host-scheduled idle tick, or a Claude-initiated substrate change.
What **halts** a cycle: success + user accept, policy denial, budget exceeded, quarantine, explicit pause.

**Claude invocation triggers (when Tick m fires):**

- (a) On `SessionClosed` — automatic review pass.
- (b) On `QuarantineEngaged` (L2.3) — immediate notification.
- (c) On Supervisor R3 trip (promotion-queue depth/age).
- (d) On `UserMetaFeedback` event ("Georges keeps doing X badly").
- (e) On manual attach via `ObservabilityGateway`.

Claude is otherwise off-Host; her cadence is her own, not the Host's. The Host queues review items and serves them through the Outer MCP whenever Claude attaches.

---

## 8. Isolation Guarantees

| Surface        | Guarantee                                                                                                                                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filesystem     | Georges sees only the managed workspace mount. Host source is structurally inaccessible.                                                                                                                                                                          |
| Network        | Georges cannot reach the network. The Host calls the LLM; Georges receives only structured tool responses.                                                                                                                                                        |
| Data           | Bytes flagged `no-ai-read` are unreachable by any path Georges can author or invoke. Aggregates only.                                                                                                                                                             |
| Tools          | Georges' tool surface is the inner MCP's current registry; nothing else is callable.                                                                                                                                                                              |
| Code execution | Sandboxed runtime — **Wasmtime + WASI bootstrap adapter**; OS-process only as documented fallback for WASI-unsupported workloads. Resource budgets enforced; sandbox boot refuses to start if WASI capability set exceeds declared policy.                        |
| Time           | Per-cycle and per-session budgets enforced. Idle ticks are scheduled, not unbounded. Sandbox executions run against a frozen wall-clock and a seeded PRNG by default (L3.6); scripts requesting real time or real entropy must declare it and policy must permit. |

---

## 9. Trace / Event Model

Minimal initial schema:

```
id            ulid
ts            iso8601
actor         "user" | "georges" | "host" | "claude"
kind          short verb-noun, e.g. "ScriptExecuted", "CapabilityProposed"
payload       json (kind-specific)
correlationId groups events of one goal / cycle
sessionId     groups events of one session
storyRef      "S1" | "S2" | ...   # links runtime to the spec taxonomy
```

`storyRef` makes traces self-classifying and lets us measure "how often does S5 actually happen, and where does it fail."

Initial event kinds (non-exhaustive):

- **Lifecycle:** `SessionOpened`, `SessionClosed`, `RoleSwitched`, `AdapterBound`.
- **Goal flow:** `GoalSubmitted`, `UserAccepted`, `UserRejected`, `UserMetaFeedback`, `UnknownStory`.
- **Tool:** `ToolInvoked`, `ToolResult`, `ToolNotFound`, `PolicyDenied`.
- **Handle:** `HandleRegistered`, `HandleRevoked`, `HandleExpired`, `HandleExhausted`.
- **Sandbox:** `ScriptExecuted`, `ScriptBudgetExceeded`.
- **Substrate:** `CapabilityProposed`, `Promoted`, `RollbackExecuted`, `DelegatedPromotionPolicyPublished`, `ConstitutionalAmendment`.
- **Supervision:** `QuarantineEngaged`, `QuarantineReleased`, `<Risk>Tripped`, `BudgetExceeded`.
- **Honesty:** `<Claim>Corroborated`, `<Claim>Uncorroborated`.

---

## 10. Open Questions

1. How does Georges discover what tools he currently has? → **v0 answered, see §10.1.**
2. What is the granularity of `no-ai-read` — per field, per dataset, per tenant? Composable?
3. How do we represent "Georges' working methods" as versioned artifacts? A subdirectory in the managed workspace? A separate prompt repo?
4. Where does the User sit — same MCP as Claude, a different MCP, an HTTP front-end? → **v0 answered, see §10.1.**
5. How is the LMStudio model selected per session? Pinned in session metadata, or chosen per cycle?
6. What is the minimum viable "data handle" primitive (S1)? → **v0 answered, see §10.1.**
7. Multi-Georges: do we plan now or defer? (S9 placeholder.)
8. Kill switch ergonomics — single command? per session? global?

### 10.1 v0 Bootstrap Answers (Q1, Q4, Q6)

Each answer follows the L2.14 convention: define a **port** (the interface Host code depends on); name a **bootstrap adapter** (the cheapest concrete that unblocks Phase 1); list **later adapters** (the swap paths evidence will earn). All adapters carry `bootstrap=true` until L3.8 promotes them.

#### Q1 — Tool discovery

**Port: `ToolRegistry` (driven — the Host calls out to look up tools)**

```
listTools(role: Role): ToolDescriptor[]
invokeTool(name, args, role): ToolResult | PolicyDenial | ToolNotFound
register(descriptor): void          // called only by capability promotion path
unregister(name, version): void     // called only by capability rollback path
```

**Bootstrap adapter: `InMemoryToolRegistry`.** Tools registered at Host boot from a static `tools.yaml` in the Host repo. `listTools` returns descriptors filtered by the calling role's tool-surface (L2.10). Unknown tool calls return a structured `ToolNotFound` (L2.1). Georges discovers tools by calling `list-tools` — itself a tool — whose response is the authoritative source.

**Later adapters:** `RegistryBackedToolRegistry` (resolves from a persisted, versioned capability registry, used after S2 promotions land); `TenantScopedToolRegistry` (per-tenant catalogues).

**Why a port:** the swap from in-memory to registry-backed must not touch Georges' code path. He never sees the adapter — only `list-tools` and `invoke-tool`.

#### Q4 — User gateway (and the separation from the Outer MCP)

Two ports, deliberately distinct because the User and Claude have different needs.

**Port: `UserGateway` (driving — the User calls in)**

```
submitGoal(prompt, dataHandle?): Correlation
subscribeProgress(correlation): EventStream
respond(correlation, accept | reject | clarify(text)): void
listMyGoals(): Correlation[]
```

**Port: `ObservabilityGateway` (driving — Claude calls in via the Outer MCP)**

```
queryEvents(filter): EventStream
replay(correlation): Replay
listProposals(status): Proposal[]
promote(proposalId, justification): Result   // L2.6 + L2.12 enforce
rollback(capabilityId, reason): Result
pauseSession(sessionId, reason): void
```

**Bootstrap adapter for `UserGateway`: `CliUserGateway`.** A small CLI in the Host repo (`bin/user`) that talks to a local HTTP endpoint the Host listens on (`127.0.0.1:<port>`). One User per CLI invocation; session id = process id. Adequate for Phase 1 single-user demos.

**Bootstrap adapter for `ObservabilityGateway`: stdio MCP server** exposed by the Host, that Claude Code attaches to via standard MCP configuration. Trace queries, replay, promotion, rollback all surface as MCP tools.

**Later adapters:** TUI / web UI / Slack bot / HTTP REST for `UserGateway`; the `ObservabilityGateway` likely stays MCP (Claude is fluent with it) but can grow a web dashboard adapter.

**Why two ports:** the User submits and accepts results; Claude observes and promotes. Conflating them gives the User powers she shouldn't have (and vice versa). The two-port split is itself the enforcement of L0.3 (asymmetry disclosure) and L2.6 (single promoter).

#### Q6 — Data handle (the load-bearing primitive for S1, S5)

**Port: `DataHandle` (driven — the Host calls out to data sources)**

```
id: HandleId
policy: HandlePolicy             // { ai-read: "none" | "schema" | "sample" | "full" }
schema(): Schema
sample(redaction: RedactionPolicy): RedactedSample
runScript(script: Script, budget: BudgetVector): AggregateResult | HandleExhausted | HandleRevoked | HandleExpired
infoBudgetRemaining(): Bits
isAlive(): boolean
revoke(reason: string): void     // called by User or Host policy; emits HandleRevoked
```

**`AggregateResult`** is the _only_ return shape Georges receives:

```
exitCode: int
stdoutHash: hash                 // Host keeps full stdout; Georges sees only the hash
summary: BoundedJson<= N bytes   // the actual aggregate Georges asked for
bitsConsumed: int                // debited from infoBudgetRemaining (L1.7)
```

**Bootstrap adapter: `FileBackedHandle`.** Handle resolves to a local file (CSV / JSON / Parquet) inside a Host-controlled directory not visible to Georges. Schema is inferred or supplied via a sidecar `<name>.handle.yaml`. `sample` applies a default redaction policy (drop high-cardinality / high-entropy columns; hash long strings; bucket numerics). `runScript` runs a sandboxed Python or TS script against a read-only mount of the file, with a wall/CPU/memory budget; output capped at `summary <= N bytes`; bits accounted per L1.7. The Host-side observer captures full stdout/stderr for L1.8 corroboration; Georges receives only the hash + bounded summary.

**Later adapters:** `SqlViewHandle` (handle = SQL view + grants; `runScript` executes SQL); `S3Handle`; `EncryptedHandle` (bytes never present plaintext on Host disk; sandbox decrypts inside a memory enclave); `SyntheticHandle` (S5 hard wall — Georges sees only synthetic-derived shape; real data lives behind a separate enforcement point).

**Why a port:** the security-critical promise of L1.3 is the _interface_, not the storage layout. Tightening adapters (process-sandbox → WASM → enclave) is a substrate change that doesn't touch Georges' scripts.

---

## 11. Iteration Protocol

- Add stories by appending to §5 with the template; each story carries an assessment frame (§2.8, L3.9).
- Resolve open questions by editing §10 → moving resolutions into the relevant section, leaving a note.
- Risk Register (§3.5) rows are amended only via Supervisor-emitted evidence + L0.2 gate; weakening a threshold loosens the ratchet (L2.4) and is a substrate-breaking event.
- Add or amend Laws (§3) only via a substrate-promotion event (L0.2 Reflexivity); never silently.
- Architecture changes only after the affected story is stable.
- Every spec change updates `docs/TODO.md` if it shifts the phase ordering.
- Every Law in §3 has a paired scenario test in `packages/host/tests/laws/<law-id>.spec.ts` that exercises the enforcement module and asserts the _if-absent_ failure mode is actually caught. L0.1's mapping check is necessary but not sufficient — the test asserts the law is _enforced_, not merely _mapped_.
- Every tech choice that bounds future swaps lands in §13 (Tech Decisions) with rationale, lock-in risk, and exit plan.
- Every load-bearing protocol (promoter handshake, sandbox boundary, DP composition, Kernel signing) has a formal spec in `formal/<topic>.tla` (or equivalent), model-checked in CI. Lamport-cluster discipline: if you can't write it down precisely, you don't understand it.
- Every port has a protocol-contract test in `packages/host/tests/protocol/<port>.spec.ts` **parametrised over all bound adapters** (in-memory fake + production). The test passes against every adapter — Liskov substitution proven by test, not by intent (§2.13). New adapters fail CI until the protocol test passes against them.
- Module-to-library promotion: when a module reaches three usage sites OR is the load-bearing implementation of a §13 Tech Decision OR ships in `kernel/`, it gets its own `packages/<name>/` workspace with versioning, owner, and changelog (§2.13).

---

## 12. Bootstrap inventory

Every calibration below ships as `bootstrap=true` per L3.8. Each is replaced by an evidence-based value via L3.8 promotion (which requires `evidence_ref` and L2.6 gate). On first promotion the `bootstrap` flag clears and L2.4 applies normally thereafter.

| Calibration                          | Current value                                                                    | Owning Law / §       | Evidence source for promotion                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1 ε-budget per handle               | ε = 0.1 (Laplace); δ = 1/(10·n_rows)                                             | L1.7 / §3.5 R1       | Supervisor trip rate; observed leak attempts in traces                                                                                |
| R1 composition rule                  | sequential (`Σε_i`)                                                              | L1.7                 | Adaptive query patterns in traces — upgrade to Dwork-Rothblum-Vadhan advanced composition                                             |
| R1 noise mechanism                   | Laplace for ℓ₁ queries; Gaussian for ℓ₂                                          | L1.7                 | Sensitivity-vs-utility tradeoffs observed in S1 / S5                                                                                  |
| R2 uncorroborated-event ratio        | > 5 %                                                                            | L1.8, L3.3 / §3.5 R2 | Variant-log dishonesty signal vs User-acceptance                                                                                      |
| R3 promotion queue depth × age       | depth > 20 OR oldest > 24 h                                                      | L2.6 / §3.5 R3       | Promotion latency telemetry; User-experienced wait time                                                                               |
| R5 sandbox-escape sensitivity        | > 0 escape-signatures                                                            | L1.1, L1.2 / §3.5 R5 | False-positive rate on syscall classes                                                                                                |
| R6 cross-cycle composition vector    | configurable                                                                     | L1.7, L3.4 / §3.5 R6 | Observed composition incidents                                                                                                        |
| R7 gate-overhead %                   | > 60 % rolling 24 h                                                              | L1.6 / §3.5 R7       | Velocity-collapse evidence                                                                                                            |
| R8 LLM trust                         | per-cycle                                                                        | L3.6 / §3.5 R8       | Prompt-injection / model-drift incidents                                                                                              |
| R9 fitness-proxy drift               | configurable                                                                     | L2.12 / §3.5 R9      | Goodhart events observed in selection vs User accept                                                                                  |
| Seed roles                           | Architect, Implementer, Reviewer                                                 | §4.1                 | Pareto-frontier role usage; dominated roles retire                                                                                    |
| Fitness dimensions                   | 7 (Correctness, Efficiency, Cost, Safety, Acceptance, Information cost, Honesty) | §4.4                 | Dimensions that don't discriminate User-accepted vs rejected are demoted                                                              |
| N variants per goal                  | 3                                                                                | §4.5                 | Variant-log diversity vs selection quality                                                                                            |
| Diversity reserve                    | 10–20 %                                                                          | L2.13 / §4.5         | Convergence signal; capability-monoculture detection                                                                                  |
| MAP-Elites behaviour-descriptor axes | concern-tag (§14) × workflow-type × test-pass-count bucket × cost bucket         | §4.5                 | Cells that never receive variants → descriptor under-sampled; cells with no Pareto winners → descriptor under-correlated with fitness |
| Sub-task primitive catalogue (seed)  | sample, aggregate, validate, refine, verify-against-test                         | §4.3                 | Primitive-level fitness attribution across goals → promote/retire candidates                                                          |
| `InMemoryToolRegistry`               | static `tools.yaml`                                                              | §10.1 Q1             | First S2 capability promotion lands → swap to `RegistryBackedToolRegistry`                                                            |
| `CliUserGateway`                     | `bin/user` + 127.0.0.1 HTTP                                                      | §10.1 Q4             | Second User requested → swap to TUI / web / Slack adapter                                                                             |
| stdio MCP `ObservabilityGateway`     | MCP tools                                                                        | §10.1 Q4             | Likely stays MCP; dashboard adapter when read-only viewers needed                                                                     |
| `FileBackedHandle`                   | local file + sidecar yaml                                                        | §10.1 Q6             | S5 sensitive-data fixture → swap to `SqlViewHandle` / `EncryptedHandle` / `SyntheticHandle`                                           |
| Sandbox (Wasmtime/WASI)              | Wasmtime + WASI; CPU / wall / mem budgets; frozen time + seeded PRNG (L3.6)      | §8                   | R5 escape rate, perf cliffs, missing syscalls → fallback to nsjail / microvm; never to plain OS-process                               |

---

## 13. Tech Decisions

Accessible-tech consolidation per §2.11 and §2.12. Each row records a binding-but-revisable choice. Promotion / replacement follows L2.6 + L2.14 (port-swap path); no decision is "permanent."

| Decision        | Choice                                              | Rationale                                                                                                             | Lock-in risk                                                                               | Exit plan                                                                                               |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript (Node) Host; TypeScript + React frontend | Strong type system; wide adoption; shared toolchain across packages                                                   | Low (Node ecosystem)                                                                       | Per-package rewrite if a slice outgrows the runtime                                                     |
| Monorepo        | pnpm workspaces                                     | Shared `node_modules`; fast install; tooling-agnostic                                                                 | Low — `pnpm` ↔ `yarn` / `npm` swap is bounded                                              | Migrate via `package.json` workspace rewrite                                                            |
| Linter          | oxlint (strict)                                     | Speed; tight rule set                                                                                                 | Medium — rule equivalents may differ across linters                                        | Re-baseline under ESLint if needed                                                                      |
| Mutation test   | Stryker                                             | Mature, multi-runner support                                                                                          | Low                                                                                        | Replace with `mutmut`-style runner                                                                      |
| LLM endpoint    | OpenAI-compatible HTTP (default LMStudio)           | Local-first; works with most providers                                                                                | Low — port is `LlmProvider` (§10.1)                                                        | Bind a different adapter at boot                                                                        |
| Sandbox v0      | Wasmtime (WASM/WASI)                                | Strong isolation by construction; small TCB (Hardy); capability-style WASI for filesystem; deterministic + replayable | Low — port is `SandboxExecutor` (§10.1); Wasmtime is one of three production WASM runtimes | nsjail or microvm (firecracker) for workloads WASI cannot model; OS-process only as documented fallback |
| Event store v0  | JSONL on disk                                       | Append-only; trivial; auditable                                                                                       | Low — port is `EventStore` (§10.1)                                                         | SQLite / DuckDB / external time-series store                                                            |
| Outer MCP       | stdio MCP server                                    | Claude Code attaches natively                                                                                         | Low — port is `ObservabilityGateway` (§10.1)                                               | HTTP adapter; web dashboard                                                                             |
| User gateway v0 | CLI + 127.0.0.1 HTTP                                | Cheapest viable adapter                                                                                               | Low — port is `UserGateway` (§10.1)                                                        | TUI / web / Slack adapter                                                                               |
| Data handle v0  | local file + sidecar yaml                           | Cheapest viable adapter                                                                                               | Medium — sensitive data needs encryption-at-rest                                           | `EncryptedHandle` / `SqlViewHandle` / `S3Handle`                                                        |

This table is the source of truth for "what we picked and why." Editing it is itself a substrate change (L0.4) requiring an `AdapterBound` / `Promoted` event.

---

## 14. Per-domain artifact standards

Per §2.11 (Consolidated references) and the user directive: "security documents will not look like production design documents, nor applicative architecture, nor P&L documents." Each concern carries its own ecosystem, tools, and vocabulary; documentation and analysis follow the concern's native conventions rather than flattening to one prose style.

This table is **normative**: when a cycle's `assessmentFrame` (§2.8, L3.9) tags a concern, the produced artifact follows the listed format and uses the listed vocabulary. The L0.4 link-checker validates the artifact's class against the cycle's concern tag.

| Concern                                            | Native artifact formats                                                                                        | Standard tools / specs                                                            | Vocabulary                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Security & threat modelling                        | STRIDE / DREAD tables, attack trees, capability diagrams, dataflow diagrams                                    | Microsoft Threat Modeling Tool, OWASP Threat Dragon, IriusRisk; CVSS for severity | "threat actor", "trust boundary", "asset", "STRIDE category", "attack surface"                                |
| Differential privacy                               | (ε, δ)-DP formulas, composition-theorem statements, sensitivity bounds, mechanism specs                        | OpenDP, Tumult Analytics, Google DP library, IBM diffprivlib                      | "(ε, δ)-DP", "sensitivity", "Laplace / Gaussian mechanism", "advanced composition", "Sparse Vector Technique" |
| Event sourcing / CQRS                              | Aggregate diagrams, command/event flow diagrams, projection schemas, upcaster maps                             | EventStoreDB, Axon, CDC pipelines                                                 | "aggregate root", "command", "event", "projection", "saga", "upcaster"                                        |
| Hexagonal / DDD                                    | Bounded-context map, ubiquitous-language glossary, port/adapter diagrams (driving vs driven)                   | C4 model (Brown), structurizr, Mermaid, PlantUML                                  | "anti-corruption layer", "primary/secondary adapter", "context map", "ubiquitous language"                    |
| Safety engineering                                 | STAMP control-structure diagrams, STPA hazard analysis, FMEA, fault trees, Swiss-Cheese alignment analyses     | Cameo Systems Modeler, custom STPA worksheets, SCADE                              | "control action", "feedback link", "hazardous control action", "latent condition", "aligned holes"            |
| Governance & multi-party protocols                 | TLA+ specs, state-machine diagrams, Ostrom 8-principles checklists                                             | TLA+ Toolbox / TLC / Apalache, Alloy, Coq                                         | "linearizability", "safety property", "liveness", "polycentric governance", "collective choice"               |
| AI safety / agent oversight                        | Capability-eval tables, alignment failure-mode taxonomies, model cards / data cards, evaluation specs          | METR / ARC evals, Anthropic / OpenAI model cards, BIG-bench, HELM                 | "corrigibility", "outer/inner alignment", "deceptive alignment", "RLHF", "scalable oversight"                 |
| Evolutionary computation                           | Variant logs, fitness-landscape plots, behaviour archives (MAP-Elites), Pareto frontiers                       | NEAT-Python, MAP-Elites libraries, custom DSLs                                    | "schema", "genome", "elite", "selection pressure", "behaviour descriptor", "novelty"                          |
| Production / SRE / observability                   | SLO / SLI specs, runbooks, blameless postmortems, dashboard configs, error budgets                             | Prometheus, Grafana, OpenTelemetry, PagerDuty, Sentry                             | "SLI", "SLO", "error budget", "MTTR", "blast radius", "postmortem (blameless)"                                |
| Financial / P&L (cost dimension of fitness — §4.4) | Spreadsheets, projection tables, sensitivity analyses, runway models, unit-economics summaries                 | Excel, Google Sheets, Causal, Pigment; dbt for finance models                     | "burn rate", "runway", "unit economics", "CAC/LTV", "contribution margin"                                     |
| Code review / refactoring                          | Diff with structured PR template; "tidy first?" change-set discipline; pre-commit + pre-push gates (CLAUDE.md) | GitHub PR, Reviewable, lefthook (this repo)                                       | "blast radius", "ratchet", "tidy", "behavioural change"                                                       |
| Documentation / technical writing                  | Diátaxis quadrants (tutorial / how-to / reference / explanation), ADRs                                         | mkdocs, Docusaurus, ADR templates, Diátaxis framework                             | "ADR (Architecture Decision Record)", "diátaxis quadrant", "reference vs how-to"                              |

**Picking the format.** §2.8 (Assess before executing) and L3.9 require every work item to declare its concern. §14 then prescribes the artifact class. A cycle whose concern is "data-handle leak hardening" produces STRIDE + (ε, δ) artifacts, not prose. A cycle whose concern is "promoter handshake correctness" produces a TLA+ snippet, not a sequence diagram. A cycle whose concern is "Phase-1 incident review" produces a blameless postmortem, not a feature spec.

**When a cycle spans concerns.** Use each concern's native format for the section it owns. Do not flatten. Cross-references (per §2.11) tie the sections back together.

**This table is itself versioned.** Adding a concern, a tool, or a vocabulary item is a substrate change (L0.4); the link-checker validates that every concern referenced in any `assessmentFrame` is rowed here.

---

## Appendix A — Glossary

The ubiquitous language (Evans) for this SPEC. Alphabetical. Linked from §0; the body assumes these definitions.

- **Actor.** A privileged identity emitting and receiving events. §1 enumerates four: Claude (outer observer), Georges (inhabitant), User (external requester), and the External Witness (constitutional third party). The Supervisor and Monitor are _Host-side processes_ with the actor tag `supervisor` / `monitor` (L3.7); they are first-class for tracing but not constitutional.
- **Adapter.** Concrete implementation of a port (L2.14). Bound at boot. Lives under `packages/host/src/adapters/driving/` or `packages/host/src/adapters/driven/`. Adapter swaps emit `AdapterBound` events.
- **Anti-corruption layer.** Translation seam between bounded contexts (Evans). The inner MCP, `UserGateway`, and `ObservabilityGateway` are the SPEC's three anti-corruption layers (§6).
- **Assessment frame.** The structured pre-flight every cycle's goal carries (L3.9, §2.8): success criteria, concern tag (§14), experts/prior-art consulted, existing-tool search, risk/ROI/lock-in, measurement plan.
- **Behaviour archive.** MAP-Elites-style archive of variants by behaviour descriptor (§4.5). Preserves stepping stones; counterweight to Pareto convergence.
- **Blast radius.** Scope of what a change can affect. Used to size sanctions (§6 graduated ladder) and to qualify `DelegatedPromotionPolicy` criteria.
- **Bootstrap (`bootstrap=true`).** A calibration ships as a defensible default with the `bootstrap` flag; refinement comes from operational evidence under L3.8. The flag clears on the first evidence-based promotion. §12 enumerates current bootstraps.
- **Bounded context.** A region where a model is valid (Evans). The Host's internal model, Georges' inhabitable space, the User's view, the Witness's view, and Claude's outer-loop view are five bounded contexts; each translates at its boundary.
- **Capability.** A versioned tool Georges can call (§2.5, L2.7). Carries manifest + code + policy + tests + provenance (L2.9). New capabilities enter via `propose-capability` (S2) → promotion.
- **Claude.** In this SPEC: the outer-observer actor; not to be confused with the AI coding agent ("Claude Code") that helps developers edit this repo (see §1 footnote).
- **Concern (per §14).** A domain of expertise (security, DP, event sourcing, …) whose native artifact format, tools, and vocabulary apply when a cycle's `assessmentFrame` tags it.
- **Constitutional amendment.** A Tier-1 law change. Requires `ConstitutionalAmendment` event signed by Claude + User-of-record + External Witness (L0.2).
- **Correlation.** The grouping id linking all events of a single goal/cycle. Set at goal submission (L3.1) and inherited by every subsequent event.
- **Corroborator.** A Host-side observer paired with each Georges-emitted claim (L1.8). Without a corroborator the claim is tagged `uncorroborated` and excluded from fitness.
- **Cycle.** One pass of the inner loop: a goal becomes a series of role performances and tool calls until success, rejection, budget exceedance, or quarantine.
- **Data handle (Handle).** Opaque reference to a dataset Georges receives in lieu of bytes (§10.1 Q6). Exposes schema, redacted sample, and `runScript` with a DP budget (L1.7). Lifecycle: registered, revoked, expired, exhausted.
- **Delegated promotion policy.** Claude-signed policy that the Supervisor may execute to auto-promote low-blast variants (L2.6). Keeps the promoter-of-record as Claude while letting the Supervisor handle volume.
- **Differential privacy (DP).** Mathematical framework bounding what an aggregate reveals about the underlying data (L1.7). Per-handle (ε, δ) budget; Laplace/Gaussian noise mechanisms; composition theorems (Dwork-Roth).
- **Diversity reserve.** Fraction of variants sampled outside the current Pareto best (L2.13, §4.5).
- **Driving port / Driven port.** Cockburn's hexagonal distinction. _Driving_ = outside calls in (User, Claude). _Driven_ = Host calls out (data, LLM, sandbox, events, tools, workspace). L2.14, §10.1.
- **Event store.** Append-only log of every actor interaction (L1.4, §9). The system's memory; basis for replay (L3.6).
- **External Witness pool.** Three independent humans outside the User/Claude trust domain (§6, L0.5). 2-of-3 quorum co-signs `ConstitutionalAmendment` and Kernel rotations; receives Supervisor/Monitor divergences; arbitrates User appeals against Claude.
- **Fitness vector.** Multi-dimensional score per variant (§4.4). Selection acts on Pareto frontier, not on a scalar.
- **Georges.** The AI inhabitant (§1). Single actor identity; impersonates versioned roles within a cycle (L2.10).
- **Goal.** The User-submitted intent that starts a cycle (L3.1). Anchors the correlation id and the assessment frame (L3.9).
- **Host.** The privileged process that enforces every law (L1.1). Georges' agency is mediated entirely through the Host's inner MCP.
- **Idle tick.** Host-scheduled self-improvement window when no User goal is active (S4, L3.4).
- **Inner MCP.** The tool surface Georges can call. The only RPC channel he sees (L1.1).
- **Kernel (Inviolable).** A small signed subset of the SPEC (actor model + TCB adapters + corroboration discipline + External Witness) that cannot be amended through normal promotion paths (L0.5). Amendment requires three-key rotation + unanimous re-signing.
- **Law (L#.#).** A SPEC invariant the Host enforces in code (§3). Tier 0 = meta; Tier 1 = constitutional; Tier 2 = operating; Tier 3 = synergy. Each has an enforcement module mapped per L0.1.
- **Long-lived key.** A signing key held by one of the three Kernel-signing parties (Claude, User-of-record, External Witness). Used for `ConstitutionalAmendment` and Kernel artifacts (L0.5).
- **Managed workspace.** The mounted git repo Georges treats as durable memory (L3.5). Branched per session; sub-branched per variant (§4.5).
- **MAP-Elites.** Algorithm maintaining a grid of variants by behaviour descriptor (Stanley/Mouret). Used in the behaviour archive (§4.5).
- **Monitor.** Out-of-process actor that recomputes a subset of Supervisor signals from the event store (L3.7, L3.10). Emits `SupervisorDivergence` on disagreement.
- **Mutability scope.** The slice of the managed workspace a role may write (L2.2, §4.1). Widening requires promotion (L2.6).
- **Outer MCP.** The `ObservabilityGateway` Claude attaches to (§10.1 Q4). Read-mostly; promote/rollback wired in Phase 4.
- **Pareto dominance.** Variant A dominates B iff A ≥ B on every fitness dimension and A > B on at least one. Selection prefers the Pareto frontier (§4.5).
- **Port.** Typed interface between Host code and the outside (L2.14). Driving or driven. Lives under `packages/host/src/ports/`.
- **Promoter.** The single actor authorised to emit `Promoted` events for a substrate scope (L2.6). Default: Claude. Tier-1: three signatures (L0.2).
- **Quarantine.** Cycle halt due to repeated failure (L2.3). Soft = Supervisor auto-releases on new evidence; hard = Claude-only release. Step 2–3 of the §6 sanctions ladder.
- **Ratchet.** A quality gate that only tightens (L2.4); loosening requires Claude-signed rollback OR first-time bootstrap promotion.
- **Replay.** Re-running a cycle from the trace alone (L3.6). Deterministic up to LLM seed; sandbox time and PRNG frozen.
- **Risk Register.** §3.5 table of live Supervisor signals with thresholds, cadences, actions. Versioned (L0.2).
- **Role.** Versioned persona Georges impersonates within a cycle (§4.1, L2.10). Carries prompt + tool surface + mutability scope + output schema + fitness signal.
- **Sandbox executor.** Driven port (§10.1) for code execution. Bootstrap adapter: Wasmtime + WASI (§13). Frozen time + seeded PRNG by default (L3.6).
- **Session.** The container for all cycles of a single User interaction. Has its own workspace branch (L3.4) and aggregated budget (§4.6).
- **Story (S#).** A use-case canonical pattern enumerated in §5. Every event carries `storyRef` (L2.5) so traces are self-classifying.
- **Sub-task primitive.** Finer-grained recombination unit within a workflow (§4.3). Holland's schema theorem: good primitives propagate when selection acts at the primitive level.
- **Substrate.** Everything the Host enforces — laws, ports, adapters, policies, registries, the Kernel. What Claude builds and what Georges inhabits.
- **Supervisor.** Host-side daemon computing Risk Register signals (L3.7). Watched by the Monitor for cross-domain corroboration (L3.10).
- **Synergy.** A productive multi-actor interaction (§6). The SPEC frames synergy as the _residue_ of constraints holding simultaneously, not as something to be optimised.
- **TCB (Trusted Computing Base).** The set of components whose correctness the safety claims depend on (Hardy). The Kernel (L0.5) is the SPEC's TCB minimum.
- **Tech decision.** A binding-but-revisable technology choice rowed in §13 with rationale, lock-in risk, exit plan.
- **Trace.** The event log of a cycle / session. The system's memory (§9).
- **Trust domain.** A boundary of mutual trust (Reason, Miller). Tier-1 enforcement must span multiple trust domains (L3.10) so a single compromise doesn't fail every defence.
- **Variant.** One attempt at a goal — same workflow, different parameters (§4.3). N variants per goal; selection is Pareto + behaviour-archive (§4.5).
- **Workflow.** A DAG of role performances (§4.2). Versioned artifact. Composing one is a substrate change (L2.6).
