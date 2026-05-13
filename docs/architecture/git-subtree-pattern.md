# Git Subtree Pattern for Vendored Repositories

## The Effect Team's Approach (Contributed Learning)

The Effect team recommends vendoring external repositories as git subtrees to give coding agents direct access to idiomatic library patterns. This is a **token-efficient** alternative to repeated web fetches.

### Why This Works Better Than Web Search

- **Token inefficiency**: Web search requires multiple round-trips and fragmented context
- **Missing structure**: Snippets without surrounding structure make pattern discovery harder
- **Local exploration**: Agents can follow usage patterns, trace abstractions like normal code
- **Pattern density**: A full codebase has examples you can't get from isolated snippets

### Git Subtree vs. Git Submodule

**Subtrees are better for this use case because:**

- Direct nesting - behaves like any other directory (no indirection)
- No initialization required when cloning
- No `.gitmodules` metadata to track
- Works out of the box with all editors

### The Exact Command

```bash
git subtree add \
  --prefix=repos/effect \
  https://github.com/Effect-TS/effect.git \
  main \
  --squash -m "docs: vendored Effect v4 source code"
```

**Key flags:**

- `--prefix`: Controls where the repo lives inside your project (recommend `repos/`)
- `--squash`: Collapses entire history into a single commit (keeps it small)

### Updating the Subtree

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git main --squash
```

### Editor Configuration (.vscode/settings.json)

```json
{
  "files.exclude": { "repos/**": true },
  "files.watcherExclude": { "repos/**": true },
  "javascript.preferences.autoImportFileExcludePatterns": ["repos/**"],
  "search.exclude": { "repos/**": true },
  "typescript.preferences.autoImportFileExcludePatterns": ["repos/**"]
}
```

### AGENTS.md Configuration

```markdown
## Vendored Repositories

- Use @repos/ as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - use normal package dependencies instead
```

### Trade-Offs (as documented by Effect)

**Costs:**

- Increases project size slightly (but manageable with squash)
- You're responsible for keeping them up to date
- Requires one extra command per new dependency

**Payoff:**

- **Improved agent output quality** when using external dependencies
- Especially valuable in an era where humans do less hands-on coding
- Direct access to idiomatic patterns without token inefficiency

### Contribution Summary

This pattern is now documented here for future template users. The Effect team's approach shows that **vendor source code, don't just depend on npm packages** - especially when working with AI agents.
EOF
echo "Created git-subtree-pattern.md"
cat /tmp/devcontainer-claude-template/git-subtree-pattern.md | head -20
