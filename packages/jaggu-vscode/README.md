# JAGGU — Autonomous AI Coding Agent for VS Code

<p align="center">
  <img src="media/icon.png" alt="JAGGU Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>A developer-controlled autonomous AI coding agent built on the Visual Studio Code foundation.</strong><br>
  <em>Act, Do Not Merely Chat.</em>
</p>

---

## Overview

**JAGGU** is an autonomous software engineering partner for VS Code that enables developers to delegate multi-file coding, debugging, refactoring, and test repair tasks without relinquishing architectural oversight or code control.

Unlike conversational chatbots that output snippets for manual copying, or opaque tools that silently overwrite workspace files, JAGGU operates within an observable, deterministic **7-state Finite State Machine (FSM)**. It analyzes your repository, constructs a structured plan, requests your approval, stages surgical multi-file diffs in an in-memory shadow buffer, executes test suites to verify its work, and self-heals compiler or test errors before completion.

---

## Key Features

- 🔍 **Repository-Aware Context**: Automatic workspace discovery, import dependency tracing, and high-speed Ripgrep symbol indexing.
- 📋 **Structured Planning**: Generates phased, milestone-based plans presented as interactive **PlanCards** for your explicit consensus.
- 🛡️ **Approval-Gated Multi-File Editing**: Changes are staged in an in-memory `VirtualDocStore` shadow buffer. Files can be inspected, approved individually, or selectively rejected.
- ⚡ **Native VS Code Diff Review**: Inspect proposed modifications side-by-side using VS Code's native diff viewer before disk commits.
- 🔄 **Deterministic Test Verification**: Automatically executes workspace test runners (Vitest, Jest, PyTest, Go test, Cargo) and parses exit codes and stack traces.
- 🩺 **Language Service Diagnostics**: Collects real-time compiler and linter diagnostics directly from the VS Code Language Server Protocol (LSP).
- 🩹 **Autonomous Self-Healing Loop**: Diagnoses compilation and test failures, synthesizes surgical fixes, and verifies repairs (strictly bounded to a 3-retry budget).
- 🔒 **Git Working Tree Safety**: Creates non-destructive safety checkpoints to preserve unstaged developer modifications. Never performs autonomous git pushes.
- ⏹️ **Instant Cancellation**: Abort active tasks or in-flight model streams at any second with a single click or `Escape`.
- 🌐 **Provider Independence**: Seamlessly switch between Anthropic Claude, OpenAI GPT-4o, Google Gemini, Hugging Face, and 100% offline local inference via Ollama or OpenAI-compatible servers.

---

## Architecture

JAGGU uses a clean, decoupled multi-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Visual Studio Code                     │
│    (Sidebar Webview • Native Diff View • Status Bar)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Extension Host IPC (Typed RPC)
┌──────────────────────────────▼──────────────────────────────┐
│                    JAGGU Extension Host                     │
│   (SidebarProvider • SecretStorage • VirtualDocProvider)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      Agent Orchestrator                      │
│            (Deterministic 7-State State Machine)            │
├──────────────────────────────┬──────────────────────────────┤
│       Context Engine         │      Verification Engine     │
│   (Ripgrep + RepoMap)        │   (Test Runners + LSP Diag)  │
├──────────────────────────────┴──────────────────────────────┤
│                        Tool Executor                        │
│   (ReadFile • ProposeEdit • ApplyEdit • RunTests • Git)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Direct TLS / Local IPC
┌──────────────────────────────▼──────────────────────────────┐
│                    Polymorphic Model Gateway                │
│    ┌───────────────┬───────────────┬───────────────────┐    │
│    │ Cloud Models  │ Local Ollama  │ OpenAI-Compatible │    │
│    │ (Claude/GPT/  │ (Qwen/        │ (vLLM / LM Studio/│    │
│    │  Gemini/HF)   │  DeepSeek-R1) │  LocalAI)         │    │
│    └───────────────┴───────────────┴───────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation

### From VS Code Marketplace (When Published)
1. Open VS Code and navigate to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`).
2. Search for `JAGGU`.
3. Click **Install**.

### Installing from a VSIX Package (Development / Offline)
1. Download or build `jaggu-vscode-0.1.0.vsix`.
2. In VS Code, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
3. Run **Extensions: Install from VSIX...** and select the `.vsix` file.
4. Alternatively, install from terminal:
   ```bash
   code --install-extension jaggu-vscode-0.1.0.vsix
   ```

---

## Model Configuration & Credentials

JAGGU provides true provider agnosticism. Configure your active provider in **Settings** (`Cmd+,` > search `JAGGU`):

### Supported Providers
- **Local Ollama** (`ollama`): Air-gapped, zero-cost inference. Requires a running Ollama daemon (`ollama serve`). Recommended models: `qwen2.5-coder:7b`, `deepseek-r1:14b`, `llama3.3:8b`.
- **OpenAI-Compatible** (`openai-compatible`): Point to local or private enterprise vLLM, LM Studio, or LocalAI endpoints.
- **Anthropic** (`anthropic`): Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku.
- **OpenAI** (`openai`): GPT-4o, GPT-4o-mini, o1, o3-mini.
- **Google Gemini** (`gemini`): Gemini 2.0 Flash, Gemini 2.0 Pro, Gemini 1.5 Pro.
- **Hugging Face** (`huggingface`): Llama 3.3 70B, Qwen 2.5 Coder 32B via HF Router.
- **Mock** (`mock`): Deterministic in-memory simulated responses for instant testing and evaluation.

### Managing API Keys
API keys are never stored in settings or files. They are managed through VS Code's native `SecretStorage` API (OS Keychain / Credential Manager):
1. Open Command Palette (`Cmd+Shift+P`).
2. Run **`JAGGU: Manage API Keys (SecretStorage)`**.
3. Select your provider (`OpenAI`, `Anthropic`, `Gemini`, or `Hugging Face`) and input your key.

---

## Security & Sandboxing

- 🔐 **Zero Credential Exposure**: API tokens are never written to disk, sent to Webviews, or printed in logs. The built-in `SecretSanitizer` automatically scrubs tokens from debug channels.
- 🛡️ **Content Security Policy (CSP)**: The Webview enforces strict nonce-based CSP (`default-src 'none'; script-src 'nonce-...';`) preventing unauthorized script execution.
- 📂 **Workspace Containment**: File reading, search, and editing tools strictly validate paths against the active workspace root to prevent directory traversal (`/../`).
- ✍️ **Zero Silent Writes**: Diffs are staged in an in-memory shadow buffer. File mutation occurs only upon explicit developer approval.
- 🛑 **Untrusted Model Output**: Model responses are treated as untrusted proposals subject to JSON schema validation and compiler diagnostic checks.

---

## Privacy Notice

- **No Proprietary Relay**: JAGGU establishes direct TLS connections from your machine to your chosen AI provider. There are no intermediate telemetry proxy servers.
- **Local AI Privacy**: When using the `ollama` or `openai-compatible` providers, 100% of code tokens remain on your local machine.
- **Cloud Providers**: When using cloud providers, only the relevant prompt tokens (task intent, retrieved code context, and active file diffs) are transmitted to the respective API provider in accordance with their terms of service.
- **Telemetry**: JAGGU does not implement independent usage telemetry.

---

## Scientific Evaluation Suite

JAGGU includes a standardized evaluation harness ([`@jaggu/eval`](https://github.com/jaggureddy11/AI-Coding-Agent/tree/main/packages/jaggu-eval)) with **12 realistic multi-file engineering benchmark tasks** across 8 archetypes:
1. `FEATURE`: Token bucket rate limiting with sliding window (`fixture-01-rate-limiter`)
2. `DEBUG`: JWT expiration clock skew tolerance (`fixture-02-jwt-clockskew`)
3. `REFACTOR`: Decoupling repository interfaces (`fixture-03-repo-decoupling`)
4. `TESTGEN`: Boundary test suite generation (`fixture-04-boundary-validation`)
5. `CODE_INTEL`: Type error diagnosis and repair (`fixture-05-type-error-recovery`)
6. `GIT_SAFETY`: Preserving unstaged working tree changes (`fixture-06-dirty-worktree`)
7. `PARTIAL_APPROVAL`: Selective file approval and rejection (`fixture-07-partial-approval`)
8. `EXPLAIN`: Cross-module architecture tracing (`fixture-08-architecture-trace`)
9. `ASYNC_RACE`: Worker pool concurrency race condition repair (`fixture-09-async-race`)
10. `SECURITY`: Directory traversal vulnerability remediation (`fixture-10-path-security`)
11. `INTEGRATION`: Correlation ID tracing across microservices (`fixture-11-correlation-id`)
12. `PERFORMANCE`: LRU cache eviction under load (`fixture-12-cache-eviction`)

---

## Known Limitations

- **File-Level Approval**: The current release supports full file-level approval and selective rejection. Individual hunk-level staging within a single file will arrive in v0.2.0.
- **Local Model Hardware**: Running local models (e.g. `qwen2.5-coder:7b`) via Ollama requires appropriate CPU/GPU RAM (minimum 8GB system RAM; 16GB+ recommended).
- **Network Requirements**: Cloud providers (Claude, GPT, Gemini, Hugging Face) require outbound Internet access.
- **Model Non-Determinism**: AI outputs depend on the underlying model's reasoning capabilities; code modifications should always be reviewed before committing.

---

## Contributing & Development

```bash
# Clone repository
git clone https://github.com/jaggureddy11/AI-Coding-Agent.git
cd AI-Coding-Agent

# Install monorepo dependencies
npm install

# Build all packages
npm run build

# Run automated test suites (189+ tests)
npm test

# Typecheck and lint
npm run typecheck
npm run lint
```

Press **`F5`** in VS Code to launch the Extension Development Host.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details. Built upon the Visual Studio Code extension architecture.
