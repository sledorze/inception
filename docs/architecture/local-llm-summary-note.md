# Local LLM Model Selection - Open Summary

> This is a working note documenting my observations about model selection for agentic coding workloads. **Not definitive** - just what I've tested so far.

## What I'm Documenting (Openly)

### Models Tested So Far

| Model                                          | VRAM Needed | Tool Calling Reliability              |
| ---------------------------------------------- | ----------- | ------------------------------------- |
| Qwen3.5-Claude-4.6-Opus-Reasoning-Distilled-9B | ~12GB       | ✅ Better in my testing (not perfect) |
| DeepSeek-V4-Flash-9B                           | ~10GB       | ⚠️ Works but may skip function calls  |
| Qwopus3.6-27B                                  | ~20GB       | ❌ Synthetic CoT issues observed      |

### What I've Observed (Uncertain)

1. **Synthetic CoT often fails tool calling** - This is a pattern I've seen across multiple models, but not proven for every variant.

2. **9B Opus distills work better than 35B Qwopus** - My testing suggests the smaller model has been more reliable, though I haven't exhaustively tested all variants.

3. **Tool calling reliability varies by synthetic vs full fine-tuning** - This is a pattern I've observed but can't guarantee for future releases.

### What You Should Do (Open-Ended)

1. **Test the 9B Opus model first** in your specific workflow before committing to larger models.
2. **Use the decision tree** rather than blindly following recommendations - hardware varies, and my testing is limited.
3. **Read the full guide** at https://github.com/sledorze/devcontainer-claude-template/tree/main/docs/architecture/local-llm-accurate.md for complete context.

---

## 📋 What I'm Still Testing (Open Work)

- More synthetic CoT models beyond Qwen3.5 and DeepSeek-V4 Flash
- How these perform on different hardware configurations (M4 Max, 64–128 GB unified memory, multi-GPU Linux)
- The actual tradeoff between benchmark performance vs agentic reliability in real-world tool calling scenarios

**This is a living document**. My observations will evolve as I test more models and workflows.
