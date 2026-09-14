# 12 — Model Gateway & Provider Abstraction Layer

## 1. Gateway Architecture & Provider Independence

To prevent vendor lock-in and provide maximum developer flexibility, ForgeAI implements a strictly polymorphic **Model Gateway Layer** (`packages/forgeai-models`). The core agent logic never interacts directly with proprietary SDKs; all inference, streaming, and tool calls route through an abstract `IModelProvider` interface.

```
                              [Agent Core]
                                   │
                                   ▼
                         [IModelProvider Contract]
                                   │
         ┌─────────────────┬───────┴─────────┬─────────────────┐
         ▼                 ▼                 ▼                 ▼
[AnthropicProvider] [OpenAIProvider]  [GeminiProvider]   [OllamaProvider]
- Claude 3.5 Sonnet - GPT-4o          - Gemini 2.0 Flash - DeepSeek-R1
- Claude 3.7 Sonnet - GPT-4o-mini     - Gemini 2.0 Pro   - Qwen 2.5 Coder
- Prompt Caching    - Structured Out  - 2M Context       - 100% Offline
```

---

## 2. Core Interface Contracts

```typescript
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ModelContentBlock[];
  toolCallId?: string;
  name?: string;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ModelRequestOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ModelToolDefinition[];
  abortSignal?: AbortSignal;
  enablePromptCaching?: boolean;
}

export type ModelStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number; costEstimateUsd: number }
  | { type: 'error'; error: Error };

export interface IModelProvider {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;
  
  streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions
  ): AsyncIterable<ModelStreamChunk>;
  
  estimateTokens(text: string): number;
  calculateCost(model: string, promptTokens: number, completionTokens: number): number;
}
```

---

## 3. Provider Implementations

### 3.1 `AnthropicProvider`
- **Supported Models**: `claude-3-5-sonnet-20241022`, `claude-3-7-sonnet-20250219`.
- **API Endpoint**: `https://api.anthropic.com/v1/messages`.
- **Special Features**:
  - Prompt Caching: Automatic injection of `cache_control: { type: "ephemeral" }` on system instructions and static repo context blocks.
  - Thinking/Reasoning token streaming support (`type: "thinking"`).
  - Native tool calling (`tool_use` blocks).

### 3.2 `OpenAIProvider`
- **Supported Models**: `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`.
- **API Endpoint**: `https://api.openai.com/v1/chat/completions`.
- **Special Features**:
  - Parallel tool calling.
  - Strict JSON Schema structured outputs (`response_format: { type: "json_schema" }`).

### 3.3 `GeminiProvider`
- **Supported Models**: `gemini-2.0-flash`, `gemini-2.0-pro-exp`.
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/`.
- **Special Features**:
  - Massive context window (up to 2,000,000 tokens).
  - Ultra-fast token generation speed (>100 tokens/sec).

### 3.4 `OllamaProvider` (Local / Offline)
- **Supported Models**: `deepseek-r1:14b`, `qwen2.5-coder:14b`, `llama3.3:70b`.
- **API Endpoint**: `http://localhost:11434/api/chat`.
- **Special Features**:
  - Zero external network dependency.
  - 100% air-gapped security for sensitive enterprise codebases.

---

## 4. Resilience, Rate Limiting & Failover Strategy

1. **Exponential Backoff**:
   - HTTP 429 (Rate Limit) and HTTP 503 (Overloaded) trigger automated backoff with full jitter:
     $$\text{delay} = \min(30000, 1000 \times 2^{\text{attempt}} + \text{jitter})$$
   - Maximum 3 automated retries before alerting user.
2. **Streaming Timeout Detection**:
   - If no token chunk is received for 15 consecutive seconds during an active stream, the gateway issues a reconnect request.
3. **Provider Fallback**:
   - If the primary provider suffers an unrecoverable outage, ForgeAI prompts the developer:
     *"Anthropic API is currently returning 500 Overloaded. Switch to OpenAI GPT-4o for this task?"*
4. **Cancellation**:
   - Every stream request links to an `AbortController`. When the developer hits `Escape` or the cancel button, the underlying HTTP socket is destroyed immediately, preventing wasted token billing.
