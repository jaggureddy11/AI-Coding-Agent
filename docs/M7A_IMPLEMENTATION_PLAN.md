# M7-A Implementation Plan: Multi-Model & Local AI Support

## Executive Summary
This document specifies the architectural design and execution plan for **Milestone M7-A (Multi-Model & Local AI Support)** for the JAGGU developer-controlled AI coding agent.

M7-A extends JAGGU so developers can freely select which AI model powers the agent—including locally hosted open-weight coding models (via Ollama and generic OpenAI-compatible local runtimes such as vLLM and LM Studio)—while strictly preserving provider independence and the foundational safety boundary:
$$\text{Model proposes} \longrightarrow \text{JAGGU validates} \longrightarrow \text{Developer approves} \longrightarrow \text{JAGGU executes}$$

M7-A explicitly avoids turning JAGGU into an autonomous multi-agent swarm or model router. JAGGU owns agent orchestration, workspace containment, shadow-document diffs, dual-gate human approvals, AST/LSP diagnostics, and verification; the underlying model remains a replaceable cognitive engine.

---

## 1. Current Architecture Findings (Phase 0 Inspection)

A thorough inspection of M0–M6 implementations revealed the following existing assets and boundaries:

| Component | Current State & Findings | M7-A Architectural Impact |
| :--- | :--- | :--- |
| **`IModelProvider`** (`@jaggu/core/types/models.ts`) | Defines `id`, `name`, `defaultModel`, `supportedModels: ModelMetadata[]`, `getCapabilities(model)`, `streamChat()`, and `estimateTokens()`. `id` is restricted to `'openai' \| 'anthropic' \| 'gemini' \| 'ollama' \| 'mock'`. | Needs extension to support `'openai-compatible'` and dynamic/extensible providers while preserving the existing async streaming chunk protocol (`ModelStreamChunk`). |
| **`ModelGateway`** (`@jaggu/core/models/gateway.ts`) | Provider registry that manages instances of `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`, `OllamaProvider`, and `MockModelProvider`. Implements `streamChat()` with telemetry and lifecycle event emissions (`model.requested`, `model.stream_started`, `model.text_delta`, `model.completed`, `model.cancelled`, `model.error`). | **Preserve completely as the central gateway boundary.** Will integrate with the new `ModelRegistry` to look up providers and model capabilities dynamically. |
| **`OllamaProvider`** (`@jaggu/core/models/ollama.ts`) | Basic NDJSON streaming using `/api/chat` and `resilientFetch`. Hardcoded to 3 models (`qwen2.5-coder:7b`, `deepseek-r1:8b`, `llama3.3:70b`). Lacks runtime tag inspection (`/api/tags`), capability reporting, model-not-installed handling, and tool-calling support. | Needs hardening: add health check via `/api/tags`, model-not-found error classification, and tool definition formatting. |
| **`OpenAIProvider`** (`@jaggu/core/models/openai.ts`) | Full SSE streaming (`parseSseStream`), tool-call parsing, token usage metrics, and abort signal handling for OpenAI Chat Completions API (`https://api.openai.com/v1/chat/completions`). | Core logic is standard Chat Completions protocol. Can be leveraged or subclassed by a generic `OpenAICompatibleProvider` for local servers (vLLM, LM Studio, Ollama OpenAI port). |
| **`CredentialManager`** (`@jaggu/vscode/credentials.ts`) | Reads/writes secrets using VS Code `SecretStorage` (`jaggu.apiKey.<providerId>`). Reads workspace configuration (`jaggu.provider`, `jaggu.model`, `jaggu.ollamaBaseUrl`). | Will be extended to support `jaggu.openaiCompatible.endpoint`, `jaggu.model.contextLimit`, and provider health state resolution. |
| **VS Code Contributions** (`@jaggu/vscode/package.json`) | Currently lacks explicit `contributes.configuration` declarations in `package.json` (settings are accessed without schema validation). | Needs formal VS Code configuration schema definitions for `jaggu.provider`, `jaggu.model`, `jaggu.ollama.endpoint`, and `jaggu.openaiCompatible.endpoint`. |
| **Webview RPC** (`@jaggu/ui/types/rpc.ts`, `App.tsx`, `sidebarProvider.ts`) | Extension host sends static `{ type: 'agent.config', payload: { provider, model } }` on `ui.ready`. UI renders `{activeConfig.provider}` badge only. No interactive model selector exists. | Needs interactive model selector in UI header, typed RPC messages for model selection (`model.select`) and health checks (`models.health_check`), with persistence back to VS Code settings. |
| **`AgentOrchestrator`** (`@jaggu/core/agent/agentOrchestrator.ts`) | Takes `providerId` and `model` in `executeTask()`, passes them to `ModelGateway.streamChat()`. Fully decoupled from provider specifics. | Works seamlessly through `ModelGateway`. Needs capability checks before requesting tool calling or structured plans. |

---

## 2. Proposed Changes & New Interfaces

### 2.1 Typed `ModelDescriptor` and Schema (`@jaggu/core`)
Create a new file `packages/jaggu-core/src/types/modelRegistry.ts` (and export through `src/index.ts`):

```ts
import { z } from 'zod';
import { ModelCapabilities } from './models.js';

export type ModelRuntimeType = 'cloud' | 'local';

export type ModelHealthStatus =
  | 'available'
  | 'unreachable'
  | 'missing_credentials'
  | 'not_installed'
  | 'unknown';

export interface ModelDescriptor {
  readonly id: string;                     // Stable unique identifier (e.g., 'gpt-4o', 'qwen2.5-coder:7b')
  readonly displayName: string;            // Human-friendly name (e.g., 'Qwen 2.5 Coder 7B')
  readonly providerId: string;             // Provider ID ('openai', 'anthropic', 'gemini', 'ollama', 'openai-compatible', 'mock')
  readonly runtimeType: ModelRuntimeType;  // 'cloud' vs 'local'
  readonly contextWindow: number;          // Maximum total context tokens (e.g., 32768, 128000)
  readonly maxOutputTokens: number;        // Maximum generation tokens
  readonly capabilities: {
    readonly streaming: boolean;
    readonly toolCalling: boolean;
    readonly structuredOutput: boolean;
    readonly vision: boolean;
  };
  readonly health: ModelHealthStatus;
  readonly healthDetail?: string;
  readonly huggingFaceModelId?: string;    // Optional reference metadata (e.g. 'deepseek-ai/DeepSeek-Coder-V2-Instruct')
}

export const ModelDescriptorSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerId: z.string().min(1),
  runtimeType: z.enum(['cloud', 'local']),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  capabilities: z.object({
    streaming: z.boolean(),
    toolCalling: z.boolean(),
    structuredOutput: z.boolean(),
    vision: z.boolean(),
  }),
  health: z.enum(['available', 'unreachable', 'missing_credentials', 'not_installed', 'unknown']),
  healthDetail: z.string().optional(),
  huggingFaceModelId: z.string().optional(),
});
```

### 2.2 Provider-Independent `ModelRegistry` (`@jaggu/core`)
Create `packages/jaggu-core/src/models/registry.ts`:
- **Responsibilities**:
  - Maintains catalog of validated `ModelDescriptor` entries.
  - Pre-registers standard built-in models for Cloud (OpenAI, Anthropic, Gemini) and Local (Ollama coding models, OpenAI-compatible local defaults, Mock).
  - Allows runtime dynamic registration of locally discovered models (e.g., from Ollama `/api/tags` or OpenAI-compatible `/v1/models`).
  - Provides lookup methods: `getModel(id)`, `listModels()`, `listByProvider(providerId)`, `listByRuntime(type)`.
  - Updates model health state deterministically.
  - Prevents duplicate registrations with mismatched metadata.

### 2.3 Generic `OpenAICompatibleProvider` (`@jaggu/core`)
Create `packages/jaggu-core/src/models/openaiCompatible.ts`:
- **Target Runtimes**: vLLM, LM Studio, LocalAI, Ollama OpenAI endpoint, self-hosted TGI.
- Implements `IModelProvider`:
  - `id`: `'openai-compatible'`
  - `name`: `'OpenAI-Compatible Local Endpoint'`
  - Uses `baseUrl` configured via options or settings (default: `http://localhost:1234/v1`).
  - Optional API key (if endpoint requires auth; defaults to optional/empty).
  - Uses standard Chat Completions `/chat/completions` and SSE stream parsing (`parseSseStream`).
  - Supports tool calls formatting and extraction identical to OpenAI protocol.
  - Implements lightweight model/health discovery via `GET /models`.

### 2.4 Hardened `OllamaProvider` (`@jaggu/core`)
Upgrade `packages/jaggu-core/src/models/ollama.ts`:
- Support tool calling: Ollama 0.3+ supports OpenAI-style function calling in `/api/chat`. Format tools in the request body if `capabilities.toolCalling` is true.
- Add error classification: Detect `"model '...' not found"` in 404 responses and throw `ModelError` with code `MALFORMED_RESPONSE` and health status `not_installed`.
- Health check method: Inspect `GET /api/tags` to list installed local model tags and verify connectivity.

### 2.5 Capability-Aware Agent Guard (`@jaggu/core`)
In `AgentOrchestrator`:
- Before invoking model for planning or tool execution, query `modelRegistry.getModel(modelId)`.
- If `capabilities.toolCalling === false`:
  - Clearly report in activity/summary that the selected model does not support native tool calling.
  - Safe fallback: For planning and diagnosis, rely on strict JSON schema structured output prompts rather than native function calling.
  - NEVER execute arbitrary unvalidated model text as a command or tool call.
- Context limit guard:
  - If estimated prompt tokens exceed `descriptor.contextWindow`:
    - ContextEngine truncates lowest-priority snippets to stay strictly within 80% of `descriptor.contextWindow`.
    - Emits a diagnostic warning if context had to be aggressively pruned.

---

## 3. UI Changes & Developer Experience (`@jaggu/ui`)

### 3.1 Model Selector Component
Create `packages/jaggu-ui/src/components/ModelSelector.tsx`:
- **Placement**: Integrated neatly in the top header of the JAGGU sidebar panel (alongside the existing status pill and clear button).
- **Display**:
  - Compact dropdown showing: `[DisplayName] [LOCAL / CLOUD badge] [Health indicator dot]`.
  - Grouped by runtime/provider:
    - **Local Models**: Ollama (`qwen2.5-coder:7b`, `deepseek-r1:8b`, etc.), OpenAI-Compatible (`local-default`).
    - **Cloud Models**: OpenAI (`gpt-4o`, `o3-mini`), Anthropic (`claude-3-5-sonnet`), Gemini (`gemini-1.5-pro`).
    - **Testing**: Mock (`mock-fast`, `mock-tool-capable`).
- **Interaction**:
  - Selecting a model dispatches RPC message: `{ type: 'model.select', payload: { modelId } }`.
  - The extension host validates the selection, updates VS Code configuration (`jaggu.model` and `jaggu.provider`), and broadcasts the updated active config to the webview.
  - No reload or restart of the extension is triggered. Active conversation history is preserved.
  - Hover tooltip displays capabilities: Context Window, Tool Calling support, Structured Output, Vision.

### 3.2 RPC Protocol Extensions (`@jaggu/ui/src/types/rpc.ts`)
Add messages:
```ts
// Webview -> Extension
| { type: 'model.select'; payload: { modelId: string } }
| { type: 'models.refresh_health'; payload?: Record<string, never> }

// Extension -> Webview
| { type: 'agent.config'; payload: {
    provider: string;
    model: string;
    models: ModelDescriptor[];
  } }
| { type: 'model.health_changed'; payload: {
    modelId: string;
    health: ModelHealthStatus;
    detail?: string;
  } }
```

---

## 4. Configuration & Credential Storage Design (`@jaggu/vscode`)

### 4.1 VS Code Settings Schema (`packages/jaggu-vscode/package.json`)
Declare in `contributes.configuration`:
```json
{
  "jaggu.provider": {
    "type": "string",
    "default": "mock",
    "description": "Active AI provider for JAGGU"
  },
  "jaggu.model": {
    "type": "string",
    "default": "mock-fast",
    "description": "Active AI model ID"
  },
  "jaggu.ollama.endpoint": {
    "type": "string",
    "default": "http://localhost:11434",
    "description": "Base URL for local Ollama server"
  },
  "jaggu.openaiCompatible.endpoint": {
    "type": "string",
    "default": "http://localhost:1234/v1",
    "description": "Base URL for local or custom OpenAI-compatible server"
  },
  "jaggu.model.contextLimit": {
    "type": "number",
    "default": 0,
    "description": "Manual override for max context window tokens (0 = use model default)"
  }
}
```

### 4.2 Security & SecretStorage
- **Zero API Keys in Webview**: The Webview receives only public `ModelDescriptor` metadata (`id`, `displayName`, `providerId`, `runtimeType`, `capabilities`, `health`).
- **Zero API Keys in Settings**: Cloud credentials (`openai`, `anthropic`, `gemini`, `openai-compatible` if auth is required) are strictly stored in `vscode.SecretStorage`.
- **Local Runtimes**: Ollama and generic local OpenAI endpoints do NOT require an API key by default. If a local server requires authentication, it can optionally be stored in SecretStorage under `jaggu.apiKey.openai-compatible`.

---

## 5. Files and Modules to Modify / Create

```text
packages/jaggu-core/
├── src/
│   ├── types/
│   │   ├── models.ts                 [MODIFY: expand provider ID union, export ModelProviderId]
│   │   └── modelRegistry.ts          [NEW: ModelDescriptor, ModelHealthStatus, Zod schemas]
│   ├── models/
│   │   ├── registry.ts               [NEW: ModelRegistry class and default model catalog]
│   │   ├── gateway.ts                [MODIFY: integrate with ModelRegistry, register OpenAICompatibleProvider]
│   │   ├── ollama.ts                 [MODIFY: health check via /api/tags, tool formatting, error classification]
│   │   ├── openaiCompatible.ts       [NEW: OpenAICompatibleProvider for vLLM, LM Studio, etc.]
│   │   └── mock.ts                   [MODIFY: add model descriptors for test archetypes]
│   ├── agent/
│   │   └── agentOrchestrator.ts      [MODIFY: capability-awareness check, context window limit enforcement]
│   └── index.ts                      [MODIFY: export new registry and types]
└── test/
    ├── modelRegistry.test.ts         [NEW: registry tests, validation, capability queries]
    ├── ollamaProvider.test.ts        [NEW: mocked HTTP tests for Ollama health, tools, errors, cancellation]
    └── openaiCompatible.test.ts      [NEW: mocked HTTP tests for OpenAI-compatible provider]

packages/jaggu-ui/
├── src/
│   ├── types/
│   │   └── rpc.ts                    [MODIFY: add model.select, models.refresh_health, ModelDescriptor payload]
│   ├── components/
│   │   └── ModelSelector.tsx         [NEW: model picker dropdown with local/cloud badges & health dots]
│   └── App.tsx                       [MODIFY: mount ModelSelector, handle model state and RPC dispatch]
└── test/
    └── modelSelector.test.tsx        [NEW: unit tests for ModelSelector rendering and selection events]

packages/jaggu-vscode/
├── package.json                      [MODIFY: add contributes.configuration schema]
├── src/
│   ├── credentials.ts                [MODIFY: read new settings endpoints, getOpenAICompatibleBaseUrl]
│   └── sidebarProvider.ts           [MODIFY: handle model.select, models.health_check, broadcast descriptors]
└── test/
    └── modelSelectionIntegration.test.ts [NEW: extension host RPC integration test for model switching]

docs/
├── M7A_IMPLEMENTATION_PLAN.md        [NEW: this design document]
├── M7A_IMPLEMENTATION.md             [NEW: post-implementation completion report]
├── M7A_MODEL_SUPPORT.md              [NEW: developer guide for local Ollama & OpenAI-compatible setup]
└── M7A_SECURITY_REVIEW.md            [NEW: dedicated security assessment]
```

---

## 6. Security Considerations & Containment

1. **Model Output Untrusted**: Model output remains untrusted text. Switching from GPT-4o to a local 7B model cannot bypass schema validation or execute unparsed commands.
2. **Permission Model Uncompromised**: The M4–M6 dual-gate human approvals (Plan Approval Gate and EditSet Approval Gate) remain strictly active. Local models cannot auto-apply file edits without explicit human approval.
3. **Workspace Isolation Intact**: `WorkspaceGuard` containment checks and `PathTraversal` protections operate unconditionally before any file access.
4. **Git Safety Intact**: Destructive Git operations (`push --force`, `reset --hard`, uncommitted user edit overwrites) remain prohibited.
5. **No Secret Leakage**:
   - `ModelDescriptor` objects never include authentication tokens.
   - Error messages returned from local endpoints (e.g. ECONNREFUSED) are sanitized and stripped of local file paths or environment variables before sending to UI.
   - Redact all authorization headers in logging and telemetry.

---

## 7. Testing Strategy

All tests will run deterministically offline without requiring external network access:

1. **Model Registry Unit Tests (`modelRegistry.test.ts`)**:
   - Validation of descriptors with Zod schema.
   - Registration, retrieval, filtering by provider, filtering by runtime (`cloud` vs `local`).
   - Duplicate ID detection and rejection.
   - Health state transitions (`available`, `unreachable`, `missing_credentials`, `not_installed`).

2. **Ollama Provider Mock Tests (`ollamaProvider.test.ts`)**:
   - Simulated NDJSON streaming of tokens.
   - Tool calling request payload formatting and response delta parsing.
   - Model-not-installed 404 response handling.
   - Offline / connection refused handling (`NETWORK_ERROR`).
   - Abort signal cancellation during streaming (guaranteeing socket teardown).
   - `/api/tags` tag discovery and health verification.

3. **OpenAI-Compatible Provider Mock Tests (`openaiCompatible.test.ts`)**:
   - Simulated SSE stream (`data: {...}`, `data: [DONE]`).
   - Custom `baseUrl` routing.
   - Tool-call chunks reconstruction.
   - Authentication header inclusion when optional API key is configured.
   - `/v1/models` discovery and health check.

4. **Capability-Aware Safety Tests**:
   - Agent orchestrator behavior when `capabilities.toolCalling = false`: verifies tool execution is safely bypassed or handled via structured output without arbitrary execution.
   - Context window limit tests: verifies context engine prunes low-priority snippets when model context limit is constrained.

5. **UI & RPC Tests (`modelSelector.test.tsx`, `modelSelectionIntegration.test.ts`)**:
   - Webview renders model selector with accurate provider and local/cloud badges.
   - Switching model emits `model.select` with correct ID.
   - Extension updates configuration and persists selection across sessions.

6. **Regression Tests**:
   - Monorepo test suite must maintain 100% pass rate across all existing 125 tests and 21 test suites.

7. **Live Local Model Verification (Conditional)**:
   - Check if a real Ollama instance is active in the environment (`http://localhost:11434/api/tags`).
   - If present: execute 1 live prompt test with an installed model and document runtime, model, latency, and capabilities.
   - If not present: explicitly document *"Live local-model verification not performed (Ollama daemon not running locally)."* and rely on mocked tests.

---

## 8. Migration & Backward Compatibility

- **Zero Breaking Changes**: Existing callers of `new ModelGateway()`, `new AgentOrchestrator()`, and `new CredentialManager()` continue functioning without signature changes.
- **Default Fallback**: If no model is configured in VS Code settings, JAGGU defaults to `mock-fast` in test mode or `gpt-4o` in production, maintaining existing behavior.
- **Provider ID Compatibility**: Existing `'openai' | 'anthropic' | 'gemini' | 'ollama' | 'mock'` provider IDs remain valid.

---

## 9. Explicit Non-Goals (Scope Boundaries)

The following items are strictly out of scope for M7-A:
- **No Automatic Model Routing / Classifier**: The developer explicitly selects the model.
- **No Multi-Agent Swarm**: Single orchestrator; no autonomous sub-agent delegation between models.
- **No Model Downloader / Installer**: JAGGU will not download weights or manage `ollama pull`.
- **No Model Fine-Tuning**: No model training or LoRA adapters.
- **No Vector Databases / Embeddings / Semantic Indexing**: Uses existing lexical and AST repository context.
- **No Autonomous Git Pushes**: Commits and pushes remain developer-controlled.
- **No Arbitrary Shell Execution**: Security sandbox remains intact.

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Local model lacks tool-calling capability** | Agent might crash or hang if it expects native function calling. | Explicit `capabilities.toolCalling` flag in `ModelDescriptor`. Safe fallback to structured JSON output parsing or read-only inquiry path. |
| **Local model has small context window (e.g. 8k or 16k tokens)** | Context overflow leads to model truncation or HTTP 400. | `ModelDescriptor.contextWindow` informs `ContextEngine` budgeting. Automatic snippet pruning stays within budget. |
| **Local endpoint is offline or misconfigured** | UI freezes or enters infinite retry loop. | `resilientFetch` uses `maxRetries: 1` for local servers to fail fast with a friendly `NETWORK_ERROR` and sets health to `unreachable`. |
| **API secrets accidentally leaked to Webview** | High security risk. | `ModelDescriptor` contains only public metadata. Secret keys remain strictly inside `vscode.SecretStorage` in the Extension Host. |

---

## 11. Verification Checklist for Acceptance

- [ ] Existing 125 tests in test suite continue to pass.
- [ ] Typed `ModelDescriptor` and `ModelRegistry` created with Zod validation.
- [ ] `OllamaProvider` supports `/api/tags` health check, tool calling format, and error handling.
- [ ] Generic `OpenAICompatibleProvider` implemented for local runtimes.
- [ ] Hugging Face models representable via metadata without coupling core to HF libraries.
- [ ] Real streaming and real cancellation verified across all providers.
- [ ] Model selector component in UI displays display name, local/cloud badge, and health status.
- [ ] Switching models updates extension config and persists across sessions.
- [ ] Capability limitations and context window boundaries are enforced.
- [ ] Clean build, 0 typecheck errors, 0 lint errors.
- [ ] Documentation complete (`M7A_IMPLEMENTATION.md`, `M7A_MODEL_SUPPORT.md`, `M7A_SECURITY_REVIEW.md`).

---

### STOP — Awaiting Review & Approval
*Implementation will commence upon explicit user approval of this plan.*
