# JAGGU — Autonomous AI Coding Agent for VS Code

<p align="center">
  <img src="media/icon.png" alt="JAGGU Logo" width="128" style="border-radius: 24px;" />
</p>

<h2 align="center">Developer-Controlled Autonomous AI Coding Agent for VS Code</h2>

<p align="center">
  <em>Plan precisely. Stage safely in shadow buffers. Verify with tests. Never surrender control.</em>
</p>

<p align="center">
  <a href="https://code.visualstudio.com/"><img src="https://img.shields.io/badge/VS_Code-%5E1.90.0-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=jaggu.jaggu-vscode"><img src="https://img.shields.io/badge/Version-2.0.0-blueviolet?style=flat-square" alt="Version 2.0.0"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://github.com/jaggureddy11/AI-Coding-Agent"><img src="https://img.shields.io/badge/Tests-40_Suites_Passing_(271_Tests)-brightgreen?style=flat-square" alt="Tests"></a>
  <a href="#-security--privacy-first"><img src="https://img.shields.io/badge/Privacy-Zero_Exfiltration-orange?style=flat-square" alt="Privacy"></a>
  <a href="#-supported-models--intelligent-routing"><img src="https://img.shields.io/badge/Air--Gapped-100%25_Offline_Ready-purple?style=flat-square" alt="Air-Gapped"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"></a>
</p>

---

## ⚡ What is JAGGU?

Most AI coding assistants force developers into one of two frustrating extremes:
1. **Chatbots that copy-paste**: Output code snippets to a sidebar that you must manually copy, paste, and diagnose when they break.
2. **Opaque Black-Box Agents**: Silently mutate workspace files on disk without warning, introducing subtle regressions and corrupting git histories.

**JAGGU delivers true autonomous engineering without sacrificing developer control.**

Built directly on the VS Code extension runtime, JAGGU indexes your codebase with Ripgrep, synthesizes structured milestone execution plans, stages surgical diffs in an **in-memory shadow buffer (`VirtualDocStore`)**, runs your project's test suites to verify its solutions, and autonomously repairs compiler or test errors before presenting the finished work for your final approval.

> **Zero Middleman Proxy** • **Free-First Default** • **100% Direct TLS Connections** • **Air-Gapped Local Model Support**

---

## 🚀 What's New in Version 2.0.0

| Feature | Highlight |
| :--- | :--- |
| 🎨 **Antigravity-Inspired Modern UI** | Sleek glassmorphic floating input dock with dynamic textarea auto-expansion, fluid scrolling, and dragging responsiveness. |
| 🎙️ **Live Voice Typing** | Integrated hands-free voice dictation powered by the Web Speech API with permission recovery, audio stream cleanup, and visual microphone state indicators. |
| ⚡ **Zero-Slop Streaming** | Real-time token streaming with automatic preamble removal (eliminating AI conversational filler like *"I will analyze this project..."*) for instant, direct technical delivery. |
| 📥 **Native Insert at Cursor** | One-click **Insert** button on generated code blocks immediately injects or replaces code at the cursor in your active VS Code editor. |
| 💬 **Multi-Session Chat Histories** | Full multi-session support with isolated conversation context, instant session switching, session deletion, and persistent state across IDE reloads. |
| 🚦 **Model Selector with Live Health Probes** | Streamlined model selection dropdown featuring live health probes (`Available`, `API Key Required`, `Endpoint Unreachable`), cross-region deduplication, and non-blocking background runtime verification. |
| 📝 **Semantic Markdown Typography** | Full markdown rendering support with semantic headings (`#`, `##`, `###`), structured bullet lists, and in-progress live streaming code blocks. |

---

## 🏛️ Architecture Overview

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

---

## ✨ Core Pillars of JAGGU

### 1. 🛡️ Controlled Autonomy
Built on a deterministic 7-state Finite State Machine (`IDLE` ➔ `PLANNING` ➔ `APPROVAL` ➔ `EXECUTING` ➔ `VERIFYING` ➔ `SELF-HEAL` ➔ `COMPLETE`). Zero runaway loops or silent background file corruption.

### 2. 📋 Structured Milestone Planning
Before touching code, JAGGU formulates a structured `PlanCard` with explicit milestones, affected files, risks, and verification steps. You review, approve, or refine the plan first.

### 3. 🪟 In-Memory Shadow Buffer Staging
All proposed code modifications are staged in an in-memory `VirtualDocStore` using Myers diff algorithm. Inspect proposed modifications side-by-side using VS Code's native diff editor (`jaggu-shadow:`).

### 4. 📁 Granular File Approvals
Selectively approve or reject individual files within a multi-file change set. Reject unwanted edits with zero disk mutations.

### 5. 🔄 Automated Test Verification & Self-Healing
Automatically runs workspace test runners (Vitest, Jest, PyTest, Go test, Cargo) after code changes. If a test fails, the agent inspects the stack trace and executes targeted self-repairs (bounded to 3 attempts).

### 6. 🔒 Non-Destructive Git Safety
Automatic working tree snapshot checkpointing safeguards unstaged modifications. JAGGU never pushes to remote repositories.

---

## 🎮 Getting Started

### 1. Open the Chat Sidebar
Click the **JAGGU icon** in the VS Code Activity Bar (or press `Cmd+Shift+P` / `Ctrl+Shift+P` and type **`JAGGU: Open Chat`**).

### 2. Choose Your AI Provider
- **Free Cloud Model (Hugging Face)**: Run `JAGGU: Set Hugging Face Token` and paste your free token (`hf_...`).
- **100% Local & Air-Gapped (Ollama)**: Start Ollama (`ollama serve`). JAGGU auto-detects running local models like `qwen2.5-coder` or `deepseek-r1`.
- **OpenAI / Anthropic / Gemini**: Run `JAGGU: Manage API Keys (SecretStorage)` to store credentials in your OS Keychain.

### 3. Assign a Task
Type your request or use **Live Voice Typing** (e.g., *"Add authentication middleware and write unit tests"*).
- Type `@` to reference workspace files.
- Review the proposed engineering plan.
- Inspect the live side-by-side diff.
- Let JAGGU verify the changes with your test suite!

---

## 🤖 Supported Models & Providers

JAGGU connects directly to AI providers with **zero intermediate proxy servers** and **Free-First Auto Routing**:

| Provider | Access Tier | Highlighted Models | Privacy / Connection |
| :--- | :--- | :--- | :--- |
| **Auto (Default)** | **Free / Local First** | Dynamic best model (`Qwen3-Coder-30B`, `qwen2.5-coder:7b`) | Automated Zero-Cost Priority |
| **Hugging Face** | **Free Cloud** | `Qwen/Qwen3-Coder-30B-A3B-Instruct`, `meta-llama/Llama-3.1-8B` | Direct Client-to-API TLS |
| **Local Ollama** | **100% Local / Free** | `qwen2.5-coder:7b`, `deepseek-r1:8b`, `llama3.3:70b` | **100% Offline / Air-Gapped** |
| **OpenAI-Compatible** | **Local Server** | Any self-hosted model (vLLM, LM Studio, LocalAI) | Local / Private Network |
| **Anthropic** | **Paid (Opt-in)** | `claude-3-7-sonnet-latest`, `claude-3-5-sonnet-latest` | Direct Client-to-API TLS |
| **OpenAI** | **Paid (Opt-in)** | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` | Direct Client-to-API TLS |
| **Google Gemini** | **Paid (Opt-in)** | `gemini-2.0-flash`, `gemini-1.5-pro` | Direct Client-to-API TLS |

---

## ⌨️ VS Code Commands

Access all JAGGU commands from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Identifier | Description |
| :--- | :--- | :--- |
| `JAGGU: Open Chat` | `jaggu.openChat` | Focuses the JAGGU sidebar view |
| `JAGGU: Start New Session` | `jaggu.startSession` | Initializes a fresh session with isolated memory |
| `JAGGU: Cancel Active Task` | `jaggu.cancelSession` | Aborts in-flight generation, streaming, or test runs |
| `JAGGU: Manage API Keys (SecretStorage)` | `jaggu.setApiKey` | Stores API keys in OS Keychain / Credential Manager |
| `JAGGU: Set Hugging Face Token` | `jaggu.setHuggingFaceToken` | Stores your free Hugging Face token |
| `JAGGU: Remove Hugging Face Token` | `jaggu.removeHuggingFaceToken` | Clears Hugging Face token |
| `JAGGU: Test Hugging Face Connection` | `jaggu.testHuggingFaceConnection` | Tests live connectivity to Hugging Face |
| `JAGGU: Check Provider Status` | `jaggu.checkProviderStatus` | Verifies runtime health of all providers |
| `JAGGU: Select Model Provider` | `jaggu.selectProvider` | Switches active AI provider |
| `JAGGU: Select Active Model` | `jaggu.selectModel` | Selects specific model tag or custom model string |
| `JAGGU: Approve Plan` | `jaggu.approvePlan` | Approves staged milestone engineering plan |
| `JAGGU: Reject Plan` | `jaggu.rejectPlan` | Rejects proposed plan and allows prompt refinement |
| `JAGGU: Approve Changes` | `jaggu.approveEditSet` | Atomically applies reviewed change set to workspace |
| `JAGGU: Reject Changes` | `jaggu.rejectEditSet` | Rejects change set with zero disk mutations |
| `JAGGU: Review Proposed Diff` | `jaggu.reviewDiff` | Opens native VS Code side-by-side diff review |

---

## 🛡️ Security & Privacy First

- 🔐 **OS-Level Secret Storage**: API keys are saved exclusively into VS Code's `SecretStorage` API (backed by macOS Keychain, Windows Credential Manager, or Linux Secret Service). Never saved to plain text or settings files.
- 🧹 **Secret Sanitizer**: Built-in regex sanitization strips API keys, tokens, and sensitive headers from debug logs and error messages.
- 🛡️ **Zero Telemetry Exfiltration**: Code, prompts, and tokens are never sent to third-party analytics or intermediary relays.
- 🛑 **Shadow Staging Protection**: The agent cannot execute destructive writes directly to your disk; all diffs reside in memory until explicitly accepted.
- 🔒 **Workspace Confinement**: Path resolution strictly prevents directory traversal (`/../`) attacks beyond the active project folder.

---

## 📄 License

This extension is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
