# Breakdown strategy — vertical slices + spikes + blast-radius

A working method for planning multi-slice tasks. Read this **before** breaking down any work that
spans 3+ files, introduces a new port/adapter, or has unknowns about its execution shape.

---

## The four-step sequence

```
1. Spike unknowns
2. Map blast radius
3. Break down vertical slices (secured by spikes)
4. Persist + self-refine
```

Never skip to step 3 without completing steps 1–2 for the relevant unknowns.

---

## Step 1 — Spike unknowns (time-boxed; findings only)

A spike is a time-boxed investigation that produces a written recommendation. It generates **no
production code**. It answers one question: "is this slice viable as described?"

**When to spike:**

- The interception point for a new adapter is unknown.
- A third-party API shape is assumed, not confirmed.
- A blast-radius estimate could change the architecture of the slice.

**Spike output format:**

```
## Spike N — <question>
Finding: <what was discovered>
Recommendation: <what to do next>
Gates: <which slice items this unblocks>
```

Land the findings in a commit message, a `docs/TODO.md` rationale line, or a plan file — not in
production code.

---

## Step 2 — Map blast radius

Before committing to a refactor, enumerate every site touched by the change:

- Files that import the symbol being renamed/moved.
- Tests that depend on the current shape.
- Protocol tests that are parametrised over the current adapters.
- Law tests that enforce the invariant being changed.

**Decision rule:**

- **Small radius (≤5 sites, all in one package):** collapse R1/R2 refactors into Slice 1 as a
  refactor-commit-first within the slice.
- **Large radius (>5 sites or cross-package):** extract as a **named strategic refactor** (R1, R2,
  …) committed alone, before the feature slice, with a commit message "refactor(Rx): … prepares
  Slice N". Defer downstream breakdown until the refactor is merged.

**Anti-pattern:** breaking down Slice 2/3 before the blast-radius refactor of Slice 1 is done.
The downstream breakdown will be wrong; rewrite cost > write cost.

---

## Step 3 — Break down vertical slices (each secured by its spike)

A vertical slice traverses the full stack: e2e test (RED) → backend → frontend → GREEN + lock.

**Slice breakdown checklist:**

- [ ] The securing spike has produced findings (or the slice has no unknowns).
- [ ] The blast-radius refactor (if needed) is committed first and the commit states what it prepares.
- [ ] The slice has a BDD acceptance criterion (e2e test or law test) that is RED on current code.
- [ ] Later slices whose breakdown depends on this slice's shape are marked `[parked]` until this
      slice lands.

**Deferred breakdown is not procrastination — it is correct.** Breakdown is useful only when the
prerequisite shape is known. A breakdown written before a blast-radius refactor will be rewritten.

---

## Step 4 — Persist + self-refine

Every multi-slice task must have a numbered `docs/TODO.md` breakdown before implementation begins.

```
## Phase N — <name>

- [todo]    N.0  <first action>
- [todo]    N.1  <spike 1>
- [blocked] N.2  <spike 2 — needs human gate X>
- [todo]    N.3  <spike 3>
- [todo]    N.4  (conditional on N.3) Strategic refactor Rx — prepares N.6
- [todo]    N.5  Vertical Slice 1 (gated by N.1 + N.3)
- [parked]  N.6  Slice 2 — deferred until N.5 + N.3 land
```

The `/goal` autonomous loop picks the lowest-numbered `[todo]` and self-refines toward the north
star. A task without a `docs/TODO.md` entry is invisible to the loop.

**Capture validated methods.** When a planning method proves itself in a phase, write it into
`CLAUDE.md` Working Practices + this patterns directory + `docs/META-LOOPS.md` in the same
_process_ commit (not a feature commit). The method becomes prescriptive, not re-derived per task.

---

## Degradation signals (from `docs/META-LOOPS.md` L7)

These are loop-degradation events, not style preferences:

- A slice was broken down before its securing spike produced findings.
- A blast-radius analysis was skipped before a strategic refactor commit.
- Work was executed but not persisted as a numbered `docs/TODO.md` item.
- A validated method was not captured into prescriptive files within the same phase.
- The `/goal` loop picks up work with no corresponding `[todo]` entry.
