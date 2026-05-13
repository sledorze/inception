# AI-Powered TypeScript Template

Start your next project with quality gates from day one. No boilerplate, just proven patterns.

**One command to get started:**

```bash
gh repo create my-project --template sledorze/devcontainer-claude-template
```

---

## 🚀 Why This Template?

| Feature                                                                            | What It Does |
| ---------------------------------------------------------------------------------- | ------------ |
| **AI-Powered** - Claude Code built-in with MCP tools for code intelligence         |
| **Type-Safe by Default** - Schema validation at all JSON/protobuf boundaries       |
| **Layered Architecture** - DDD/Clean Architecture enforced at compile time         |
| **Quality Gates Work from Day One** - Tests, coverage thresholds, dependency rules |

## ⚡ Quick Start (2 Commands)

```bash
gh repo create my-project --template sledorze/devcontainer-claude-template
cd my-project && pnpm install
pnpm dev:full              # Supabase + Vite on :3100
```

That's it. You're ready to build a production-ready TypeScript project with quality gates from day one.

---

## 🌟 Features (Non-Technical)

### Layer Violations Caught Before Push

Compile-time enforcement of DDD/Clean Architecture boundaries. Prevents accidental `domain → application` imports that would break your system later.

### No Regression on Accidents

Coverage thresholds that fail when code drops below quality gates (lines ≥50%, functions ≥40%). The baseline prevents threshold inflation from refactoring alone.

### Type-Safe JSON/Protobuf Interchange

Replace `JSON.parse(x) as T` with typed Schema validation at all boundaries. No accidental type confusion - compiler catches it before production.

### Catch Merge Conflicts Early

Pre-push quality gate that merges `origin/main` before checking, catching conflicts in pre-push (fast, local) instead of waiting for CI to fail.

---

## 🛠️ What's Included

### AI Coding

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's CLI (native install with auto-updates)
- **MCP Tools** - Pre-installed for code intelligence:
  - **serena** - Semantic code analysis (symbol navigation, refactoring)
  - **xray** - Codebase exploration and visualization
  - **ts-refactor** - TypeScript refactoring operations

### Backend Patterns

- **Supabase** - Edge Functions, RLS policies, Postgres (zero Node.js servers)
- **DDD/Clean Architecture** - Layered patterns enforced at compile time
- **Effect v4** - Typed services with Schema validation and dependency injection

### Frontend Patterns

- **React + Vite** - Modern component library (shadcn/ui) by default, can be removed
- **Tailwind CSS v4** - Utility-first styling with modern features
- **Plain React for pure rendering** - No Effect overhead in UI components

---

## 📋 Quick Reference

| Task                           | Command                            |
| ------------------------------ | ---------------------------------- |
| Start development (full stack) | `pnpm dev:full`                    |
| Run tests with coverage        | `pnpm test`                        |
| Check layer violations         | `pnpm deps:check`                  |
| View all features              | Read `.template/SETUP.enhanced.md` |

---

## 📚 Documentation

- **GitHub Gist Catalog** - `.github/gists/CATALOG.md` (standalone configs)

- **AI Brief** - [CLAUDE.md](.CLAUSDE.md) (read this first!)
- **Architecture Patterns** - `docs/architecture/*.md`
- **Feature Selection** - `.template/SETUP.enhanced.md`
- **GitHub Gist Catalog** - `.github/gists/CATALOG.md`

---

## 🏗️ Architecture Highlights

### Layered Design (Enforced at Compile Time)

```
domain/          ← Pure, no ports, no application
  ↓              (compile-time violation)
ports/          ← Declare interfaces only
  ↓
application/     ← Use cases with ports + domain
  ↓
data/           ← Storage adapters (live/dev split)
```

### Pre-Push Quality Gate Flow

```
pre-push hook:
  ├─ git merge origin/main → catch conflicts early
  ├─ pnpm typecheck → verify no TypeScript errors
  ├─ pnpm deps:check → enforce layer violations
  └─ pnpm test:coverage:ci → fail on regression
```

---

## 🎯 Getting Started Guide (Non-Technical)

1. **Clone the template** - `gh repo create my-project --template sledorze/devcontainer-claude-template`
2. **Read CLAUDE.md** - Understand what's built-in and why it matters
3. **Run pnpm install** - Install dependencies (takes ~5 minutes)
4. **Start developing** - `pnpm dev:full` brings up Supabase + Vite

### What Makes This Special?

- **AI-Powered** - Claude Code for code intelligence built-in
- **Type-Safe by Default** - Schema validation at all boundaries
- **Quality Gates Work from Day One** - Tests, coverage, dependency rules
- **Layered Architecture** - DDD/Clean Architecture enforced at compile time

### For More Information

See the full documentation in:

- [CLAUDE.md](.CLAUSDE.md) - AI assistant setup and conventions
- `.template/SETUP.enhanced.md` - Feature selection guide
- `docs/architecture/*.md` - Architecture patterns explained

---

## 🔒 Security & Compliance (Out of the Box)

| Tool               | Purpose                          |
| ------------------ | -------------------------------- |
| gitleaks           | Detect secrets before commit     |
| hadolint           | Dockerfile linter                |
| syncpack           | Dependency version consistency   |
| dependency-cruiser | Layer violations at compile time |

---

## 🎨 Customization (Optional)

### Remove the Frontend Entirely

```bash
rm -rf packages/frontend/ vitest.stryker-frontend.config.ts
```

### Skip E2E Testing

```bash
rm -rf e2e/ playwright.config.ts
```

### Use a Different Backend (Plain TypeScript)

Just don't enable the Effect backend in `.template/SETUP.enhanced.md`. The rest of the template works perfectly with vanilla TypeScript.

---

## 🤝 Contributing

This template is designed to be **improved over time**. If you've built something useful, consider:

1. **Adding a new configuration** to `.github/gists/CATALOG.md`
2. **Writing documentation** for a feature or pattern
3. **Creating a GitHub Gist** of a reusable configuration
4. **Submitting a PR** that improves the template experience

See [CONTRIBUTING-AI-GUIDANCE.md](.claude/rules/contributing-back.md) for details.

---

## 📦 License

MIT - See `LICENSE` file in repo root.
