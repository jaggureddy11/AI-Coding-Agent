# ADR-007: Persistence Architecture & Session Storage Strategy

## Status
Accepted

## Context
Developers require conversation continuity across editor restarts, task auditability, and safety snapshots. However, bundling a heavy relational database engine (such as SQLite with native C++ bindings) inside a VS Code extension introduces cross-compilation headaches, native binary packaging failures across different OS architectures (Apple Silicon, Linux ARM, Windows x64), and unnecessary bloat.

## Decision
JAGGU implements a **Zero-Native-Dependency JSON File Store**:
1. **Workspace Configuration & Sessions**: Stored as clean JSON files inside `.vscode/jaggu/sessions/`.
2. **Audit Logging**: Stored as append-only Newline-Delimited JSON (NDJSON) in `.vscode/jaggu/audit.log`.
3. **Secret Storage**: API keys are stored exclusively in VS Code's encrypted OS keychain via `context.secrets.store()`.
4. **Git Checkpoints**: Staged in standard Git stashes or temporary `.vscode/jaggu/snapshots/` directories.

## Alternatives Considered
- **SQLite with better-sqlite3**:
  - *Why Rejected*: Requires native Node C++ binary compilation, frequently failing during npm install on developer machines with non-standard toolchains.
- **Pure In-Memory (No Persistence)**:
  - *Why Rejected*: Loss of all chat history and active task state whenever the developer reloads VS Code or switches branches.

## Reasoning
1. **Zero Native Build Dependencies**: Pure JavaScript/TypeScript file I/O runs identically on macOS, Linux, and Windows with zero compilation risk.
2. **Human-Inspectable**: Developers can inspect, backup, or delete `.vscode/jaggu/` at any time using standard file tools.
3. **Git-Friendly**: `.vscode/jaggu/` is automatically added to `.gitignore`, keeping repo history clean.

## Consequences
- **Positive**: Extremely fast, portable, zero-dependency storage; easy session restore.
- **Negative**: Not designed for querying millions of rows (which is completely unnecessary for localized IDE chat sessions).
