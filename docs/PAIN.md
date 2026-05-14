# PAIN Log — Code-Production Friction

Running record of friction points encountered during development.
Each item has a **severity** (blocks work / slows / annoys), a **symptom**, and a **candidate fix**.
Address these in dedicated review sessions, not inline during feature work.

**Convention:** when an item is fixed, cut it from this file and paste it into `docs/PAIN-archive.md`
in the same commit as the fix. This file holds OPEN items only, severity-sorted.

---

## P10 — LMStudio response shape divergence not surfaced to EventStore (severity: annoys)

**Symptom.** `OpenAiCompatLlmProvider`'s `reasoningAwareFetch` intercept uses
`Schema.decodeUnknownOption(LmMessage)` to parse each `message` object. When the shape
doesn't match (e.g. new LMStudio version adds or removes fields), the intercept emits
`console.warn` and passes the message through unchanged — but this signal never reaches the
`EventStore`, so Claude has no way to inspect it later via `/events` or outer-MCP replay.

**Encountered in.** P7 fix implementation — `console.warn` is a temporary bridge; the proper
channel is an `UnknownShapeObserved` event in the store.

**Candidate fix.** Promote the warn to an `Effect.logWarning` or a structured `UnknownShapeObserved`
event appended to `EventStore`. Requires bridging the fetch intercept (Promise territory) back
to the Effect runtime — probably done via a shared `Queue` injected at boot, similar to how
`CliUserGateway` bridges HTTP callbacks. Worth tackling as part of 3.3 / outer-MCP observability
work.

---

## P8 — `ToolResultObserved` correlationId drift (severity: slows)

**Symptom.** `ToolResultObserved` events carry a fresh UUID instead of the goal's correlationId,
breaking the goal-level correlation chain in the trace. Makes it impossible to join tool events
to their parent goal without a secondary key.

**Encountered in.** S1 trace inspection — `ToolResultObserved.correlationId` ≠ `GoalSubmitted.correlationId`.

**Candidate fix.** Pass the goal's `correlationId` down through `GeorgesToolkit` and use it when
appending `ToolResultObserved` events (currently `GeorgesToolkit.ts` generates a fresh UUID per
tool call).

---

## P3 — `sort-keys` lint rule on handler objects (severity: annoys)

**Symptom.** `Toolkit.of({...})` and any multi-key object literal requires alphabetically sorted
keys. Easy to add a new tool handler in the "logical" order (read → write → run) rather than
lexicographic order; discovered only on `pnpm lint`.

**Encountered in.** `GeorgesToolkit.ts` after adding `run-script` after `write-workspace`.

**Candidate fix.** Enable `sort-keys` in `oxlint-autofix.sh` so the lefthook pre-commit pass
corrects it automatically instead of blocking. Check oxlint docs for `--fix` support on
`sort-keys`.

---

## P6 — `replace_all: true` blast radius on Edit tool (severity: blocks work)

**Symptom.** A broad `replace_all: true` substitution (e.g., `err` → `error`) silently corrupts
unrelated identifiers (`console.error` → `console.erroror`). Requires reading the entire file
after every broad edit to catch collisions.

**Encountered in.** `packages/host/src/main.ts` during `catch-error-name` lint fix.

**Candidate fix.** Avoid `replace_all: true` on short tokens. Prefer targeted single-occurrence
edits or use regex-aware replacement only when the pattern is unambiguous. For lint autofixes,
let `oxlint-autofix.sh` do the rename rather than doing it manually.
