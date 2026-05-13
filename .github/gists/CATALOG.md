# GitHub Gist Catalog: Reusable Back-Contributions

This catalog contains **standalone, versioned configurations** that can be copied directly into any project. Each file is a complete pattern ready to use.

## Quick Links (All Public & Versioned)

| #   | Configuration                                                                  | Gist URL                                                          |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | **DDD Layer Enforcement** - Dependency-cruiser for DDD/Clean Architecture      | https://gist.github.com/sledorze/0524886a0f2dfa89fa70f0a342c8e35e |
| 2   | **Lefthook Pre-Push Gate** - Git hooks with merge-first conflict detection     | https://gist.github.com/sledorze/8746a986b8547aa544604385bc82101e |
| 3   | **Turborepo Inputs/Outputs** - Deterministic cache inputs for faster CI builds | https://gist.github.com/sledorze/ffd2d1e38f532815f5d3c8ecfe7b4a4f |
| 4   | **Effect Schema JSON** - Type-safe JSON/protobuf interchange patterns          | https://gist.github.com/sledorze/3eecb9055faac6ee4fbadec9f482d9ca |
| 5   | **Effect CLI Tooling** - Typed services with Schema validation & DI            | https://gist.github.com/sledorze/2a7232897d8418747334fc8619134809 |
| 6   | **Syncpack Config** - Dependency version consistency for monorepos             | https://gist.github.com/sledorze/d32e205e048c2db135969caad76b882e |
| 7   | **OxLint Config** - TypeScript linter with strict mode & curated exclusions    | https://gist.github.com/sledorze/a98c885db4f09108f49b11060136e89d |
| 8   | **DepCruiser Example** - Starting dependency rules template                    | https://gist.github.com/sledorze/fbff6733cd2e1f45394cd5e8c476dbb9 |

## How to Use These Gists

### Copy-Paste Directly (Recommended)

```bash
curl -L "https://gist.github.com/sledorze/0524886a0f2dfa89fa70f0a342c8e35e" > .dependency-cruiser.cjs
pnpm install dependency-cruiser
pnpm deps:check  # Enforce DDD layer violations at compile time
```

### Embed in Your Documentation

```markdown
See [DDD Layer Rules](https://gist.github.com/sledorze/0524886a0f2dfa89fa70f0a342c8e35e) for a working example.
```
