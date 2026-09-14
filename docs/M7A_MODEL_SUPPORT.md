# JAGGU M7-A: Model Support & Configuration Guide

This guide details how JAGGU supports multiple cloud and local AI models, how to configure local runtimes, and the supported capability matrix.

---

## Supported Providers & Runtimes

JAGGU provides a clean boundary separating model execution from agent orchestration:

| Provider ID | Runtime Type | Default Base URL | Credential Required | Key Strengths |
| :--- | :--- | :--- | :--- | :--- |
| `mock` | Local / Simulated | N/A | None | Fast offline testing & deterministic verification |
| `ollama` | Local Runtime | `http://localhost:11434` | None | Open-weight models (Qwen, DeepSeek, Llama) with native Ollama API |
| `openai-compatible` | Local / Self-Hosted | `http://localhost:1234/v1` | Optional (if required by host) | Compatible with LM Studio, vLLM, LocalAI, text-generation-webui |
| `openai` | Cloud | `https://api.openai.com/v1` | OpenAI API Key (SecretStorage) | High tool-calling accuracy, large context (GPT-4o) |
| `anthropic` | Cloud | `https://api.anthropic.com/v1` | Anthropic API Key (SecretStorage) | Strong coding & long-form reasoning (Claude 3.5 Sonnet) |
| `gemini` | Cloud | `https://generativelanguage.googleapis.com` | Gemini API Key (SecretStorage) | Multimodal, large context (Gemini 1.5 Pro) |

---

## Model Capability Matrix

| Model ID | Runtime | Context Window | Max Output | Streaming | Tool Calling | Structured Output | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `qwen2.5-coder:7b` | Local (Ollama) | 32,768 | 8,192 | Yes | Yes | Yes | Open-weight coding model with native tool call formatting |
| `deepseek-r1:8b` | Local (Ollama) | 32,768 | 8,192 | Yes | **No** | No | Reasoning distilled model; chat and explanation only |
| `llama3.3:70b` | Local (Ollama) | 131,072 | 8,192 | Yes | Yes | Yes | Large-scale local model for high-spec workstations |
| `local-coding-model` | Local (OpenAI-Compat) | 32,768 | 8,192 | Yes | Yes | Yes | Default model for LM Studio / vLLM local servers |
| `gpt-4o` | Cloud (OpenAI) | 128,000 | 4,096 | Yes | Yes | Yes | Standard flagship cloud model |
| `claude-3-5-sonnet` | Cloud (Anthropic) | 200,000 | 8,192 | Yes | Yes | Yes | High performance coding & planning model |
| `gemini-1.5-pro` | Cloud (Google) | 1,048,576 | 8,192 | Yes | Yes | Yes | Extremely large context window |

---

## Hugging Face Model Compatibility

JAGGU recognizes Hugging Face as an open model ecosystem and registry rather than an execution engine. 
Models hosted on Hugging Face are represented via the `huggingFaceModelId` metadata property (e.g. `Qwen/Qwen2.5-Coder-7B-Instruct`, `deepseek-ai/DeepSeek-R1-Distill-Llama-8B`).

Execution of these models is handled by an active runtime:
- **Locally via Ollama**: `ollama run qwen2.5-coder:7b`
- **Locally via LM Studio or vLLM**: Served via OpenAI-compatible endpoint.

JAGGU does not download models or install Python packages directly.

---

## Local Setup Instructions

### 1. Setting up Ollama
1. Install and start Ollama on your system:
   ```bash
   ollama serve
   ```
2. Pull your desired coding model:
   ```bash
   ollama pull qwen2.5-coder:7b
   ```
3. In VS Code settings (`settings.json`), configure your endpoint (if not using the default):
   ```json
   {
     "jaggu.ollama.endpoint": "http://localhost:11434"
   }
   ```
4. In the JAGGU sidebar header, select **Qwen 2.5 Coder 7B (Ollama)** from the model dropdown.

### 2. Setting up LM Studio or vLLM (OpenAI-Compatible)
1. Start local server in LM Studio (default port `1234`) or vLLM:
   ```bash
   python -m vllm.entrypoints.openai.api_server --model deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct --port 1234
   ```
2. In VS Code settings:
   ```json
   {
     "jaggu.openaiCompatible.endpoint": "http://localhost:1234/v1"
   }
   ```
3. Select **Local OpenAI-Compatible (vLLM / LM Studio)** in the JAGGU UI.

---

## Capability-Aware Fallback & Safety Rules

1. **Models Without Tool Calling**:
   If a model has `capabilities.toolCalling: false` (such as `deepseek-r1:8b`), JAGGU's orchestrator automatically:
   - Suppresses model tool definitions from the request payload to avoid confusing the local model.
   - Refuses automated file editing actions through tools, clearly explaining the model's limitation to the developer.
2. **Context Limits**:
   If the assembled workspace context exceeds the selected model's context window, JAGGU surfaces an explicit diagnostic instead of truncating silently or failing with opaque provider errors.
