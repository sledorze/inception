# EXPERTS — Field consultations on `docs/SPEC.md`

A two-pass expert review of the AI-Native Factory SPEC. Per §2.8 (Assess before executing) and §2.11 (Consolidated references), this document consolidates outside-perspective critique so insights compound rather than scatter.

**Method.** Eight fields the SPEC engages with. Three prominent experts per field. For each expert: their contributions and characteristic mindset, then what they would likely say about this SPEC if it crossed their desk. Then trends within the field. Then trends across all eight fields. Then a _re-assessment_ — how each cluster would update its critique after seeing the others'. Then a summary and a final challenge.

**Caveat.** These are imagined personas drawn from each expert's public writing — papers, books, talks, blog posts. They are interpretations, not endorsements. Where an expert is deceased (Shannon, Holland, Hardy, Reason) the persona is anchored in published work. Where alive (Russell, Bengio, Christiano, Miller, Lamport, Kleppmann, Young, Helland, Cockburn, Evans, Beck, Dwork, Roth, Stanley, Forrest, Leveson, Cook, Ostrom, Liskov), the persona aims at what their published positions would extrapolate to. Treat each as a useful steelman, not a quote.

---

## Fields covered by the SPEC

| Field                                                    | SPEC engagement                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. AI safety & agent oversight                           | §1 actors, §3 Tier 1 laws (L1.5, L1.8), §4 fitness, S2/S4/S7 stories |
| 2. Capability-based security & sandbox isolation         | L1.1, L1.2, L1.3, L2.10, §8, §10.1 Q6                                |
| 3. Event sourcing & observability                        | L1.4, L2.5, L3.6, §9, §10.1 Q4                                       |
| 4. Hexagonal architecture / Ports & Adapters / DDD / TDD | L2.14, §10.1, §11                                                    |
| 5. Differential privacy & information theory             | L1.3, L1.7, R1, R6, §10.1 Q6                                         |
| 6. Evolutionary computation & open-ended search          | §4 roles/variants/selection, L2.13                                   |
| 7. Safety engineering & resilience                       | §3.5 Risk Register, L3.7, L2.3, §7                                   |
| 8. Multi-actor governance & formal protocols             | L0.2, L2.6, L0.3, §6 synergies                                       |

---

## Field 1 — AI safety & agent oversight

The SPEC is _about_ this field at its core: an AI inhabitant (Georges) with a human overseer (Claude) and an external User. Laws L1.4 (Traceability), L1.5 (Reversibility), L1.8 (Corroboration), L2.6 (Single Promoter), L3.2 (User Acceptance), L3.3 (Honest Reporting) are recognisably AI-safety primitives.

### Stuart Russell

**Contributions & mindset.** Author of _Human Compatible_ (2019); proposed the "standard model" of AI as flawed (objective given, optimise hard) and the alternative: AI uncertain about human preferences (Cooperative Inverse Reinforcement Learning), corrigible, deferential. Builder of CHAI at Berkeley. Insists on three principles: AI's only objective is human preference satisfaction; AI is uncertain about what those preferences are; the ultimate source of information about preferences is human behaviour.

**What he would say about this SPEC.** "You have built a beautiful enforcement substrate for an AI whose objective function is given. The fitness vector (§4.4) is the objective. The bootstrap-and-promote loop (L3.8) means the objective evolves — but evolves toward Pareto-dominance of a _fixed_ set of dimensions. Who decides what 'Acceptance' means? You wrote 'User accept/reject signal' — but the User's acceptance is itself shaped by what Georges presents. There is a reflexive shaping risk: Georges learns _which framings get accepted_ rather than _which outcomes satisfy preferences_. The L1.8 corroborator helps with honesty about actions, not honesty about whether what was produced is actually what the User wanted. The Pareto frontier optimises proxies. Where is the preference-uncertainty modelled in Georges? Where is the explicit place for the User to _correct the objective itself_, not just reject a variant?"

### Paul Christiano

**Contributions & mindset.** Former Anthropic alignment lead, founder of METR (formerly ARC). Originated Iterated Distillation & Amplification (IDA), Reinforcement Learning from Human Feedback (RLHF) for language models, and the framing of _scalable oversight_: how do you supervise an AI whose outputs are too complex for a human to evaluate directly? Increasingly focused on capability evaluations and slow takeoff.

**What he would say about this SPEC.** "L1.8 (Host Corroboration) is the right instinct: don't trust Georges' self-narration; pair it with an outside observer. But your corroborator is the Host process — the same code Claude wrote, running in the same trust domain. When Georges grows capable enough to subtly influence what the Host observes (selecting which traces are emitted, gaming the entropy estimator), corroboration collapses to self-trust by another name. Real scalable oversight needs _debate_ between two Georges instances on each others' outputs, or _factored cognition_ where Georges' work is decomposed so each piece is small enough for a human reviewer. You hint at this with L2.13 (diversity reserve) but don't go far enough. Also: L3.6 (replay determinism) is necessary but not sufficient for debugging — you need _interpretability tools_ to inspect _why_ Georges produced a given output, not just the inputs that led there."

### Yoshua Bengio

**Contributions & mindset.** Turing-Award co-recipient (with Hinton and LeCun); MILA founder; recently shifted toward AI risk, advocating "AI Scientist" approaches that produce _understandable hypotheses_ rather than opaque action policies. Strong public position: cap autonomous agency until alignment is solved.

**What he would say about this SPEC.** "You have built exactly the kind of self-improving substrate (S4, L3.8) that I argue should not exist yet. The risk is not in any single law; the risk is that the _combination_ — Georges proposing capabilities (S2), idle-time self-edits (S4), variant log driving promotion (L2.12) — is a _self-modifying agent loop_ with humans in the loop only on a delay (Claude's review pass is asynchronous). L2.2 (Bounded Mutability) is the right structural answer, but the manifest is itself a versioned artifact that L0.2 says can be amended. Where is the _inviolable safety kernel_ — the subset of behaviour that no L3.8 promotion can ever weaken, no `bootstrap=true` carve-out can touch, no User can override? You have L1 (Constitutional), but L0.2 says even Tier 1 can be amended (with a stricter gate). If the goal is to demonstrate safety, ship a smaller kernel that is _literally unamendable_ in this version and grow from there."

#### Trends in Field 1

All three press on what is _outside_ the SPEC's enforcement: the choice of objective itself. Russell asks where preferences come from; Christiano asks how corroborators stay trustworthy as Georges grows; Bengio asks where the inviolable kernel is. All three would accept the SPEC as Phase 0 — but flag that the SPEC defines the _substrate of safety enforcement_, not the _content of safety_.

#### Re-assessment in Field 1

After seeing the security cluster (Field 2), the safety cluster would tighten: "the inviolable kernel must include a _small Trusted Computing Base_ in the Hardy sense — not just unamendable laws, but an unamendable enforcement _layer_." After seeing the DP cluster (Field 5), they would say: "the entropy estimator being folklore is a safety-critical bug; the privacy bound is part of the corrigibility story." After seeing the governance cluster (Field 8), they would say: "the inviolable kernel needs _polycentric_ sign-off, not Claude-and-User-of-record alone — Ostrom's design principles imply at least a third independent monitor."

---

## Field 2 — Capability-based security & sandbox isolation

L1.1 (Mediation), L1.2 (Containment), L1.3 (Code-over-Data), L2.10 (Role tool surface), §8 (Isolation Guarantees) and §10.1 Q6 (`DataHandle` port) are recognisably capability-security primitives.

### Mark S. Miller

**Contributions & mindset.** Father of object-capability security in user-space: designed E, Caja (capability-safe JavaScript), led capability work at Google and Agoric. Mantra: _POLA — Principle of Least Authority_. Every program has only the rights it needs; rights are first-class objects (capabilities); no ambient authority anywhere; capabilities can be _attenuated_ (a weaker version handed to a less-trusted callee) and _revoked_.

**What he would say about this SPEC.** "L1.2 (Containment) and L1.3 (Code-over-Data) are POLA in spirit. But your capabilities are not first-class enough. A `DataHandle` is one capability with one policy — it cannot be _attenuated_. If Georges needs to read only column X of a handle, he must hold the full handle and trust himself to query column X. The right primitive is: Georges can derive a _weaker handle_ from a stronger one, restricted to column X, and pass that to a sub-task — and the Host enforces the restriction. Similarly for `ToolRegistry`: a role's tool surface is the union of allowed tools, not an attenuated capability handed in by the workflow. And `revoke` (now in your port, good) needs to be _transitive_ — if a derived handle was passed to a sub-task, revoking the parent must close the child. CSP-style protocols on every port (Hoare's point) make these guarantees provable."

### Norm Hardy

**Contributions & mindset.** Architect of KeyKOS (1980s capability OS at Tymshare), later EROS / Coyotos / KeyKOS-derivatives. Built a TCB (Trusted Computing Base) so small it could be hand-verified. Insisted on the _factor of 1000_ — the difference between a 10 KLOC TCB and a 10 MLOC OS-as-TCB is the difference between a verifiable system and a hopeful one.

**What he would say about this SPEC.** "Your TCB is the Host process plus the entire Linux kernel plus glibc plus the Node.js runtime plus every NPM dependency. That is not a TCB; that is the universe. Process-level sandbox is acceptable as a _pre-prototype_ but you cannot make the safety claims of L1.1, L1.2, L1.3 against it. Sandbox-escape (R5) is not a tail risk; it is the median outcome of any motivated adversary because the surface area is megabytes of C. Ship WASM (or nsjail / a real syscall-filter sandbox) in Phase 1, not as `[parked]`. Until then, the SPEC's strong language about isolation is aspirational and the trust claims compound on a falsehood."

### Tony Hoare

**Contributions & mindset.** Designed Quicksort, CSP (Communicating Sequential Processes), formal correctness of programs via Hoare triples; invented the null reference and famously called it his "billion-dollar mistake." Mindset: _protocol_ matters as much as _type_. Two systems with the same type signatures may have entirely different valid sequences of operations; type-checking misses sequencing bugs.

**What he would say about this SPEC.** "Your ports (L2.14) define types. CSP would define _protocols_: the legal sequences of method calls on each port. `DataHandle.runScript` after `revoke()` is currently undefined behaviour — should be a protocol violation, structurally rejected. `EventStore` writes after `SessionClosed` — same. `ToolRegistry.invokeTool` after `unregister` — same. Write each port's protocol as a CSP process; type-checking the port shape catches half the bugs, protocol-checking catches the other half. Also: L0.1 (Codified Constraint) is the right meta-law, but constraints today are stated in English and bound to modules. Bind them to _executable protocol specs_ — TLA+ or CSPm — and the SPEC becomes a verifiable artifact, not a documentation artifact."

#### Trends in Field 2

All three converge on: _the SPEC has the right vocabulary but is missing the operational rigour of the capability tradition_. Miller wants attenuation and first-class capabilities; Hardy wants a small TCB; Hoare wants protocols on every port. The common subtext: capability security is forty years old; the field knows how to do this, and the SPEC borrows the prose but not the discipline.

#### Re-assessment in Field 2

After seeing the safety cluster (Field 1), they would say: "this is what 'inviolable kernel' means in practice — the TCB _is_ the kernel. Make it small enough to verify; everything Georges does is non-TCB." After seeing the governance cluster (Field 8), they would add: "capability _revocation_ is the basis of conflict resolution — the User of Ostrom's commons can revoke a misbehaving member's access. Wire revocation through to L2.6 (delegated promotion) so a bad `DelegatedPromotionPolicy` can be killed instantly."

---

## Field 3 — Event sourcing & observability

L1.4 (Traceability) makes events the system's memory. §9 defines the schema. L3.6 (Replay) and the §10.1 Q4 `ObservabilityGateway` make the trace the substrate of outer-loop learning.

### Martin Kleppmann

**Contributions & mindset.** _Designing Data-Intensive Applications_ (2017) — the standard reference for modern data systems. Researcher on local-first software and CRDTs. Believes systems are built on a handful of primitive abstractions (logs, indexes, replication, partitioning) and most architectures are recombinations of these. Pragmatic about consistency tradeoffs.

**What he would say about this SPEC.** "JSONL-on-disk as v0 is fine — append-only files are the simplest event log. But your SPEC makes claims (L3.6 replay, L2.5 storyRef filtering, L1.4 immutability) that the v0 adapter cannot really back. Append-only on disk is not tamper-evident unless you hash-chain or sign. 'Immutable' under L1.4 means no actor can mutate the past _through the SPEC's actor model_ — but a shell user with write access can. Decide: is the immutability claim about _protocol_ (no actor has a mutate API) or _substrate_ (the storage refuses mutation)? They are different and the SPEC conflates them. Also: schema evolution. Event kinds will grow; old events will lack fields the new code expects. You need an explicit schema-versioning + migration policy or every replay becomes a museum-piece reconstruction. GDPR / right-to-erasure: append-only conflicts with deletion; the standard answer is _crypto-shredding_ (encrypt PII with a per-subject key; delete the key to render the event unreadable while preserving its structural place in the chain). This belongs in the trace model."

### Greg Young

**Contributions & mindset.** Coined and popularised CQRS (Command Query Responsibility Segregation) and modern event sourcing. Author of _Versioning in an Event Sourced System_. Mantra: events are _facts about the past_; never to be re-shaped. Snapshots are how you keep replay tractable.

**What he would say about this SPEC.** "Good: events are the source of truth (L1.4). Bad: replaying every event from session start to reconstruct state will eat you alive when sessions get long. You need snapshots — periodic materialised views of state, with the invariant that 'last snapshot + events since' = 'full replay'. Also: your event kinds list is good but doesn't address _what state the events project to_. A `Promoted` event projects to the capability registry; a `HandleExhausted` event projects to the per-handle ledger. Define the projections; they are the API the rest of the Host reads from. Otherwise every consumer re-implements its own scan logic and they drift. Finally: versioning. Every event kind needs a `v` field. Renaming a field is a new version. Upcasters (functions that read old versions and emit new) are part of the trace model, not an afterthought."

### Pat Helland

**Contributions & mindset.** Long career at Microsoft, Amazon, Salesforce. Author of canonical essays — _Life Beyond Distributed Transactions_, _Immutability Changes Everything_, _Data on the Outside vs. Data on the Inside_. Specialty: thinking carefully about what state lives where, who sees it, and how it propagates.

**What he would say about this SPEC.** "Your `DataHandle` is _data on the outside_ — opaque references with policies, owned by someone else, immutable from Georges' view. Your managed workspace is _data on the inside_ — Georges' own state, mutable, owned by his session. The two demand different consistency models: handles are referentially transparent (same handle id always denotes the same logical dataset, even if the underlying file changed — the change is a new handle), while workspace artifacts are mutable and need versioning _internal_ to the session. The SPEC doesn't draw this distinction sharply. Also: idempotency. Network calls fail. If `runScript` retries, does it debit the info-ledger twice? You need request keys on every mutating operation so that retries are detectable. This applies to every port that crosses a boundary."

#### Trends in Field 3

All three push on the same theme: _the event model in §9 is a shape, not a discipline_. Kleppmann wants schema versioning, tamper-evidence, GDPR plans. Young wants snapshots, projections, and event versioning. Helland wants distinctions between inside/outside data, and idempotency. The common subtext: event sourcing is hard; you do not get to skip the disciplines just because the v0 adapter is JSONL.

#### Re-assessment in Field 3

After seeing the security cluster (Field 2), they would add: "tamper-evidence (Merkle hash-chain on events) is also a capability primitive — the chain is itself a capability that Claude holds, the system verifies." After seeing the safety cluster (Field 1), they would add: "the corroboration honesty problem (Christiano's point) is partly an event-versioning problem — when corroborator schema drifts from claim schema, pairing silently breaks. Fix the schema discipline and you close that hole."

---

## Field 4 — Hexagonal architecture / Ports & Adapters / DDD / TDD

L2.14 is literally hexagonal architecture. §10.1 names ports and adapters. §11 demands tests paired with laws. The SPEC reads as if Cockburn, Evans, and Beck collaborated on it.

### Alistair Cockburn

**Contributions & mindset.** Originator of Ports & Adapters / Hexagonal Architecture (2005). Builder of the Crystal family of methodologies. Distinguishes _driving_ ports (the outside calls in — e.g., UserGateway, ObservabilityGateway) from _driven_ ports (the inside calls out — e.g., DataHandle, LlmProvider, EventStore). The distinction matters: driving adapters live in the application's input layer; driven adapters live in the output layer; the application core depends on neither.

**What he would say about this SPEC.** "L2.14 is the right discipline. But the SPEC mixes driving and driven ports without naming the distinction. `UserGateway` and `ObservabilityGateway` are driving (the User and Claude call in). `DataHandle`, `LlmProvider`, `SandboxExecutor`, `EventStore`, `ToolRegistry`, `WorkspaceMount` are driven (the Host calls out). Rename §10.1 to separate the two; rename the directory `packages/host/src/ports/driving/` and `packages/host/src/ports/driven/`. The dep-cruiser rule then enforces: application code may depend on either port set; adapters live in `adapters/driving/` and `adapters/driven/` and may not import each other; tests live in `tests/driving/` and `tests/driven/` and exercise the application core through driving ports while mocking driven ports. This is the architecture you have _implicitly_; making it explicit prevents drift."

### Eric Evans

**Contributions & mindset.** Author of _Domain-Driven Design_ (2003). Mantras: _ubiquitous language_ (the team speaks the domain's vocabulary, code and prose alike); _bounded context_ (a model is valid only within a context — different contexts can have different models of the same concept); _anti-corruption layer_ (the boundary between contexts translates rather than leaks).

**What he would say about this SPEC.** "Where is the glossary? You use 'cycle', 'session', 'correlation', 'story', 'goal', 'tick', 'variant', 'role', 'capability', 'handle', 'mutability scope', 'substrate' — each load-bearing, each defined informally in different sections. A six-month-later reader (or a new contributor, or you) will conflate them. Ship a §0 or appendix glossary, alphabetical, one paragraph per term. Then: bounded contexts. The Host, Georges' inhabitable space, the User's view, and Claude's outer-loop view are four bounded contexts. They share concepts (e.g., 'goal') but mean different things by them: a goal-in-the-User-view is a request; a goal-in-Georges-view is a correlation root; a goal-in-Claude-view is a unit of fitness measurement. The anti-corruption layers between contexts (UserGateway, inner MCP, ObservabilityGateway) translate one concept into another. Naming these translations prevents the inevitable 'why does Georges see this differently than the User' debugging session."

### Kent Beck

**Contributions & mindset.** Originator of Extreme Programming, TDD, and recently _Tidy First?_ — the discipline of separating refactors from feature work. Mantras: _make it work, make it right, make it fast_ (in that order); _the simplest thing that could possibly work_; _kill your darlings_.

**What he would say about this SPEC.** "Phase 1 has 9 items for the S1 vertical slice. You could ship a smaller demo: items 1.6 (event store) + 1.7 (data handle) + 1.8 (sandbox), with a _hand-written_ script (no LLM, no User gateway, no observability MCP) — and demonstrate the code-over-data primitive end-to-end. That is the _kernel_ of the factory. Everything else (UserGateway, LlmProvider, ToolRegistry, ObservabilityGateway, WorkspaceMount) is decoration on the kernel. Ship the kernel first; you will learn what the surrounding layers really need to be by working backward from the trace. Also: §11 wants paired tests per law. Good. But your test discipline says nothing about _mutation testing on the law tests_. If a law test passes on a broken enforcement, the law-test pair is theatre. Add mutation testing on `packages/host/tests/laws/` to the ratchet (L2.4)."

#### Trends in Field 4

All three say the same thing in different vocabularies: _the SPEC has the right architecture but is not yet operationalised at the level of naming, glossary, and incremental delivery_. Cockburn wants driving/driven separation; Evans wants a glossary and bounded-context map; Beck wants the kernel-first delivery and mutation-tested tests-of-laws. None object to the structure; all want it sharpened.

#### Re-assessment in Field 4

After seeing the security cluster (Field 2), they would add: "the bounded-context map is also the security-context map — each context has its own TCB and capability set." After seeing the safety cluster (Field 1), they would add: "kernel-first delivery (Beck) also bounds the safety claim — the SPEC can only claim safety properties it has tests for, today; everything else is aspirational." After seeing the governance cluster (Field 8), they would add: "the glossary belongs in the constitution (L0.2), not in an appendix — Ostrom's design principles require a shared vocabulary among commons participants."

---

## Field 5 — Differential privacy & information theory

L1.3 (no raw bytes), L1.7 (info budget per handle), R1 (bits-out signal) and R6 (cross-cycle composition) make information leakage a first-class concern. The SPEC borrows the _language_ of information theory; the field has the _math_.

### Cynthia Dwork

**Contributions & mindset.** Co-inventor of differential privacy (2006); the field's senior author. Frame: a randomised algorithm M is (ε, δ)-differentially private if for any two datasets differing in one record, and any output set, `Pr[M(D1) ∈ S] ≤ exp(ε)·Pr[M(D2) ∈ S] + δ`. Composition theorems: running k mechanisms each (ε, 0)-DP yields (kε, 0)-DP. The whole framework is about giving rigorous, composable, mathematical guarantees on what an aggregate can reveal.

**What she would say about this SPEC.** "Your L1.7 bootstrap estimator is folklore. `min(bytes×8, log2(distinct+1)×rows)` is not an information-theoretic bound on what Georges learns about the underlying data; it is a bound on the _size_ of the aggregate, which is not the same thing. A 4-byte aggregate '42' can reveal arbitrarily much if it is the median of a known-uniform distribution. The right framing is (ε, δ)-differential privacy: every `runScript` adds Laplace or Gaussian noise calibrated to the _sensitivity_ of the query, and debits an ε-budget. Composition is _additive on ε_, not multiplicative on bytes. R6 (cross-cycle composition) is precisely the place where the advanced composition theorem applies: `sqrt(2k·ln(1/δ')·ε^2)` after k queries, not naive summation. Without this, L1.3's 'central security promise' is a promise you cannot keep against a motivated adversary."

### Aaron Roth

**Contributions & mindset.** Co-author of _The Algorithmic Foundations of Differential Privacy_ (2014). Specialty: composition, post-processing, and the _Sparse Vector Technique_ (efficient adaptive queries). Frame: privacy is a budget you spend; the question is always how to spend it on the most informative queries.

**What he would say about this SPEC.** "Concur with Cynthia. Add: the SPEC treats handles as one-time resources (`infoBudgetRemaining()`) but doesn't think about _adaptive_ querying — Georges sees the output of `runScript` and chooses the next script based on what he learned. Adaptive composition is harder than non-adaptive; the bounds are tighter. The Sparse Vector Technique lets you answer many adaptive queries with a single ε-cost provided most queries return 'no' to a threshold. Georges' workflow looks like 'find columns with skew', 'find correlations', 'find outliers' — all threshold-style queries. There is a tailored mechanism here; using it would let you keep the SPEC's per-handle cap while serving more queries. Worth a paper, worth a Phase-2 capability."

### Claude Shannon

**Contributions & mindset.** Founder of information theory (1948). Conditional entropy `H(X|Y)` measures information about X given knowledge of Y. Mutual information `I(X;Y) = H(X) - H(X|Y)`. Channel capacity. Source coding. Mindset: _information is a property of the source distribution relative to the receiver's prior_, not an intrinsic property of bytes.

**What he would say about this SPEC.** "The estimator `log2(distinct+1)` measures distinctness, not information. Information is conditional on what the receiver already knows. If Georges has the schema, the conditional entropy `H(aggregate | schema)` is the right quantity; if Georges has previous aggregates, it is `H(new aggregate | schema, previous aggregates)`. The latter shrinks as Georges accumulates knowledge — the per-call debit should _grow_ with the receiver's accumulated prior, not stay constant. This is exactly Dwork's adaptive composition argument re-stated in classical information-theoretic terms. Either framework is rigorous; pick one and apply it."

#### Trends in Field 5

All three flatly reject the bootstrap entropy estimator. The SPEC's L1.7 is the _right place_ for a privacy bound; the bound is _wrong_. The whole field has built rigorous mathematics for exactly this problem; the SPEC ignores it. None of the experts would block Phase 0 on this — but all would treat it as the top _technical-correctness_ gap in the SPEC.

#### Re-assessment in Field 5

After seeing the security cluster (Field 2), they would add: "the DP mechanism is a _capability_ — `DataHandle` should expose an ε-aware query method, not a free `runScript`. Miller's attenuation applies: deriving a 'low-ε' sub-handle is the right primitive." After seeing the safety cluster (Field 1), they would add: "DP gives you a _provable_ corrigibility property: even if Georges is adversarial, the per-handle ε-bound caps what he can ever learn. This is the right form of L1.3's 'central security promise'."

---

## Field 6 — Evolutionary computation & open-ended search

§4 (Roles, Workflows, Variants, Selection) is recognisably an evolutionary architecture. Fitness vector, Pareto frontier, diversity reserve, retirement candidates — these are evolutionary-algorithm primitives.

### John Holland

**Contributions & mindset.** Founder of Genetic Algorithms (1975); the _schema theorem_ — short, low-order, high-fitness schemata (substructures of the genome) propagate exponentially through the population. Mindset: evolution succeeds when good _building blocks_ can be discovered, combined, and reused. Granularity of representation matters.

**What he would say about this SPEC.** "Your variants are whole workflows. That is too coarse — selection acts on the whole, not on the discovered substructures. A variant might be excellent at sub-task A and terrible at sub-task B; selection sees only the aggregate. The schema theorem doesn't fire because there are no short, recombinable schemata. Decompose. Identify sub-task primitives — 'check schema', 'sample rows', 'compute aggregate', 'verify against test' — and let variants differ at the _primitive_ level. The fitness signal then attributes to primitives, and good primitives propagate. Otherwise you are doing very expensive whole-organism mutation, which works but slowly."

### Kenneth Stanley

**Contributions & mindset.** Originator of NEAT (NeuroEvolution of Augmenting Topologies), novelty search, MAP-Elites, and _open-ended evolution_. Author of _Why Greatness Cannot Be Planned_ (with Joel Lehman): great achievements rarely come from optimising for an objective; they come from _stepping stones_ discovered while exploring. Novelty search outperforms objective-directed search on hard, deceptive problems.

**What he would say about this SPEC.** "L2.13 (Diversity Reserve, 10–20 %) is the right instinct but the wrong dose. For open-ended discovery you need to _replace_ much of objective-directed selection with novelty-directed selection. The Pareto frontier of fitness is a local-optimum trap when the fitness function is itself imperfect (R9). Instead: maintain a _behaviour archive_ — variants kept for their _behavioural distinctness_, regardless of fitness. The MAP-Elites approach: partition the behaviour space into cells, keep the best variant in each cell, search proceeds by mutating archived variants. Your variant log (L2.11) is the perfect substrate for an archive; you just need the cell axes. Diversity then becomes structural, not a percentage."

### Stephanie Forrest

**Contributions & mindset.** Pioneer of _artificial immune systems_ (AIS); applies biological-immunity metaphors to computer security. The immune system learns _self_ through negative selection (cells that match self are killed in the thymus); what remains can only flag non-self. Translates to computer security: train detectors on normal traces; anything they fire on is anomalous.

**What she would say about this SPEC.** "L1.8 (Host Corroboration) is negative selection: the corroborator learns what 'normal' tool execution looks like; Georges' claims that don't match are flagged. Good instinct. But your corroborator is _hand-built_ and _static_ — it is the immune system of a fetus, not an adult. Make it adaptive: as the system runs, the corroborator's notion of 'normal' updates from accumulated traces; novel patterns trigger review. Also: immune systems have _negative selection followed by clonal expansion_ — when a detector fires, it gets copied and refined. Your Supervisor (L3.7) fires on Risk-Register signals — but those signals don't expand or refine. Add a learning loop on the Supervisor itself. Otherwise it is a static rule engine wearing biological vocabulary."

#### Trends in Field 6

All three diagnose the SPEC's evolutionary layer as _correctly framed but undercooked_. Holland wants finer granularity. Stanley wants novelty-based selection alongside Pareto. Forrest wants the corroborator and Supervisor themselves to evolve. The common subtext: evolutionary computation works when the _evolutionary substrate_ (representation, selection, archive) is itself well-designed; the SPEC has chosen the right ingredients but combined them in a stiff configuration.

#### Re-assessment in Field 6

After seeing the safety cluster (Field 1), they would add: "novelty selection (Stanley) is in tension with corrigibility (Russell). Resolve by archiving novel behaviours but only _deploying_ fitness-dominant ones — novelty is for exploration, not delivery." After seeing the architecture cluster (Field 4), they would add: "Holland's finer granularity needs the bounded contexts (Evans) — each context has its own gene space."

---

## Field 7 — Safety engineering & resilience

§3.5 Risk Register is recognisably hazard-analysis. L3.7 (Continuous Supervision) is operational safety. L2.3 (Quarantine) is fault containment. The SPEC borrows the form; the field has decades of practice.

### Nancy Leveson

**Contributions & mindset.** MIT; author of _Engineering a Safer World_ (2011). Originator of STAMP (Systems-Theoretic Accident Model and Processes) and STPA (System-Theoretic Process Analysis). Frame: accidents result from _missing constraints_ in a system's control structure, not from component failures. Safety analysis maps the control structure and asks where commands could go astray, where feedback could be wrong, where constraints could be missing.

**What she would say about this SPEC.** "Your laws (§3) are _constraints_. Good. But where is the _control structure diagram_? STPA would have me draw: User commands flow to Georges via UserGateway; Georges commands flow to the world via inner MCP; Claude commands flow to the substrate via ObservabilityGateway promotions; Supervisor signals flow to the scheduler. At each control link, ask: what hazardous control actions are possible? (Wrong command, missing command, wrong timing, wrong duration.) The Risk Register catches _some_ of these (R3 = missing Claude command, timing; R5 = wrong Georges action) but not all. R4 (Reflexivity paradox) is a missing-constraint hazard at the meta level — the SPEC has a _partial_ control structure but not the full STPA. Drawing it would surface coupling you have not named."

### Richard Cook

**Contributions & mindset.** Anaesthesiology and patient-safety researcher; author of the classic _How Complex Systems Fail_ (18 points). Mantras: complex systems are intrinsically hazardous; they run in a degraded mode; failure-free intervals are characteristic, not normal; human practitioners are the adaptable element; safety is a process, not a property.

**What he would say about this SPEC.** "Point 4: 'Complex systems contain changing mixtures of failures latent within them.' Your Risk Register names the _known_ failure modes; the unknown ones are the dangerous ones. Point 14: 'Human practitioners are the adaptable element of complex systems.' Your practitioners are Georges, the User, and Claude — and the SPEC assumes Claude is reliable because she is the outer observer. But Claude is also an AI agent, fallible in ways that change over time (model upgrades, prompt drift, context loss). Where in the SPEC does it say _what happens when Claude is wrong_? Point 15: 'Human practitioners have dual roles as producers and as defenders against failure.' Claude is the safety net but also a productivity actor (she promotes capabilities, refines prompts). The two roles conflict; safety pressures conflict with throughput pressures. Acknowledge this; design escalation when they conflict."

### James Reason

**Contributions & mindset.** Author of _Human Error_ (1990) and the _Swiss Cheese_ model. Frame: complex systems have multiple layers of defence; each has holes (active failures and latent conditions); accidents happen when holes align across layers. Mantra: _latent conditions_ are the long-tail failures, hidden in the system for years before alignment.

**What he would say about this SPEC.** "Your layers are: L1 constitutional, L2 operating, L3 synergy, anti-laws, Supervisor, Risk Register, Claude review. That is good defence-in-depth. But Swiss Cheese tells us accidents pass through _aligned_ holes — multiple layers fail simultaneously because they share an underlying assumption. Example: L1.8 (Host Corroboration) and L3.7 (Supervisor) both run _inside_ the Host process. If the Host process is compromised (R5 sandbox escape, but expanded to 'Host bug'), both layers fail together. The SPEC's defences are not as independent as they look. Identify the shared assumptions across layers; place at least one defence _outside_ the Host's trust domain. The User's ability to revoke a handle or terminate a session is one such external defence — make it more prominent."

#### Trends in Field 7

All three want _more rigour about what the SPEC's defences actually defend against_. Leveson wants the full STAMP control structure. Cook wants explicit acknowledgement that Claude is fallible. Reason wants independence analysis across layers. None object to the form; all want the analysis to go further than the Risk Register.

#### Re-assessment in Field 7

After seeing the security cluster (Field 2), they would add: "Reason's aligned-hole argument is exactly Hardy's TCB argument: shared assumptions = shared trust domain = shared failure. The TCB must be small enough that its assumptions are auditable." After seeing the governance cluster (Field 8), they would add: "Cook's 'who watches the watcher' is Ostrom's polycentric governance — Claude cannot be the only oversight."

---

## Field 8 — Multi-actor governance & formal protocols

L0.2 (Reflexivity with stricter Tier-1 gate), L2.6 (Single Promoter + Delegation), L0.3 (Asymmetry Disclosure), and §6 (Synergies map) define the SPEC's governance model. Three actors, asymmetric privileges, formal promotion paths.

### Leslie Lamport

**Contributions & mindset.** Designer of Paxos (1989) and TLA+ (1990s). Inventor of much of the formal vocabulary for distributed consensus: linearizability, sequential consistency, the happens-before relation, the bakery algorithm. Mantra: _if you can't write it down precisely, you don't understand it_. Mathematics-as-engineering, not as documentation.

**What he would say about this SPEC.** "The promoter handshake — Georges proposes → Supervisor evaluates against `DelegatedPromotionPolicy` → emits `Promoted` carrying Claude's signature, OR routes to manual Claude review — is a _consensus protocol_. It has safety properties (no two contradictory promotions for the same scope) and liveness properties (every proposal eventually resolves). Write it in TLA+; model-check it. You will find one of: a corner case where two promotions race (e.g., a `DelegatedPromotionPolicy` and a manual Claude decision land simultaneously); a deadlock (R3 fires; Supervisor waits for Claude; Claude waits for Supervisor evidence; both stuck); or a liveness bug under partial failure. All three are common. TLA+ catches them in minutes; running prod for a month does not."

### Elinor Ostrom

**Contributions & mindset.** Nobel Prize in Economics (2009), the only woman; author of _Governing the Commons_ (1990). Documented the conditions under which communities sustainably manage shared resources without privatisation or central control. Her _eight design principles for managing commons_: (1) clear group boundaries; (2) rules adapted to local conditions; (3) collective-choice arrangements; (4) monitoring; (5) graduated sanctions; (6) low-cost conflict-resolution mechanisms; (7) recognition of the right to self-organise; (8) for large systems, nested enterprises.

**What she would say about this SPEC.** "The Host substrate is a commons. Multiple actors (User, Georges, Claude) share it; its rules govern who can do what. Your SPEC scores well on principles 1 (clear boundaries — §1), 2 (rules adapted — L3.8 discover-and-adapt), 4 (monitoring — Supervisor + Risk Register), 8 (nested enterprises — workflows compose roles). But: principle 3 (collective-choice arrangements). Who can amend rules? L0.2 says 'Claude promotes; Tier-1 needs User-of-record co-signature.' That is two-party, not collective. Principle 5 (graduated sanctions). L2.3 (Quarantine) is one sanction; L2.8 (Cooldown) another. Where is the _graduated_ part — light sanctions for first offences, heavier for repeats? Principle 6 (low-cost conflict resolution). Where is the User's appeal path against Claude's decision? Currently if Claude rejects a User's proposal, the User has no recourse. Principle 7 (right to self-organise). Where can Users coordinate? These gaps are not theoretical; commons that ignore them fail empirically."

### Barbara Liskov

**Contributions & mindset.** Turing Award (2008); originator of CLU, abstract data types, and the _Liskov Substitution Principle_: if S is a subtype of T, an object of type T may be replaced with an object of type S without altering the desirable properties of the program. Mindset: substitutability is about _behaviour_, not just _type signature_ — preconditions cannot be strengthened in the subtype; postconditions cannot be weakened.

**What she would say about this SPEC.** "L2.14 (Ports over Implementations) is substitution at the architecture level. Good. But the SPEC says adapters bind to ports; it does not say what _substitutability invariants_ the adapter must preserve. Concrete example: `FileBackedHandle` provides `runScript` with a certain leak profile (limited by the local file's contents). `EncryptedHandle` provides `runScript` with a tighter leak profile (limited by the decryption enclave). The first to second is a _strengthening_ — fine. But what about `SqlViewHandle`? Its leak profile depends on the SQL adapter's join semantics. If you swap `FileBackedHandle` → `SqlViewHandle`, you might silently weaken L1.3's guarantees. The SPEC needs a _port-protocol contract_ (Hoare's CSP point, restated) that adapters must demonstrably preserve. Without it, `AdapterBound` events bind to ports whose semantics drift adapter-by-adapter."

#### Trends in Field 8

All three want the SPEC's governance to be _more formally specified and more polycentric_. Lamport wants TLA+ on the promoter handshake. Ostrom wants the missing commons principles wired in (collective choice, graduated sanctions, appeal paths, self-organisation). Liskov wants port-protocol contracts that adapters must preserve, not just shape-match. The common subtext: governance protocols _look_ simple in English and _are not_ simple in code; the field knows this; the SPEC has not yet paid the cost.

#### Re-assessment in Field 8

After seeing the safety cluster (Field 1), they would add: "Ostrom's collective-choice principle is Bengio's inviolable kernel: the _meta-rules_ belong to the commons, not to Claude alone." After seeing the security cluster (Field 2), they would add: "Liskov's port-protocol contracts are Miller's capability protocols, restated — the same insight from two traditions." After seeing the architecture cluster (Field 4), they would add: "Lamport's TLA+ pairs naturally with Cockburn's driving/driven distinction — each port set has its own protocol; verify each separately."

---

## General trends across all 8 fields

Across 24 experts, eight cross-cutting themes emerge.

1. **The SPEC has the right form but several content gaps in the math and protocols.** Capability security wants attenuation and CSP-style protocols, not just port shapes. Differential privacy wants (ε, δ) bounds, not byte counts. Formal methods wants TLA+ on the promoter handshake. The common thread: enforcement _points_ exist; the _invariants_ they enforce are not rigorously stated.

2. **The Sandbox is the weakest link.** Hardy, Miller, Reason, Cook, and Christiano all flag process-level isolation as inadequate for the trust claims being made. Promoting WASM/isolate to Phase 1 (out of "later/parked") is the single highest-leverage SPEC change.

3. **The Supervisor needs supervision.** Cook (who watches the watcher?), Reason (aligned holes), Forrest (the corroborator must itself evolve) converge: a single Supervisor is a Goodhart target and a single point of failure.

4. **Self-improvement scope is under-specified.** Russell asks where preference uncertainty lives. Bengio asks where the inviolable safety kernel is. Christiano asks what makes the corroborator trustworthy as Georges grows. The SPEC lets L3.8 promotion touch _most_ of the substrate; the experts want a small, literally-unamendable kernel.

5. **Information-leak math is folklore, not science.** Dwork, Roth, Shannon flatly reject the bootstrap entropy estimator. Differential privacy gives a rigorous, composable replacement. This is the SPEC's single biggest technical-correctness gap.

6. **Diversity / novelty / evolutionary granularity are undercooked.** Holland (variants too coarse), Stanley (10–20 % diversity is too low for open-ended discovery), Forrest (corroborators must evolve). The SPEC has chosen evolutionary primitives but stiff configurations.

7. **Documentation, glossary, and bounded-context discipline are missing.** Evans (no glossary), Cockburn (no driving/driven distinction), Helland (data-inside vs data-outside not drawn), Beck (kernel-first delivery deferred). These are _cheap to fix and pay back forever_.

8. **Governance is too two-party.** Ostrom: collective-choice arrangements, graduated sanctions, conflict resolution, appeal paths are all missing. Lamport: the consensus protocol is not formally specified. Liskov: port-protocol contracts are absent. The SPEC's governance has Claude + User-of-record as the only signatories on Tier-1 amendments; commons theory and consensus theory both say this is structurally fragile.

---

## Re-assessed reading — how each cluster would now address the SPEC

Knowing the other clusters' positions, each would update its critique:

**AI safety cluster** (Russell + Christiano + Bengio): Build the _inviolable kernel_ as a literal `kernel/` package whose contents are signed and cannot be amended without two-party rotation of long-lived keys. The kernel contains: the actor model, the law-to-enforcement map, the corroboration discipline, the TCB primitives (sandbox, event store, info-ledger). Everything else can evolve via L3.8 / L2.6. The kernel is what Bengio's "cap on self-improvement" looks like in code.

**Capability-security cluster** (Miller + Hardy + Hoare): Promote WASM (or nsjail or a microVM) to Phase 1. Add attenuated capabilities as a port operation. Bind every port to a CSP-style protocol spec. The kernel from cluster 1 includes the small TCB Hardy wants.

**Event-sourcing cluster** (Kleppmann + Young + Helland): Define event versioning, snapshots, projections, schema migration, hash-chain tamper-evidence, idempotency keys. The trace is the system's memory; treat it with the rigour of a database, not a log file.

**Architecture cluster** (Cockburn + Evans + Beck): Ship a glossary, name driving/driven ports, deliver a kernel-first Phase 1 (events + handle + sandbox + hand-written script). Add mutation testing on the law-tests so the test discipline is itself verified.

**Differential-privacy cluster** (Dwork + Roth + Shannon): Replace the entropy estimator with an (ε, δ)-DP mechanism. Per-handle ε-budget. Adaptive-composition theorem for R6. Use Sparse Vector Technique for threshold queries. Expose `runScript` as ε-aware, with attenuation (Miller's point) so a derived handle has a smaller ε-budget.

**Evolutionary cluster** (Holland + Stanley + Forrest): Decompose variants into sub-task primitives so the schema theorem fires. Add a MAP-Elites archive alongside Pareto selection. Make the Supervisor and corroborator themselves evolvable. Novelty for exploration, fitness for delivery.

**Safety-engineering cluster** (Leveson + Cook + Reason): Draw the STAMP control-structure diagram. Document what happens when Claude is wrong (escalation, rotation). Identify shared assumptions across defence layers; place at least one defence outside the Host trust domain.

**Governance cluster** (Lamport + Ostrom + Liskov): Write TLA+ for the promoter protocol. Add collective-choice arrangements (User community), graduated sanctions, and an appeal path. Specify port-protocol substitution invariants. The two-party Tier-1 gate (L0.2) is the minimum; the Ostrom design asks for at least a third independent monitor.

---

## Summary — top 8 gaps in priority order

1. **Sandbox is too weak.** Promote WASM/isolate adapter to Phase 1. Until then, every isolation claim is aspirational.
2. **Entropy estimator is folklore.** Replace with (ε, δ)-DP. The current estimator is a publication-grade red flag.
3. **No inviolable kernel.** Identify a tiny subset of the SPEC that _cannot_ be amended through L3.8 / L2.6 and ship it as a signed, key-rotated artifact.
4. **No formal protocol for the promoter handshake.** Write TLA+; model-check. Cheap; catches race / deadlock / liveness bugs that prod will surface in months.
5. **Documentation drift gaps are unforced losses.** Glossary, driving/driven port naming, bounded-context map, kernel-first Phase 1. All cheap, all compounding.
6. **The Supervisor is unsupervised.** Add meta-supervision (independent observer outside Host process) or rotate Supervisor signals.
7. **Governance is too two-party.** Add appeal path for User; graduated sanctions; collective-choice arrangements for Tier-1 amendments (third independent signatory).
8. **Variants too coarse; diversity too low.** Decompose to sub-task primitives; raise diversity reserve or add MAP-Elites archive alongside Pareto.

---

## Challenge to the SPEC

If the goal of this factory is to _demonstrate_ that an AI inhabitant can be governed safely, then the _tightest, most provable_ version of the SPEC matters more than the _broadest_ one. The current SPEC is broad; it covers a lot of ground; it borrows vocabulary from many fields. The expert consensus is consistent: _the borrowed vocabulary is not yet operationalised at the level the borrowing fields demand_.

A counter-challenge, in the spirit of §2.10 (Write what you do; do what you write):

> Cut every law that is enforced only by _organisational discipline_ (i.e., depends on Claude or a User doing the right thing at the right time). Keep only the laws enforced by _executable substrate_ (per L0.1). Re-derive the Tier-1 laws under that constraint. If a Tier-1 law cannot be made structural — for instance L1.8 (Host Corroboration) when the corroborator runs inside the Host's own trust domain — demote it to Tier 2 or Tier 3 until the substrate exists to make it structural. The result should be a SPEC where the Trusted Computing Base is small enough to verify, and every claim outside the TCB is qualified explicitly as 'aspirational under current adapters.'

This is the experts' aggregate ask: _the Host is the TCB; it must be small enough to verify; everything else flows from that_. The current SPEC has the right architecture to make this move. It has not yet made it.

A secondary challenge, in the spirit of §2.8 (Assess before executing):

> Before any Phase-1 code is written, run §3 through STPA (Leveson), TLA+ (Lamport), and (ε, δ)-DP analysis (Dwork) on the three load-bearing primitives — the promoter handshake, the sandbox boundary, and the data-handle aggregate. Each is a half-day of work for someone fluent in the technique; each will find a structural bug that would have cost a Phase-1 rewrite. The assessment frame the SPEC now requires (L3.9) should require these three analyses on any cycle whose goal claims to test L1.1, L1.3, L1.8, L2.6 or L1.7.

The experts are not in conflict with the SPEC's vision. They are asking it to honour, in operational rigour, the standards it has already set itself in §2.10 and L0.1.
