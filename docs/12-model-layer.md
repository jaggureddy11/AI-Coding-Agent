# 12 — Model Gateway & Provider Abstraction Layer

## 1. Gateway Architecture & Provider Independence

To prevent vendor lock-in and provide maximum developer flexibility, JAGGU implements a strictly polymorphic **Model Gateway Layer** (`packages/jaggu-core/src/models/`). The core agent logic never interacts directly with proprietary SDKs; all inference, streaming, and tool calls route through an abstract `IModelProvider` interface.

```
                              [Agent Core]
                                   │
                                   ▼
                             [ModelGateway]
                                   │
                                   ▼
                       [IModelProvider Contract]
                                   │
         ┌─────────────────┬───────┴─────────┬─────────────────┐
         ▼                 ▼                 ▼                 ▼
[AnthropicProvider] [OpenAIProvider]  [GeminiProvider]   [OllamaProvider]
- Claude 3.5 Sonnet - GPT-4o          - Gemini 2.0 Flash - DeepSeek-R1
- Claude 3.5 Haiku  - GPT-4o-mini     - Gemini 1.5 Pro   - Qwen 2.5 Coder
- Claude 3 Opus     - o1 / o3-mini    - Gemini 1.5 Flash - 100% Offline
```

---

## 2. Core Interface Contracts

```typescript
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
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

export type ModelStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number; costEstimateUsd?: number };

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

## 3. Provider Implementations

### 3.1 `AnthropicProvider`
- **Supported Models**: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`.
- **API Endpoint**: `https://api.anthropic.com/v1/messages`.
- **Transport**: Native `fetch` with pure Server-Sent Events (`message_start`, `content_block_delta`, `message_delta`) stream parser.
- **Capabilities**: Streaming, Tool Calling, Vision, System instructions separation, 200k context.

### 3.2 `OpenAIProvider`
- **Supported Models**: `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`.
- **API Endpoint**: `https://api.openai.com/v1/chat/completions`.
- **Transport**: Native `fetch` with SSE stream parser.
- **Capabilities**: Streaming, Parallel tool calls, Structured outputs, 128k context.

### 3.3 `GeminiProvider`
- **Supported Models**: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`.
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse`.
- **Transport**: Native `fetch` with SSE parser and API key parameterization.
- **Capabilities**: Streaming, Tool calling, Vision, 1M+ context window.

### 3.4 `OllamaProvider` (Local / Offline)
- **Supported Models**: `deepseek-r1:14b`, `qwen2.5-coder:7b`, `llama3.3:70b`.
- **API Endpoint**: `http://localhost:11434/api/chat`.
- **Transport**: Native `fetch` with NDJSON newline stream parser.
- **Capabilities**: 100% offline, Zero external network calls, Air-gapped enterprise compliance.

### 3.5 `MockModelProvider` (Automated Testing)
- **Default Model**: `mock-fast`.
- **Capabilities**: Deterministic in-memory streaming with configurable token delays, tool-call simulation, error injection, and abortable cancellation for CI test suites.

---

## 4. Resilience, Rate Limiting & Failover Strategy

1. **Exponential Backoff**:
   - HTTP 429 (Rate Limit) and HTTP 503 (Overloaded) trigger automated backoff with full jitter:
     $$\text{delay} = \min(30000, 1000 \times 2^{\text{attempt}} + \text{jitter})$$
   - Maximum 3 automated retries before alerting user. Fail-fast with zero retries on 401/403 or 400 bad requests.
2. **Streaming Timeout Detection**:
   - Network timeouts trigger classified `TIMEOUT` model errors with retryable flags.
3. **Cancellation**:
   - Every stream request links to an `AbortController`. When the developer hits `Escape` or the cancel button, the underlying HTTP socket is destroyed immediately, preventing wasted token billing.

---

## 5. Security & Credential Management

* **Zero Webview Exposure**: API keys are never transmitted to the React Webview.
* **VS Code SecretStorage**: API keys are securely persisted in the OS keychain via `vscode.ExtensionContext.secrets` (`CredentialManager`).
* **Header-Only Utilization**: Secrets are injected only inside the Extension Host when signing outgoing HTTPS request headers.
* **Log Sanitization**: Credentials, authorization headers, and sensitive environment variables are strictly redacted from diagnostic logs and event payloads.
