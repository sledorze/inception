---
name: bridge-zone
description: When and how to mark Effect/Promise boundary files — the machine-readable annotation that distinguishes legitimate bridges from accidental violations
---

# Pattern: Bridge zones — legitimate Effect/Promise crossings

**Enforced by:** `effect-patterns/no-async-in-src` + `effect-patterns/no-raw-promise` (TODO 10.1 / P35)  
**Context:** `packages/host/src/adapters/` files that wrap Promise-based APIs

---

## The concept

The hard rule "No `async`/`await` or raw `Promise` in `packages/host/src/`" (CLAUDE.md) has two valid exception classes:

1. **Entry point** — `main.ts` uses top-level `await` to boot the runtime. Not an adapter.
2. **Bridge adapters** — adapters that wrap third-party APIs (fetch, Node crypto, `better-sqlite3`) that are inherently Promise-based. These are the composition root's responsibility to isolate.

A **bridge zone** is a file that legitimately crosses the Effect/Promise boundary. The crossing is intentional, documented, and confined to the adapter layer.

---

## The annotation

Add exactly this comment at the **file scope** (top of file or alongside the Promise usage):

```ts
// promise-bridge: intentional
```

This is the **machine-readable marker** that `no-async-in-src` and `no-raw-promise` rules will use to exempt the file. It is not a prose comment — it is a lint suppression signal.

### ✅ Correct

```ts
// promise-bridge: intentional
// This adapter wraps the global fetch API which is inherently Promise-based.
// All callers see only the Effect interface via the LlmProvider port.

export const OpenAiCompatLlmProvider = {
  layer: (opts: Opts) =>
    Layer.effect(
      LlmProvider,
      Effect.gen(function* () {
        const baseFetch = yield* HttpClient.fetch
        return LlmProvider.of({
          complete: req =>
            Effect.tryPromise({
              try: () => baseFetch(url, init).then(r => r.json()),
              catch: e => new LlmProviderError({ cause: e }),
            }),
        })
      }),
    ),
}
```

### ❌ Wrong — Promise chain outside `Effect.tryPromise`

```ts
// No annotation and raw .then() chain exposed at adapter boundary
return baseFetch(url, init)
  .then(r => r.json())
  .then(body => parseBody(body))
```

The problem: `.then()` chains bypass Effect's typed error channel, TestClock, and span propagation.

---

## When a file qualifies as a bridge zone

| Question                                                            | If yes → bridge zone | If no → fix it |
| ------------------------------------------------------------------- | -------------------- | -------------- |
| Does the file wrap a third-party API that only offers Promises?     | ✅                   |                |
| Is the Promise usage inside `Effect.tryPromise` / `Effect.promise`? | ✅ (clean bridge)    | ❌ (leaking)   |
| Is the file in `src/adapters/`?                                     | ✅                   | ❌             |
| Is the file in `src/domain/` or `src/application/`?                 |                      | ❌ never       |

**Bridge zones are only valid in `src/adapters/`.** The domain and application layers must be pure Effect.

---

## Current bridge zones (as of enforcement work P35/P39)

| File                                         | Why                                        |
| -------------------------------------------- | ------------------------------------------ |
| `adapters/driven/OpenAiCompatLlmProvider.ts` | Wraps `globalThis.fetch` (Promise-based)   |
| `adapters/driven/RecordReplayLlmProvider.ts` | Wraps `globalThis.fetch` for record/replay |
| `src/main.ts`                                | Entry point; top-level `await` at boot     |

These three files need the `// promise-bridge: intentional` annotation when TODO 10.1 lands.

---

## Why this matters

Without the annotation, the lint rules introduced by TODO 10.1 would flag every bridge adapter. The annotation is the contract: "this crossing is intentional and reviewed." Any new adapter that uses Promise chains without the annotation fails lint immediately.

**Enforcement ladder:**

```
Bridge zone annotation absent + async/Promise usage → oxlint no-async-in-src / no-raw-promise
Bridge zone in domain/ or application/              → oxlint + code review
try/catch in src/ (any file)                        → oxlint no-try-catch-in-src (P39 / TODO 10.4)
```

---

## Related

- P35 — `async`/`await` and raw `Promise` lint enforcement
- P39 — `try/catch` lint enforcement
- `.claude/patterns/dep-boundary.md` — import graph rules (where adapters can import from)
- `packages/host/.oxlintrc.json` — current lint rules
- `packages/host/tests/unit/oxlint-rules.unit.test.ts` — acceptance tests for lint rules
