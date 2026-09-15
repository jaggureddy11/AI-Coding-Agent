# JAGGU Architecture & Implementation Plan: Multi-Model Gateway, Auto-Router & Persistent Coding Panel

**Document**: `docs/MODEL_ROUTING_PLAN.md`  
**Milestone**: Multi-Model Gateway & Model Router (Phase 0 Audit & Design Specification)  
**Status**: DRAFT (Awaiting Review & Approval)  
**Target Version**: 0.2.0  

---

## 1. Executive Summary & Core Product Vision

JAGGU is an existing, production-hardened developer-controlled AI coding agent for VS Code with robust safety gates (in-memory shadow staging, two-phase human approvals, Base-SHA conflict detection, strict subprocess whitelisting, and workspace containment).

This milestone elevates JAGGU's user experience to feel like a premier modern AI coding assistant—similar to **Kilo Code**, **Blackbox AI**, and **Antigravity's Coding Panel**—while strictly preserving JAGGU's non-negotiable safety model.

### Key Tenets:
1. **Zero Mandatory Paywall / Free-First Default**: The user installs JAGGU and can immediately code without purchasing subscriptions, entering credit cards, or bringing mandatory paid API keys.
2. **"Auto" as Default**: Users do not need to research LLM parameter counts, context windows, or provider APIs. `Auto` intelligently selects the optimal free/open model (defaulting to the Qwen3-Coder family via Hugging Face), falls back to local Ollama if available, and uses configured paid providers only when explicitly enabled.
3. **Never Spend Money Automatically**: Auto mode strictly enforces that paid cloud models (OpenAI, Anthropic, Gemini) are NEVER activated unless explicitly configured in SecretStorage and explicitly opted-in to the Auto routing pool.
4. **Persistent Coding Panel**: Persistent chat sessions, live compact agent progress steps (`✓ Searching`, `✓ Reading`, `✓ Planning`, `● Generating edits`, `○ Running tests`), rich tool cards, `@workspace` / `@file` / `@code` references, and slash commands (`/fix`, `/plan`, `/test`, `/explain`).

---

## 2. Current State vs. Required Changes

| Component | Current Implementation | Target 0.2.0 Architecture |
| :--- | :--- | :--- |
| **Model Selection** | Manual dropdown in Webview (`mock-fast`, `qwen2.5-coder:7b`, etc.); defaults to last chosen model or mock. | Defaults to `Auto`. Dropdown grouped by `AUTO`, `FREE / OPEN`, `LOCAL`, `CONFIGURED`. |
| **Model Registry** | Basic `ModelDescriptor` with boolean capabilities and 5 health states. | Extended `ModelDescriptor` with numerical coding/reasoning capabilities, access tier (`free`, `local`, `paid`), availability status (`free-available`, `auth-required`, `rate-limited`, `offline`, `unavailable`), and health latency metrics. |
| **Model Router** | None (Orchestrator accepts static `providerId` and `model` string). | Dedicated `ModelRouter` in `@jaggu/core` with deterministic task classification, candidate filtering, multi-factor scoring, and safe bounded fallback (max 2 attempts). |
| **Hugging Face Provider** | Simple router endpoint; strictly required API key even for open models. | Enhanced Hugging Face router supporting free inference routing (Qwen3-Coder family priority: `Qwen3-Coder-30B-A3B-Instruct`, alternatives), status distinction (`FREE_AVAILABLE`, `AUTH_REQUIRED`, `RATE_LIMITED`), and token SecretStorage. |
| **Chat Sessions** | Single in-memory conversation; clearing empties all state. | Multi-session local history store (New Chat, Rename, Delete, Clear) persisted in VS Code workspace session storage without writing secrets or sensitive code to disk. |
| **Editor Context** | Workspace root discovery and Ripgrep indexing. | Workspace grounding + active editor awareness: current active file, selected text, cursor position, and LSP compiler diagnostics automatically surfaced when relevant (`@file`, `@code`, `@workspace`). |
| **Slash Commands** | None. Standard text submission only. | Native slash commands (`/fix`, `/plan`, `/test`, `/explain`, `/refactor`, `/review`, `/search`) mapping directly into the existing AgentOrchestrator pipeline. |
| **Agent Activity UI** | Full-screen empty state or raw message bubbles. | Compact live activity progress checklist (`✓ Searching repository`, `✓ Reading file`, `● Generating edits`, `○ Verifying tests`) with expandable tool activity cards. |
| **Settings & Preferences**| QuickPick for API keys only. | Clean Settings panel in Webview/sidebar for Routing Preference (`Free first`, `Free & Local only`, `Configured providers`), provider endpoints, and privacy disclosures. |

---

## 3. Architectural Design

```text
Visual Studio Code (Active Editor Context: @file, Selection, Diagnostics)
                           │
                           ▼
               JAGGU Persistent Coding Panel
              (Chat History • [ Auto ▾ ] • Settings)
                           │
                           ▼ Typed Webview RPC (Extension Host)
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Extension Host                                  │
│  - Active Editor Tracker (File, Language, Text Selection, Diagnostics)      │
│  - Session Storage Manager (Local conversation history metadata)            │
│  - SecretStorage (Hugging Face, OpenAI, Anthropic, Gemini tokens)           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ModelRouter                                     │
│  1. Task Classifier: Analyzes user prompt + editor context                  │
│     (TaskType: CodeMutation | Debugging | Explanation | TestGen | Search)   │
│  2. Candidate Filtering: Filters models by tool-calling, contextWindow, auth │
│  3. Multi-Factor Scoring: Free-first bias + coding power + latency + health │
│  4. Policy Gate: Enforces Free & Local preferences (zero unintended spend) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Selected ModelDescriptor + Fallbacks
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AgentOrchestrator (FSM)                             │
│  UNDERSTANDING ➔ PLANNING ➔ PLAN REVIEW ➔ EXECUTING ➔ EDIT REVIEW ➔ VERIFY  │
│  (Existing Safety Architecture: In-Memory Shadow Diffs, Whitelisted Runners)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ModelGateway                                     │
│   ┌───────────────────┬───────────────────┬───────────────────────────────┐ │
│   │   Hugging Face    │   Local Ollama    │ Configured Cloud Providers    │ │
│   │ (Qwen3-Coder Free)│ (qwen, deepseek)  │ (OpenAI, Anthropic, Gemini)   │ │
│   └───────────────────┴───────────────────┴───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Extended Model Descriptor Contract

We extend `packages/jaggu-core/src/types/modelRegistry.ts` using Zod validation without breaking existing contracts:

```typescript
export type ModelRuntimeType = 'cloud' | 'local' | 'openai-compatible';

export type ModelAccessTier = 'free' | 'local' | 'paid' | 'unknown';

export type ModelAvailabilityStatus =
  | 'available'
  | 'auth-required'
  | 'rate-limited'
  | 'offline'
  | 'unavailable'
  | 'unknown';

export interface ModelCapabilities {
  coding: number; // 0 - 100 rating
  reasoning: number; // 0 - 100 rating
  toolCalling: boolean;
  streaming: boolean;
  vision: boolean;
  structuredOutput: boolean;
}

export interface ModelDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly providerId: string;
  readonly runtimeType: ModelRuntimeType;
  readonly modelFamily?: string;

  readonly capabilities: ModelCapabilities;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;

  readonly access: ModelAccessTier;
  readonly availability: ModelAvailabilityStatus;
  readonly hfModelId?: string;

  readonly health?: {
    healthy: boolean;
    latencyMs?: number;
    checkedAt?: number;
    detail?: string;
  };
}
```

### Initial Model Catalog & Priority
1. **Hosted Free / Open (Primary)**:
   - `Qwen/Qwen2.5-Coder-32B-Instruct` / `Qwen3-Coder-30B-A3B-Instruct` (Free Hosted / HF Router) — Coding: 92, Reasoning: 88, Tools: Yes, Access: `free`
   - `meta-llama/Llama-3.1-8B-Instruct` (HF Free Router fallback) — Coding: 78, Reasoning: 75, Tools: Yes, Access: `free`
2. **Local Open Models (Air-Gapped / Privacy)**:
   - `qwen2.5-coder:7b` / `qwen2.5-coder:14b` (Ollama) — Coding: 85, Reasoning: 80, Tools: Yes, Access: `local`
   - `deepseek-coder-v2` (Local OpenAI-compatible / vLLM) — Coding: 90, Reasoning: 86, Tools: Yes, Access: `local`
3. **Configured Cloud Providers (Opt-in Only)**:
   - `claude-3-5-sonnet-latest` (Anthropic) — Coding: 98, Reasoning: 96, Tools: Yes, Access: `paid`
   - `gpt-4o` (OpenAI) — Coding: 94, Reasoning: 92, Tools: Yes, Access: `paid`
   - `gemini-1.5-pro` (Gemini) — Coding: 90, Reasoning: 90, Tools: Yes, Access: `paid`

---

## 5. Model Routing Algorithm & Policy Engine

### 5.1 Task Classification
When a user submits a prompt, `TaskClassifier` deterministically classifies task characteristics without requiring an extra LLM call:
- **Requires Tool Calling**: Detected if intent involves code modification, multi-file inspection, test execution, or directory search. (Pure explanation tasks like `/explain` or "what does this function do?" do not require tools).
- **Estimated Context Tokens**: Estimated based on user prompt length, active editor selection, and grounded workspace snippet headers.
- **Task Category**: `CODE_MUTATION` | `BUG_FIX` | `REFACTOR` | `TEST_GENERATION` | `EXPLANATION` | `SEARCH`.

### 5.2 Step 1: Strict Capability & Policy Filtering
A model candidate is **instantly eliminated** if:
1. The task requires tool calling, but the model has `capabilities.toolCalling === false`.
2. The task context size exceeds the model's `contextWindow`.
3. The model is marked `offline`, `unavailable`, or `rate-limited`.
4. The user's Routing Preference is:
   - **`Free & Local only`**: Any `paid` cloud model is eliminated.
   - **`Local only`**: Any non-local model is eliminated.
   - **`Free first` (Default)**: Paid models are eliminated UNLESS all free/local models are unavailable AND the user has explicitly enabled configured paid fallbacks in settings.
5. The model requires an API key (`auth-required`), but no key is present in `SecretStorage`.

### 5.3 Step 2: Multi-Factor Scoring Formula
For all surviving eligible candidates:

$$\text{Score} = (W_{\text{coding}} \cdot C) + (W_{\text{tools}} \cdot T) + (W_{\text{context}} \cdot K) + (W_{\text{tier}} \cdot A) + (W_{\text{health}} \cdot H) - (W_{\text{failures}} \cdot F)$$

Where:
- $C = \text{coding capability (0 to 1)}$: Model benchmark score.
- $T = \text{toolCalling capability (1 if supported, 0.2 if not needed)}$.
- $K = \text{context fit (1 if optimal, penalty if near limit)}$.
- $A = \text{access tier bonus}$: $+0.35$ for `free` (Hugging Face / Open), $+0.30$ for `local` (Ollama), $+0.00$ for `paid`.
- $H = \text{health & latency factor}$ ($1.0$ for verified fast, $0.5$ for unknown).
- $F = \text{recent session failure penalty}$ ($0.25$ per consecutive transient failure).

The highest-scoring candidate is selected as `primaryModel`, with the second highest ranked as `fallbackModel`.

---

## 6. Safe Model Fallback & Bounded Retries

To prevent runaway loops or infinite retry chains:
1. **Maximum Fallback Attempts**: Exactly **2**.
2. **Transient Failures Eligible for Fallback**:
   - HTTP 429 (Rate Limited)
   - HTTP 503 / 500 (Provider Unavailable)
   - Network ETIMEDOUT / ECONNREFUSED
   - Stream truncation before first semantic token
3. **Non-Eligible Failures (Halt Immediately)**:
   - User cancellation (`AbortSignal.aborted`)
   - Explicit user rejection during Plan Approval or Edit Review
   - Workspace boundary violations (`PATH_TRAVERSAL_DETECTED`)
4. **Transparent User Notification**:
   When a fallback triggers, JAGGU dispatches an informational event to the Webview:
   ```text
   ℹ️ Qwen3-Coder is temporarily rate-limited. Switched to local Ollama (qwen2.5-coder:7b) to continue your task.
   ```
   *No API keys, authorization headers, or raw provider stack traces are ever displayed.*

---

## 7. Persistent Chat Sidebar UX & Design

The sidebar is redesigned to feel like an integrated engineering workstation:

```text
┌─────────────────────────────────────────────────────────────┐
│ ⚡ JAGGU                                        [+ New]  ⚙ │
├─────────────────────────────────────────────────────────────┤
│ Recent: [Fix JWT skew ▾]                                    │
├─────────────────────────────────────────────────────────────┤
│ 🛡 TRUSTED CONTROL ACTIVE • Review-Gated      [Ready]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ USER: Fix clock skew in auth/jwt.ts and add tests           │
│                                                             │
│ JAGGU:                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚡ Agent Activity                                       │ │
│ │  ✓ Searching codebase with ripgrep (auth/jwt.ts)        │ │
│ │  ✓ Read 2 workspace files (4.2 KB)                      │ │
│ │  ✓ Analyzed TypeScript compiler diagnostics             │ │
│ │  ✓ Plan formulated with Qwen3-Coder (Hugging Face Free) │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 PlanCard: Fix JWT Expiration Clock Skew              │ │
│ │  1. Add 60s tolerance window to verifyToken()           │ │
│ │  2. Create auth/jwt.test.ts regression suite            │ │
│ │  [Approve Plan]                      [Modify / Reject]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🪟 EditSet: 2 files staged in memory                    │ │
│ │  ✓ auth/jwt.ts (+14 -2)                [Review Diff]    │ │
│ │  ✓ auth/jwt.test.ts (+42 -0)           [Review Diff]    │ │
│ │  [Accept All]     [Accept Selected]    [Reject All]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Type a task or slash command (/fix, /plan, /test)...    │ │
│ │                                                         │ │
│ │ [ @workspace ] [ @file: jwt.ts ]                        │ │
│ │ ┌─────────────────────────────────┐                     │ │
│ │ │ [Auto (Qwen3-Coder) ▾]          │  [🎤]     [ Send ↑] │ │
│ │ └─────────────────────────────────┘                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Slash Commands Specification:
- `/fix [issue]`: Directly prompts diagnosis, plan creation, and targeted repair.
- `/plan [feature]`: Instructs the agent to formulate a multi-step milestone plan without immediately staging edits.
- `/test [file/module]`: Generates comprehensive unit tests and executes test verification.
- `/explain [code]`: Generates a grounded, contextual explanation of the selected code or active file without modifying disk.
- `/refactor [code]`: Proposes clean architecture refactorings with test verification.
- `/search [term]`: Executes ripgrep search and presents grounded findings.

---

## 8. Security & Trust Boundaries

The multi-model router adheres strictly to the established **5 Security Gates**:
1. **Secret Isolation**: Hugging Face tokens and cloud API keys reside strictly within VS Code `SecretStorage`. The Webview only ever receives provider IDs and masked availability status (`available`, `auth-required`, `rate-limited`).
2. **Untrusted Model Output Principle**: Code generated by Qwen3-Coder, Ollama, or OpenAI is treated as untrusted text. It must pass Zod schema parsing, canonical `fs.realpathSync` path containment, and explicit human approval before touching disk.
3. **No Financial Surprise Guarantee**: Auto mode cannot access or bill paid providers unless the user has manually toggled `Allow Paid Fallback in Auto` in Settings.
4. **Redaction of Provider Errors**: All HTTP and stream error messages are scrubbed through `sanitizeSecretStrings` prior to display.

---

## 9. Test & Verification Plan

### 9.1 Unit & Adversarial Test Suites (`packages/jaggu-core/test/`)
- `modelRouter.test.ts`:
  - Verify default selection picks best available free model (Qwen3-Coder).
  - Verify task requiring tools rejects models with `toolCalling === false`.
  - Verify task with 50K context rejects models with 32K context window.
  - Verify `Free & Local only` setting eliminates paid models even when keys are present.
  - Verify fallback triggers cleanly on simulated 429 / timeout and switches to secondary model.
  - Verify max 2 fallback limit stops infinite recursion.
- `huggingFaceFreeRouter.test.ts`:
  - Test Hugging Face router response handling under free tier rate limits.
  - Test streaming token parser and tool delta reconstitution.

### 9.2 Webview & RPC Tests (`packages/jaggu-ui/test/`)
- Test `Auto` model selector option and expandable provider grouping.
- Test chat session switching (create new chat, rename, delete, clear).
- Test slash command autocomplete and dispatch.
- Test active editor context pill rendering (`@file`, `@selection`).

### 9.3 End-to-End Evaluation Benchmark (`packages/jaggu-eval`)
- Run the 12 SWE benchmark tasks with `Auto` mode enabled.
- Verify 100% Task Success Rate and compare latency and repair efficiency against single-model baselines.

---

## 10. Step-by-Step Phased Implementation Roadmap

- [ ] **Phase 0: Audit & Specification** (Current Phase — Stop & Plan).
- [ ] **Phase 1: Model Router Core** (`@jaggu/core`): Implement `TaskClassifier`, `ModelRouter`, extended `ModelDescriptor`, and unit test suite.
- [ ] **Phase 2: Hugging Face & Free-First Catalog**: Implement Qwen3-Coder catalog entries, free availability detection, and SecretStorage integration.
- [ ] **Phase 3: Persistent Chat UI & Auto Selector**: Redesign sidebar Webview with Auto selector, chat sessions, slash commands, and active editor context pills.
- [ ] **Phase 4: Real End-to-End Integration**: Validate full task flow in live VS Code extension host.
- [ ] **Phase 5: SWE Evaluation Benchmark**: Run benchmark suite across Auto vs Qwen3-Coder vs Ollama and generate evaluation report.
- [ ] **Phase 6: Release Verification & VSIX Packaging**: Full regression, audit, and clean packaging.
