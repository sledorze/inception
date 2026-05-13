---
paths:
  - 'formal/**'
---

# Formal specs

You are inside `formal/`. Per `docs/SPEC.md` L0.2 + L2.6 + §11:

Every load-bearing protocol has a formal spec here, model-checked in CI.

## Scheduled specs

- `formal/promoter.tla` (TODO 1.16) — promoter handshake. Georges proposes → Supervisor evaluates `DelegatedPromotionPolicy` → `Promoted` emitted OR routed to Claude. Properties: **safety** (no two contradictory promotions for the same scope) + **liveness** (every proposal eventually resolves). Lamport-cluster ask.

## Not-yet-scheduled (but mentioned in §11)

- `formal/sandbox-boundary.tla` — what crosses the WASM/WASI boundary; capability attenuation (Miller-cluster ask).
- `formal/dp-composition.tla` — (ε, δ)-DP composition: sequential and adaptive (advanced) bounds (Dwork-cluster ask).

## CI

Every `.tla` file has a matching `.cfg` and is model-checked with `tlc` (or `apalache` for symbolic). Spec changes without a passing model-check fail CI (L0.2 enforcement). Add the new spec to `.github/workflows/formal-check.yml` when you create it.

## When to add a new spec

When you find yourself writing in `docs/SPEC.md` "the protocol is: X happens, then Y, …" and that protocol has more than two states or more than two actors — write it here too. Lamport's discipline: _if you can't write it down precisely, you don't understand it_. The TLA+ effort catches race / deadlock / liveness bugs that prod will surface in months.

## Authoring tips

- Start with state variables + initial state + Next-state relation.
- Express safety as `[]Inv`; liveness as `<>P` or `<>[]P`.
- Use `INSTANCE` to compose sub-protocols.
- Keep one TLA+ module per protocol; one `.cfg` per intended model-check configuration.
- When the spec is too big for `tlc`, factor out a refinement layer or move to `apalache` for symbolic.

## Code economy (§2.13)

Formal specs are _also_ code. The same library/DSL discipline applies: shared TLA+ operators (logging, set operations, sequence helpers) belong in `formal/lib/` once 3+ specs use them.
