Scan the codebase for violation classes that pass all automated checks today.
For each finding: name the detection gap, propose the enforcement mechanism,
file a PAIN item, and commit a red-step acceptance test (describe.skip until fixed).

## Goal

Make violations **structurally impossible to miss** — not by convention, by tooling.
Every finding must result in a concrete machine-checkable constraint, not a doc update.

## Scan categories

Run each category. For each hit, check whether current tooling (oxlint, dep-cruiser,
lefthook, PostToolUse hooks, TypeScript) would catch it automatically. If not, it's a gap.

### 1. Promise/async abuse in Effect zones (`packages/host/src/`)

```bash
# Standalone async functions (not inside Effect.tryPromise callbacks)
grep -rn "^async \|^export async \| async function\b\| async ()" packages/host/src/ --include="*.ts" | grep -v "// promise-bridge:"

# Raw Promise constructors / combinators
grep -rn "new Promise\|Promise\.resolve\|Promise\.reject\|Promise\.all\|\.then(\|\.catch(" packages/host/src/ --include="*.ts" | grep -v "Effect\.tryPromise\|Effect\.promise\|// promise-bridge:\|runPromise"
```

Enforcement candidates: `effect-patterns/no-async-in-src` oxlint rule + `no-raw-promise` rule,
annotating legitimate bridge files with `// promise-bridge: intentional`.

### 2. Business logic / data transforms in presentation layer

```bash
# API imports directly in components (should go through hooks/)
grep -rn "from '../../api/" packages/app/src/components packages/backoffice/src/components --include="*.tsx"

# Inline data transforms in component bodies (map/filter/reduce not in render)
grep -rn "\.filter(\|\.reduce(\|\.sort(" packages/app/src/components packages/backoffice/src/components --include="*.tsx"

# State mutation patterns that belong in a hook
grep -rn "useState.*null\|setError\|setBusy\|setLoading" packages/app/src/components packages/backoffice/src/components --include="*.tsx" | wc -l
```

Enforcement candidates: dep-cruiser deny rule `components/**` → `api/**`;
extract `useAsyncFetch<T>` hook that owns the `useState + fetch + .catch(setErr)` boilerplate.

### 3. Dep-cruiser allow-all rules (missing sub-directory deny rules)

```bash
# Find rules with only 'from' + 'to' and no 'severity: error' deny entries
grep -A5 "from.*path.*app\|backoffice" .dependency-cruiser.cjs | grep -v "deny\|error\|Forbidden"

# Verify current component→api crossing is NOT flagged
node_modules/.bin/depcruise --validate .dependency-cruiser.cjs --output-type err \
  packages/app/src/components/app/Metrics.tsx 2>&1 | head -5
```

Enforcement candidates: replace allow-all entry with explicit deny rules for
`components→api`, `api→components`, and `hooks→components` (upward dep).

### 4. Doc-only rules in CLAUDE.md with no machine backing

```bash
# Rules mentioned as "hard rules" or "never" — check each has a matching lint/hook entry
grep -n "hard rule\|never\|must not\|forbidden" CLAUDE.md | head -20

# Cross-reference against oxlint plugin rules
grep -n "rules" packages/host/.oxlintrc.json

# Cross-reference against check-effect-patterns.sh checks
grep -n "ERROR" .claude/hooks/check-effect-patterns.sh
```

For each CLAUDE.md hard rule without a matching lint/hook: the gap is the enforcement
mechanism. Each gap → a PAIN item.

### 5. Pattern files that should be commands

```bash
# Pattern files accessed in hunt logs (proxy for "consulted frequently")
grep -rn "patterns/" docs/PAIN*.md CLAUDE.md | grep -v "^--"

# Patterns not referenced in CLAUDE.md "When in doubt" section
sed -n '/When in doubt/,/^---/p' CLAUDE.md | grep "patterns/"
```

Pattern files referenced in hunt logs but absent from "When in doubt" → candidates for
`.claude/commands/` entries (project-level slash commands, always discoverable).

### 6. Test layer gaps (port without red-side protocol test)

```bash
# Ports that exist but have no matching protocol test
ls packages/host/src/ports/driving/ packages/host/src/ports/driven/
ls packages/host/tests/protocol/

# Protocol tests that cover only fake adapter, not prod
grep -l "InMemory\|Fake" packages/host/tests/protocol/*.spec.ts | \
  xargs grep -L "Sqlite\|FileBack\|Scrypt\|EventStore"
```

Enforcement candidates: L2.14 law test assertion that every port file has a matching
`tests/protocol/<Port>.spec.ts` parametrised over all bound adapters.

### 7. Type safety gaps at external boundaries (`as` casts, `unknown` re-used as `any`)

```bash
# Unsafe casts in src/
grep -rn " as [A-Z]\| as Record\| as unknown" packages/host/src/ --include="*.ts" | grep -v "// cast:"

# Schema.decodeUnknownSync used in Effect contexts (wrong API — use decodeUnknownEffect)
grep -rn "decodeUnknownSync\|decodeSync" packages/host/src/ --include="*.ts" | grep -v "Effect.try"
```

Enforcement candidates: tsgo `no-blind-cast` diagnostic; `effect-patterns/no-decode-sync-in-effect` rule.

### 8. Stale TODO/PAIN cross-references

```bash
# PAIN items archived without acceptance test citation
grep -B2 "FIXED" docs/PAIN-archive.md | grep -v "test:"

# TODO items marked [done] with no linked commit or test
grep "\[done\]" docs/TODO.md | grep -v "(20[0-9][0-9]-"
```

Enforcement candidates: `check-pain-closure.sh` PostToolUse hook already checks this;
verify it runs on edits to PAIN.md and PAIN-archive.md.

## Enforcement mechanism taxonomy

When a gap is found, pick the tightest available enforcement layer:

| Layer                       | When to use                                       | Feedback latency  |
| --------------------------- | ------------------------------------------------- | ----------------- |
| **TypeScript strict**       | Type-level invariant (shape, brand, nullability)  | Instant (tsgo)    |
| **oxlint rule** (plugin)    | AST pattern — keyword, call, import shape         | PostToolUse (1 s) |
| **PostToolUse hook** (grep) | Multi-file or cross-file pattern oxlint can't see | PostToolUse (1 s) |
| **dep-cruiser deny**        | Import graph boundary                             | Pre-commit (10 s) |
| **lefthook pre-commit**     | File convention, naming, format                   | Pre-commit (10 s) |
| **Vitest acceptance test**  | Behavioural contract ("lint should catch X")      | Pre-commit / CI   |
| **CI job**                  | Full-repo scan, mutation score, coverage ratchet  | PR (minutes)      |

Prefer the highest (tightest, fastest) layer that can express the constraint.
A CI-only check is always weaker than a PostToolUse check — violations survive until PR.

## Output

For each gap found:

1. **PAIN item** in `docs/PAIN.md` — severity, symptom (why tooling misses it),
   candidate fix (name the enforcement layer + mechanism).
2. **Red-step acceptance test** — add as `describe.skip` or `it.skip` to an existing
   test file, or create `tests/unit/<topic>.unit.test.ts`. Remove `.skip` in the fix commit.
   Cite the test path in the PAIN item.
3. **TODO item** in `docs/TODO.md` under the current or a new phase — red step + green step
   named explicitly.

Commit PAIN + TODO + test stubs together. Do not mix with feature work.
