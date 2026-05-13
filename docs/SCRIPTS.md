# Optional Scripts & Dependencies

Copy these into your `package.json` as needed.

## Already Included

```json
{
  "devDependencies": {
    "lefthook": "^2.1.0",
    "oxlint": "^1.51.0",
    "prettier": "^3.8.0",
    "prettier-plugin-packagejson": "^3.0.0",
    "prettier-plugin-sort-json": "^4.2.0"
  },
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "prepare": "lefthook install"
  }
}
```

## TypeScript Project

```json
{
  "devDependencies": {
    "tsx": "^4.20.0",
    "typescript": "^5.9.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

## Testing (Vitest)

```json
{
  "devDependencies": {
    "vitest": "^4.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest"
  }
}
```

## Monorepo (Turborepo)

```json
{
  "devDependencies": {
    "syncpack": "^14.0.0",
    "turbo": "^2.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "syncpack:check": "syncpack lint",
    "syncpack:fix": "syncpack fix",
    "test": "turbo run test"
  },
  "workspaces": ["apps/*", "packages/*"]
}
```

## Python (via uv)

No `package.json` needed! Use commands directly:

```bash
# Project setup
uv init                    # Create pyproject.toml
uv add requests pandas     # Add dependencies
uv sync                    # Install all deps

# Running
uv run python script.py    # Run with deps
uv run pytest              # Run tests

# Tools without installing
uvx ruff check .           # Lint
uvx ruff format .          # Format
uvx mypy .                 # Type check
```

## Docker

```json
{
  "scripts": {
    "docker:build": "docker build -t my-project .",
    "docker:lint": "find . -name 'Dockerfile*' -not -path './node_modules/*' | xargs hadolint",
    "docker:run": "docker run -it --rm my-project"
  }
}
```

## Unused Code Detection (Knip)

```json
{
  "devDependencies": {
    "knip": "^5.0.0"
  },
  "scripts": {
    "knip": "knip",
    "knip:fix": "knip --fix"
  }
}
```

## Quality Check (All-in-one)

```json
{
  "scripts": {
    "quality:check": "npm run typecheck && npm run lint && npm run test"
  }
}
```

## Full Example (TypeScript + Testing)

```json
{
  "devDependencies": {
    "lefthook": "^2.1.0",
    "oxlint": "^1.51.0",
    "prettier": "^3.8.0",
    "prettier-plugin-packagejson": "^3.0.0",
    "prettier-plugin-sort-json": "^4.2.0",
    "tsx": "^4.20.0",
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  },
  "engines": {
    "node": ">=22"
  },
  "name": "my-project",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "prepare": "lefthook install",
    "quality:check": "npm run typecheck && npm run lint && npm run test",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "type": "module",
  "version": "0.0.0"
}
```
