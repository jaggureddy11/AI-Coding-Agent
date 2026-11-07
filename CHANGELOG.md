# Changelog

All notable changes to the **JAGGU** extension and monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-11-07

### Added
- **Antigravity-Inspired Modern UI**: Redesigned floating input bar with glassmorphic aesthetics, fluid auto-resizing textarea, and responsive drag handles.
- **Isolated Multi-Session Histories & New Chat**: Added multi-session support with separate conversation histories, instant switching, session deletion, and cross-reload state persistence.
- **Zero-Slop Streaming**: Real-time token streaming with automatic preamble removal (eliminating AI conversational filler and robotic chatter) for instant, direct technical delivery.
- **Insert at Cursor Action**: Added one-click "Insert" button on generated code blocks to immediately inject or replace code at the cursor in the active VS Code editor, with fallback to new documents if active editor is read-only.
- **Live Voice Typing**: Integrated hands-free voice transcription powered by the Web Speech API with permission recovery, audio stream cleanup, and visual microphone state indicators.
- **Clean Model Selector & Health Diagnostics**: Streamlined model selection dropdown featuring live health probes (Available, API Key Required, Endpoint Unreachable), cross-region deduplication, and non-blocking background runtime verification.
- **Enhanced Markdown Typography**: Added semantic styling for Markdown headings (`#`, `##`, `###`), structured bullet lists, and in-progress live streaming code blocks.
- **Hardened Error Handling & Re-authentication**: Added explicit guidance for expired AWS credentials and network drops with automatic token scrubbing.

---

## [0.1.0] - 2026-09-15

### Added
- **Autonomous Agent Orchestrator**: Core agent loop built on a deterministic 7-state Finite State Machine (`IDLE`, `PLANNING`, `AWAITING_APPROVAL`, `EXECUTING`, `VERIFYING`, `SELF_HEALING`, `COMPLETED`, `ERROR`).
- **Repository Context Engine**: Workspace discovery, import tree analysis, and high-speed Ripgrep symbol indexing with sliding token budgets.
- **Structured Planning & Approval**: Interactive `PlanCard` interface for developer review, modification, and consensus before execution.
- **Shadow Buffer Staging & Native Diff**: Surgical multi-file Myers diff generation staged in an in-memory `VirtualDocStore`, with side-by-side native VS Code diff previews (`jaggu-shadow:`).
- **Selective File Approval**: Granular per-file approval allowing users to accept or reject specific file changes.
- **Runtime Verification Engine**: Automatic execution of workspace test runners (Vitest, Jest, PyTest, Go test, Cargo) with exit code and stack trace parsing.
- **LSP Compiler Diagnostics**: Real-time feedback integration with VS Code Language Server Protocol.
- **Autonomous Self-Healing Loop**: Root-cause failure localization and iterative repair (bounded to a strict 3-retry budget).
- **Git Working Tree Safety**: Snapshot checkpointing to safeguard unstaged user modifications; zero automated push operations.
- **Polymorphic Model Gateway**: Unified, provider-independent model client supporting:
  - Anthropic (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
  - OpenAI (GPT-4o, GPT-4o-mini, o1, o3-mini)
  - Google Gemini (Gemini 2.0 Flash, Gemini 2.0 Pro)
  - Hugging Face Router (Llama 3.3 70B, Qwen 2.5 Coder 32B)
  - Local Ollama (`qwen2.5-coder`, `deepseek-r1`, `llama3.3`)
  - OpenAI-Compatible endpoints (vLLM, LM Studio, LocalAI)
  - Mock Provider (in-memory deterministic testing)
- **Security & SecretStorage**: OS-level keychain credential storage with automatic `SecretSanitizer` token scrubbing and nonce-based Webview Content Security Policy (CSP).
- **Scientific Evaluation Suite (`@jaggu/eval`)**: 12-task SWE benchmark suite covering rate limiting, clock skew, repository decoupling, boundary testing, type error recovery, git safety, selective approval, architecture tracing, async race conditions, path traversal security, correlation ID tracing, and cache eviction.
- **Clean VSIX Packaging**: Standalone `esbuild` extension bundle with zero external monorepo runtime dependencies.
