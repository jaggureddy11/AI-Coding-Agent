# ADR-004: Model Provider Abstraction Layer

## Status
Accepted

## Context
AI models evolve at blinding speed. What is state of the art today (e.g. Claude 3.5 Sonnet) may be matched or surpassed tomorrow by GPT-5, Gemini 2.5, or open-weight models running on local hardware (DeepSeek, Llama). Hardcoding an application to a single vendor's SDK or proprietary endpoint leads to rapid obsolescence and creates enterprise adoption barriers.

## Decision
JAGGU defines a polymorphic `IModelProvider` abstraction in `packages/jaggu-models`. The agent core consumes a normalized stream of typed chunks (`TokenChunk`, `ToolCallChunk`, `UsageChunk`, `ErrorChunk`), completely decoupled from provider-specific SDK idiosyncrasies. JAGGU natively ships adapters for Anthropic, OpenAI, Google Gemini, and local Ollama.

## Alternatives Considered
- **Direct Vendor SDKs (`openai`, `@anthropic-ai/sdk`, `@google/genai`)**:
  - *Why Rejected*: Adds ~4MB+ of transitive node dependencies to the extension bundle, creates multiple conflicting HTTP clients, and complicates unified AbortSignal cancellation and exponential backoff retry policies.
- **Using LangChain / LlamaIndex**:
  - *Why Rejected*: Heavy dependency tree (hundreds of transient packages), frequent breaking changes, high abstraction bloat, and poor latency control.
- **Unified Native Fetch + Lightweight Stream Parsers (Chosen)**:
  - *Why Selected*: Built directly on Node.js 20+ / Web-standard `fetch`, `ReadableStream`, `TextDecoder`, and `AbortController`. Zero external npm dependencies. Gives JAGGU 100% control over request construction, error codes, backoff retries, and hardware-level cancellation.

## Reasoning
1. **Developer Choice**: Developers can use their existing API keys or run completely offline with Ollama.
2. **Resilience & Control**: Enables automatic exponential backoff retry for 429/5xx, fail-fast for 401 auth errors, and one-click fallback if a cloud provider experiences an outage.
3. **Clean Zero-Bloat Code**: 0 npm dependencies added to the gateway; clean, high-performance TypeScript interfaces maintained directly in the monorepo.
4. **Real Cancellation**: AbortSignal directly closes the native fetch socket stream upon user cancellation.

## Consequences
- **Positive**: Complete freedom of model choice; enterprise air-gap compatibility; decoupled architecture; 0KB third-party bundle weight.
- **Negative**: Must maintain lightweight mapping logic for each provider's streaming and tool-calling wire format (SSE and NDJSON).
