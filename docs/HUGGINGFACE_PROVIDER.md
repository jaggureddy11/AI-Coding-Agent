# Hugging Face Provider Integration

## Overview

The `HuggingFaceProvider` class (`packages/jaggu-core/src/models/huggingface.ts`) interfaces with Hugging Face's official OpenAI-compatible inference router (`https://router.huggingface.co/v1`).

It powers JAGGU's primary **Free & Open** cloud intelligence tier, giving developers high-performance code generation without recurring API costs.

---

## 1. Supported Free & Open Models

JAGGU includes verified open-weight coding models served on Hugging Face:

1. **`Qwen/Qwen3-Coder-30B-A3B-Instruct`** *(Default)*
   - **Context Window**: 131,072 tokens
   - **Capabilities**: Native streaming, Tool calling / JSON function definitions, structured code mutations
   - **Performance**: High coding (95/100) & reasoning (92/100) benchmark scores
2. **`Qwen/Qwen2.5-Coder-32B-Instruct`**
   - **Context Window**: 32,768 tokens
   - **Capabilities**: Fast code generation, test synthesis, unit test generation
3. **`meta-llama/Llama-3.1-8B-Instruct`**
   - **Context Window**: 128,000 tokens
   - **Capabilities**: Lightweight code editing, explanation, refactoring

---

## 2. API Communication & Streaming Protocol

- **Endpoint**: `https://router.huggingface.co/v1/chat/completions` (configurable via `jaggu.huggingface.endpoint` setting)
- **Format**: Server-Sent Events (`text/event-stream`)
- **Chunks Supported**:
  - `token`: Delta assistant text streaming
  - `tool_call_delta`: Streaming tool call arguments
  - `usage`: Prompt and completion token statistics

---

## 3. Credential Security & Storage

- Hugging Face User Access Tokens (`hf_...`) are stored strictly inside VS Code's native `SecretStorage`.
- **Zero Logging Policy**: Tokens and `Authorization: Bearer ...` headers are NEVER emitted into logs, event buses, telemetry, or Webview RPC messages.
- **Webview Isolation**: The Webview UI only receives model metadata and status strings (`FREE`, `AUTO`, `READY`), never raw credentials.

---

## 4. Error Handling & Auto-Recovery

| HTTP Status | Error Code | Behavior |
| :--- | :--- | :--- |
| `401 Unauthorized` | `AUTH_FAILURE` | Prompts user with a 1-click SecretStorage button to connect Hugging Face token; Auto router attempts local Ollama fallback. |
| `429 Rate Limit` | `RATE_LIMITED` | Auto router marks model temporarily unavailable and immediately routes to alternative free/local model. |
| `503 Service Unavailable` | `PROVIDER_UNAVAILABLE` | Auto router fails over to local Ollama or alternative provider candidate. |
| `Network Timeout` | `NETWORK_ERROR` | Surfaces human-friendly retry message or suggests offline mode. |
