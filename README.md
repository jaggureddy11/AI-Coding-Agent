# JAGGU ⚡

<p align="center">
  <img src="./packages/jaggu-vscode/media/icon.svg" alt="JAGGU Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>The Autonomous Software Engineering Partner Built on the VS Code Foundation.</strong><br>
  <em>Act, Do Not Merely Chat.</em>
</p>

<p align="center">
  <a href="#test-status"><img src="https://img.shields.io/badge/tests-189%20passed%20(31%20suites)-brightgreen.svg?style=flat-square" alt="Tests"></a>
  <a href="#typescript"><img src="https://img.shields.io/badge/typescript-5.7%20strict-blue.svg?style=flat-square" alt="TypeScript"></a>
  <a href="#vscode"><img src="https://img.shields.io/badge/vscode-%5E1.90.0-purple.svg?style=flat-square" alt="VS Code"></a>
  <a href="#monorepo"><img src="https://img.shields.io/badge/monorepo-npm%20workspaces-informational.svg?style=flat-square" alt="Monorepo"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <a href="#privacy"><img src="https://img.shields.io/badge/privacy-zero%20exfiltration-orange.svg?style=flat-square" alt="Privacy"></a>
</p>

---

## ⚡ Executive Vision

Current developer tools treat artificial intelligence as a novelty: a side-panel chatbot answering in hypothetical markdown blocks, or an inline ghost-text completer predicting syntax. When developers face genuine engineering tasks—refactoring a legacy authentication module across four files, diagnosing a flaking integration test, or tracing an async race condition—they are forced to act as the human copy-paste glue between chat and editor.

**JAGGU fundamentally breaks this paradigm.**

JAGGU is an **AI-native autonomous software engineering environment** that delivers end-to-end delegation without relinquishing developer control. JAGGU explores codebases, indexes symbols via high-speed lexical search, generates structured multi-file execution plans, stages surgical diffs in memory, executes terminal commands and test runners, captures LSP compiler diagnostics, heals its own errors, and preserves Git working tree safety.

```
                           THE JAGGU INTERACTION LOOP
                           
   [User Intent] ─────────────────> "Fix async race condition in worker batch processing"
         │
         ▼
   [1. UNDERSTAND] ───────────────> Analyze repo conventions, schemas & AST imports
         │
         ▼
   [2. RETRIEVE CONTEXT] ─────────> High-speed Ripgrep symbol indexing & sliding token budgets
         │
         ▼
   [3. FORMULATE PLAN] ───────────> Construct structured, multi-phase PlanCard
         │
         ▼
   [4. HUMAN CONSENSUS] ──────────> Interactive Approval Gate (Accept / Modify / Reject)
         │
         ▼
   [5. SHADOW STAGING] ───────────> Myers diffs staged in VirtualDocStore (Zero direct overwrite)
         │
         ▼
   [6. RUNTIME VERIFICATION] ────> Run build & test runner (Jest, Vitest, PyTest, Go, Cargo)
         │
         ▼
   [7. OBSERVE & DIAGNOSE] ───────> Collect exit codes, stderr, and VS Code language diagnostics
         │
         ▼
   [8. AUTONOMOUS SELF-HEAL] ─────> Root-cause diagnosis & repair loop (strict 3-retry budget)
         │
         ▼
   [9. ATOMIC MERGE & CHECKPOINT]> Interactive diff review, selective file merge & Git safety commit
```

---

## 🏛️ The Three Core Architectural Pillars

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE THREE JAGGU PILLARS                                   │
├──────────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│    🛡️ CONTROLLABLE AUTONOMY   │    🔄 RUNTIME VERIFICATION   │    🌐 PROVIDER INDEPENDENCE   │
│       & THREE-TIER SAFETY    │       & SELF-HEALING         │      & ZERO DATA EXFILTRATION │
├──────────────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ • Deterministic 7-state FSM  │ • Closes the loop: compiles  │ • 100% unbundled from vendor  │
│ • Interactive Plan Cards     │   code and executes tests    │   lock-in (BYOK + Local AI)   │
│ • In-memory VirtualDocStore  │ • Captures stdout, stderr,   │ • Claude 3.5/3.7, GPT-4o,     │
│   shadow staging buffer      │   exit codes & LSP errors    │   Gemini 2.0, Hugging Face    │
│ • Per-hunk & selective file  │ • Autonomous 3-retry repair  │ • Air-gapped Ollama & vLLM/   │
│   approval / rejection       │   loop before presenting     │   LM Studio local runtimes    │
│ • Three-tier safety model:   │ • Never declares success     │ • Zero proxy relays; direct   │
│   Safe / Moderate / High-Risk│   without empirical proof    │   TLS + SecretSanitizer regex │
└──────────────────────────────┴──────────────────────────────┴───────────────────────────────┘
```

### 1. 🛡️ Controllable Autonomy & Three-Tier Safety
Unlike opaque tools that silently overwrite workspace files behind spinning indicators, JAGGU operates with total transparency:
- **Deterministic State Machine**: 7 observable states (`IDLE`, `PLANNING`, `AWAITING_APPROVAL`, `EXECUTING`, `VERIFYING`, `SELF_HEALING`, `COMPLETED`, `ERROR`).
- **Shadow Buffer Staging**: Edits are staged in a `VirtualDocStore` memory buffer before touching disk.
- **Selective File Approval**: Developers can approve modified files individually or reject specific files while accepting the rest.
- **Granular Safety Classification**: Operations are classified into **Safe** (read-only queries), **Moderate** (file modifications requiring diff review), and **High-Risk** (terminal executions and file deletions requiring explicit user confirmation).

### 2. 🔄 Deterministic Runtime Verification & Self-Healing
An AI coding agent that cannot test its own output is only half an engineer:
- **Closed-Loop Verification**: Automatically executes workspace test runners (Vitest, Jest, PyTest, Go test, Cargo) and parses test failure outputs.
- **Language Service Diagnostics**: Collects real-time compiler and linter diagnostics directly from the VS Code Language Server Protocol (LSP).
- **Autonomous Self-Healing Loop**: When tests fail or type errors occur, JAGGU synthesizes a targeted diagnosis, generates a repair diff, and re-runs verification (bounded by a deterministic 3-retry limit).
- **Empirical Proof of Correctness**: A task is never marked complete without passing test proof.

### 3. 🌐 Provider Independence & Zero-Exfiltration Privacy
JAGGU is built on a vendor-agnostic architecture:
- **Direct Client-to-Provider TLS**: No proprietary middleman servers, telemetry honeypots, or subscription markups. Your keys connect directly to model APIs.
- **Local & Air-Gapped AI Support**: Run top coding models (Qwen 2.5 Coder, DeepSeek-R1, Llama 3.3) locally via **Ollama** or any **OpenAI-Compatible** endpoint (vLLM, LM Studio, Ollama, LocalAI) with zero bytes leaving your workstation.
- **Native Secret Sanitization**: Built-in `SecretSanitizer` automatically scrubs API tokens, JWTs, private keys, and environment secrets from prompts and debug logs.

---

## 📊 Feature Comparison: Why JAGGU?

| Feature / Capability | Traditional Chat (Copilot) | Proprietary Forks (Cursor) | CLI Agents (Aider / Cline) | **JAGGU** |
| :--- | :---: | :---: | :---: | :---: |
| **Execution Model** | Text advice only | Server-side black box | Terminal-driven | **Native VS Code Extension & FSM** |
| **Multi-File Surgical Diffs** | ❌ Manual copy-paste | ⚠️ Automatic | ⚠️ Line edits | **✅ Myers diff in Shadow Buffer** |
| **Selective File Approval** | N/A | ❌ All or nothing | ❌ Branch revert | **✅ Granular per-file Accept/Reject** |
| **Runtime Test Verification** | ❌ | ⚠️ Cloud/Limited | ⚠️ Shell execution | **✅ Native test runners + exit code parsing** |
| **LSP Diagnostic Feedback** | ❌ | ⚠️ Closed source | ❌ None | **✅ Direct VS Code Language Diagnostics** |
| **Autonomous Self-Healing** | ❌ | ⚠️ Unbounded loops | ⚠️ Manual retry | **✅ Bounded 3-retry repair loop** |
| **Local Offline LLMs** | ❌ Cloud only | ❌ Cloud only | ⚠️ Partial | **✅ Native Ollama & OpenAI-Compatible** |
| **Zero Middleman Proxy** | ❌ Proprietary cloud | ❌ Proprietary cloud | ✅ Direct API | **✅ 100% Direct TLS (Zero telemetry)** |
| **Git Safety Checkpoints** | ❌ | ❌ | ⚠️ Auto-commits | **✅ Non-destructive stash & safety commit** |
| **Scientific Benchmark Suite** | ❌ | ❌ Proprietary | ❌ | **✅ Built-in 12-task SWE benchmark** |

---

## 📦 Monorepo Architecture

JAGGU is engineered as a clean, decoupled TypeScript monorepo with strict layer boundaries:

```
jaggu-monorepo/
├── packages/
│   ├── jaggu-core/       # Pure TypeScript agent engine, FSM, and subsystem contracts
│   │   ├── src/agent/        # Finite State Machine & Agent Orchestrator loop
│   │   ├── src/context/      # High-speed Ripgrep symbol indexing & RepoMap builder
│   │   ├── src/diff/         # VirtualDocStore shadow buffer & Myers diff engine
│   │   ├── src/events/       # Strongly-typed lifecycle EventBus (14 events)
│   │   ├── src/git/          # Working tree safety, snapshots & checkpoint manager
│   │   ├── src/models/       # Polymorphic Model Gateway (Claude, GPT-4o, Gemini, Ollama, HF)
│   │   ├── src/planning/     # Structured plan generator & schema validator
│   │   ├── src/tools/        # 14 standardized tools (read, write, search, terminal, git)
│   │   └── src/verification/ # Runtime verification engine & test runner analyzers
│   │
│   ├── jaggu-ui/         # React 18 Webview UI foundation
│   │   ├── src/components/   # PlanCard, ApprovalCard, ModelSelector, ContextPill, StatusPill
│   │   └── src/App.tsx       # Bidirectional RPC state bridge with VS Code extension host
│   │
│   ├── jaggu-vscode/     # VS Code extension host integration
│   │   ├── src/extension.ts          # Lifecycle bootstrap, activation & command dispatch
│   │   ├── src/sidebarProvider.ts    # Webview provider, RPC handler & agent bindings
│   │   ├── src/credentials.ts        # OS-level SecretStorage for API keys
│   │   └── src/virtualDocProvider.ts # Read-only virtual document schema provider
│   │
│   └── jaggu-eval/       # Scientific benchmarking & evaluation suite
│       ├── fixtures/         # 12 isolated multi-file sandbox repositories
│       ├── src/registry.ts   # 12 benchmark tasks across 8 software engineering archetypes
│       ├── src/evaluator.ts  # Deterministic harness, latency breakdown & security scoring
│       └── src/runner.ts     # Baseline benchmark execution CLI
│
└── docs/                 # Complete 30+ document architectural specification & PRDs
```

---

## 🤖 Supported Models & AI Providers

JAGGU's polymorphic **Model Gateway** abstracts model providers behind a uniform, resilient transport layer with automatic token rate tracking, NDJSON streaming, and direct TLS connections:

| Provider | Provider ID | Supported Models | Connection Type | Authentication |
| :--- | :--- | :--- | :--- | :--- |
| **Anthropic** | `anthropic` | `claude-3-7-sonnet-latest`, `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest` | Direct Cloud API | API Key (SecretStorage) |
| **OpenAI** | `openai` | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` | Direct Cloud API | API Key (SecretStorage) |
| **Google Gemini** | `gemini` | `gemini-2.0-flash`, `gemini-2.0-pro-exp`, `gemini-1.5-pro` | Direct Cloud API | API Key (SecretStorage) |
| **Hugging Face** | `huggingface` | `meta-llama/Llama-3.3-70B-Instruct`, `Qwen/Qwen2.5-Coder-32B-Instruct` | Router Endpoint | Bearer Token |
| **Local Ollama** | `ollama` | `qwen2.5-coder:7b`, `deepseek-r1:14b`, `llama3.3:8b`, any local tag | Local HTTP (default: `11434`) | None (Local Air-Gapped) |
| **OpenAI-Compatible** | `openai-compatible` | Any local or self-hosted model (vLLM, LM Studio, LocalAI) | Local / Remote HTTP | Optional Bearer Token |
| **Mock Engine** | `mock` | `mock-fast`, `mock-accurate`, `mock-stream-error` | In-Memory Deterministic | None (Instant Testing) |

---

## 🧪 Scientific Benchmarking Suite (`@jaggu/eval`)

JAGGU includes an automated evaluation harness designed to test real-world software engineering capabilities across **12 standardized benchmark tasks** in isolated fixtures:

| Task ID | Archetype | Target Repository | Engineering Challenge | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **TASK-01** | `FEATURE` | `fixture-01-rate-limiter` | Token bucket rate limiting with sliding window | Unit test suite execution |
| **TASK-02** | `DEBUG` | `fixture-02-jwt-clockskew` | Clock skew tolerance in JWT verification | Regression test suite |
| **TASK-03** | `REFACTOR` | `fixture-03-repo-decoupling` | Extract database interface from business logic | Multi-file typecheck + test |
| **TASK-04** | `TESTGEN` | `fixture-04-boundary-validation` | Generate high-coverage boundary validation tests | Coverage + test pass rate |
| **TASK-05** | `CODE_INTEL` | `fixture-05-type-error-recovery` | Diagnose and resolve compiler type mismatches | LSP compiler diagnostic check |
| **TASK-06** | `GIT_SAFETY` | `fixture-06-dirty-worktree` | Execute tasks while preserving dirty unstaged work | Git working tree diff inspection |
| **TASK-07** | `PARTIAL_APPROVAL` | `fixture-07-partial-approval` | Selective approval: approve file A, reject file B | Byte-for-byte unmutated check |
| **TASK-08** | `EXPLAIN` | `fixture-08-architecture-trace` | Generate cross-module trace and flow explanation | Structural markdown validation |
| **TASK-09** | `ASYNC_RACE` | `fixture-09-async-race` | Resolve async worker pool race condition | Concurrent test runner |
| **TASK-10** | `SECURITY` | `fixture-10-path-security` | Patch path traversal vulnerability (`/../secrets`) | Security override validation |
| **TASK-11** | `INTEGRATION` | `fixture-11-correlation-id` | Propagate HTTP correlation IDs across microservices | End-to-end integration test |
| **TASK-12** | `PERFORMANCE` | `fixture-12-cache-eviction` | Implement LRU cache with eviction watermark | Latency & capacity test suite |

Run the full evaluation baseline:
```bash
npm run eval --workspace=@jaggu/eval
```

---

## 🚀 Quickstart & Installation

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **VS Code**: `v1.90.0` or higher
- **Git**: Installed and configured on your path
- *(Optional)* **Ollama**: For 100% offline local model inference

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/jaggureddy11/AI-Coding-Agent.git
cd AI-Coding-Agent
npm install
```

### 2. Build All Packages
```bash
npm run build
```

### 3. Run Verification Tests
Verify that all 31 test suites pass cleanly across core, UI, extension host, and eval:
```bash
npm test
```

### 4. Launch in VS Code
1. Open the repository root in VS Code:
   ```bash
   code .
   ```
2. Press **`F5`** (or select **Run > Start Debugging**).
3. An **Extension Development Host** window will open with JAGGU activated.
4. Click the **JAGGU** icon in the Activity Bar sidebar to start collaborating!

---

## ⚙️ Configuration Reference

Configure JAGGU to your preferred workflow in **VS Code Settings** (`Cmd+,` or `Ctrl+,` > search `JAGGU`):

```jsonc
{
  // Primary AI Provider ("mock", "ollama", "openai-compatible", "openai", "anthropic", "gemini", "huggingface")
  "jaggu.provider": "ollama",

  // Model identifier
  "jaggu.model": "qwen2.5-coder:7b",

  // Local Ollama server endpoint (when using provider: "ollama")
  "jaggu.ollama.endpoint": "http://localhost:11434",

  // Custom OpenAI-compatible endpoint (vLLM, LM Studio, etc.)
  "jaggu.openaiCompatible.endpoint": "http://localhost:1234/v1",

  // Context window token limit (0 = automatic model default)
  "jaggu.model.contextLimit": 0,

  // Sampling temperature
  "jaggu.temperature": 0.2
}
```

### Setting API Keys
API keys are stored securely using VS Code's native `SecretStorage` API (backed by macOS Keychain, Windows Credential Manager, or Linux Secret Service):
1. Run Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
2. Search: **`JAGGU: Manage API Keys`**.
3. Select your provider (`Anthropic`, `OpenAI`, `Google Gemini`, or `Hugging Face`) and paste your key.

---

## 📚 Complete Engineering Documentation

The `docs/` directory contains an exhaustive, production-grade architectural specification suite:

| Category | Key Documents | Description |
| :--- | :--- | :--- |
| **Product & Vision** | [`01-product-vision.md`](docs/01-product-vision.md)<br>[`02-PRD.md`](docs/02-PRD.md)<br>[`03-roadmap.md`](docs/03-roadmap.md) | Vision, problem statement, user personas, phased delivery roadmap. |
| **Architecture** | [`06-system-architecture.md`](docs/06-system-architecture.md)<br>[`07-agent-architecture.md`](docs/07-agent-architecture.md)<br>[`14-api-contracts.md`](docs/14-api-contracts.md) | Multi-process topology, Extension Host IPC, FSM transitions. |
| **Context & Retrieval** | [`10-context-engine.md`](docs/10-context-engine.md)<br>[`11-code-indexing.md`](docs/11-code-indexing.md) | 8-tier context hierarchy, Ripgrep AST lexical index, sliding budgets. |
| **Security & Safety** | [`09-security-and-permissions.md`](docs/09-security-and-permissions.md)<br>[`17-git-integration.md`](docs/17-git-integration.md) | Three-tier permissions, command allowlists, Git checkpoint manager. |
| **Model Gateway** | [`12-model-layer.md`](docs/12-model-layer.md)<br>[`M7A_MODEL_SUPPORT.md`](docs/M7A_MODEL_SUPPORT.md) | Polymorphic provider adapters, local AI runtimes, streaming parser. |
| **Evaluation & Tests** | [`18-test-strategy.md`](docs/18-test-strategy.md)<br>[`19-agent-evaluation.md`](docs/19-agent-evaluation.md)<br>[`M8_IMPLEMENTATION.md`](docs/M8_IMPLEMENTATION.md) | Four-tier testing pyramid, 12-task benchmark suite, latency telemetry. |
| **Architecture Decisions** | [`docs/adr/`](docs/adr/) | 8 Architecture Decision Records (Extension vs Fork, FSM, Safety). |

---

## 🛠️ Development & Quality Invariants

JAGGU enforces strict engineering standards across all packages:
- **Strict TypeScript**: `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`. Zero unchecked `any`.
- **Zero Circular Dependencies**: Enforced via unidirectional package dependency DAG (`jaggu-vscode` ➔ `jaggu-ui` & `jaggu-core`).
- **Minimal Dependencies**: Pure TypeScript core with zero heavy C++ native bindings. Fast startup under 200ms.
- **100% Test Passing Invariant**: Every commit must pass all unit, integration, and vertical slice tests without skipping.

```bash
# Type check all workspaces
npm run typecheck

# Code formatting & linting
npm run lint
npm run format

# Run tests with coverage
npm test
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details. Built upon the Visual Studio Code open API framework.
