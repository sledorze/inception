Load and apply the Effect test pattern from `.claude/patterns/effect-test-pattern.md`.

Read the pattern file in full, then apply the relevant guidance to the current task:

- Use `it.effect` (not `it` + `await Effect.runPromise`) for all Effect-based tests.
- Use `layer(testLayer)(...)` to inject dependencies; compose layers with `Layer.merge` / `Layer.provide`.
- Use `Effect.flip` to test expected failures; avoid `Effect.runPromise` in test bodies.
- Mark RED acceptance tests with `.fails` so pre-commit hooks don't block.
- For frontend tests: use `Response.json(payload)` not `new Response(JSON.stringify(...))`.

If the current task involves writing or modifying tests in `packages/host/tests/`, confirm which pattern applies before writing any test code.
