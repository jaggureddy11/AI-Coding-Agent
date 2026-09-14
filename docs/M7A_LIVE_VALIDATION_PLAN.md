# M7-A Live Validation Plan: Online & Offline AI Inference

**Target Milestone:** M7-A Live Validation (Online Hugging Face + Offline Ollama)  
**Date:** September 14, 2026  
**Goal:** Prove that JAGGU operates with both real online Hugging Face Inference and real offline Ollama inference through the exact same developer-controlled agent architecture.

---

## 1. Architectural Overview

JAGGU enforces the core invariant:
$$\text{Model Proposes} \longrightarrow \text{JAGGU Validates} \longrightarrow \text{Developer Approves} \longrightarrow \text{JAGGU Executes}$$

The target dual-path architecture:

```text
                         JAGGU
                           │
                    Model Selector
                           │
              ┌────────────┴────────────┐
              │                         │
           ONLINE                     OFFLINE
              │                         │
    Hugging Face Inference            Ollama
    (OpenAI / Anthropic / Gemini)   Local Model
              │                         │
              └────────────┬────────────┘
                           │
                     ModelGateway
                           │
                   AgentOrchestrator
                           │
             Context / Tools / Edits / Git
                           │
                Diagnostics / Tests / Repair
```

The model provides reasoning and proposals; JAGGU owns context, planning, tool permissions, file safety, edit approval, Git safety, diagnostics, verification, repair, and developer control.

---

## 2. Provider Architecture

### Online Provider: `HuggingFaceProvider` (`packages/jaggu-core/src/models/huggingface.ts`)
* **Endpoint:** `https://router.huggingface.co/v1` (Hugging Face Serverless Inference Router)
* **Protocol:** OpenAI-compatible Chat Completions v1 (`/chat/completions` with SSE streaming, tool calls, and usage statistics)
* **Authentication:** `Authorization: Bearer <HUGGINGFACE_TOKEN>`
* **Features:**
  * Real SSE stream parsing via `parseSseStream`
  * Function / Tool calling translation (`tool_calls` delta accumulation)
  * Usage reporting (`promptTokens`, `completionTokens`)
  * Immediate `AbortSignal` cancellation
  * Strict error classification (`AUTH_FAILURE`, `MODEL_NOT_FOUND`, `RATE_LIMIT`, `NETWORK_ERROR`)
  * Health check probing `GET https://router.huggingface.co/v1/models`

### Offline Provider: `OllamaProvider` (`packages/jaggu-core/src/models/ollama.ts`)
* **Endpoint:** `http://localhost:11434`
* **Protocol:** Native Ollama API (`/api/chat` with NDJSON streaming and tool calls)
* **Features:**
  * Health probe via `GET /api/tags`
  * Model discovery and offline availability reporting
  * Missing model classification (`MODEL_NOT_FOUND`)
  * Local daemon connection failure classification (`NETWORK_ERROR`)

---

## 3. Authentication & Secret Isolation

* **Storage:** VS Code `SecretStorage` with provider key `jaggu.apiKey.huggingface`.
* **Zero Leakage Rule:**
  * Token is **never** written to source code, logs, git commits, configuration files, or diagnostics.
  * Token is **never** sent to the Webview UI. The Webview only receives sanitized `ModelDescriptor` health states (`available` vs `missing_credentials`).
  * In non-VS Code environments (e.g. CLI / tests), the token is read from environment variable `HF_TOKEN` / `HUGGINGFACE_API_KEY` or passed explicitly in-memory.

---

## 4. Exact Models to Validate

### 1. Online Model: `Qwen/Qwen2.5-Coder-32B-Instruct` (Hugging Face)
* **Model ID:** `Qwen/Qwen2.5-Coder-32B-Instruct`
* **Provider:** Hugging Face Serverless Inference Router
* **License:** Apache 2.0 (open-weight)
* **Context Window:** 32,768 tokens (up to 131,072)
* **Tool Calling:** Supported (`supports_tools: true` on vLLM backend)
* **Structured Output:** Supported

### 2. Alternative Online Model: `meta-llama/Llama-3.1-8B-Instruct` (Hugging Face)
* **Model ID:** `meta-llama/Llama-3.1-8B-Instruct`
* **Context Window:** 128,000 tokens
* **Tool Calling:** Supported

### 3. Offline Model: `qwen2.5-coder:7b` / `local-coding-model` (Ollama / Local Runtime)
* **Model ID:** `qwen2.5-coder:7b` (Ollama)
* **Runtime:** Local Ollama daemon (`http://localhost:11434`)
* **Tool Calling:** Supported in Ollama v0.3+

---

## 5. Test Tasks & Workflows

### Common Controlled Coding Task: Input Validation
```text
Task: Add input validation to user registration flow.
Requirements:
1. Reject empty username.
2. Reject invalid email.
3. Reject passwords shorter than minimum length.
4. Add comprehensive unit tests.
5. Do not modify unrelated files.
```

### Execution Flow:
1. **Repository Context Assembly**: `ContextEngine` collects bounded codebase snippets with SHA-256 provenance.
2. **Model Plan Generation**: Model proposes multi-step plan.
3. **`PLAN_REVIEW` Human Gate**: Developer approves plan.
4. **Tool / Edit Generation**: Model reads files / generates multi-file `EditSet`.
5. **`EDIT_REVIEW` Human Gate**: Developer reviews diffs with selective approval support.
6. **Atomic Application**: Pre-validated write to disk.
7. **Diagnostics & Tests**: Language server diagnostics check + test suite execution.
8. **Bounded Repair**: If verification fails, bounded self-repair cycle.

---

## 6. Security Invariants & Checks

1. **Tool Execution Isolation**: Model tool requests pass through `ToolExecutor` Zod schema validation and permission checks. Direct command execution is forbidden.
2. **Workspace Containment**: Path traversal (`..`) is strictly blocked.
3. **Git Safety**: Existing developer changes are preserved using baseline SHA checks.
4. **Secret Isolation**: `Authorization` headers are masked in all event bus telemetry and webview messages.
5. **Cancellation Safety**: Aborting task cancels active HTTP streams without hanging or socket leaks.

---

## 7. Failure Criteria & Safe Failure Tests

* **Failure Criteria**:
  * Any unhandled crash or socket leak during model streaming.
  * Secret token entering Webview messages or log files.
  * Model bypassing plan approval or edit approval gates.
  * Model executing arbitrary shell commands or editing outside workspace.
* **Safe Failure Tests**:
  * Online: Request without API key $\to$ `AUTH_FAILURE` / `missing_credentials`.
  * Online: Request invalid model ID $\to$ `MODEL_NOT_FOUND` / `MALFORMED_RESPONSE`.
  * Offline: Ollama daemon stopped / unreachable port $\to$ `NETWORK_ERROR`.
  * Offline: Model not installed in local Ollama $\to$ `MODEL_NOT_FOUND`.

---

## 8. Proposed Implementation Changes

1. **`packages/jaggu-core/src/types/models.ts`**:
   * Add `'huggingface'` to `ModelProviderId` union.
2. **`packages/jaggu-core/src/models/huggingface.ts`**:
   * Implement `HuggingFaceProvider` using resilient fetch, SSE parsing, and OpenAI router protocol (`https://router.huggingface.co/v1`).
3. **`packages/jaggu-core/src/models/registry.ts`**:
   * Add Hugging Face models (`Qwen/Qwen2.5-Coder-32B-Instruct`, `meta-llama/Llama-3.1-8B-Instruct`) to `DEFAULT_BUILTIN_MODELS`.
4. **`packages/jaggu-core/src/models/gateway.ts`**:
   * Register `HuggingFaceProvider` in `ModelGateway`.
5. **`packages/jaggu-vscode/src/sidebarProvider.ts` & `credentials.ts`**:
   * Include `huggingface` in cloud provider credential probing (`jaggu.apiKey.huggingface`).
6. **Tests**:
   * `packages/jaggu-core/test/liveHuggingFaceDirect.test.ts`: Live streaming, tool calling, token usage, cancellation, and missing-token error handling.
   * `packages/jaggu-core/test/liveOllamaDirect.test.ts`: Live Ollama probe and 404 handling.
   * Verify all 165+ tests pass with `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

---

## 9. Evidence to Collect

* Exact model names, latency to first token (TTFT), completion throughput.
* Streaming token chunks and tool call delta logs.
* Complete verification table in `docs/M7A_LIVE_VALIDATION.md` with explicit `LIVE` vs `MOCKED` labels.
