# 00 — VS Code Repository Analysis & Integration Architecture

## 1. Executive Summary

This document establishes the technical foundation for building **ForgeAI**, a Cursor-class AI-native coding agent developed on top of the open-source Visual Studio Code (`microsoft/vscode`) ecosystem.

Rather than executing a naive wholesale fork of the ~2.5-million-line VS Code codebase on day one—which creates crushing upstream rebase debt, slows down CI, and impedes distribution—ForgeAI adopts a **Dual-Ring Architecture**:
1. **Ring 0 (ForgeAI Core Extension & Agent Daemon)**: Ships 75–85% of full agent capabilities (context engine, agent orchestrator, model gateway, secure tool runtime, diff review view, and interactive planning UI) as a decoupled TypeScript/Node.js engine leveraging VS Code's rich Extension Host APIs, Custom Editor / Webview APIs, Language Server Protocol (LSP), and Terminal APIs.
2. **Ring 1 (Selective Workbench Deep Integrations)**: Injects surgical workbench-level patches into VS Code core (`src/vs/workbench`) strictly where Extension APIs cannot provide native experiences—specifically for multi-file inline ghost text diffs, native editor tab decorations, gutter agent controls, and zero-latency streaming text buffer manipulation.

---

## 2. VS Code Architecture Decomposition

VS Code is organized into layered subsystems following strict separation of concerns, AMD/ESM module boundaries, and dependency constraints enforced by custom build linters (`build/lib/tsb`).

```
                    +------------------------------------------+
                    |           Electron Main Process          |
                    |           (src/vs/code/electron-main)    |
                    +--------------------+---------------------+
                                         | IPC (Electron)
                    +--------------------+---------------------+
                    |       Workbench Renderer Process         |
                    |         (src/vs/workbench)               |
                    |  +------------------------------------+  |
                    |  |       Monaco Editor Layer          |  |
                    |  |       (src/vs/editor)              |  |
                    |  +------------------------------------+  |
                    |  |       Platform Services            |  |
                    |  |       (src/vs/platform)            |  |
                    |  +------------------------------------+  |
                    |  |       Base Utilities               |  |
                    |  |       (src/vs/base)                |  |
                    |  +------------------------------------+  |
                    +--------------------+---------------------+
                                         | RPC Channel (Named Pipes / Sockets)
                    +--------------------+---------------------+
                    |       Extension Host Process             |
                    |       (src/vs/workbench/api)             |
                    |  +------------------------------------+  |
                    |  |  ForgeAI Core Agent Controller     |  |
                    |  |  (Context, Orchestrator, Tools)    |  |
                    |  +------------------------------------+  |
                    |  |  Language Server Clients / Git     |  |
                    +--------------------+---------------------+
                                         | Localhost HTTP / WS
                    +--------------------+---------------------+
                    |       ForgeAI Agent Daemon / Worker       |
                    |   (Ripgrep, AST Indexer, LLM Gateway)    |
                    +------------------------------------------+
```

### 2.1 Subsystem Hierarchy

| Layer | Source Directory | Responsibility | UI vs Node | ForgeAI Relevance |
|---|---|---|---|---|
| **Base** | `src/vs/base/` | Platform agnostic utilities, polyfills, functional primitives, collections, cancellation tokens, events (`Emitter`, `Event`). | Both (browser, common, node) | Fundamental primitives (`CancellationToken`, `IDisposable`, `URI`). |
| **Platform** | `src/vs/platform/` | Abstract service interfaces, DI infrastructure (`InstantiationService`), configuration, telemetry, storage, file service, keybindings. | Both | Reference patterns for dependency injection and service contracts. |
| **Editor** | `src/vs/editor/` | The Monaco editor core: text buffer (`PieceTreeTextBuffer`), syntax highlighting, tokens, view models, cursor management, decoration system. | Browser / Common | Native inline multi-diff decorations, ghost text projections, change tracking. |
| **Workbench** | `src/vs/workbench/` | Visual shell: layout, sidebar, activity bar, panel, status bar, tabs, title bar, webviews, notification center. | Browser / Common | Primary UI injection surfaces; custom views, side panels, and diff reviewers. |
| **Extension API** | `src/vs/workbench/api/` | The bridge between Workbench renderer and Extension Host; exposes `vscode.d.ts` via strict RPC (`RPCProtocol`). | Common / Node | Contractual boundary for Ring 0 agent implementation. |
| **Server / Remote** | `src/vs/server/` | Headless remote execution environment for web and containerized development. | Node.js | Enables ForgeAI headless agent execution in remote/containerized environments. |

---

## 3. Subsystem Detailed Analysis

### 3.1 Extension Host & IPC Protocol
- **Mechanism**: The Extension Host runs in a separate Node.js process (or Web Worker) isolated from the Electron Renderer process to guarantee that UI rendering remains 60 FPS even under heavy extension computation.
- **IPC Mechanism**: Communication uses bidirectional typed RPC over named pipes / Unix domain sockets (`RPCProtocol`). Ext Host proxies commands to Workbench (`$proxy`) and receives event updates from Workbench (`$acceptModelChanged`, `$acceptConfigurationChanged`).
- **Implication for ForgeAI**: Heavy AI operations (AST parsing, ripgrep code traversal, vector calculation, LLM token streaming parsing) must live either in the Extension Host or in an auxiliary worker thread/daemon to prevent frame drops in the editor UI.

### 3.2 Terminal Architecture & Execution Subsystem
- **Core Interfaces**: `ITerminalService`, `ITerminalInstance`, `vscode.window.createTerminal`, `vscode.window.onDidWriteTerminalData`.
- **Pseudoterminal API**: VS Code exposes `ExtensionTerminalOptions` with `Pseudoterminal`. This allows ForgeAI to construct a synthetic, fully controlled terminal pipe (`onDidWrite`, `onDidClose`, `handleInput`).
- **Headless Command Execution**: For background autonomous test execution and compilation error capturing, ForgeAI uses Node's `child_process.spawn` with pty emulation (`node-pty`) directly inside the agent runtime, outputting structured traces to an interactive pseudo-terminal view.

### 3.3 Editor Text Buffer & Diff Architecture
- **Text Buffer**: Monaco uses a balanced red-black piece tree (`PieceTreeTextBuffer`) for O(log N) inserts and deletes, with zero memory copy on file loads.
- **Diff Algorithms**: Monaco implements the Myers diff algorithm and the modern Patience/Histogram diff engine (`src/vs/editor/common/diff/defaultLinesDiffComputer.ts`).
- **Diff Presentation**: Exposed via `vscode.diff` command (side-by-side or inline) and custom decorations (`TextEditor.setDecorations`). 
- **ForgeAI Advantage**: Allows non-destructive draft generation. The agent computes diffs in-memory, presents a unified Myers diff preview to the developer with per-hunk "Accept / Reject" action buttons, and flushes to disk only on developer confirmation.

### 3.4 Language Service Integration (LSP)
- **Symbol Retrieval**: `vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', query)` accesses language servers (TypeScript, Pyright, Rust Analyzer, gopls) already installed by the user without re-implementing compilers.
- **Definition & Reference Providers**: `vscode.executeDefinitionProvider` and `vscode.executeReferenceProvider` provide exact semantic references for call-graph construction.
- **Diagnostics**: `vscode.languages.getDiagnostics()` extracts compiler errors, linter violations, and syntax warnings in real time, serving as the sensory input for ForgeAI's self-healing debugging loop.

### 3.5 Git Integration Subsystem
- **Built-in Extension**: VS Code bundles `extensions/git`, exposing an internal API via `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)`.
- **Capabilities**: Access to repository instances, HEAD commit, index staging, branch list, untracked files, and working tree diffs.
- **ForgeAI Role**: Inspects working tree changes before and after task execution, computes rollbacks via `git checkout` / `git stash`, and assists with semantic commit messages.

---

## 4. Build, Test, and Packaging Analysis

### 4.1 Toolchain Specification
- **Node.js**: v20.x–v22.x LTS (compatible with v25.5.0 environment via Node Version Manager / modern polyfills).
- **TypeScript**: 5.4+ with strict null checks (`strict: true`, `noImplicitAny: true`).
- **Package Manager**: `npm` / `pnpm` workspaces for multi-package monorepo architecture.
- **Bundler**: `esbuild` for instant extension and worker bundling; `gulp` used for full VS Code core distribution builds.

### 4.2 Repository Strategy & Boundary Definition

```
forgeai-workspace/
├── packages/
│   ├── forgeai-core/           # Platform-agnostic Agent engine (state machine, tools, context, model gateway)
│   ├── forgeai-ui/             # Webview React/Tailwind UI (Activity bar, Sidebar, Plan Cards, Approvals)
│   ├── forgeai-vscode/         # VS Code Extension adapter (Commands, TextDocumentContentProvider, LSP, Git)
│   └── forgeai-eval/           # Benchmarking & SWE-bench style evaluation harness
├── vscode/                     # Upstream VS Code submodule (Ring 1 selective modifications, post-MVP)
├── docs/                       # Comprehensive architectural & product specification
└── scripts/                    # Development, build, and packaging orchestration
```

---

## 5. Architectural Risks and Mitigation

| Risk | Impact | Root Cause | Mitigation Strategy |
|---|---|---|---|
| **Upstream Rebase Hell** | High | Deep modifications directly in `src/vs/workbench`. | Restrict core VS Code modifications to <5% of codebase. House 95% of logic in clean modular extension packages. |
| **Extension Host Blocking** | High | Synchronous AST traversal or large token streaming in main thread. | Isolate indexing and agent loops into decoupled Node child processes or worker threads. |
| **Model Hallucinated Tool Calls** | High | LLM emitting invalid JSON or non-existent file paths. | Strict Zod runtime schema validation, static path resolution, and sandboxed validation before tool execution. |
| **Uncontrolled File Mutations** | Critical | Agent modifying files without transaction boundaries or rollback. | In-memory Shadow File System + Git snapshot checkpointing before any patch application. |
| **Terminal Command Injection** | Critical | Agent executing arbitrary destructive commands (`rm -rf`, curl pipes). | Strict three-tier permission model with mandatory human-in-the-loop approvals for non-allowlisted actions. |

---

## 6. Recommended Architectural Boundary

1. **Phase 1 through 8**: Target the **VS Code Extension Architecture (Ring 0)**. Deliver full agent autonomy, tree search, context indexing, file editing, interactive diffs, and terminal verification.
2. **Phase 9+**: Evaluate **Selective Workbench Core Patches (Ring 1)** strictly for:
   - Floating prompt widgets anchored inside the active Monaco editor line.
   - Dual-buffer inline streaming ghost text rendering prior to disk save.
   - Custom title bar and status bar telemetry widgets.
