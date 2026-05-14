# Meta-loops — Intentional Design and Efficiency Metrics

This project improves itself through six explicit feedback loops. Each loop has a purpose,
a measurable efficiency metric, and a degradation signal that `/hunt` scans for.

Degradation signals are the primary input for heuristic #9 in `.claude/patterns/cycle-hunt.md`.

---

## L1 — Friction → Fix (reactive quality loop)

**Purpose.** Surface and eliminate recurring friction before it compounds into wasted cycles.

**Flow.**

```
Friction encountered
  → docs/PAIN.md          log it, severity-tag it
  → .claude/patterns/     document the pattern so the next agent avoids it
  → lefthook / CC hook    mechanize the check so it fires automatically
  → docs/PAIN-archive.md  cut + archive when fixed (same commit as the fix)
```

**Metrics.**

| Metric                 | Formula                                                                                    | Target                        | Current baseline                                         |
| ---------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------- |
| Detection stage at fix | Stage when violation is caught after fix lands (0=edit, 1=commit, 2=push, 3=CI, 4=runtime) | ≤1                            | ~1.5 avg (some checks still push-only)                   |
| PAIN item age          | Calendar days from item creation to PAIN-archive entry                                     | P1 < 14 days; P2/P3 < 60 days | P1: >60 days (wiring fan-out, blocked on Effect v4 beta) |
| Mechanization rate     | Items that produced a hook or CC hook / total archived items                               | >50%                          | ~30% (most land in pattern files only)                   |

**Degradation signals.**

- P1/P2 age exceeds target without a `blocked` annotation explaining why.
- New items added faster than old ones are archived (backlog growing monotonically).
- A pattern file exists but the same violation recurs — the pattern is not being consulted.

**Quick check.** `grep -c "^## P[0-9]" docs/PAIN.md` — value >4 signals loop not closing.

---

## L2 — Cycle-Hunt (proactive waste scan)

**Purpose.** Find waste before it bites, feeding findings into L1 and the other loops.

**Flow.**

```
Trigger fires (slice boundary / PAIN count / explicit /hunt)
  → scan 8 heuristics + meta-loop health (heuristic #9)
  → land each candidate in its output channel
  → commit outputs separately
```

**Metrics.**

| Metric                 | Formula                                              | Target  | Current baseline                    |
| ---------------------- | ---------------------------------------------------- | ------- | ----------------------------------- |
| Candidates per hunt    | Findings surfaced / hunt session                     | 2–4     | 2 (first dogfood hunt)              |
| Hunt frequency         | Hunt sessions per vertical slice                     | ≥1      | 1/1 slices so far                   |
| Output channel quality | (Hook + pattern) outputs / total outputs             | >50%    | 50% (1 PAIN item, 1 CLAUDE.md edit) |
| Heuristic hit rate     | Heuristics that fired ≥1 finding across last 3 hunts | ≥4 of 9 | Not yet trackable                   |

**Degradation signals.**

- 0 candidates in a hunt → heuristics are stale; revise them.
- All outputs land in PAIN items only (nothing mechanized) → L1 not closing; hunt is logging, not fixing.
- > 1 slice since last hunt.

**Quick check.** `git log --oneline --grep="hunt" | head -3` — last hunt commit date.

---

## L3 — Assessment Frame → Test → Coverage (per-cycle quality gate)

**Purpose.** Ensure every work cycle produces verifiable, durable outputs that cannot silently degrade.

**Flow.**

```
Assessment frame filed (L3.9)
  → law test written (packages/host/tests/laws/<id>.spec.ts)
  → protocol test parametrised over all bound adapters
  → coverage ratchet (never lower)
  → Stryker mutation score on law tests
```

**Metrics.**

| Metric                      | Formula                                                            | Target | Current baseline                                               |
| --------------------------- | ------------------------------------------------------------------ | ------ | -------------------------------------------------------------- |
| Law coverage                | Laws in §3 with a paired `tests/laws/` test / total laws           | 100%   | ~60% (Phase 1.5 tests complete; earlier laws partially tested) |
| Protocol parametrization    | Adapters passing protocol test / total bound adapters per port     | 100%   | ~80%                                                           |
| Mutation score              | Stryker score on `tests/laws/`                                     | >80%   | Not yet in CI (nightly only)                                   |
| Assessment frame compliance | Commits with a SPEC-section ref in message / total feature commits | 100%   | Enforced by commit-msg hook                                    |

**Degradation signals.**

- A law added to §3 without a paired `tests/laws/` file.
- A new adapter not added to its port's protocol test parametrization.
- Coverage threshold manually lowered.

**Quick check.** `pnpm deps:check && pnpm typecheck` green; then grep `tests/laws/` count against §3 law count.

---

## L4 — Supervisor → Monitor → Divergence (behavioral integrity loop)

**Purpose.** Detect misbehavior or risk-signal drift before it propagates to Users or compounds
across cycles.

**Flow.**

```
Georges runs a cycle
  → Supervisor (in-process) computes risk signals (R1, R2, R5 in Phase 1)
  → Monitor (out-of-process) independently recomputes a random subset
  → SupervisorDivergence event emitted on mismatch
  → escalation path (PAIN item, constitutional amendment, or quarantine)
```

**Metrics.**

| Metric           | Formula                                                | Target                                 | Current baseline                    |
| ---------------- | ------------------------------------------------------ | -------------------------------------- | ----------------------------------- |
| Signal coverage  | Risk signals actively computed / total signals in §3.5 | 100% long-term; ≥R1,R2,R5 for Phase 1  | 3 of N (bootstrap)                  |
| Divergence rate  | SupervisorDivergence events / total cycles             | Baseline needed; alert on rising trend | Unknown — no production traffic yet |
| Signal staleness | Signals not recomputed in last 10 cycles               | 0                                      | Not yet measurable                  |
| Resolution time  | SupervisorDivergence to resolution event               | <1 cycle                               | Unknown                             |

**Degradation signals.**

- Monitor process not running (L3.7 violation).
- Signal coverage stagnant while new risks are added to §3.5.
- Divergence rate climbing without corresponding PAIN items or fixes.

**Quick check.** Is the Monitor process alive? Any `SupervisorDivergence` events in the store
since the last cycle?

---

## L5 — Capability Proposal → Promotion (evolution loop)

**Purpose.** Allow Georges to grow its own tool surface in a gated, auditable way — closing
the self-improvement loop for the AI inhabitant.

**Flow.**

```
Georges calls propose-capability (manifest + code + tests)
  → Supervisor evaluates DelegatedPromotionPolicy
  → Claude reviews + optionally countersigns
  → Promoted / Rejected event
  → capability active (or not) in next session
```

**Metrics.**

| Metric               | Formula                                                   | Target                                     | Current baseline              |
| -------------------- | --------------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Acceptance rate      | Promoted / (Promoted + Rejected)                          | >50% initial; rising as Georges calibrates | N/A — Phase 4 not yet started |
| Time to promotion    | propose-capability timestamp to Promoted event            | <2 cycles                                  | N/A                           |
| Capability longevity | Capabilities still active after 5 cycles / total promoted | >80%                                       | N/A                           |
| Rollback rate        | Promotions reverted / total promotions                    | <10%                                       | N/A                           |

**Degradation signals (once active).**

- Acceptance rate <20% → Georges proposing outside its competence or scope; calibrate
  the capability manifest schema.
- Time to promotion >1 week → review bottleneck; check Claude review queue.
- High rollback rate → promoted capabilities failing in practice; tighten the test requirement
  in `propose-capability`.

**Quick check.** N/A until Phase 4. Track from first `CapabilityProposed` event.

---

## L6 — Session Context → Orientation (startup efficiency loop)

**Purpose.** Minimize the tokens and time a fresh Claude session needs to orient before
producing useful output.

**Flow.**

```
session-context.sh fires at SessionStart
  → injects: date + branch + status + top PAIN + next TODO + hunt nudge (if 3+ PAIN items)
  → Claude reads SPEC-nav.md (not full SPEC §A + §3 — already tightened)
  → Claude jumps to the one relevant SPEC section if needed
  → first useful action within 2-3 tool calls
```

**Metrics.**

| Metric               | Formula                                                         | Target               | Current baseline               |
| -------------------- | --------------------------------------------------------------- | -------------------- | ------------------------------ |
| Priming token cost   | Tokens consumed by session-start reads before first code action | <500                 | Unknown — not yet instrumented |
| PAIN relevance       | Does top PAIN item match current branch concern? (manual check) | Yes                  | Not tracked                    |
| Orientation accuracy | Claude identifies correct next TODO on first read               | Yes/No per session   | Not tracked                    |
| Ritual depth         | SPEC sections read in full at session start                     | 0 (SPEC-nav.md only) | 0 since L6 tightening          |

**Degradation signals.**

- Session hook advertising a solved PAIN item (stale `PAIN.md`).
- Agent re-reading full SPEC §A + §3 despite SPEC-nav.md existing.
- "Next TODO" field pointing at a done or blocked item — `TODO.md` stale.

**Quick check.** Read the last three session-context outputs from git log. Do they match
the actual state of PAIN.md and TODO.md?

---

## Measuring loop health — summary table

| Loop | Quick check command / observation                                   | Red signal                       |
| ---- | ------------------------------------------------------------------- | -------------------------------- |
| L1   | `grep -c "^## P[0-9]" docs/PAIN.md`                                 | >4 open items                    |
| L2   | `git log --oneline --grep="hunt" \| head -3`                        | Last hunt >1 slice ago           |
| L3   | `pnpm test --coverage`; count `tests/laws/` vs §3 laws              | Coverage drop or uncovered law   |
| L4   | Is Monitor running? `SupervisorDivergence` events since last cycle? | Monitor down; rising divergence  |
| L5   | N/A (Phase 4)                                                       | Acceptance rate <20% once active |
| L6   | Does session hook output match `PAIN.md` + `TODO.md` reality?       | Stale injection                  |

---

## Invariants

- Every loop must have at least one **mechanized** check (a hook, a CI job, or a `session-context.sh`
  field) — a loop with only manual checks is not a loop, it's a wishlist.
- Every metric must be **computable from artifacts already in the repo** (event store, git log,
  file counts). Metrics requiring external instrumentation are targets, not baselines.
- A loop with no recent activity (no archive entry, no hunt commit, no divergence event) is not
  healthy by default — it may simply not be running.
