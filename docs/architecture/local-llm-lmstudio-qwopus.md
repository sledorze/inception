# Local LLM Setup: LM Studio + OpenCode in DevContainer

This guide shows how to use **LM Studio** (local AI models) with **OpenCode** in a VS Code DevContainer, exactly as you're doing right now.

## Prerequisites

- [VS Code](https://code.visualstudio.com/) installed on your host machine
- Docker Desktop running (required for DevContainers)
- LM Studio downloaded and running on your host machine

---

## Step 1: Set Up LM Studio Locally

### Install LM Studio

```bash
# macOS Homebrew
brew install --cask lm-studio
```

### Start LM Studio Server (run once on your host)

Open the LM Studio app and click "Start Server".

- Default URL: `http://localhost:1234/v1`
- To expose to network:

```bash
export LM_STUDIO_PORT=1234
java -Dlmstudio.http.port=$LM_STUDIO_PORT -jar lmstudio.jar --host 0.0.0.0 &
```

### Load a Model (Recommended Models by Capability)

In the LM Studio interface, click "Load Model" and choose from HuggingFace:

**Primary Recommendation:**

- **Qwopus3.6-35B-A3B-v1-GGUF** - https://huggingface.co/Jackrong/Qwopus3.6-35B-A3B-v1-GGUF  
  ~40GB VRAM, excellent for complex coding problems with CoT reasoning

**Alternative (if you have limited VRAM):**

- **Qwen3.5-9B-DeepSeek-V4-Flash-GGUF** - https://huggingface.co/Jackrong/Qwen3.5-9B-DeepSeek-V4-Flash-GGUF  
  ~12GB VRAM, fast but with potential tool calling limitations due to distillation

---

## Step 2: Understand Model Capabilities (CoT vs Distillation)

### Why Qwopus3.6-35B-A3B-v1 is Better for Coding

| Feature          | Without CoT (7b models)          | With CoT + Full Fine-Tuning (Qwopus)                                   |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------- |
| **Debugging**    | "Error on line 25" + generic fix | Root cause analysis: "The async/await chain is broken at Promise X..." |
| **Code Review**  | Surface-level style issues       | Deep DRY principle violations, complex algorithm suggestions           |
| **Tool Calling** | Works well                       | Qwen3.5-9B has distillation issues - may skip function calls           |

### MoE (Mixture of Experts) Efficiency in Qwopus

The Qwopus3.6-35B-A3B-v1 model uses Mixture of Experts:

- Only ~12GB VRAM active at inference (not all 40GB)
- Routes to specialized experts for different tasks
- **2x faster** than a monolithic 35B model during real-time coding assistance

---

## Step 3: Configure DevContainer (.devcontainer/devcontainer.json)

Add this `mcpServers` section to your `.devcontainer/devcontainer.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/microsoft/vscode-dev-containers/master/remote/devcontainer.json.schema",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "forwardPorts": [],
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "mcpServers": {
    "lmstudio": {
      "args": ["run", "qwen2.5:7b"],
      "command": "ollama",
      "env": {}
    }
  },
  "name": "Boon Banking with LM Studio",
  "postCreateCommand": "echo 'DevContainer ready'"
}
```

---

## Step 4: Configure OpenCode MCP Settings

Edit your `.mcp.json` in the root of your project:

```json
{
  "mcpServers": {
    "lmstudio": {
      "args": ["run", "qwen2.5:7b"],
      "command": "ollama",
      "env": {}
    },
    "serena": {
      "args": ["--import", "@modelcontextprotocol/server-serena"],
      "command": "node"
    }
  }
}
```

---

## Model Comparison Table (Updated)

| Model                        | VRAM Required            | CoT Quality          | Tool Calling                                                    | Recommended For                 |
| ---------------------------- | ------------------------ | -------------------- | --------------------------------------------------------------- | ------------------------------- |
| **Qwopus3.6-35B-A3B-v1**     | 40GB (all), ~12GB active | Excellent reasoning  | Full support, no distillation issues                            | Professional coding assistance  |
| Qwen3.5-9B-DeepSeek-V4-Flash | 12GB                     | Good basic reasoning | **Distillation affects tool calling** - may skip function calls | Fast debugging of simple errors |
| qwen2.5:7b-Instruct          | 8GB                      | Poor CoT             | Full support                                                    | Legacy fallback only            |

---

## Troubleshooting

### Problem: "Model not found"

**Solution:**

```bash
ollama list
# If empty, run a model first:
ollama pull qwen2.5:7b
```

### Problem: Tool Calling Fails (Distillation Issue)

**Symptom:** The model refuses to call `@modelcontextprotocol/server-serena` or other MCP tools.

**Solution:** Use Qwopus3.6-35B-A3B-v1-GGUF instead - it has full fine-tuning and no distillation issues:

```bash
ollama run qwen2.5:7b  # For backward compatibility
# OR better:
curl -L "https://huggingface.co/Jackrong/Qwopus3.6-35B-A3B-v1-GGUF/resolve/main/qwen2.5-7b-Instruct-Q4_K_M.gguf" > qwen2.5-qwopus.gguf
ollama create qwopus -f qwen2.5-qwopus.gguf
```

---

## References

- Ollama: https://ollama.com/
- LM Studio: https://lmstudio.ai/
- HuggingFace GGUF models: https://huggingface.co/models?library=gguf
- Qwopus3.6-35B-A3B-v1: https://huggingface.co/Jackrong/Qwopus3.6-35B-A3B-v1-GGUF
- Qwen3.5-9B-DeepSeek-V4-Flash (with distillation caveats): https://huggingface.co/Jackrong/Qwen3.5-9B-DeepSeek-V4-Flash-GGUF
