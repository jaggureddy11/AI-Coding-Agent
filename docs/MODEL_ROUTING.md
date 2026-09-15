# JAGGU Model Routing Architecture

## Overview

JAGGU uses a deterministic, multi-factor **Model Router** (`ModelRouter` in `@jaggu/core`) that dynamically selects the optimal language model for each developer task while enforcing a strict **Free-First Policy**.

By default, JAGGU operates in **Auto Mode** with no requirement for expensive paid API subscriptions.

---

## 1. Auto Mode Principles

1. **Auto is the Default**:
   - The user never needs to know model IDs, endpoints, or complex configuration to start using JAGGU.
   - Simply opening the sidebar and submitting a prompt automatically selects the best available model.

2. **Free-First Priority**:
   - Free cloud models (e.g. Hugging Face Inference router) and local offline models (Ollama, vLLM) are always preferred over paid cloud models.
   - Paid cloud APIs (OpenAI, Anthropic, Gemini) remain **strictly disabled** unless the user explicitly checks `jaggu.allowPaidFallback: true` and configures their API key in VS Code `SecretStorage`.

3. **Multi-Factor Scoring Matrix**:
   The router evaluates models across several objective dimensions:
   - **Task Classification**: Identifies task type (`CODE_MUTATION`, `BUG_FIX`, `TEST_GENERATION`, `REFACTOR`, `EXPLANATION`, `SEARCH`).
   - **Capability Matching**: Ensures candidate model supports required capabilities (e.g., tool calling for code mutation / tests).
   - **Context Window Headroom**: Verifies prompt length + workspace context fits comfortably within model limits.
   - **Coding & Reasoning Benchmark Weights**: Multiplies task-specific weights against model ratings.
   - **Runtime & Access Tier**: Applies bonus points for free cloud and local zero-cost models.

---

## 2. Model Routing Policies

| Policy | Behavior |
| :--- | :--- |
| `free-first` *(Default)* | Prioritizes free cloud models (Hugging Face) and local models (Ollama). Paid models are only considered if free/local options are unavailable AND `allowPaidFallback` is explicitly enabled. |
| `free-and-local-only` | Strictly blocks all paid models under all circumstances. |
| `local-only` | Routes exclusively to locally installed Ollama or OpenAI-compatible (vLLM/LM Studio) daemons. |
| `balanced` | Balanced routing across all configured providers. |
| `cost-optimized` | Minimizes cost per token while satisfying minimum task capability. |

---

## 3. Fallback Orchestration

When an active model encounters a runtime issue (e.g. HTTP 429 Rate Limiting, 401 Auth Failure, Network Timeout, or Model Unavailable):
1. The failure is recorded in `ModelRouter.sessionFailures`.
2. `ModelRouter.routeFallback(currentResult, failureReason)` is invoked to select the next highest-scoring alternative candidate.
3. Fallbacks are strictly bounded to a maximum of **2 automatic attempts** per user interaction to prevent infinite routing loops.
4. If a cloud model fails due to missing credentials, JAGGU seamlessly switches to an available local Ollama model.
5. If no model can service the request, a clear and actionable error message is surfaced in the Webview UI.

---

## 4. Model Catalog Summary

| Model Name | Provider | Access Tier | Context Window | Tool Calling | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen 3 Coder 30B** | Hugging Face | Free | 131,072 | Yes | Complex refactoring, full-stack features |
| **Qwen 2.5 Coder 32B** | Hugging Face | Free | 32,768 | Yes | Fast code generation, unit tests |
| **Llama 3.1 8B Instruct** | Hugging Face | Free | 128,000 | Yes | Lightweight code fixes, explanations |
| **Qwen 2.5 Coder 7B** | Ollama (Local) | Local | 32,768 | Yes | Offline coding, local private dev |
| **DeepSeek-R1 8B** | Ollama (Local) | Local | 32,768 | No | Offline reasoning & architectural explanations |
| **Llama 3.3 70B** | Ollama (Local) | Local | 131,072 | Yes | High-end local workstation development |
| **GPT-4o / Claude 3.5 / Gemini 1.5** | Configured Cloud | Paid *(Opt-in)* | 128k - 1M | Yes | Optional fallback when explicitly enabled |
