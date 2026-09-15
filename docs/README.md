# JAGGU

<p align="center">
  <img src="./packages/jaggu-vscode/media/icon.png" alt="JAGGU Logo" width="128" style="border-radius: 24px;" />
</p>

<h2 align="center">Developer-Controlled AI Coding Agent for VS Code</h2>

<p align="center">
  <em>Plan precisely. Stage safely. Verify with tests. Never surrender control.</em>
</p>

<p align="center">
  <code>TypeScript</code> &nbsp;|&nbsp;
  <code>React</code> &nbsp;|&nbsp;
  <code>VS Code API</code> &nbsp;|&nbsp;
  <code>Hugging Face</code> &nbsp;|&nbsp;
  <code>Ollama</code>
</p>

<p align="center">
  <a href="#-demo"><img src="https://img.shields.io/badge/🎬_Demo-Preview-8A2BE2?style=for-the-badge" alt="Demo"></a>
  <a href="#-architecture-diagram"><img src="https://img.shields.io/badge/🏛️_Architecture-Diagram-4B0082?style=for-the-badge" alt="Architecture Diagram"></a>
  <a href="#-install-extension"><img src="https://img.shields.io/badge/⚡_Install-Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install Extension"></a>
  <a href="#-view-vsix-package"><img src="https://img.shields.io/badge/📦_View-VSIX_Package-28A745?style=for-the-badge" alt="View VSIX"></a>
</p>

<p align="center">
  <a href="https://code.visualstudio.com/"><img src="https://img.shields.io/badge/VS_Code-%5E1.90.0-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#-development--testing"><img src="https://img.shields.io/badge/Tests-31_Suites_Passing-brightgreen?style=flat-square" alt="Tests"></a>
  <a href="#-security--privacy-first"><img src="https://img.shields.io/badge/Privacy-Zero_Exfiltration-orange?style=flat-square" alt="Privacy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"></a>
</p>

---

## ⚡ Overview

Most AI coding assistants either output code snippets to a chat window for you to manually copy-paste, or silently modify your workspace files with opaque, unpredictable changes.

**JAGGU delivers true autonomous engineering without sacrificing developer control.**

Built directly on the VS Code extension runtime, JAGGU indexes your codebase with Ripgrep, synthesizes structured multi-phase execution plans, stages surgical diffs in an **in-memory shadow buffer**, runs your project's test suites to verify its solutions, and autonomously repairs compiler or test errors before presenting the finished work for your final approval.

> **Zero Middleman Proxy** • **100% Direct TLS Connections** • **Air-Gapped Local Model Support**

---

## 🎬 Demo

<p align="center">
  <img src="./docs/images/demo.png" alt="JAGGU VS Code Extension Live Interface" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.25);" />
</p>

*Above: JAGGU's interactive sidebar inside VS Code with model switching, autonomous plan formulation, approval gates, and native side-by-side diff review.*

---

## 🏛️ Architecture Diagram

JAGGU uses a decoupled, event-driven multi-layer architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Visual Studio Code                            │
│     (Sidebar Webview React 18 • Native Diff Editor • Status Bar)        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Extension Host Typed IPC
┌────────────────────────────────────▼────────────────────────────────────┐
│                          JAGGU Extension Host                           │
│       (SidebarProvider • SecretStorage • VirtualDocProvider)            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                            Agent Orchestrator                           │
│        (Deterministic 7-State Finite State Machine / Safety Model)      │
├────────────────────────────────────┬────────────────────────────────────┤
│           Context Engine           │        Verification Engine         │
│   (Ripgrep Index + AST RepoMap)    │   (Test Runners + LSP Diagnostics) │
├────────────────────────────────────┴────────────────────────────────────┤
│                              Tool Executor                              │
│       (ReadFile • ProposeEdit • ApplyEdit • ExecuteTerminal • Git)      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Direct TLS / Local IPC
┌────────────────────────────────────▼────────────────────────────────────┐
│                        Polymorphic Model Gateway                        │
│   ┌─────────────────────┬──────────────────────┬────────────────────┐   │
│   │    Cloud Models     │  Air-Gapped Ollama   │ OpenAI-Compatible  │   │
│   │ (Claude/GPT/Gemini) │  (Qwen/DeepSeek-R1)  │ (vLLM / LM Studio) │   │
│   └─────────────────────┴──────────────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### The 7-State Execution Loop

```mermaid
flowchart TD
    A([User Task]) --> B[1. Context Discovery & Ripgrep Indexing]
    B --> C[2. Formulate Structured PlanCard]
    C --> D{3. Human Approval Gate}
    D -- Modify / Reject --> C
    D -- Approved --> E[4. Stage Myers Diffs in Shadow Buffer]
    E --> F[5. Execute Test Suite & LSP Diagnostics]
    F --> G{Tests Pass?}
    G -- Failing Tests --> H[6. Autonomous Self-Healing Loop<br>Max 3 Retries]
    H --> E
    G -- All Tests Pass --> I[7. Interactive Diff Review & Selective Merge]
    I --> J([Task Completed Safely])
```

---

## ⚡ Install Extension

### Quick Install via VS Code Terminal
Run the following command in your terminal to install the packaged extension directly into your local VS Code instance:

```bash
code --install-extension packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix
```

### Install via VS Code UI
1. Open VS Code.
2. Open the Command Palette (`Cmd+Shift+P` on macOS / `Ctrl+Shift+P` on Windows/Linux).
3. Type **`Extensions: Install from VSIX...`** and press Enter.
4. Select `packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix`.

---

## 📦 View VSIX Package

The production-ready, standalone VSIX package is generated at:

| Attribute | Details |
| :--- | :--- |
| **Artifact Path** | [`packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix`](packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix) |
| **Package Size** | ~508 KB (Self-contained, zero external runtime dependencies) |
| **Included Files** | 12 files (Bundled CJS extension, minified Webview IIFE, icons, manifest, license) |
| **Target VS Code** | `^1.90.0` or higher |

To rebuild or repackage the VSIX from source at any time:
```bash
npm run package:extension
```

---

## ✨ Key Features

| Capability | What It Does | Why It Matters |
| :--- | :--- | :--- |
| 🛡️ **Controlled Autonomy** | Deterministic 7-state Finite State Machine (`IDLE` ➔ `PLANNING` ➔ `APPROVAL` ➔ `EXECUTING` ➔ `VERIFYING` ➔ `SELF-HEAL` ➔ `COMPLETE`) | No runaway loops or silent background file corruption. Every transition is transparent and observable. |
| 📋 **Interactive PlanCards** | Generates structured, milestone-based execution plans | Review and approve the agent's strategy before a single line of code is staged. |
| 🪟 **Shadow Buffer Diffs** | Edits staged in an in-memory `VirtualDocStore` | Zero direct file overwrites. Inspect changes side-by-side using VS Code's native diff editor. |
| 📁 **Selective File Approval** | Granular per-file Accept / Reject gates | Approve only the files you want, reject unwanted changes, or iterate on the diff before committing. |
| 🔄 **Automated Test Verification** | Auto-detects & runs test runners (Jest, Vitest, PyTest, Go, Cargo) | The agent never marks a task finished without empirical test proof. |
| 🩹 **Self-Healing Loop** | Catches exit codes, stderr & LSP compiler diagnostics | Automatically attempts up to 3 targeted repairs if tests fail or syntax errors arise. |
| 🔒 **Git Safety Checkpoints** | Non-destructive working tree safety stashes | Protects unstaged work and provides instant rollback points. Never pushes to remote. |
| 🌐 **Provider Agnostic & Local AI** | Native support for Claude 3.5/3.7, GPT-4o, Gemini 2.0, Hugging Face, Ollama, & vLLM | Complete independence from vendor lock-in. Run 100% offline and air-gapped with zero telemetry. |

---

## 🎮 Using JAGGU

1. **Open the Sidebar**: Click the **JAGGU coding glasses icon** in the Activity Bar (or run `JAGGU: Open Chat`).
2. **Configure Your Provider**:
   - **Local AI (Ollama)**: Ensure Ollama is running (`ollama serve`). Select `ollama` as your provider and type your model (e.g. `qwen2.5-coder:7b`). No API key needed!
   - **Cloud Models**: Run `JAGGU: Manage API Keys (SecretStorage)` from the Command Palette, pick your provider, and paste your API key.
3. **Submit a Task**: Type your request (e.g. *"Fix the clock skew error in the JWT auth middleware and add regression tests"*).
4. **Approve the Plan**: Review the milestone PlanCard and click **Approve**.
5. **Inspect Diffs & Review**: Check the staged changes in VS Code's side-by-side diff viewer and accept or reject files individually.

---

## ⌨️ VS Code Commands

Access all JAGGU capabilities directly via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Identifier | Action |
| :--- | :--- | :--- |
| `JAGGU: Open Chat` | `jaggu.openChat` | Focuses and opens the JAGGU sidebar view |
| `JAGGU: Start New Session` | `jaggu.startSession` | Resets conversation state and initializes a clean task session |
| `JAGGU: Cancel Active Task` | `jaggu.cancelSession` | Instantly aborts in-flight generation, streaming, or test execution |
| `JAGGU: Manage API Keys (SecretStorage)` | `jaggu.setApiKey` | Securely stores API keys in OS Keychain / Credential Manager |
| `JAGGU: Select Model Provider` | `jaggu.selectProvider` | Quickly switches active AI provider (Ollama, Anthropic, OpenAI, etc.) |
| `JAGGU: Select Active Model` | `jaggu.selectModel` | Selects specific model tag or enters custom model string |

---

## 🤖 Supported Models & Providers

JAGGU connects directly to AI providers with **zero intermediate proxy servers**:

| Provider | Provider ID | Highlighted Models | Privacy / Connection |
| :--- | :--- | :--- | :--- |
| **Local Ollama** | `ollama` | `qwen2.5-coder:7b`, `deepseek-r1:14b`, `llama3.3:8b` | **100% Offline / Air-Gapped** |
| **OpenAI-Compatible** | `openai-compatible` | Any self-hosted model (vLLM, LM Studio, LocalAI) | Local / Private Network |
| **Anthropic** | `anthropic` | `claude-3-7-sonnet-latest`, `claude-3-5-sonnet-latest` | Direct Client-to-API TLS |
| **OpenAI** | `openai` | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` | Direct Client-to-API TLS |
| **Google Gemini** | `gemini` | `gemini-2.0-flash`, `gemini-2.0-pro-exp`, `gemini-1.5-pro` | Direct Client-to-API TLS |
| **Hugging Face** | `huggingface` | `Qwen/Qwen2.5-Coder-32B-Instruct`, `meta-llama/Llama-3.3-70B` | Direct Client-to-API TLS |
| **Mock Engine** | `mock` | `mock-fast`, `mock-accurate` | In-memory simulated for testing |

---

## 🛡️ Security & Privacy First

- 🔐 **OS-Level Secret Storage**: API keys are saved exclusively into VS Code's `SecretStorage` API (backed by macOS Keychain, Windows Credential Manager, or Linux Secret Service). Never saved to plain text or settings files.
- 🧹 **Secret Sanitizer**: Built-in regex sanitization strips API keys, tokens, and sensitive headers from debug logs and error messages.
- 🛡️ **Zero Telemetry Exfiltration**: Code, prompts, and tokens are never sent to third-party analytics or intermediary relays.
- 🛑 **Shadow Staging Protection**: The agent cannot execute destructive writes directly to your disk; all diffs reside in memory until explicitly accepted.
- 🔒 **Workspace Confinement**: Path resolution strictly prevents directory traversal (`/../`) attacks beyond the active project folder.

---

## 📦 Monorepo Architecture

JAGGU is built as an extensible TypeScript monorepo with clean separation of concerns:

```
AI-Coding-Agent/
├── packages/
│   ├── jaggu-core/       # Pure TypeScript agent engine & orchestration
│   │   ├── src/agent/        # 7-state Finite State Machine (FSM)
│   │   ├── src/context/      # Ripgrep indexing & AST context discovery
│   │   ├── src/diff/         # VirtualDocStore shadow buffer & Myers diff
│   │   ├── src/models/       # Model Gateway (Claude, GPT, Gemini, Ollama)
│   │   ├── src/planning/     # Structured PlanCard synthesis & validation
│   │   ├── src/tools/        # Workspace tools (read, write, search, tests)
│   │   └── src/verification/ # Test runner executor & LSP diagnostic analyzer
│   │
│   ├── jaggu-ui/         # React 18 Webview interface
│   │   ├── src/components/   # PlanCard, ApprovalCard, DiffPreview, ModelSelector
│   │   └── src/App.tsx       # Bidirectional RPC bridge with extension host
│   │
│   ├── jaggu-vscode/     # VS Code extension host adapter
│   │   ├── src/extension.ts          # Lifecycle management & command dispatch
│   │   ├── src/sidebarProvider.ts    # Webview provider & agent host bridge
│   │   └── src/credentials.ts        # SecretStorage credential manager
│   │
│   └── jaggu-eval/       # Empirical benchmarking harness
│       ├── fixtures/         # 12 isolated software engineering test sandboxes
│       └── src/evaluator.ts  # Deterministic test harness & scoring engine
│
└── docs/                 # Architecture specifications, PRDs & ADRs
```

---

## 🧪 Scientific Evaluation Suite

JAGGU includes `@jaggu/eval`, an automated benchmarking suite inspired by SWE-bench, evaluating the agent across **12 realistic software engineering archetypes**:

- **Feature Implementation**: Token bucket rate limiting with sliding window
- **Bug Diagnosis**: Clock skew tolerance in JWT expiration
- **Architectural Refactoring**: Decoupling database repositories from business logic
- **Test Generation**: High-coverage boundary and edge-case test synthesis
- **Compiler Recovery**: Diagnostic analysis and repair of TypeScript type errors
- **Concurrency & Race Conditions**: Thread-safe worker pool synchronization
- **Security Vulnerability Remediation**: Directory traversal patching (`/../`)
- **Git Safety & Working Tree**: Unstaged developer modification preservation

To run the evaluation suite:
```bash
npm run eval --workspace=@jaggu/eval
```

---

## 🛠️ Development & Testing

```bash
# Type check all packages
npm run typecheck

# Run linter across all workspaces
npm run lint

# Run all 31 unit & integration test suites
npm test

# Package standalone .vsix extension
npm run package:extension
```

---

## 📚 Documentation

Deep-dive architectural documentation is available in the [`docs/`](docs/) directory:

- [Documentation Master Index](docs/INDEX.md)
- [System Architecture](docs/06-system-architecture.md)
- [Agent State Machine Specification](docs/07-agent-architecture.md)
- [Context Retrieval Engine](docs/10-context-engine.md)
- [Security & Permission Architecture](docs/09-security-and-permissions.md)
- [Marketplace Release Checklist](docs/MARKETPLACE_RELEASE_CHECKLIST.md)
- [Architecture Decision Records (ADRs)](docs/adr/)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
