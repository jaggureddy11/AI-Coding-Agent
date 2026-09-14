# Milestone M2 Implementation Record: JAGGU Multi-Provider Model Gateway

**Milestone**: M2 — JAGGU Multi-Provider Model Gateway  
**Completed**: September 14, 2026  
**Status**: COMPLETE & VERIFIED  

---

## 1. Objective & Scope

The goal of Milestone M2 is to replace deterministic mock intelligence with a real, production-ready, provider-independent AI model gateway layer.

The core architecture strictly enforces dependency inversion:

$$\text{JAGGU Agent Core} \longrightarrow \text{IModelProvider} \longrightarrow \text{Provider Adapter} \longrightarrow \text{External / Local Model}$$

Key accomplishments in M2:
1. **Provider Abstraction (`IModelProvider`)**: Formalized common capability metadata, context token limits, streaming generators, tool definition contracts, and structured error hierarchies in `@jaggu/core`.
2. **Multi-Provider Adapters**:
   * **OpenAI Adapter** (`OpenAIProvider`): Server-Sent Events (SSE) streaming, streaming tool-call accumulation, token usage accounting (`gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`).
   * **Anthropic Adapter** (`AnthropicProvider`): SSE streaming with Anthropic's block delta protocol (`message_start`, `content_block_delta`, `message_delta`), system prompt extraction (`claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`).
   * **Google Gemini Adapter** (`GeminiProvider`): REST SSE streaming via `streamGenerateContent?alt=sse` (`gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`).
   * **Ollama Adapter** (`OllamaProvider`): Local daemon NDJSON stream parsing with immediate connection failure classification (`qwen2.5-coder:7b`, `llama3.3:70b`, `deepseek-r1:14b`).
   * **Mock Adapter** (`MockModelProvider`): Deterministic in-memory streaming with simulated delays, tool calls, error injection, and abortable cancellation for test suites.
3. **Model Gateway (`ModelGateway`)**: Dynamic provider registry, unified `streamChat` orchestration, automatic token usage telemetry, and lifecycle event emission to `EventBus`.
4. **Resilient Network Layer (`resilientFetch`)**: Native `fetch` with jittered exponential backoff retry for transient network dropouts and rate limits (429, 5xx), with strict fail-fast non-retry for 401/403 credentials and 400 validation failures.
5. **Real-Time Token Streaming Pipeline**: Incremental token delivery (`token.delta` and `token.complete`) from Provider → Gateway → Extension Host → Webview RPC → React UI state without UI flicker.
6. **Hardware/Network Cancellation**: First-class `AbortController` propagation terminating active HTTP requests and socket streams upon user cancellation (`agent.cancel`).
7. **Secure Credential Management (`CredentialManager`)**: Backed strictly by VS Code `SecretStorage` (`context.secrets`) with zero secrets leaked to the Webview, disk logs, or error payloads.
8. **Automated Verification**: Comprehensive unit test suite (41 unit tests across 7 test suites, 0 external network requests required during CI).

---

## 2. Provider Abstraction & Data Contracts

The model gateway is defined in `packages/jaggu-core/src/types/models.ts` and exports:

### Model Capabilities

```typescript
export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  structuredOutput: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}
```

### Model Request & Options

```typescript
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ModelRequestOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ModelToolDefinition[];
  abortSignal?: AbortSignal;
}
```

### Stream Chunks & Usage

```typescript
export type ModelStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number; costEstimateUsd?: number };
```

### Model Provider Contract

```typescript
export interface IModelProvider {
  readonly id: ModelProviderId;
  readonly name: string;
  readonly defaultModel: string;
  readonly supportedModels: ModelMetadata[];

  getCapabilities(model: string): ModelCapabilities;
  streamChat(messages: ModelMessage[], options: ModelRequestOptions): AsyncIterable<ModelStreamChunk>;
  estimateTokens(text: string): number;
}
```

---

## 3. Provider SDK Strategy Decision (ADR-004)

### Context & Alternatives
When implementing multi-provider support, three strategies were evaluated:
1. **Third-Party Agent Frameworks (e.g. LangChain, LlamaIndex)**:
   * *Rejected*: Introduces massive dependency graphs, complex abstractions, unpredictable breaking changes, and robs JAGGU of architectural control over token budgeting, stream parsing, and cancellation.
2. **Official Vendor SDKs (`openai`, `@anthropic-ai/sdk`, `@google/genai`)**:
   * *Rejected*: Adding 3 separate vendor SDKs increases the VS Code extension bundle size by ~4MB+, introduces multiple conflicting HTTP clients, and complicates unified cancellation/error classification.
3. **Unified Native Fetch + Lightweight SSE/NDJSON Stream Parsers**:
   * **SELECTED**: Built directly on Node.js 20+ / Web-standard `fetch`, `ReadableStream`, `TextDecoder`, and `AbortController`. Zero external npm dependencies. Gives JAGGU 100% control over request construction, error codes, backoff retries, and cancellation.

---

## 4. Streaming Architecture & Flow

The streaming pipeline moves tokens incrementally through the system:

```
Provider (OpenAI / Anthropic / Gemini / Ollama)
       │ (HTTP SSE / NDJSON Chunk)
       ▼
Provider Adapter (openai.ts / anthropic.ts / gemini.ts / ollama.ts)
       │ (yield ModelStreamChunk { type: 'token', text })
       ▼
ModelGateway (gateway.ts)
       │ (emits 'model.text_delta' to EventBus)
       ▼
VS Code Extension Host (sidebarProvider.ts)
       │ (sends RPC postMessage { type: 'token.delta', payload: { text, messageId } })
       ▼
React Webview (App.tsx)
       │ (accumulates token into active message state in real-time)
       ▼
Rendered Markdown Bubble in UI
```

---

## 5. Cancellation Architecture

Cancellation is end-to-end and cancels active network connections:

1. **User Action**: User clicks the "Cancel" button or presses `Escape` in the Webview UI.
2. **Webview RPC**: Sends `{ type: 'agent.cancel' }` to the Extension Host.
3. **Extension Host Execution**: `JagguSidebarProvider.cancelActiveTask()` triggers `activeAbortController.abort()`.
4. **Transport Layer**: The `AbortSignal` propagates to native `fetch({ signal: abortSignal })`.
5. **Network Socket**: The HTTP client immediately closes the underlying TCP socket connection and terminates the stream.
6. **Gateway & Provider Cleanup**: The provider adapter catches the abort, emits `model.cancelled` to `EventBus`, transitions agent state to `CANCELLED`, and resets to `IDLE`.

---

## 6. Secret Storage & Security Architecture

API keys must never be exposed or logged. JAGGU employs a strict security perimeter:

* **VS Code SecretStorage**: Keys are stored using `vscode.ExtensionContext.secrets` (backed by OS keychain: macOS Keychain, Windows Credential Manager, Linux Secret Service / Keyring).
* **Isolation**: API keys are retrieved only inside the Extension Host when constructing outgoing HTTP headers (`Authorization: Bearer <key>`).
* **Webview Sanitization**: The Webview UI receives ONLY the provider name and model identifier via `{ type: 'agent.config', payload: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' } }`. API keys are NEVER sent across the Webview RPC boundary.
* **Log Redaction**: URLs, error objects, and telemetry events NEVER output credential tokens or authorization headers.

---

## 7. Model Lifecycle Events & Observability

The `EventBus` captures telemetry for observability:

| Event Name | Payload Description |
| :--- | :--- |
| `model.requested` | `{ taskId, provider, model, messageCount, timestamp }` |
| `model.stream_started` | `{ taskId, provider, model, timeToFirstTokenMs, timestamp }` |
| `model.text_delta` | `{ taskId, provider, model, deltaLength, timestamp }` |
| `model.tool_call_delta` | `{ taskId, provider, model, toolCallId, name, argumentsDelta, timestamp }` |
| `model.completed` | `{ taskId, provider, model, promptTokens, completionTokens, durationMs, timestamp }` |
| `model.cancelled` | `{ taskId, provider, model, durationMs, timestamp }` |
| `model.error` | `{ taskId, provider, model, code, message, httpStatus, retryable, timestamp }` |

---

## 8. Verification Results

### Automated Test Suite
All 41 unit tests pass across 7 test suites:
* `packages/jaggu-core/test/models.test.ts` (16 tests):
  * Provider metadata and capabilities verification
  * ModelGateway provider resolution and fallback handling
  * OpenAI SSE stream parsing and tool-call aggregation
  * Anthropic SSE streaming block delta handling
  * Google Gemini SSE streaming content parsing
  * Ollama local NDJSON streaming and network connection error classification
  * MockModelProvider latency simulation and error handling
  * Resilient fetch exponential backoff retry loop for 429/503 errors
  * Immediate fail-fast for 401 unauthorized errors
  * AbortSignal cancellation terminating active streams
* `packages/jaggu-vscode/test/integration.test.ts` (2 tests):
  * Webview ↔ Extension Host streaming RPC flow (`token.delta`, `token.complete`)
  * Webview cancellation (`agent.cancel`) aborting active mock stream
* `packages/jaggu-vscode/test/extension.test.ts` (3 tests): Extension activation, command registration, status bar initialization
* `packages/jaggu-ui/test/rpc.test.ts` (9 tests): RPC schema validation and type guards
* `packages/jaggu-ui/test/ui.test.tsx` (5 tests): React Webview rendering and user interaction
* `packages/jaggu-core/test/fsm.test.ts` (5 tests): Agent state machine transitions
* `packages/jaggu-eval/test/runner.test.ts` (1 test): Evaluation runner scaffolding

### Quality Gate
* `npm run build`: Exited code 0 (All packages build cleanly; Webview bundle 152.6 KB)
* `npm run typecheck`: Exited code 0 (Zero TypeScript errors)
* `npm run lint`: Exited code 0 (Zero ESLint warnings or errors)
* `npm test`: Exited code 0 (41 / 41 passing)
