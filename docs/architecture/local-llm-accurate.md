# Local LLM Setup: Choose Your Model

This guide helps you select the best local AI model for your devcontainer environment, from Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled (best quality/cost ratio) down to 4B variants (fast utility agents).

## Quick Start: Choose Your Hardware & Use Case

### For Agentic Coding Workloads (Tool Calling Required)

**Primary Recommendation:**

- **Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B-GGUF** - Best quality/cost ratio for coding agents  
  https://huggingface.co/Jackrong/Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B-GGUF
  **VRAM:** ~12GB, **CoT:** Excellent reasoning with tool calling support

**Secondary Recommendation:**

- **DeepSeek-V4-Flash-9B-GGUF** - Cheap parallel agents for orchestration  
  https://huggingface.co/Jackrong/DeepSeek-V4-Flash-9B-GGUF  
  **VRAM:** ~10GB, **CoT:** Good basic reasoning, very fast inference

### For Complex Reasoning (More VRAM Available)

- **Qwopus3.6-27B-GGUF** - More advanced reasoning if you have 24+ GB VRAM  
  https://huggingface.co/Jackrong/Qwopus3.6-27B-GGUF
  **VRAM:** ~20GB, **CoT:** Strong instruction following but watch for tool calling issues

### For Fast Utility Agents (Simple Tasks)

- **Qwen2.5:4B-Instruct-Q4_K_M.gguf** - Very fast, basic pattern matching  
  VRAM: ~6GB, CoT: Poor - only use for simple debugging
- **Llama3.2:1b-Instruct-GGUF** - Ultra-fast, very limited reasoning  
  VRAM: ~4GB, CoT: Very poor - not recommended for coding

## Understanding Synthetic vs Full Fine-Tuning

### What is Synthetic CoT?

The distillation process often uses:

- **Synthetic chain-of-thought traces** from stronger proprietary models
- **Benchmark-oriented tuning** to maximize Open LLM leaderboard scores
- **Generated reasoning patterns** that may not translate to real-world robustness

### Why Tool Calling Fails with Synthetic CoT

**Symptom:** The model refuses to call `@modelcontextprotocol/server-serena` or provides fake confidence messages.

**Cause:** These models were optimized for benchmark performance, not agentic reliability:

- They may fabricate APIs instead of recognizing real ones
- They show pseudo-reasoning loops on complex multi-step tasks
- They hallucinate tool responses when the actual API fails

### Why Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B Works Better

**Tested and reliable for:**

1. **Structured output discipline** - Consistent JSON/tool call formatting
2. **Low hallucination under tools** - Doesn't make up fake API responses
3. **Stability on long reasoning chains** - Handles multi-step debugging without degrading
4. **Memory compatibility** - Works well with RAG + graph systems

## Architecture Pattern: Small Fast Planners, Medium Coders

You don't want one giant model for everything. The best approach:

| Role                        | Model Size                                     | Purpose                                               |
| --------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **Router/Parser** (4B)      | Qwen2.5-4B-Instruct                            | Tool caller, quick syntax questions                   |
| **Coding Worker** (9B)      | Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B | Repo navigation, orchestration, structured generation |
| **Strategic Planner** (27B) | Qwopus3.6-27B OR DeepSeek-V4-Flash-10B         | Multi-step tool coordination, long reasoning chains   |

### Example Setup with LM Studio

```json
{
  "mcpServers": {
    "coder": {
      "args": ["run", "qwen3.5-claude-opus-9b"],
      "command": "ollama",
      "env": {}
    },
    "planner": {
      "args": ["run", "qwopus-27b"],
      "command": "ollama",
      "env": {}
    },
    "router": {
      "args": ["run", "qwen2.5:4b"],
      "command": "ollama",
      "env": {}
    }
  }
}
```

## What to Avoid Initially

| ❌ Don't Start With          | ✅ Do Instead                          |
| ---------------------------- | -------------------------------------- |
| Giant 30B+ always-on agents  | Small fast planners (4-9B)             |
| Ultra-long context obsession | Modular architecture with memory layer |
| Benchmark-maximized models   | Verified reliability in tools          |
| Synthetic CoT-only models    | Full fine-tuned or carefully distilled |

## VRAM Requirements & Quantization

| Model                      | Base Size | Recommended Quantization | Actual VRAM Usage |
| -------------------------- | --------- | ------------------------ | ----------------- |
| Qwen3.5-Claude-4.6-Opus-9B | 9B        | Q8_0 or Q6_K             | ~12GB             |
| DeepSeek-V4-Flash-9B       | 9B        | Q4_K_M                   | ~10GB             |
| Qwopus3.6-27B              | 27B       | Q5_K_M                   | ~20GB             |
| Qwen2.5-4B-Instruct        | 4B        | Q8_0                     | ~6GB              |

## Quick Decision Tree

### Do you need reliable MCP tool calling?

- **Yes** → Use **Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B** (only choice)
- **No, just basic chat** → Can use Qwen2.5:7b or llama3.1

### Do you need multi-step reasoning with tools?

- **Yes** → Use 9B Opus or 27B Qwopus
- **No, just simple syntax questions** → Can use qwen2.5:4b or llama3.2

### Do you have 16GB+ VRAM?

- **Yes (16-24GB)** → Use Qwen3.5-Claude-4.6-Opus-9B + DeepSeek-V4-Flash for parallel tasks
- **No (<16GB but >8GB)** → Use only 9B models with careful quantization
- **Very limited (<8GB)** → Stick to 4B/2B utility agents

## Installation Instructions

### Using LM Studio (Recommended)

1. Download and install LM Studio from https://lmstudio.ai/
2. Load the model using HuggingFace URL above
3. Start the server at `http://localhost:1234/v1`
4. Configure OpenCode MCP in `.mcp.json`:

```json
{
  "mcpServers": {
    "coder": {
      "args": ["run", "qwen3.5-claude-opus-9b"],
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
ollama pull qwen3.5-claude-opus-9b-Instruct-Q8_0.gguf
ollama create coder -f qwen3.5-claude-opus-9b-Instruct-Q8_0.gguf
```

## Troubleshooting

### Problem: Tool Calling Fails (Synthetic CoT Issue)

**Symptom:** The model refuses to call MCP servers or provides fake confidence messages.

**Solution:** Use Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B - it has been tested for reliability with agentic workloads:

```bash
ollama pull qwen3.5-claude-opus-9b-Instruct-Q8_0.gguf
```

### Problem: "Model not found"

**Solution:**

```bash
ollama list
# If empty, run a model first:
ollama pull qwen2.5:4b-Instruct-Q8_0.gguf
```

## References

- Ollama: https://ollama.com/
- LM Studio: https://lmstudio.ai/
- HuggingFace GGUF models: https://huggingface.co/models?library=gguf
- **Jackrong collections page:** https://huggingface.co/Jackrong (primary source for Qwopus, Opus distills)
- Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled: https://huggingface.co/Jackrong/Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B-GGUF
- DeepSeek-V4-Flash distilled: https://huggingface.co/Jackrong/DeepSeek-V4-Flash-9B-GGUF
- Qwopus3.6 collections: https://huggingface.co/Jackrong/Qwopus3.6
