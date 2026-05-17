Load and apply the schema decode boundary pattern from `.claude/patterns/schema-decode.md`.

Read the pattern file in full, then use the three-way decision table to pick the right API:

| Context                                        | API                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Inside `Effect.gen` (can `yield*`)             | `Schema.decodeUnknownEffect(S)(v).pipe(Effect.orDie)`                                     |
| HTTP/API boundary (sync, returns typed Result) | `Schema.decodeUnknownResult(S)(v)`                                                        |
| `Effect.try`'s `try: () =>` sync callback      | Extract to a named helper function (never inline `decodeUnknownSync` inside Effect scope) |

Never use `as { ... }` casts on externally-sourced data. Never call `Schema.decodeUnknownSync` inside `Effect.gen` scope — the `schemaSyncInEffect` tsgo rule will fire.

All event payload schemas live in `packages/host/src/domain/events.ts`. Add new payload schemas there — never inline a `Schema.Struct` at the decode site.
