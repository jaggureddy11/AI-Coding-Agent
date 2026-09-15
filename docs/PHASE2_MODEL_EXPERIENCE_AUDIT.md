# Phase 2 — Model Experience Architecture & Audit

## 1. Provider Architecture
JAGGU uses a polymorphic `ModelGateway` that abstracts all model runtimes behind the standardized `IModelProvider` interface:
- **Cloud Providers**: Hugging Face Inference Router (`HuggingFaceProvider`), Anthropic, OpenAI, Gemini.
- **Local Providers**: Ollama (`OllamaProvider`), OpenAI-Compatible Server (`OpenAICompatibleProvider` for vLLM/LM Studio).
- **Offline / Deterministic Testing**: `MockModelProvider`.

All providers normalize text deltas, tool call deltas, and usage metrics into unified event bus streams (`model.requested`, `model.text_delta`, `model.tool_call_delta`, `model.completed`).

## 2. Model Registry & Catalog
The `ModelRegistry` maintains a curated catalog of coding models with capability metrics:
- **Free Cloud**: `Qwen/Qwen3-Coder-30B-A3B-Instruct` (131k context, coding: 95, tools: true), `Qwen/Qwen2.5-Coder-32B-Instruct`, `meta-llama/Llama-3.1-8B-Instruct`.
- **Local (Ollama / vLLM)**: `qwen2.5-coder:7b` (32k context, coding: 86, tools: true), `deepseek-r1:8b`, `llama3.3:70b`, `deepseek-coder-v2`.
- **Paid (Opt-in only)**: `gpt-4o`, `claude-3-5-sonnet-latest`, `gemini-1.5-pro`.

## 3. Auto-Routing Behavior
The `ModelRouter` and `TaskClassifier` dynamically select models based on:
1. **Task Intent**: Classifies prompts into `CODE_MUTATION`, `BUG_FIX`, `TEST_GENERATION`, `REFACTOR`, `EXPLANATION`, `SEARCH`.
2. **Free-First Policy**: Filters eligible candidates to free/local tiers first. Paid models are strictly excluded in Auto mode unless `jaggu.allowPaidFallbackInAuto` is explicitly set to `true`.
3. **Multi-Factor Scoring**: Weights coding rating, reasoning rating, context token headroom, tool capability, and access tier bonus.
4. **Bounded Fallback**: Automatically tries alternative free/local candidates up to 2 attempts on transient 429 rate-limiting or 401 auth failures.

## 4. Credentials & SecretStorage Flow
- All API keys and access tokens (e.g. Hugging Face user tokens) are stored in VS Code `SecretStorage`.
- The Webview UI receives only model display names, provider IDs, and status badges (`AUTO`, `FREE`, `LOCAL`, `PAID`).
- Tokens are never emitted into RPC messages, event bus payloads, log files, or Git history.

## 5. UI Capabilities
- The sidebar header features an interactive `ModelSelector` with categorized options (`AUTO (RECOMMENDED)`, `FREE / OPEN`, `LOCAL`, `CONFIGURED CLOUD`).
- Live badges indicate availability status (`FREE`, `LOCAL`, `PAID`).
- Clear error states inform users when models are rate-limited, offline, or require authentication tokens without raw technical stack traces.

## 6. Files Changed in Phase 2
- `packages/jaggu-core/src/models/router.ts`
- `packages/jaggu-core/src/models/huggingface.ts`
- `packages/jaggu-core/src/models/transport.ts`
- `packages/jaggu-core/src/models/registry.ts`
- `packages/jaggu-ui/src/components/ModelSelector.tsx`
- `packages/jaggu-ui/src/components/ChatView.tsx`
- `packages/jaggu-vscode/src/sidebarProvider.ts`
- `packages/jaggu-vscode/src/credentials.ts`
- `packages/jaggu-vscode/src/extension.ts`
- `packages/jaggu-vscode/package.json`
