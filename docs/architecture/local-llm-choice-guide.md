# Local LLM Setup: Choose Your Model

This guide helps you select the best local AI model for your devcontainer environment, from Qwopus3.6-35B-A3B-v1 (best for complex coding) down to qwen2.5:7b-Instruct (fastest for simple tasks).

## Quick Start: Choose Your Hardware

### If you have 40GB+ VRAM → Use **Qwopus3.6-35B-A3B-v1**

```bash
ollama pull qwen2.5:7b-Instruct-Q4_K_M.gguf  # Or use LM Studio directly
curl -L "https://huggingface.co/Jackrong/Qwopus3.6-35B-A3B-v1-GGUF/resolve/main/qwen2.5-qwopus.gguf" > qwen2.5-qwopus.gguf
ollama create qwopus -f qwen2.5-qwopus.gguf
```

**Why:** Full fine-tuning, no distillation issues with tool calling, excellent CoT reasoning for complex debugging.

### If you have 16GB VRAM → Use **Qwen3.5-9B-DeepSeek-V4-Flash**

```bash
ollama pull qwen3.5:9b-deepseek-flash-Instruct-Q4_K_M.gguf
```

**Why:** Good balance of speed and reasoning, but tool calling may be affected by distillation.

### If you have 8GB VRAM → Use **qwen2.5:7b-Instruct**

```bash
ollama pull qwen2.5:7b-Instruct-Q4_K_M.gguf
```

**Why:** Fast, decent for simple tasks like debugging basic errors.

### If you have 4GB VRAM → Use **llama3.2-1b-Instruct**

```bash
ollama pull llama3.2:1b-Instruct-Q4_K_M.gguf
```

**Why:** Very fast, but only handles very simple reasoning tasks.

## Model Comparison Table (Updated)

| Model                            | VRAM Required            | CoT Quality          | Tool Calling                                                    | Best For                            |
| -------------------------------- | ------------------------ | -------------------- | --------------------------------------------------------------- | ----------------------------------- |
| **Qwopus3.6-35B-A3B-v1**         | 40GB (all), ~12GB active | Excellent reasoning  | Full support, no distillation issues                            | Professional coding assistance      |
| **Qwen3.5-9B-DeepSeek-V4-Flash** | 12GB                     | Good basic reasoning | **Distillation affects tool calling** - may skip function calls | Fast debugging of simple errors     |
| qwen2.5:7b-Instruct              | 8GB                      | Poor CoT             | Full support                                                    | Legacy fallback only                |
| llama3.2-1b-Instruct             | 4GB                      | Very poor CoT        | Full support                                                    | General tasks, not complex problems |

## Understanding Distillation vs Full Fine-Tuning

### What is Distillation?

Distillation = training a large model to mimic the behavior of an even larger teacher model. This makes models smaller and faster, but **can affect tool calling** - especially MCP servers like `@modelcontextprotocol/server-serena`.

### Why Qwopus3.6-35B-A3B-v1 is Better for Coding

- **Full fine-tuning:** No distillation issues with tool calling
- **CoT (Chain of Thought):** Reasons through problems step-by-step before answering
- **MoE efficiency:** Only ~12GB VRAM active at inference despite being a 35B model

### Why Qwen3.5-9B-DeepSeek-V4-Flash Has Tool Calling Issues

The distillation process can cause the model to:

1. Skip function calls when it thinks they're unnecessary
2. Provide generic error messages instead of specific MCP tool invocations
3. Fail on complex multi-step debugging tasks

**Solution:** Use Qwopus3.6-35B-A3B-v1 for any project requiring reliable tool calling.

## Official Models (HuggingFace)

These are the most commonly used official models from HuggingFace:

### 1. qwen2.5:7b-Instruct (Official, Legacy)

**Link:** https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF

- VRAM: ~8GB
- CoT: Poor - mostly pattern matching
- Tool Calling: Full support
- **Best for:** Simple debugging when you have limited hardware

### 2. llama3.1:8b (Official, General Purpose)

**Link:** https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct-GGUF

- VRAM: ~4GB
- CoT: Very poor - basic pattern matching
- Tool Calling: Full support
- **Best for:** Basic syntax checking, not complex reasoning

### 3. qwen3.5:9b-deepseek-flash (Distilled)

**Link:** https://huggingface.co/Jackrong/Qwen3.5-9B-DeepSeek-V4-Flash-GGUF

- VRAM: ~12GB
- CoT: Good basic reasoning
- Tool Calling: **Limited due to distillation**
- **Best for:** Fast tasks when you don't have Qwopus3.6

## Quick Decision Tree

### Do you need reliable MCP tool calling?

- **Yes** → Use **Qwopus3.6-35B-A3B-v1** (only choice)
- **No, just basic chat** → Can use Qwen3.5-9B or qwen2.5:7b

### Do you need multi-step reasoning (debugging complex issues)?

- **Yes** → Use **Qwopus3.6-35B-A3B-v1**
- **No, just simple syntax questions** → Can use qwen2.5:7b or llama3.1

### Do you have 40GB+ VRAM?

- **Yes** → Use **Qwopus3.6-35B-A3B-v1**
- **No (8-16GB)** → Use Qwen3.5-9B-DeepSeek-V4-Flash
- **No (<8GB)** → Use qwen2.5:7b or llama3.1

## Installation Instructions

### Using LM Studio (Recommended)

1. Download and install LM Studio from https://lmstudio.ai/
2. Load the model using the HuggingFace URL above
3. Start the server at `http://localhost:1234/v1`
4. Configure OpenCode MCP in `.mcp.json`:

```json
{
  "mcpServers": {
    "lmstudio": {
      "args": ["run", "qwen2.5:7b"],
      "command": "ollama",
      "env": {}
    }
  }
}
```

### Using Ollama CLI (Alternative)

```bash
# Install Ollama on Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh

# Pull and run a model
ollama pull qwen2.5:7b-Instruct-Q4_K_M.gguf
ollama run qwen2.5:7b "Explain this TypeScript code:" << 'EOF'
function calculateTotal(price, quantity) {
  return price + quantity;
}
EOF
```

## Troubleshooting

### Problem: Tool Calling Fails (Distillation Issue)

**Symptom:** The model refuses to call `@modelcontextprotocol/server-serena` or other MCP tools.

**Solution:** Use Qwopus3.6-35B-A3B-v1-GGUF - it has full fine-tuning and no distillation issues:

```bash
curl -L "https://huggingface.co/Jackrong/Qwopus3.6-35B-A3B-v1-GGUF/resolve/main/qwen2.5-qwopus.gguf" > qwen2.5-qwopus.gguf
ollama create qwopus -f qwen2.5-qwopus.gguf
```

### Problem: "Model not found"

**Solution:**

```bash
ollama list
# If empty, run a model first:
ollama pull qwen2.5:7b-Instruct-Q4_K_M.gguf
```

## References

- Ollama: https://ollama.com/
- LM Studio: https://lmstudio.ai/
- HuggingFace GGUF models: https://huggingface.co/models?library=gguf
- Qwopus3.6-35B-A3B-v1: https://huggingface.co/Jackrong/Qwopus3.6-35B-A3B-v1-GGUF
- Qwen3.5-9B-DeepSeek-V4-Flash (with distillation caveats): https://huggingface.co/Jackrong/Qwen3.5-9B-DeepSeek-V4-Flash-GGUF
- qwen2.5:7b-Instruct (official, legacy): https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF
- llama3.1:8b (official, general purpose): https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct-GGUF
