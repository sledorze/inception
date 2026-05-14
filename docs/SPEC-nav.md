# SPEC Navigation — Laws Quick Index

One-page lookup for laws. Jump to SPEC.md for full text, if-absent clauses, and derivations.
Source of truth: `docs/SPEC.md`. Update this file whenever a law is added or renamed.

**How to use:** Ctrl-F the law ID → get SPEC line + paired test path.
For ports/stories/calibrations: grep SPEC.md directly (they change faster than laws).

---

## Tier 0 — Meta-laws (SPEC.md §3 line 111)

| ID   | Name                    | SPEC line | Paired test                                                        |
| ---- | ----------------------- | --------- | ------------------------------------------------------------------ |
| L0.1 | Codified Constraint     | 113       | _(no dedicated test; verified at Host boot via laws.yaml)_         |
| L0.2 | Reflexivity             | 115       | _(no dedicated test; CI linkcheck + ConstitutionalAmendment gate)_ |
| L0.3 | Asymmetry Disclosure    | 117       | _(no dedicated test)_                                              |
| L0.4 | Documentation Coherence | 119       | _(no dedicated test; enforced by pairing requirement itself)_      |
| L0.5 | Inviolable Kernel       | 121       | _(no dedicated test; kernel-signatures CI job)_                    |

## Tier 1 — Constitutional laws (SPEC.md §3 line 124)

| ID   | Name                               | SPEC line | Paired test                             |
| ---- | ---------------------------------- | --------- | --------------------------------------- |
| L1.1 | Mediation                          | 126       | `packages/host/tests/laws/L1.1.spec.ts` |
| L1.2 | Containment                        | 128       | _(no dedicated test)_                   |
| L1.3 | Code-over-Data                     | 130       | `packages/host/tests/laws/L1.3.spec.ts` |
| L1.4 | Traceability                       | 132       | `packages/host/tests/laws/L1.4.spec.ts` |
| L1.5 | Reversibility-by-Proposal          | 134       | `packages/host/tests/laws/L1.5.spec.ts` |
| L1.6 | Vector Budget                      | 136       | _(no dedicated test)_                   |
| L1.7 | Information Budget per Handle (DP) | 138       | `packages/host/tests/laws/L1.7.spec.ts` |
| L1.8 | Host Corroboration                 | 140       | `packages/host/tests/laws/L1.8.spec.ts` |

## Tier 2 — Operating laws (SPEC.md §3 line 143)

| ID    | Name                            | SPEC line | Paired test                                                      |
| ----- | ------------------------------- | --------- | ---------------------------------------------------------------- |
| L2.1  | Self-Description                | 145       | `packages/host/tests/laws/L2.1.spec.ts`                          |
| L2.2  | Bounded Mutability              | 147       | _(tested inline in L1.3, L1.5 specs; no dedicated test)_         |
| L2.3  | Quarantine                      | 149       | _(no dedicated test)_                                            |
| L2.4  | Ratcheting                      | 151       | _(no dedicated test; coverage thresholds enforced in CI config)_ |
| L2.5  | Story-Tagging                   | 153       | _(no dedicated test)_                                            |
| L2.6  | Single Promoter per Scope       | 155       | `packages/host/tests/laws/L2.6.spec.ts`                          |
| L2.7  | Idempotent Proposals            | 157       | _(no dedicated test)_                                            |
| L2.8  | Cooldown                        | 159       | _(no dedicated test)_                                            |
| L2.9  | Capability Provenance           | 161       | _(no dedicated test)_                                            |
| L2.10 | Role Versioning                 | 163       | `packages/host/tests/laws/L2.10.spec.ts`                         |
| L2.11 | Variant Provenance              | 165       | `packages/host/tests/laws/L2.11.spec.ts`                         |
| L2.12 | Selection by Fitness, Not Vibes | 167       | _(no dedicated test)_                                            |
| L2.13 | Diversity Reserve               | 169       | `packages/host/tests/laws/L2.13.spec.ts`                         |
| L2.14 | Ports over Implementations      | 171       | _(enforced by dependency-cruiser CI; no law spec)_               |
| L2.15 | AI Work Provenance              | 173       | _(no dedicated test)_                                            |
| L2.16 | Prompt Regression               | 175       | _(no dedicated test)_                                            |

## Tier 3 — Synergy laws (SPEC.md §3 line 178)

| ID    | Name                         | SPEC line | Paired test                                         |
| ----- | ---------------------------- | --------- | --------------------------------------------------- |
| L3.1  | Visible Intent               | 180       | _(no dedicated test)_                               |
| L3.2  | User Acceptance              | 182       | _(no dedicated test)_                               |
| L3.3  | Honest Reporting             | 184       | _(no dedicated test)_                               |
| L3.4  | Bounded Idle Productivity    | 186       | _(no dedicated test)_                               |
| L3.5  | Externalized Memory          | 188       | _(no dedicated test)_                               |
| L3.6  | Trace Sufficiency for Replay | 190       | _(no dedicated test)_                               |
| L3.7  | Continuous Risk Supervision  | 192       | `packages/host/tests/laws/L3.7.spec.ts`             |
| L3.8  | Calibration by Evidence      | 194       | _(no dedicated test; bootstrap flags in §12)_       |
| L3.9  | Assessment Frame             | 196       | _(no dedicated test; process ritual per CLAUDE.md)_ |
| L3.10 | Defence-in-Depth             | 198       | _(no dedicated test; trust_domain in laws.yaml)_    |

## Anti-laws — Explicitly forbidden patterns (SPEC.md §3 line 201)

| ID   | Name                    | SPEC line |
| ---- | ----------------------- | --------- |
| AL.1 | Trust by default        | 203       |
| AL.2 | Silent fallback         | 204       |
| AL.3 | Prompt-only enforcement | 205       |
| AL.4 | Untraced mutation       | 206       |
| AL.5 | Trust by absence        | 207       |
| AL.6 | Documentation drift     | 208       |
| AL.7 | Bloat / re-invention    | 209       |

---

_Missing tests are the top backlog item for Phase 1.5/2 law completeness (see L0.4)._
