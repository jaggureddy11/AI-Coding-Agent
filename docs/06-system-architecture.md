# 06 — System Architecture & Component Design

## 1. System Topology & Process Model

ForgeAI is structured as a decoupled multi-process architecture optimized for performance, security, and integration with Visual Studio Code. Rather than running all computations on the VS Code UI thread, ForgeAI strictly segregates execution across three execution domains:

```
+-----------------------------------------------------------------------------------------+
|                                    RENDERER PROCESS                                     |
|  +-----------------------------------------------------------------------------------+  |
|  | VS Code Workbench Shell & Monaco Editor                                           |  |
|  | +-----------------------------+  +----------------------------------------------+ |  |
|  | | ForgeAI Webview Sidebar     |  | Native Monaco Multi-Diff Editor              | |  |
|  | | (React 18 + Tailwind)       |  | (Myers / Line Diff Computations)             | |  |
|  | +--------------+--------------+  +----------------------+-----------------------+ |  |
|  +----------------|----------------------------------------|-------------------------+  |
+-------------------|----------------------------------------|----------------------------+
                    | Webview RPC (postMessage)              | VS Code Extension API
+-------------------|----------------------------------------|----------------------------+
|                   v                                        v                            |
|                                EXTENSION HOST PROCESS                                   |
|  +-----------------------------------------------------------------------------------+  |
|  | ForgeAI Extension Controller (`packages/forgeai-vscode`)                         |  |
|  | - Window / Document Listeners      - SecretStorage (API Keys)                     |  |
|  | - Editor Decoration Controller     - Pseudoterminal / PTY Bridge                  |  |
|  | - LSP Client Invoker               - Git Extension Bridge                         |  |
|  +-------------------------------------+---------------------------------------------+  |
+----------------------------------------|------------------------------------------------+
                                         | IPC / In-Process Worker Bridge
+----------------------------------------v------------------------------------------------+
|                                  AGENT CORE ENGINE                                      |
|  +-----------------------------------------------------------------------------------+  |
|  | Agent Orchestrator (`packages/forgeai-core/agent`)                                |  |
|  | - Deterministic Finite State Machine (FSM)                                        |  |
|  | - Task & Milestone Planner                                                        |  |
|  | - Self-Healing Loop Coordinator                                                   |  |
|  +-----------------------------------------------------------------------------------+  |
|  | Context Engine (`packages/forgeai-context`)                                        |  |
|  | - Ripgrep Content & File Search Engine                                            |  |
|  | - AST Import / Symbol Dependency Resolver                                         |  |
|  | - Sliding Window Token Budget Manager                                             |  |
|  +-----------------------------------------------------------------------------------+  |
|  | Model Gateway (`packages/forgeai-models`)                                         |  |
|  | - Provider Adapters (Anthropic, OpenAI, Gemini, Ollama)                           |  |
|  | - SSE Stream Reader & Tool-Call Chunk Parser                                      |  |
|  | - Rate-Limit & Backoff Resilience Engine                                          |  |
|  +-----------------------------------------------------------------------------------+  |
|  | Tool Execution Runtime (`packages/forgeai-core/tools`)                            |  |
|  | - File System Tools (Read, Write, Create, Delete, List)                            |  |
|  | - Terminal Runner (node-pty / subshell process manager)                            |  |
|  | - Git Inspector & Snapshot Checkpointer                                           |  |
|  +-----------------------------------------------------------------------------------+  |
|  | Safety & Permission Engine (`packages/forgeai-core/security`)                      |  |
|  | - 3-Tier Operation Risk Classifier (Safe, Moderate, High-Risk)                     |  |
|  | - Interactive Approval Token Coordinator                                          |  |
|  | - Secret Sanitizer & Shell Metacharacter Escaper                                  |  |
|  +-----------------------------------------------------------------------------------+  |
|  | Diff & Shadow Buffer Engine (`packages/forgeai-core/diff`)                         |  |
|  | - In-Memory Transactional Staging Buffer                                          |  |
|  | - Myers Line-by-Line & Character-Level Diff Calculator                            |  |
|  | - Per-Hunk Accept / Reject Logic                                                   |  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Subsystems & Component Responsibilities

### 2.1 Agent Core Engine (`packages/forgeai-core`)
- **Agent Orchestrator**: Houses the authoritative Finite State Machine (FSM). Manages state transitions, dispatches instructions to the Model Gateway, invokes tools, and enforces loop boundaries (max 20 iterations, max 3 test repairs).
- **Context Engine**: Bundles ripgrep (`@vscode/ripgrep`), connects to VS Code LSP for symbol resolution, harvests active editor context, and enforces the 8-tier sliding token budget.
- **Model Gateway**: Provides a polymorphic, unified interface over Anthropic, OpenAI, Gemini, and local Ollama APIs using native Node `fetch` SSE streaming.
- **Tool Runtime**: Executes validated Zod-schema tools (`read_file`, `write_file`, `search_code`, `run_command`). Background test runs execute via Node `child_process.spawn()` with non-blocking stream capture.
- **Safety & Permission Manager**: Intercepts tool calls; enforces Safe/Moderate/High-Risk policies; scrubs secrets with regex filters; enforces shell denylists.
- **Shadow Buffer Manager**: Maintains virtual proposed files in memory, exposes them to `TextDocumentContentProvider`, and generates `WorkspaceEdit` objects on approval.

### 2.2 User Interface Layer (`packages/forgeai-ui`)
- **Responsibility**: React 18 + Tailwind CSS Webview application rendered strictly within the ForgeAI Sidebar.
- **Surfaces**: Conversation timeline, streaming markdown responses, interactive Plan Cards with step-by-step checkboxes, and High-Risk Approval confirmation modals.

### 2.3 VS Code Extension Host Bridge (`packages/forgeai-vscode`)
- **Responsibility**: Minimal, high-speed adapter connecting VS Code extension lifecycle to `forgeai-core`.
- **Integrations**: Registers `WebviewViewProvider`, hooks `TextDocumentContentProvider` for `forgeai-shadow://` diff tabs, exposes status bar items, and bridges `vscode.git` and LSP commands.

### 2.4 Evaluation Benchmark Suite (`packages/forgeai-eval`)
- **Responsibility**: Headless test harness running 25 standardized SWE-bench style engineering tasks to scientifically evaluate Task Success Rate (TSR), test pass rate, latency, and token efficiency.

---

## 3. Inter-Component Communication Contracts

All inter-component requests use strictly-typed TypeScript events and asynchronous promises:
1. **Webview to Extension Host**: Structured message protocol (`WebviewMessage<T>`) over `vscode.postMessage`.
2. **Extension Host to Agent Core**: Direct in-memory method invocations with `CancellationToken` support.
3. **Agent Core to Terminal / Tools**: Asynchronous child process streaming via Node streams.

---

## 4. Scalability and Resource Limits

| Resource | Boundary / Threshold | Enforcement Action |
|---|---|---|
| **Max Context Window** | 32,000 tokens (configurable) | Older history and low-relevance files summarized or dropped. |
| **Max Agent Iterations** | 20 steps per task | State machine pauses and requests developer instruction. |
| **Max Terminal Execution** | 60 seconds (default) | Process receives `SIGTERM`, then `SIGKILL` to prevent hangs. |
| **Max Concurrent Files Staged** | 50 files | Rejects broad operations; requires chunked milestone planning. |
| **Memory Limit** | 256MB for background worker | Proactive GC and index cache eviction. |
