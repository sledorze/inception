# Meta-loops — Design and Measurement

This project improves itself through six explicit feedback loops.

**Source of objectivity: `pnpm loop:health`** — a script that computes metrics from repo
artifacts (git log, file counts, CI results). It exits non-zero on red signals and prints what
it cannot yet measure as `⏸ pending`. Run it; read the numbers; apply judgement to anomalies.
The script is the measure. This document is the spec for what to measure and why.

Judgement is not a substitute for measurement — it interprets the edges the machine cannot
distinguish: "coverage went up 2% — is that real assertion growth or trivial lines?" The machine
produces the number; a human or constitutional actor decides what it means.

---

## L1 — Friction → Fix

**Purpose.** Surface and eliminate recurring friction before it compounds.

**Flow.**

```
Friction encountered
  → docs/PAIN.md          log it (severity-tagged)
  → .claude/patterns/     document it (so the next agent avoids re-derivation)
  → lefthook / CC hook    mechanize it (so it fires automatically)
  → docs/PAIN-archive.md  archive it (same commit as the fix)
```

**Measured by.** `pnpm loop:health` — L1 block: PAIN open count, archive rate.

**Judgement questions** (after seeing the numbers):

- Is P1 age exceeding target because the item is genuinely blocked, or because no one looked at it?
- Did an archived item produce a hook, or just a pattern file? (Hooks close loops; patterns only document them.)
- Is a pattern file being consulted, or does the same violation recur? (Recurrence means the pattern is not auto-activated.)

**Invariant.** Every loop must have at least one mechanized check. A pattern file alone is
documentation, not enforcement.

---

## L2 — Cycle-Hunt

**Purpose.** Find waste before it bites, feeding findings into L1 and the other loops.

**Flow.**

```
Trigger fires (slice boundary / PAIN ≥3 / explicit /hunt)
  → scan heuristics 1–9 (cycle-hunt.md)
  → land each candidate in its declared output channel
  → commit outputs separately from feature work
```

**Measured by.** `pnpm loop:health` — L2 block: days since last hunt commit.

**Judgement questions** (after seeing the numbers):

- Were the candidates real waste or manufactured to hit a count? (The test: did anything mechanically improve as a result?)
- Did the hunt output land in a hook/pattern (strong) or only a PAIN item (weak)?
- Was heuristic #9 (meta-loop health) run as part of the hunt?

**Invariant.** A hunt that produces only PAIN items and no mechanization is logging, not fixing.
L1 closes the loop; L2 feeds it.

---

## L3 — Assessment Frame → Test → Coverage

**Purpose.** Ensure every work cycle produces verifiable, durable outputs.

**Flow.**

```
Assessment frame filed (L3.9)
  → law test written     packages/host/tests/laws/<id>.spec.ts
  → protocol test        parametrised over all bound adapters
  → coverage ratchet     CI rejects threshold drops
  → mutation score       Stryker on law tests (nightly)
```

**Measured by.** `pnpm loop:health` — L3 block: law test coverage %, dep boundary violations.
Full coverage number: `pnpm test:coverage:ci`. Dep violations: `pnpm deps:check`.

**Judgement questions** (after seeing the numbers):

- Law coverage 26%: is the gap explained by laws with structural enforcement (dep-cruiser, kernel-signatures CI) rather than test files? Or are laws simply untested?
- A new adapter was added — is it in its port's protocol test parametrization?
- Did coverage increase because of real assertions, or because test files grew with trivial lines?

**Invariant.** CI enforces coverage ratchet and dep boundaries unconditionally. These are the
hardest metrics to game because machines run them, not agents.

---

## L4 — Supervisor → Monitor → Divergence

**Purpose.** Detect behavioral misbehavior or risk-signal drift before it reaches Users.

**Flow.**

```
Georges runs a cycle
  → Supervisor (in-process)     computes risk signals (R1, R2, R5 in Phase 1)
  → Monitor (out-of-process)    independently recomputes a random subset
  → SupervisorDivergence?       emitted to event store on mismatch
  → escalation                  PAIN item / constitutional amendment / quarantine
```

**Measured by.** Event store queries once production traffic flows. Currently `⏸ pending`.

**Judgement questions** (once measurable):

- Is the Monitor actually running? An absent Monitor is a silent loop break, not a green signal.
- Is divergence rate rising with no corresponding PAIN items? That's a coverage gap in the fix loop.
- Are risk signals being added to §3.5 without being added to the Supervisor's compute set?

**Invariant.** Two independent watchers (Supervisor + Monitor) break the single-point-of-failure
of self-reporting. If only one runs, the loop is open.

---

## L5 — Capability Proposal → Promotion

**Purpose.** Allow Georges to grow its own tool surface in a gated, auditable way.

**Flow.**

```
Georges calls propose-capability (manifest + code + tests)
  → Supervisor evaluates DelegatedPromotionPolicy
  → Claude reviews
  → Promoted / Rejected event
  → capability active (or not) in next session
```

**Measured by.** Event store queries once Phase 4 starts. Currently `ℹ N/A`.

**Judgement questions** (once active):

- Is acceptance rate low because Georges proposes poorly, or because the review criteria are unclear?
- Is time-to-promotion bounded? A long queue means the human review step is the bottleneck.
- Are promoted capabilities staying active, or are they being rolled back? Rollbacks are the strongest signal that the test requirement is too weak.

---

## L6 — Session Context → Orientation

**Purpose.** Minimize tokens and time needed to orient a fresh Claude session.

**Flow.**

```
session-context.sh fires at SessionStart
  → injects top PAIN + next TODO + hunt nudge (if PAIN ≥3)
  → Claude reads SPEC-nav.md only (not full §A + §3)
  → first useful action within 2–3 tool calls
```

**Measured by.** `pnpm loop:health` — L6 block: PAIN surfaceability, TODO freshness.
Token cost is `⏸ pending` (needs session instrumentation).

**Judgement questions** (after seeing the numbers):

- Does the top PAIN item match what is actually blocking progress on the current branch?
- Is the next TODO the right one — or is there a higher-priority unlabelled item?
- Is the session hook advertising a solved problem? (Stale injection is silent; only comparison reveals it.)

---

## Running the health check

```bash
pnpm loop:health
```

Exit 0 = green or warnings only (apply judgement).
Exit 1 = red signals (action required; start with judgement: "is this a real problem?").

**Pending metrics** (`⏸` in the output) require instrumentation that doesn't exist yet:
structured PAIN item metadata (created-at, detected-at stage), a structured hunt log, session
token counters, and production event store traffic. These are the next instrumentation targets —
they move from `⏸` to a measured number when the instrumentation is built.
