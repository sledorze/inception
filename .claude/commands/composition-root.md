Load and apply the composition root pattern from `.claude/patterns/composition-root.md`.

Read the pattern file in full, then apply the guidance when adding adapters or wiring layers:

- `packages/host/src/runtime/bind.ts` is the **only** file that may import from `packages/host/src/adapters/`.
- All other files in `packages/host/src/` depend on port Tags — never on adapter implementations.
- When adding a new adapter: (1) add its import to `runtime/bind.ts`, (2) chain `Layer.provide(NewAdapter.layer)` in `appLayer`, (3) `AppServices` type updates automatically — never hand-maintain it.
- `main.ts` imports only from `runtime/bind.ts` (the `appLayer` and any Tags it re-exports).

The `host-no-adapter-import` dep-cruiser rule enforces this at pre-commit time — violations will block the commit.
