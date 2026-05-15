# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

## P24 — Four tsgo diagnostics remain `"off"` pending adapter-to-platform migration (severity: annoys)

**Symptom.** The following `@effect/language-service` diagnostics are disabled in
`packages/host/tsconfig.json` because the violations are structural (adapter bridge code
using node built-ins and console/fetch globals):

| Diagnostic            | Files                                                                                             | Blocker                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `nodeBuiltinImport`   | All adapters (`node:fs`, `node:child_process`, etc.) + `EventStore.ts` (`createHash`) + `main.ts` | adapter-to-@effect/platform-node migration                       |
| `globalConsole`       | `main.ts` (startup log + SIGTERM handler) + `checks/check-test-conventions.ts` (CLI output)       | main.ts is the Node bridge; CLI scripts legitimately use console |
| `globalFetch`         | `OpenAiCompatLlmProvider.ts` (`reasoningAwareFetch` intercept)                                    | Replace with `@effect/platform` HttpClient                       |
| `globalFetchInEffect` | Same                                                                                              | Same as `globalFetch`                                            |

**Acceptance test.** This PAIN entry IS the tracking mechanism. When each diagnostic is
re-enabled as `"error"` and tsgo passes, that diagnostic's entry above is struck and the
commit is cited. P24 is closed when all four are "error".

**Candidate fix (priority order):**

1. `globalFetch`/`globalFetchInEffect` → replace `reasoningAwareFetch` with
   `@effect/platform` HttpClient middleware that intercepts the response body.
2. `globalConsole` in `main.ts` → accept console in the Node entry-point bridge (the
   override list already grants this escape); OR wrap server startup in `Effect.runFork`
   and use `Effect.logInfo`.
3. `nodeBuiltinImport` → migrate adapters to `@effect/platform-node`
   `FileSystem`, `Path`, `CommandExecutor`. `EventStore.ts`'s `createHash` needs a
   synchronous SHA-256 that doesn't import `node:crypto` — consider vendoring a 50-line
   pure-JS SHA-256 or accepting this specific import as a domain invariant.
