# ADR-004: Model Provider Abstraction Layer

## Status
Accepted

## Context
AI models evolve at blinding speed. What is state of the art today (e.g. Claude 3.5 Sonnet) may be matched or surpassed tomorrow by GPT-5, Gemini 2.5, or open-weight models running on local hardware (DeepSeek, Llama). Hardcoding an application to a single vendor's SDK or proprietary endpoint leads to rapid obsolescence and creates enterprise adoption barriers.

## Decision
JAGGU defines a polymorphic `IModelProvider` abstraction in `packages/jaggu-models`. The agent core consumes a normalized stream of typed chunks (`TokenChunk`, `ToolCallChunk`, `UsageChunk`, `ErrorChunk`), completely decoupled from provider-specific SDK idiosyncrasies. JAGGU natively ships adapters for Anthropic, OpenAI, Google Gemini, and local Ollama.

## Alternatives Considered
- **Direct Anthropic SDK Hardcoding**:
  - *Why Rejected*: Excludes users who require OpenAI, Gemini, or air-gapped local execution with Ollama.
- **Using LangChain / LlamaIndex**:
  - *Why Rejected*: Heavy dependency tree (hundreds of transient packages), frequent breaking changes, high abstraction bloat, and poor latency control.

## Reasoning
1. **Developer Choice**: Developers can use their existing API keys or run completely offline with Ollama.
2. **Resilience**: Enables automatic or one-click fallback if a cloud provider experiences an outage or rate limiting.
3. **Clean Code**: Clean, zero-bloat TypeScript interfaces maintained directly in the monorepo.

## Consequences
- **Positive**: Complete freedom of model choice; enterprise air-gap compatibility; decoupled architecture.
- **Negative**: Must maintain lightweight mapping logic for each provider's streaming and tool-calling wire format.
