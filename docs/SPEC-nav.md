# SPEC Navigation — Laws Quick Index

One-page lookup for laws. Jump to SPEC.md for full text, if-absent clauses, and derivations.
Source of truth: `docs/SPEC.md`. Update this file whenever a law is added or renamed.

**How to use:** Ctrl-F the law ID → get SPEC line + paired test path.
For ports/stories/calibrations: grep SPEC.md directly (they change faster than laws).

---

## Tier 0 — Meta-laws (SPEC.md §3 line 111)

| ID   | Name                    | SPEC line | Paired test                             |
| ---- | ----------------------- | --------- | --------------------------------------- |
| L0.1 | Codified Constraint     | 113       | `packages/host/tests/laws/L0.1.spec.ts` |
| L0.2 | Reflexivity             | 115       | `packages/host/tests/laws/L0.2.spec.ts` |
| L0.3 | Asymmetry Disclosure    | 117       | `packages/host/tests/laws/L0.3.spec.ts` |
| L0.4 | Documentation Coherence | 119       | `packages/host/tests/laws/L0.4.spec.ts` |
| L0.5 | Inviolable Kernel       | 121       | `packages/host/tests/laws/L0.5.spec.ts` |

## Tier 1 — Constitutional laws (SPEC.md §3 line 124)

| ID   | Name                               | SPEC line | Paired test                             |
| ---- | ---------------------------------- | --------- | --------------------------------------- |
| L1.1 | Mediation                          | 126       | `packages/host/tests/laws/L1.1.spec.ts` |
| L1.2 | Containment                        | 128       | `packages/host/tests/laws/L1.2.spec.ts` |
| L1.3 | Code-over-Data                     | 130       | `packages/host/tests/laws/L1.3.spec.ts` |
| L1.4 | Traceability                       | 132       | `packages/host/tests/laws/L1.4.spec.ts` |
| L1.5 | Reversibility-by-Proposal          | 134       | `packages/host/tests/laws/L1.5.spec.ts` |
| L1.6 | Vector Budget                      | 136       | `packages/host/tests/laws/L1.6.spec.ts` |
| L1.7 | Information Budget per Handle (DP) | 138       | `packages/host/tests/laws/L1.7.spec.ts` |
| L1.8 | Host Corroboration                 | 140       | `packages/host/tests/laws/L1.8.spec.ts` |
| L1.9 | Tenant Isolation                   | 143       | `packages/host/tests/laws/L1.9.spec.ts` |

## Tier 2 — Operating laws (SPEC.md §3 line 146)

| ID    | Name                            | SPEC line | Paired test                              |
| ----- | ------------------------------- | --------- | ---------------------------------------- |
| L2.1  | Self-Description                | 145       | `packages/host/tests/laws/L2.1.spec.ts`  |
| L2.2  | Bounded Mutability              | 147       | `packages/host/tests/laws/L2.2.spec.ts`  |
| L2.3  | Quarantine                      | 149       | `packages/host/tests/laws/L2.3.spec.ts`  |
| L2.4  | Ratcheting                      | 151       | `packages/host/tests/laws/L2.4.spec.ts`  |
| L2.5  | Story-Tagging                   | 153       | `packages/host/tests/laws/L2.5.spec.ts`  |
| L2.6  | Single Promoter per Scope       | 155       | `packages/host/tests/laws/L2.6.spec.ts`  |
| L2.7  | Idempotent Proposals            | 157       | `packages/host/tests/laws/L2.7.spec.ts`  |
| L2.8  | Cooldown                        | 159       | `packages/host/tests/laws/L2.8.spec.ts`  |
| L2.9  | Capability Provenance           | 161       | `packages/host/tests/laws/L2.9.spec.ts`  |
| L2.10 | Role Versioning                 | 163       | `packages/host/tests/laws/L2.10.spec.ts` |
| L2.11 | Variant Provenance              | 165       | `packages/host/tests/laws/L2.11.spec.ts` |
| L2.12 | Selection by Fitness, Not Vibes | 167       | `packages/host/tests/laws/L2.12.spec.ts` |
| L2.13 | Diversity Reserve               | 169       | `packages/host/tests/laws/L2.13.spec.ts` |
| L2.14 | Ports over Implementations      | 171       | `packages/host/tests/laws/L2.14.spec.ts` |
| L2.15 | AI Work Provenance              | 173       | `packages/host/tests/laws/L2.15.spec.ts` |
| L2.16 | Prompt Regression               | 175       | `packages/host/tests/laws/L2.16.spec.ts` |

## Tier 3 — Synergy laws (SPEC.md §3 line 178)

| ID    | Name                         | SPEC line | Paired test                              |
| ----- | ---------------------------- | --------- | ---------------------------------------- |
| L3.1  | Visible Intent               | 180       | `packages/host/tests/laws/L3.1.spec.ts`  |
| L3.2  | User Acceptance              | 182       | `packages/host/tests/laws/L3.2.spec.ts`  |
| L3.3  | Honest Reporting             | 184       | `packages/host/tests/laws/L3.3.spec.ts`  |
| L3.4  | Bounded Idle Productivity    | 186       | `packages/host/tests/laws/L3.4.spec.ts`  |
| L3.5  | Externalized Memory          | 188       | `packages/host/tests/laws/L3.5.spec.ts`  |
| L3.6  | Trace Sufficiency for Replay | 190       | `packages/host/tests/laws/L3.6.spec.ts`  |
| L3.7  | Continuous Risk Supervision  | 192       | `packages/host/tests/laws/L3.7.spec.ts`  |
| L3.8  | Calibration by Evidence      | 194       | `packages/host/tests/laws/L3.8.spec.ts`  |
| L3.9  | Assessment Frame             | 196       | `packages/host/tests/laws/L3.9.spec.ts`  |
| L3.10 | Defence-in-Depth             | 198       | `packages/host/tests/laws/L3.10.spec.ts` |

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

_All 40 laws now have paired spec files (100% coverage per L0.4). Law test coverage ratchet: maintained by L0.4.spec.ts._
