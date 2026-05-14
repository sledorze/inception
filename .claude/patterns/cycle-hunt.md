# Pattern: Cycle-hunt — proactive waste scanning

**Enforced by:** practitioner judgment — no automated gate; self-reinforcing via output channels  
**Law:** §2.13 (Code economy) + L3.9 (Assessment frame) + §16 (Risk × ROI × Feedback-ability)

This is the **proactive sibling of `docs/PAIN.md`**. PAIN.md captures friction _after_ it bites (reactive). A cycle-hunt deliberately scans for waste _before_ it compounds (proactive). The findings feed the same PAIN→pattern→hook pipeline.

---

## When to hunt (at least one trigger must fire)

| Trigger                                     | Signal                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| End of a vertical slice or phase boundary   | Natural pause; context loaded but not mid-task         |
| `docs/PAIN.md` has 3+ open items            | Backlog growing → a systematic pass beats ad-hoc fixes |
| Same friction encountered 2× in one session | Repetition reveals a structural gap, not bad luck      |
| Context window > 70% used                   | Token-economy signal — compression approaching         |
| User or Claude invokes the hunt explicitly  | Explicit intent is sufficient; no other trigger needed |

## When NOT to hunt (guard rails, per §2.13)

- **Mid-task.** Finish the current cycle first; a half-baked fix leaves two messes.
- **First 10 minutes of a fresh session.** Context not loaded; candidates will be shallow.
- **When the only candidate is speculative future-proofing.** No demand → no hunt. §2.13: "don't pre-abstract."
- **Sooner than one slice since the last hunt.** Cooldown prevents over-churning the same files.

---

## Scan heuristics — the eight targets

### 1. Detection-stage drift

A problem is caught at push time when commit-time was possible; caught at runtime when typecheck was possible.

```
❌ deps:check runs only at pre-push → violation latent for an entire dev cycle
✅ deps:check at pre-commit → caught in seconds, 30 s after the offending import lands
```

Ask: for every CI or hook check, what is the earliest stage it could fire?

### 2. Repeated manual touch-ups

The same fix applied more than once in a session → mechanize it.

```
❌ Hand-correcting Effect.runPromise → it.effect in three test files separately
✅ Add check-effect-patterns.sh pre-commit hook so the pattern violation surfaces at edit time
```

Ask: did I fix the same thing twice this session?

### 3. Token amplifiers

Serial tool calls that could parallelize; sub-agents redoing work the main loop already did; overly broad globs widening reads.

```
❌ Read file A, then Read file B, then Read file C (independent reads)
✅ Three parallel Read calls in one message → 3× faster, same result

❌ Spawn a sub-agent with "find and understand everything about X" → it re-reads files already in context
✅ Hand the sub-agent the already-known file paths and the specific question
```

Ask: are there independent reads or searches I'm issuing sequentially?

### 4. Sub-agent arbitrage

Research that should live in a sub-agent (saves main-context tokens) vs work pulled into the main loop unnecessarily.

```
❌ Doing a 10-file codebase survey directly in the main loop → fills context, makes later calls expensive
✅ Explore sub-agent returns a 200-word summary → main loop retains room for implementation
```

Ask: is this exploration work, or decision work? Exploration → sub-agent.

### 5. Pattern absence

A violation surfaces, but no `.claude/patterns/<file>.md` exists for it yet.

```
❌ dep-boundary violation → agent must re-derive the rule from scratch at the next encounter
✅ dep-boundary.md exists → single consultation prevents the next violation
```

Ask: if this happened again, would the next agent know what to do without re-deriving?

### 6. Stale memory / doc

Outdated frontmatter descriptions, broken path references, `FIXED` items lingering in `docs/PAIN.md` instead of `docs/PAIN-archive.md`, session hooks advertising solved problems.

```
❌ session-context.sh shows "Top PAIN: P1 — Layer wiring fan-out" after the fan-out is fixed
✅ Move the item to PAIN-archive.md; session hook now surfaces the real top open item
```

Ask: does any documentation describe a world that no longer exists?

### 7. Asymmetric feedback

A check's cost is out of proportion to the problem it catches. Invert the ratio.

```
✅ 30 s pre-commit hook catches a 30 min investigation → strong positive ROI
❌ 5 min hook catches a 10 s problem that self-documents in the error → negative ROI, remove it
```

Ask: for each hook/check, what is the (time-to-catch) / (time-to-fix-if-missed) ratio? Should it move left, move right, or be removed?

### 8. Context-priming friction

The same SPEC section re-read every session because no nav doc or session hook collapses it.

```
❌ Start-of-session ritual: "Read SPEC §3 + Appendix A" — full text, every session, ~500 tokens
✅ Read SPEC-nav.md first (~50 tokens) → jump directly to the one section this task needs
```

Ask: what do I re-read most often? Can a nav file, session hook, or memory entry replace the full re-read?

---

## Output channels — where findings land

| Finding type                                           | Output channel                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Friction with no fix yet, or fix > 30 min              | `docs/PAIN.md` (new item, severity-tagged)                             |
| Problem solved this cycle → archive an open PAIN item  | `docs/PAIN-archive.md` (cut from PAIN.md, add `FIXED <date> in <sha>`) |
| Recurring pattern that benefits from documentation     | `.claude/patterns/<name>.md` (new pattern file)                        |
| Mechanizable check (detectable, fixable automatically) | `lefthook.yml` hook + `.claude/hooks/<name>.sh`                        |
| Conceptual gap in agent instructions                   | `CLAUDE.md` edit (minimal — one line or one table row)                 |
| User-specific working preference                       | auto-memory file                                                       |

If a finding fits two channels, pick the one that **closes the loop the fastest** (hook > pattern > PAIN item).

---

## Stop conditions — when to end the hunt

- **3 candidates surfaced.** Write them up before scanning further; saturation.
- **No new candidate in the last 5 minutes.** Signal exhausted for this repo state.
- **30-minute time-box exceeded.** Treat remaining suspects as a PAIN item; don't let the hunt become a task.

---

## Quick checklist (copy-paste for a hunt session)

```
Triggers that fired: ___
Hunt start time: ___

Candidates:
  1. Target: ___ | Heuristic: ___ | Output channel: ___
  2. Target: ___ | Heuristic: ___ | Output channel: ___
  3. Target: ___ | Heuristic: ___ | Output channel: ___

Stopped because: ___
```
