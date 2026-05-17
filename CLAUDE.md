# AI Brief — AI-Native Factory

This is your primary context for working in this codebase. Read it fully before writing any code. It explains **what this project is**, **how to operate within it**, and **how to consolidate work without drift**.

## What This Project Is

A self-hosted "factory": an application where an AI inhabitant (**Georges**) and external **Users** gradually build and improve it together, under outer-loop oversight from **Claude**. Stories drive design; architecture is residue.

- Design source of truth → `docs/SPEC.md`
- Execution log → `docs/TODO.md`
- Cross-field expert critique → `docs/EXPERTS.md`
- The substrate Georges inhabits → `packages/host/`

> **Note on "Claude" in this project.** In `docs/SPEC.md`, "Claude" is the constitutional outer-observer role. You (Claude Code editing this repo) and that role are the same model in practice but in different invocation contexts; SPEC's "Claude" cannot speak to Users in-session and can only act via the substrate. See `docs/SPEC.md` §1 footnote.

## Actors

| Actor                                               | Role                                                | Cannot                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Claude**                                          | Outer observer + substrate builder                  | Speak to Users in-session; act as Georges; bypass the trace/policy substrate                                      |
| **Georges**                                         | AI inhabitant (LMStudio via OpenAI-compatible HTTP) | Read Host source; reach network beyond LLM endpoint; persist outside managed workspace; invoke unregistered tools |
| **User**                                            | External requester                                  | Modify the Host directly; reach Georges except via Host                                                           |
| **External Witness pool** (3 humans, 2-of-3 quorum) | Constitutional third party                          | Hold a production role; co-signs Tier-1 amendments + Kernel rotations                                             |

Plus Host-side tracing identities: **Supervisor** (in-process risk monitor) and **Monitor** (out-of-process cross-check of the Supervisor).

## Resuming after auto-compaction

If you are picking up from a compacted summary, do this BEFORE the first action:

1. Read `docs/SPEC-nav.md` (~1 min) — law IDs, SPEC line numbers, paired test paths.
2. Check `docs/TODO.md` — active phase + lowest-numbered `[todo]` or `[in-progress]`.
3. Scan `docs/PAIN.md` — any P1 (blocks work) items relevant to the current task?
4. Skip full SPEC §3 / §A re-read unless the current task touches a law or port directly.

## Start-of-session ritual

1. Read `docs/SPEC-nav.md` — laws quick index. Jump to the SPEC.md section it references only if the current task touches a law or port directly. (Skip full §A + §3 otherwise — same rule as "Resuming after auto-compaction".)
2. Read `docs/TODO.md` top to bottom — current phase + items.
3. Pick the lowest-numbered `[todo]` or `[in-progress]` in the active phase.

## Per-task ritual (every cycle, per L3.9)

File an **assessment frame** before any code:

1. Success criteria.
2. Concern tag (mapped to `docs/SPEC.md` §14, dictating artifact format + vocabulary).
3. Experts / prior-art consulted.
4. Existing-tool search ("build vs. adopt vs. integrate"). Default heavily toward adopt/integrate. Re-invention is **AL.7**.
5. Risk / ROI / lock-in dimensions.
6. How outcome will be measured.

Implement. Pair every Law you touch with a test in `packages/host/tests/laws/<law-id>.spec.ts`. Pair every port you touch with a protocol-contract test in `packages/host/tests/protocol/<port>.spec.ts` parametrised over all bound adapters (fake + prod). Update §12 (Bootstrap inventory) when any calibration changes; §13 (Tech Decisions) when any tech choice changes; `docs/TODO.md` when items move state. Commit with a SPEC-section-numbered message.

## Code economy (§2.13, AL.7)

- **Don't pre-abstract.** Three similar lines is better than premature abstraction. Factorise once a pattern has stabilised (≥3 usage sites OR one usage that clarifies the domain).
- **Consolidate infrastructure at 2.** The 3-site threshold applies to application logic. For infrastructure — test layer compositions, error `_tag` string constants, shared helpers, binding glue — consolidate as soon as the second copy appears. Divergence in infrastructure is silent and expensive to fix later. Specific patterns: (a) repeated `Layer.mergeAll(...)` in test files → extract to `packages/host/tests/helpers/`; (b) `_tag` strings duplicated between a `TaggedErrorClass` definition and `Effect.catchTags` call sites → export a const from the port file.
- **Log friction, then fix it.** When a duplication or awkward pattern causes a visible slowdown, add it to `docs/PAIN.md` with severity + candidate fix. **Also open an acceptance test that fails on the current code** (plain vitest or `@effect/vitest` depending on whether Effect context is needed) — this is the red step that proves the fix matters. At the start of every review session, scan `docs/PAIN.md` for P1/P2 items (blocks work) and address the highest-severity open item before new features. When a fix lands: make the acceptance test pass (green step), cut the item from `docs/PAIN.md`, paste it (full text + `FIXED <date> in <commit> — test: <test path>`) into `docs/PAIN-archive.md` in the same commit. PAIN.md holds OPEN items only.
- **Hunt proactively.** When 3+ PAIN items are open or context feels expensive, do a deliberate waste-scan — see `.claude/patterns/cycle-hunt.md`. The hunt feeds findings back into the PAIN→pattern→hook machinery.
- **Promote to libraries.** When a module stabilises, give it its own `packages/<name>/` workspace with semver, owner, and changelog. Triggers: 3+ usage sites, load-bearing tech decision, or ships in `kernel/`.
- **Prefer (embedded) DSLs** for domain grammars — workflows, role manifests, policy expressions, fitness vectors, capability declarations. Imperative code is the last resort.
- **Contract tests run against fake AND prod.** Every port's protocol test is parametrised over all bound adapters. Liskov substitution proven by test, not by intent.
- **SOLID by default.** S: one module, one responsibility. O: extend via ports, not edits. L: parametrised protocol tests. I: split interfaces by concern. D: depend on ports, not adapters.

## Phases (per `docs/TODO.md`)

- **Phase 0** — Stories + spec consolidation (in progress).
- **Phase 1** — S1 vertical slice (9 items). Exit: Georges runs S1 end-to-end against synthetic data, trace queryable.
- **Phase 1.5** — Enforcement substrate (12 items: budget ledger, info-ledger, corroborators, role registry, variant log, Supervisor, TLA+ promoter spec, Monitor, Witness ceremony, DP adapter, MAP-Elites archive, Kernel directory). Exit: S1 re-runs with all enforcement on.
- **Phase 2** — Inner MCP toolset (Georges' tool surface).
- **Phase 3** — End-to-end S1 demo.
- **Phase 4** — Capability proposals (S2).
- **Phase 5** — Outer observability + substrate refinement.
- **Phase 6** — Conversational MVP (S6 + S8): project-scoped multi-turn chat with Georges, TDD-e2e via LLM record-replay.

**Do not ship Phase 1 without Phase 1.5.** Phase 1 alone is _aspirational safety_; AL.5 (Trust by absence) forbids shipping safety claims without enforcement.

## Architecture (per L2.14)

- **Driving ports** (`packages/host/src/ports/driving/`): outside calls in. `UserGateway`, `ObservabilityGateway`.
- **Driven ports** (`packages/host/src/ports/driven/`): Host calls out. `LlmProvider`, `EventStore`, `SandboxExecutor` (Wasmtime/WASI), `DataHandle`, `ToolRegistry`, `WorkspaceMount`, `Supervisor`.

dependency-cruiser rules enforce: (a) non-adapter code cannot import from `adapters/`; (b) driving adapters cannot import from driven adapters; (c) every port has a CSP-style protocol contract in `tests/protocol/<port>.spec.ts` parametrised over adapters.

The **Kernel** (`kernel/`) is the inviolable TCB — actor model, TCB driven-port adapter manifests, corroboration discipline, External Witness pool manifest. Signed by Claude + User-of-record + 2-of-3 of the 3 Witness pool keys (five long-lived keys total). Amendment requires unanimous re-signing + key rotation (L0.5). **Do not edit `kernel/` files in the same commit as anything outside `kernel/`.**

Formal specs live in `formal/` and are model-checked in CI (`tlc` for TLA+).

## Repository Layout

```
packages/
  host/                     Substrate Georges inhabits
    src/
      ports/
        driving/            Outside calls in (User, Claude) — AuthGateway, AdminQuery, UserGateway, ObservabilityGateway
        driven/             Host calls out (data, LLM, sandbox, …) — LlmProvider, EventStore, SandboxExecutor, DataHandle, ToolRegistry, WorkspaceMount, Supervisor
      adapters/
        driving/            ScryptAuthGateway, FakeAuthGateway, EventStoreAdminQuery, CliUserGateway, …
        driven/             SqliteEventStore, OpenAiCompatLlmProvider, FileBackedHandle, …
      runtime/bind.ts       Service registry: ports → adapters at boot (composition root)
      application/          Effect.gen orchestrations; imports ports only
      domain/               Pure leaf: schemas, value objects, invariants
      bootstrap/
        tools.yaml          Seed tool registry
        agent.md            Georges' operating context — injected as system prompt
    tests/
      laws/                 One spec per Law in docs/SPEC.md §3
      protocol/             One spec per port, parametrised over adapters
      unit/                 Pure logic tests
      integration/          Cross-component tests
  monitor/                  Out-of-process Supervisor cross-check (L3.7)
  backoffice/               Admin back-office UI (proposals, trace, PAIN, patterns, agent.md)
  app/                      End-user chat app (goal submission + conversation)
kernel/                     Inviolable TCB (L0.5; signed; 2-of-3 Witness quorum)
formal/                     TLA+ specs (L0.2 promoter; later sandbox + DP)
docs/
  SPEC.md                   Design source of truth
  TODO.md                   Execution log
  EXPERTS.md                Cross-field critique
.claude/                    Claude's meta-machinery (NOT shared with Georges)
  rules/                    Path-scoped operating constraints
  patterns/                 Annotated code patterns (hex boundaries, test structure, …)
  hooks/                    Lifecycle hooks (pre-commit guardrails, session context)
  commands/                 Slash commands (/hunt, …)
```

## Effect runtime (`packages/host/`)

All Host code is written with **Effect v4** (`effect@4.0.0-beta.x` — exact-pinned; see `.syncpackrc`).  
The v4 source is vendored at `vendor/effect-smol/` via **git subtree** (read-only reference; do not import from it).  
To pull in Effect updates: `git subtree pull --prefix=vendor/effect-smol https://github.com/Effect-TS/effect.git main --squash`

### Canonical patterns (AGENTS.md in `vendor/effect-smol/` has the full list)

| Goal                            | Pattern                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Define a port                   | `class Foo extends Context.Service<Foo, { method: ... }>()(id) {}`                             |
| Define an adapter layer         | `static readonly layer = Layer.effect(this, Effect.gen(function*() { return Foo.of({...}) }))` |
| Named function returning Effect | `Effect.fn("Module.name")(function*(args) { ... })`                                            |
| Custom error                    | `class FooError extends Schema.TaggedErrorClass<FooError>()("id", { fields }) {}`              |
| Access a service                | `yield* ServiceClass` inside `Effect.gen`                                                      |
| Parse at boundary               | `yield* Schema.decodeUnknownEffect(schema)(rawInput)`                                          |

### Hard rules (never violate)

- **No `async`/`await` or `try`/`catch`** in `packages/host/` — use `Effect.tryPromise`, `Effect.gen`, `Effect.catchTag`.
- **No `Date.now()` or `new Date()`** — use `Clock.currentTimeMillis` / `Clock.currentTimeNano` (enables `TestClock` in tests).
- **`Effect.fn("Name.method")`** for all named Effect-returning functions — improves stack traces + attaches a span. **Never call it as an IIFE:** `Effect.fn("X")(fn)()` is caught by tsgo `effectFnIife`; write `Effect.gen(fn).pipe(Effect.withSpan("X"))` for values, and `Effect.fn("X")(fn)` for functions.
- **`it.effect`** for all Effect-based tests; import `{ assert, describe, it }` from `@effect/vitest`.

### When you need to understand an Effect API

> `vendor/effect-smol/` is a **git subtree** of the Effect repo (read-only reference; do not import from it; excluded from VSCode search and auto-import). Treat it as your source of truth for Effect patterns — not web search, not training data.

1. Read `vendor/effect-smol/LLMS.md` — agent-oriented overview; read this first before any Effect code.
2. Read `.agents/skills/effect-ts/references/` — project-local curated guides (layers, schema, error handling, testing, observability, …). Fastest token-efficient stop for common patterns.
3. Read `vendor/effect-smol/ai-docs/src/` — AI-optimised examples by category (effect, stream, testing, observability, …).
4. Read `vendor/effect-smol/packages/effect/src/<Module>.ts` — canonical source for exact signatures.
5. Read `vendor/effect-smol/MIGRATION.md` — v3 → v4 API mapping table.
6. Read `vendor/effect-smol/AGENTS.md` — coding-agent conventions used inside the Effect repo itself.

Do **not** rely on web search or your training-data knowledge of Effect v3 APIs — the v4 API changed.

## Toolchain (inherited from template)

- **pnpm workspaces** + **Turborepo** (incremental, cached).
- **oxlint (strict)** — all severities = error. Disabled rules + rationale documented in `.oxlintrc.json`.
- **lefthook** — pre-commit (gitleaks, hadolint, oxlint, prettier, syncpack), pre-push (merge origin/main → typecheck + tests).
- **Vitest** + **`@effect/vitest`** — `*.unit.test.ts`, `*.integration.test.ts` for host; `*.test.tsx` for frontend.
- **Stryker** — mutation testing. **Also runs on `packages/host/tests/laws/`** to ratchet law-test quality (§11).
- **dependency-cruiser** — deny-by-default; enforces L2.14 hex boundaries (see `.dependency-cruiser.cjs`).
- **Claude Code hooks** — `block-no-verify.sh` (refuses `--no-verify`), `session-context.sh` (injects date/branch/status at every session start), `oxlint-autofix.sh` (auto-fixes safe cosmetic violations after every edit).

## Working Practices

- **Plan before building** for any task touching 3+ files or introducing a new pattern.
- **Vertical feature slices.** Every task traverses the stack — frontend (if any) → backend → data. No horizontal tasks.
- **BDD.** Start from observable behaviour. Write the test, then implement.
- **Consolidate before you commit.** After implementing a feature, scan the diff for duplicated structure. If the same layer composition, error tag string, or import block appears in two or more files, extract it before the commit lands. One extra minute of consolidation prevents one hour of divergence debugging.
- **Strategic refactors.** Only valid as preparation for an upcoming slice; state what it prepares; never merge refactors and new behaviour in the same commit.
- **Spikes for unknowns.** Time-boxed; produce findings + recommendation; no production code.
- **Breakdown strategy (`.claude/patterns/breakdown-strategy.md`).** Slice into _vertical_ slices; secure each with a spike before breaking it down; map blast radius before any refactor commit (large radius → named strategic refactor committed first → defer downstream breakdown). Persist the numbered breakdown to `docs/TODO.md` so `/goal` can unroll and self-refine to the north star. When a planning method proves itself, capture it immediately: CLAUDE.md Working Practices + `.claude/patterns/` + `docs/META-LOOPS.md` (same _process_ commit, separate from feature).
- **Witness the automation.** Run `pnpm test`, `pnpm typecheck`, `pnpm lint` locally before pushing.
- **Never lower coverage thresholds** (L2.4 ratchet; bootstrap-loosening exception only for `bootstrap=true` calibrations on first L3.8 promotion).
- **Minimize dependency fan-out.** Hubs (>10 importers) need to be split by domain boundary or kept stable.

## CI Pipeline

Three jobs in parallel per PR:

| Job        | Runs                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `checks`   | `lint:ci` + `typecheck` + `format:check:ci` + `deps:check` + `syncpack:check:ci` via Turborepo |
| `test`     | `test:coverage:ci` via Turborepo; uploads coverage; posts PR comment                           |
| `security` | gitleaks + hadolint                                                                            |

To be wired in Phase 1 / 1.5:

- `law-tests` — runs `packages/host/tests/laws/` and Stryker on it.
- `protocol-tests` — runs `packages/host/tests/protocol/` parametrised across all bound adapters.
- `formal-check` — model-checks every `formal/*.tla` with `tlc`.
- `kernel-signatures` — verifies `kernel/` signatures on every push touching it.

Mutation report runs nightly (`mutation-report.yml`), not on PRs.

## Anti-drift tripwires

- Calibration changed without §12 update → revert.
- Adapter swapped without §13 update → revert.
- Cycle shipped without `assessmentFrame` → revert (L3.9).
- Tier-1 law touches Host-only code → flag L3.10 violation.
- `kernel/` modified without unanimous re-signing on same commit → CI rejects.
- Law in §3 lacks paired test in `packages/host/tests/laws/` → L0.4 fails.
- Port lacks parametrised protocol test in `packages/host/tests/protocol/` → L2.14 + §2.13 violation.
- New code that duplicates a library or internal module → AL.7 violation.
- PAIN item closed in `PAIN-archive.md` without a passing acceptance test cited in the entry → revert.

## Path-scoped rules (auto-loaded when paths match)

- `.claude/rules/host-package.md` — `packages/host/**`
- `.claude/rules/kernel.md` — `kernel/**`
- `.claude/rules/formal.md` — `formal/**`

## Patterns reference (`.claude/patterns/`)

Annotated code patterns for the codebase's recurring constructs. Check here **before** writing code that touches hex boundaries, test structure, or layer wiring — violations are caught at commit time by lefthook and cost a cycle to fix.

| File                            | When to read                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `dep-boundary.md`               | Importing anything across `domain/`, `application/`, `ports/`, `adapters/`, `runtime/`                                |
| `application-vs-domain.md`      | Deciding where a new function or module lives                                                                         |
| `composition-root.md`           | Adding an adapter or changing the Layer wiring                                                                        |
| `effect-test-pattern.md`        | Writing or modifying any test under `packages/host/tests/`                                                            |
| `cycle-hunt.md`                 | End of slice/phase, or when friction repeats — proactive scan for cycle-time + token-cost waste                       |
| `frontend-design-system.md`     | Adding a new design-system oxlint rule or migrating a violation in `packages/frontend/`                               |
| `frontend-llm-ui-generation.md` | Prompting any LLM to generate UI in `packages/app/` or `packages/backoffice/` — constraints, checklist, anti-patterns |
| `breakdown-strategy.md`         | Planning a multi-slice task — when to spike, how to map blast radius, when to trigger a strategic refactor            |
| `schema-decode.md`              | Decoding `unknown` data at any boundary — which API (`decodeUnknownEffect` / `Result` / generics) and why             |

## When in doubt

- Vocabulary → `docs/SPEC.md` Appendix A.
- "Is X enforced?" → `docs/SPEC-nav.md` (law ID + test path) → then SPEC §3 for full text + `if absent` clause.
- "Why was Y chosen?" → §13 (Tech) for tech, §12 (Calibrations) for parameters.
- "What format should this artifact take?" → §14 (Per-domain artifact standards).
- "What would an expert say?" → `docs/EXPERTS.md`.
- "Should I build this or use a library?" → AL.7 + §2.8. Default to adopt/integrate.
- "How does this Effect API work?" → `.agents/skills/effect-ts/references/` first, then `vendor/effect-smol/ai-docs/` → `vendor/effect-smol/packages/effect/src/`. Never guess from v3 memory.
- "How should I write or modify a test in `packages/host/tests/`?" → `/effect-test-pattern` (layer(), it.effect, Effect.flip, RED .fails tests).
- "Which decode API do I use at this boundary?" → `/schema-decode` (three-way table: decodeUnknownEffect / decodeUnknownResult / helper function).
- "How do I add a new adapter or wire a new Layer?" → `/composition-root` (bind.ts is the only adapter importer; Layer.provide chain; AppServices derived automatically).
- "What code pattern should I follow here?" → `.claude/patterns/` (hex boundaries, test structure, composition root).
- "Is this async/Promise usage in `packages/host/src/` a legitimate bridge or a violation?" → `.claude/patterns/bridge-zone.md` (annotation marker, which files qualify, when NOT to annotate).
- "How do I prompt an LLM to generate UI that won't fail the lint gate?" → `.claude/patterns/frontend-llm-ui-generation.md` (constraints, checklist, anti-patterns, workflow)
- "Is there waste I'm not seeing?" → `/hunt`
- "Where do Georges' behavioral instructions live?" → `packages/host/src/bootstrap/agent.md` (never in `.claude/`)
- "Are the self-improving loops healthy?" → `docs/META-LOOPS.md` (metrics + degradation signals for L1–L7)

## Feedback

`/help` for Claude Code help. Issues: https://github.com/anthropics/claude-code/issues.
