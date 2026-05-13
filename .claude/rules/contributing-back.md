---
paths:
  - ".github/gists/"
  - "docs/architecture/*.md"
---

# Contributing Back to devcontainer-claude-template

## How This Template Works

This repository (`devcontainer-claude-template`) is a **starting point** for TypeScript projects that want quality gates "right from day one". All improvements made here should be contributed back upstream to the original template.

## AI Contribution Guidelines

### 1. Review Changes Before Making Them

Before implementing new features or configurations:
- Read `.CLAUSDE.md` and `docs/architecture/README.md`
- Check `.claude/rules/` for path-scoped rules that apply to you
- Look at `.github/gists/CATALOG.md` for existing patterns (don't duplicate)

**Trap to avoid:** Don't implement features from memory - always check if a pattern already exists in the codebase or as a Gist.

### 2. Use the `analyse-from-brief` Skill First

When given a feature request or problem statement, run:
```bash
claude analyse --brief "[feature description]"
```

This skill will:
- Ground in existing files (what we have / what's missing)
- Surface architectural choices with expert lenses
- Generate analysis before any code is written
- Create a plan that can be reviewed and approved

**Never skip this step for non-trivial features.** It prevents "reinventing the wheel" by finding existing patterns first.

### 3. Follow the Template Structure

All new files must follow these conventions:

| File Pattern | Purpose |
|-------------|---------|
| `.github/gists/*.md` | Reusable configurations that can be uploaded to Gist |
| `docs/architecture/*.md` | Architecture documentation (not just code) |
| `.claude/rules/*.md` | Path-scoped AI context for specific directories |

**Don't create:**
- `.ts/.tsx` files without corresponding tests in `scripts/checks/`
- Markdown files in random locations (use the structured docs/ directory)
- New directories without a parent rule file explaining their purpose

### 4. Write Tests First (TDD)

For any new feature or configuration:
1. **Write the test** - Create a spec that exercises the behavior
2. **Implement the production path** - Outside-in from test to implementation
3. **Refactor if needed** - Keep tests green at all times
4. **Run `pnpm typecheck`** - Verify no new TypeScript errors

### 5. Document Before Code

**Rule:** If a feature touches 3+ files or introduces a new pattern, document it first.

Where to document:
- **Architecture patterns:** `docs/architecture/<pattern>.md`
- **Feature decisions:** `docs/decisions/<issue>-<solution>.md`

### 6. Use Gists for Reusable Configurations

If a configuration is:
- Generic enough to apply to multiple projects
- Needs to be versioned separately from this repo
- Might be useful to the original devcontainer-claude-template author

**Then upload it as a Gist first**, then link to it in documentation.

See `.github/gists/CATALOG.md` for examples. The catalog is updated automatically when new gists are added.

### 7. Submit Pull Requests with Clear Context

When you submit a PR:
1. **Title format:** `feat: <one-line summary> (#<issue>)`
2. **Body format:**
   - What problem does this solve?
   - Why is it needed for the template?
   - How does it relate to existing patterns?
3. **Files changed:** Keep under 50 lines of actual code (documentation + configs are fine)
4. **Tests included:** Every PR must have tests, even if they're just a `.spec.ts` file

### 8. Review Changes Before Merging

Before merging any changes:
- Run `pnpm lint:ci typecheck test:coverage:ci deps:check`
- Verify coverage thresholds are maintained (or increase, never decrease)
- Check that `.dependency-cruiser.cjs` rules aren't broken

## Back-Contributions Checklist

After making improvements:

| ✅ Done | Not Done |
|-------|----------|
| [ ] Code passes all tests and linter checks | [ ] Tests fail or lint errors exist |
| [ ] Documentation added (CLAUDE.md, docs/, README) | [ ] No documentation changes |
| [ ] Gist uploaded for reusable configurations | [ ] Configs are hardcoded in repo only |
| [ ] PR created with clear title and body | [ ] Changes pushed without context |

## Quick Reference

| Action | Command |
|--------|---------|
| Analyze feature request | `claude analyse --brief "<request>"` |
| Upload config to Gist | `gh gist create --public <filename>` |
| Check all tests pass | `pnpm lint:ci typecheck test:coverage:ci deps:check` |

---

*This file auto-loads when working with `.github/gists/` or architecture documentation.*
