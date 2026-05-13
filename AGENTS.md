# AI Agent Guidelines

## How to Use This Repository

This repository is a devcontainer template that provides production-ready starting points for TypeScript projects. The goal is not perfection - it's getting started quickly with proven patterns that work.

## Vendored Repositories (Read-Only Reference)

### @repos/effect/ - Effect v4 Source Code
**Use as read-only reference material when writing idiomatic Effect code.**

This repository vendors the Effect library source code under `@repos/effect/`. Use it as read-only reference material:

- **When writing Effect code:** Read `@repos/effect/LLMS.md` first (this is the source of truth)
- **Follow examples and patterns** in test files under `@repos/effect/test/`
- **Don't edit files under @repos/** - use it as reference material only
- **Import from normal package dependencies**, not from vendored code

**Why this matters:** Direct access to idiomatic patterns (no web search delays). Explore actual implementation, tests, and module structure. Learn from examples across a full codebase, not isolated snippets.

## How to Use Effect Source Code

### Pattern 1: Review Schema Implementation
When you need to use `Schema` in your project:
1. Read the Schema documentation at `@repos/effect/src/Schema.ts`
2. Look at test examples at `@repos/effect/test/SchemaTest.ts`
3. Create a pattern file at `agent-patterns/effect-schema.md` if you need frequent reference

### Pattern 2: Use Effect's Test Patterns
When writing tests with Effect:
1. Read the vitest patterns at `@repos/effect/src/internal/vitest.ts`
2. Look at test examples at `@repos/effect/test/SchemaTest.ts`
3. Don't write tests from memory - copy and adapt patterns directly

### Pattern 3: Use Schema for JSON/Protobuf Interchange
When you need type-safe serialization:
1. Read the decodeUnknownEffect pattern at `@repos/effect/src/Schema.ts`
2. Look at encodeUnknownEffect examples in test files
3. Create a small reference file if you'll use it frequently

## Vendor Directories

This project vendors external repositories under `@repos/`:
- **Use vendored repositories as read-only reference material**
- **Prefer examples and patterns from the vendored source code over generated guesses or web search results**
- **Do not edit files under @repos/** unless explicitly asked
- **Do not import from @repos/** - application code should continue importing from normal package dependencies

## When Writing Effect Code

When writing Effect code, inspect `@repos/effect/` for examples of idiomatic usage:
- Module structure and API design
- Tests that demonstrate proper usage patterns  
- Documentation in LLMS.md and other source files

Treat it as the source of truth for Effect patterns. Create pattern reference files when you need them (e.g., `agent-patterns/effect-schema.md`).

## AGENTS.md Configuration

The important thing is to be explicit about both the location and intended usage of vendored repositories:
- **Location:** `@repos/` directory at project root  
- **Intended usage:** Read-only reference material when working with related libraries

You can also make this more specific for particular libraries you vendor, for example: "When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage."

## Vendored Repositories Section (for AGENTS.md)

```
## Vendored Repositories

This project vendors external repositories under `@repos/`:

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies
```

## Creating Pattern Files

Another useful pattern is to ask the agent to create a small reference file for a particular data type or module from the vendored codebase. This gives the agent a project-local artifact it can come back to later instead of rediscovering patterns repeatedly.

For example, when reviewing Schema implementation:
- Create `agent-patterns/effect-schema.md` with common constructors and combinators
- Include encoding/decoding examples and transformation patterns
- Add error handling patterns and what to avoid

The resulting file doesn't need to be exhaustive - it should be a practical reference capturing the idioms most likely needed when working in your application code.

## Summary

1. **Vendored Repositories:** Use `@repos/` as read-only reference material
2. **Effect Source:** Read `@repos/effect/LLMS.md` first for idiomatic patterns
3. **No Editing:** Never edit files under `@repos/`
4. **Normal Imports:** Continue importing from package dependencies, not vendored code
