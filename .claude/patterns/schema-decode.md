# Pattern: Schema decode at boundaries

**Enforced by:** `effect(schemaSyncInEffect)` tsgo rule + `effect(unknownInEffectCatch)` tsgo rule  
**Law:** §2.13 (no `as` casts without validation) + L2.14 (hex boundaries)

Use Effect's Schema API at every data boundary. Never use `as { ... }` casts on externally-sourced data. The right API depends on context.

---

## Three-way decision

| Context                                        | API                                                                     | When to use                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Inside `Effect.gen` (can `yield*`)             | `Schema.decodeUnknownEffect(S)(v).pipe(Effect.orDie)`                   | Event payload decode (defect semantics — trusted internal events should always decode)              |
| HTTP/API boundary (sync, returns typed Result) | `Schema.decodeUnknownResult(S)(v)`                                      | HTTP request body validation; check with `Result.isFailure(r)` → 422, use `r.success` on success    |
| `Effect.try`'s `try: () =>` sync callback      | Extract decode to a named helper function OR use library generic typing | The `schemaSyncInEffect` rule fires for inline `Schema.decodeUnknownSync` inside `Effect.gen` scope |

---

## Canonical patterns

### Internal event payload (defect semantics)

```ts
// In Effect.gen body — use decodeUnknownEffect
const p = yield * Schema.decodeUnknownEffect(GoalSubmittedPayload)(event.payload).pipe(Effect.orDie)
goals.set(event.correlationId, p.goal)
```

### HTTP request body (business error semantics)

```ts
// At HTTP boundary — use decodeUnknownResult
const bodyResult = Schema.decodeUnknownResult(SubmitGoalBody)(rawParsed)
if (Result.isFailure(bodyResult)) {
  res.writeHead(422).end('missing or invalid goal/handleId')
  return
}
const { goal, handleId } = bodyResult.success
```

### DB adapter single-column query (trusted schema, no Schema decode needed)

```ts
// Use better-sqlite3 generic typing instead of Schema for simple single-column reads.
// The DB schema is controlled by the application — a cast via generic is appropriate.
const lastRow = db
  .prepare<
    [string],
    { content_hash: string }
  >('SELECT content_hash FROM events WHERE session_id = ? ORDER BY rowid DESC LIMIT 1')
  .get(sessionId)
const prevHash = lastRow?.content_hash ?? 'genesis'
```

### DB adapter full-row decode (Schema validates the DB row shape)

```ts
// rowToStoredEvent is a standalone function (not inside Effect.gen) — Schema.decodeUnknownSync is fine
function rowToStoredEvent(row: unknown): StoredEvent {
  const r = Schema.decodeUnknownSync(StoredEventRow)(row)
  return { actor: r.actor, contentHash: r.content_hash, ... }
}
// Inside Effect.try (sync callback) — call the function, don't inline Schema.decodeUnknownSync
return db.prepare('SELECT * FROM events ...').all(...params).map(rowToStoredEvent)
```

---

## Why NOT `Effect.try(() => Schema.decodeUnknownSync(S)(v)).pipe(Effect.orDie)`

This pattern was common before Effect v4's `decodeUnknownEffect`. It fires two tsgo rules:

- `effect(schemaSyncInEffect)` — use `decodeUnknownEffect` inside Effect.gen instead
- `effect(unknownInEffectCatch)` — `Effect.try`'s catch must return a typed error, not unknown

Replace with `Schema.decodeUnknownEffect(S)(v).pipe(Effect.orDie)` directly.

---

## Payload schemas

All event payload schemas live in `packages/host/src/domain/events.ts`:

- `GoalSubmittedPayload`, `GoalCompletedPayload`
- `ClarifyRequestedPayload`, `ClarifyAnsweredPayload`
- `CapabilityProposedPayload`, `DecisionPayload`
- HTTP body schemas: `SubmitGoalBody`, `RejectGoalBody`, `RespondBody`

Add new payload schemas there — never inline a `Schema.Struct` at the decode site.

---

## Regression guard

`packages/host/tests/integration/schemaDecodeBoundary.integration.test.ts` contains 6 tests
that pass malformed payloads to application functions and assert defects. These tests FAIL
if someone reverts to `as` casts (silent success with undefined fields).
