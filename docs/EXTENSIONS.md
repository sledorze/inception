# VS Code Extensions Reference

Extensions to add to `.devcontainer/devcontainer.json` → `customizations.vscode.extensions`.

## Included by Default

| Extension                               | Purpose            |
| --------------------------------------- | ------------------ |
| `esbenp.prettier-vscode`                | Code formatting    |
| `streetsidesoftware.code-spell-checker` | Spell checking     |
| `eamodio.gitlens`                       | Git supercharged   |
| `waderyan.gitblame`                     | Inline git blame   |
| `exiasr.hadolint`                       | Dockerfile linting |

## Recommended

### Productivity

```json
"christian-kohler.path-intellisense",  // Path autocomplete
"wayou.vscode-todo-highlight",         // Highlight TODO/FIXME
"natqe.reload"                         // Reload window command
```

### Markdown & Documentation

```json
"yzhang.markdown-all-in-one",          // TOC, preview, shortcuts
"bierner.markdown-mermaid"             // Mermaid diagrams
```

### Shell & Scripts

```json
"timonwong.shellcheck" // Shell script linting
```

### GitHub Integration

```json
"GitHub.vscode-pull-request-github",   // PRs in VS Code
"github.vscode-github-actions"         // Actions workflows
```

## JavaScript/TypeScript

```json
"dbaeumer.vscode-eslint",              // ESLint (if using ESLint)
"biomejs.biome",                       // Biome (alternative to ESLint)
"steoates.autoimport",                 // Auto-import suggestions
"fill-labs.dependi"                    // Show dependency versions inline
```

## Docker

```json
"ms-azuretools.vscode-docker" // Docker management UI
```

## Design & Diagrams

```json
"pomdtr.excalidraw-editor" // Excalidraw diagrams
```

## Full Copy-Paste Block

```json
"extensions": [
  "esbenp.prettier-vscode",
  "streetsidesoftware.code-spell-checker",
  "eamodio.gitlens",
  "waderyan.gitblame",
  "exiasr.hadolint",
  "christian-kohler.path-intellisense",
  "yzhang.markdown-all-in-one",
  "bierner.markdown-mermaid",
  "wayou.vscode-todo-highlight",
  "timonwong.shellcheck",
  "GitHub.vscode-pull-request-github",
  "github.vscode-github-actions",
  "dbaeumer.vscode-eslint",
  "biomejs.biome",
  "steoates.autoimport",
  "fill-labs.dependi",
  "ms-azuretools.vscode-docker",
  "pomdtr.excalidraw-editor"
]
```
