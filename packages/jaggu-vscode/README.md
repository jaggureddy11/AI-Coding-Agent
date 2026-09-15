# JAGGU ⚡

<p align="center">
  <img src="media/icon.png" alt="JAGGU Logo" width="128" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>The Developer-Controlled Autonomous AI Coding Agent for VS Code</strong><br>
  <em>Plan precisely. Stage safely. Verify with tests. Never surrender control.</em>
</p>

<p align="center">
  <a href="https://code.visualstudio.com/"><img src="https://img.shields.io/badge/VS_Code-%5E1.90.0-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://github.com/jaggureddy11/AI-Coding-Agent"><img src="https://img.shields.io/badge/Tests-31_Suites_Passing-brightgreen?style=for-the-badge" alt="Tests"></a>
  <a href="#-security--privacy-first"><img src="https://img.shields.io/badge/Privacy-Zero_Exfiltration-orange?style=for-the-badge" alt="Privacy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-using-jaggu">Usage</a> •
  <a href="#-vs-code-commands">Commands</a> •
  <a href="#-supported-models--providers">Models</a> •
  <a href="#-security--privacy-first">Security</a>
</p>

---

## ⚡ Overview

Most AI coding assistants either output code snippets to a chat window for you to manually copy-paste, or silently modify your workspace files with opaque, unpredictable changes.

**JAGGU delivers true autonomous engineering without sacrificing developer control.**

Built directly on the VS Code extension runtime, JAGGU indexes your codebase with Ripgrep, synthesizes structured multi-phase execution plans, stages surgical diffs in an **in-memory shadow buffer**, runs your project's test suites to verify its solutions, and autonomously repairs compiler or test errors before presenting the finished work for your final approval.

> **Zero Middleman Proxy** • **100% Direct TLS Connections** • **Air-Gapped Local Model Support**

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

## 📄 License

This extension is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details. Built upon the Visual Studio Code extension architecture.
