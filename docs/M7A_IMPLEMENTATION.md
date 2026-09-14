# M7-A Implementation Report: Multi-Model & Local AI Support

## Overview & Objectives

In Milestone **M7-A**, JAGGU was extended to empower the developer to choose which AI model powers the agent, including locally hosted and open-weight coding models (e.g. Ollama, LM Studio, vLLM).

The architectural core of JAGGU remains firmly developer-controlled and provider-independent:

$$\text{Model Proposes} \longrightarrow \text{JAGGU Validates} \longrightarrow \text{Developer Approves} \longrightarrow \text{JAGGU Executes}$$

M7-A strictly avoids automatic model routing, swarms, or vector databases. Instead, it provides a clean, capability-aware abstraction where models can be swapped dynamically without restarting the extension host.

---

## Architectural Changes & Key Components

### 1. Provider-Independent Model Registry (`@jaggu/core`)
- **`ModelDescriptor` abstraction**: Strongly typed descriptor containing `id`, `displayName`, `providerId`, `runtimeType` (`cloud` | `local`), `contextWindow`, `maxOutputTokens`, `capabilities` (`streaming`, `toolCalling`, `structuredOutput`, `vision`), `health` status, and optional `huggingFaceModelId`.
- **Runtime Validation**: Validated via Zod (`ModelDescriptorSchema`).
- **`ModelRegistry`**: In-memory catalog pre-populated with curated cloud models (OpenAI, Anthropic, Gemini), local coding models (Qwen 2.5 Coder 7B, DeepSeek-R1 8B, Llama 3.3 70B), generic OpenAI-compatible local defaults, and deterministic Mock models.

### 2. Local Model Runtimes
- **Ollama Provider Hardening (`packages/jaggu-core/src/models/ollama.ts`)**:
  - Native OpenAI/Ollama tool calling formatting for `/api/chat`.
  - Parses streaming tool calls (`tool_calls` in message chunks) into `tool_call_delta` and `tool_call_complete`.
  - Differentiates 404 model-not-found (`MODEL_NOT_FOUND`) from connection failure (`NETWORK_ERROR`).
  - Implements `checkHealth()` probing `GET /api/tags` to discover locally installed models without token costs.
- **Generic OpenAI-Compatible Provider (`packages/jaggu-core/src/models/openaiCompatible.ts`)**:
  - Connects to LM Studio, vLLM, Ollama's `/v1` endpoint, LocalAI, and self-hosted inference servers.
  - Reuses the OpenAI Chat Completions schema with configurable base URLs and optional API keys.
  - Streaming SSE parser with real AbortSignal propagation.
  - Implements `checkHealth()` probing `GET /models`.

### 3. Stream Transport & Real Cancellation (`packages/jaggu-core/src/models/transport.ts`)
- `parseSseStream` and `parseNdjsonStream` strictly monitor `abortSignal`. When aborted, they immediately abort network requests and throw `ModelError('Request was cancelled by user', 'CANCELLED')`.
- Zero leaked network sockets or phantom token generation after task cancellation.

### 4. Capability & Context Bounds in Orchestrator (`packages/jaggu-core/src/agent/agentOrchestrator.ts`)
- **Tool Calling Enforcement**: Before initiating planning or execution cycles that require tools, the orchestrator verifies `descriptor.capabilities.toolCalling`. If false (e.g. reasoning models like `deepseek-r1`), tool definitions are omitted from requests and tool calls are prohibited.
- **Context Window Verification**: Validates prompt and context token estimates against `descriptor.contextWindow`. Throws `CONTEXT_LENGTH_EXCEEDED` with actionable diagnostic instructions if limits are breached.

### 5. UI Model Selector (`@jaggu/ui`)
- **`ModelSelector.tsx`**: Header dropdown component grouping models into **Local / Self-Hosted** and **Cloud Providers**.
- Displays `[LOCAL]` / `[CLOUD]` badges, colored health status dots (green = available, amber = unconfigured, red = unreachable, gray = unknown), and `[No Tools]` tags for models without function calling.
- Emits RPC event `model.select` upon user interaction; listens to `agent.config` and `model.health_changed`.

### 6. VS Code Extension Integration (`@jaggu/vscode`)
- **Configuration settings in `package.json`**:
  - `jaggu.provider`: Active model provider.
  - `jaggu.model`: Active model ID.
  - `jaggu.ollama.endpoint`: Custom Ollama endpoint (default `http://localhost:11434`).
  - `jaggu.openaiCompatible.endpoint`: Custom OpenAI-compatible URL (default `http://localhost:1234/v1`).
  - `jaggu.model.contextLimit`: Manual override context token budget.
- **Credential & Secret Storage**: Cloud API keys remain strictly stored in `vscode.SecretStorage`. Never sent to Webview.
- **Non-blocking Health Checking (`checkRuntimesHealth`)**: Probes local runtimes in the background upon `ui.ready` or explicit refresh, notifying the webview via `model.health_changed`.

---

## Files Changed

| Component | File Path | Purpose |
| :--- | :--- | :--- |
| Core | `packages/jaggu-core/src/types/modelRegistry.ts` | Model descriptor types and Zod schema |
| Core | `packages/jaggu-core/src/types/models.ts` | Updated `ModelProviderId` and `IModelProvider` interface |
| Core | `packages/jaggu-core/src/models/registry.ts` | In-memory `ModelRegistry` catalog and health tracking |
| Core | `packages/jaggu-core/src/models/ollama.ts` | Ollama tool calling, health probe, error classification |
| Core | `packages/jaggu-core/src/models/openaiCompatible.ts` | OpenAI-compatible endpoint adapter (LM Studio/vLLM) |
| Core | `packages/jaggu-core/src/models/transport.ts` | Resilient fetch and cancellation-safe stream parsers |
| Core | `packages/jaggu-core/src/models/gateway.ts` | Registered OpenAI-compatible provider & registry exposure |
| Core | `packages/jaggu-core/src/agent/agentOrchestrator.ts` | Capability checks & context window boundaries |
| Core | `packages/jaggu-core/src/index.ts` | Exported registry classes and types |
| UI | `packages/jaggu-ui/src/types/rpc.ts` | RPC message types for model selection and health |
| UI | `packages/jaggu-ui/src/components/ModelSelector.tsx` | Model selector dropdown with badges and health dots |
| UI | `packages/jaggu-ui/src/App.tsx` | Integrated ModelSelector in header & RPC event handling |
| VS Code | `packages/jaggu-vscode/package.json` | Added configuration settings for endpoints and models |
| VS Code | `packages/jaggu-vscode/src/credentials.ts` | Accessors/mutators for endpoints and provider IDs |
| VS Code | `packages/jaggu-vscode/src/sidebarProvider.ts` | Catalog distribution, model switching, runtime health check |

---

## Verification Results

### Monorepo Quality Gate
- **Build (`npm run build`)**: Pass across all 4 workspaces (`@jaggu/core`, `@jaggu/eval`, `@jaggu/ui`, `jaggu-vscode`).
- **Typecheck (`npm run typecheck`)**: Pass with 0 errors.
- **Lint (`npm run lint`)**: Pass with 0 errors.
- **Unit & Integration Tests (`npm test`)**: **157/157 tests passing** across 26 test suites (0 failed).

### Live Verification Status
Per Phase 14 instructions:
- Probed `http://localhost:11434/api/tags` and `http://localhost:1234/v1/models`.
- No local daemon was running in this sandboxed development environment (`curl` returned connection refused code 7).
- Result: **Live local-model verification not performed.** Deterministic offline mocked provider test suites used exclusively.
