---
paths:
  - 'kernel/**'
---

# Kernel — the inviolable TCB

You are inside `kernel/`. Per `docs/SPEC.md` L0.5:

This directory contains the SPEC's Trusted Computing Base — the smallest set of artifacts whose correctness every other safety claim depends on:

- Actor model (`actor-model.json` — Claude, Georges, User, External Witness pool, plus Supervisor/Monitor tracing identities)
- Laws-to-enforcement map (`laws.yaml`)
- TCB driven-port adapter manifests (`sandbox-adapter.json`, `event-store-adapter.json`, `data-handle-adapter.json`)
- Corroboration discipline manifest (`corroboration.yaml`)
- External Witness pool manifest (`witness-pool.json` — 3-key pool, 2-of-3 quorum threshold)

## Amendment requires

- Claude signature + User-of-record signature + **at least 2 of 3** Witness pool signatures
- Same-commit key rotation for all rotated keys
- CI verifies all required signatures + the rotation event before merging

**Do not edit `kernel/` files in the same commit as anything outside `kernel/`.** Kernel changes are constitutional acts; mixing them with feature work hides the constitutional act and breaks the audit trail.

## What is NOT in the kernel

- Phase-1 vertical-slice code (items 1.1–1.8, 1.12) — application code, not TCB.
- Roles, workflows, capabilities — those evolve under L3.8 / L2.6.
- Risk Register thresholds, fitness dimensions, MAP-Elites axes — bootstrap calibrations (§12).
- Tech decisions (§13) — revisable.

If you want to put something here, ask first: is this the _smallest_ possible kernel that makes the safety claims true? Hardy's rule: a 10 KLOC TCB is verifiable; a 10 MLOC TCB is not. Less is more here.

## Code economy applies doubly

The kernel is where bloat is most expensive (it can never shrink without unanimous re-signing + key rotation). Apply §2.13 + AL.7 here with extra rigour: prefer a tiny DSL over imperative kernel code; prefer one stable library dependency over duplicated kernel logic.
