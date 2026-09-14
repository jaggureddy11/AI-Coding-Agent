# 24 — Engineering Guidelines & Coding Invariants

## 1. Core Engineering Principles

These guidelines define the non-negotiable coding and architectural standards for developing JAGGU. Every pull request and module must conform to these 17 invariants.

---

## 2. The 17 Coding Invariants

### Invariant 1: Strict TypeScript Everywhere
- `strict: true` must be enabled across all `tsconfig.json` files.
- `any` is strictly prohibited. If a dynamic type is required, use `unknown` with runtime type narrowing or Zod validation.
- All function parameters and public methods must specify explicit return types.

### Invariant 2: Prefer Existing VS Code Abstractions
- Do not reinvent wheels that VS Code already provides.
- Use `vscode.Disposable` / `DisposableStore` for resource cleanup.
- Use `vscode.CancellationToken` for cancellation propagation.
- Use `vscode.EventEmitter` / `vscode.Event` for event streams.
- Use `vscode.Uri` for cross-platform file path representations.

### Invariant 3: Zero Unnecessary Dependencies
- Every dependency adds binary bloat, security attack surface, and cold-start latency.
- Do NOT introduce heavy libraries where native Node.js / browser APIs suffice (e.g., use native `fetch` over `axios`, use standard `node:crypto` over external crypto packages).
- Keep total runtime dependencies in the extension host minimal.

### Invariant 4: Small, Focused, Single-Responsibility Modules
- Modules should rarely exceed 300 lines of code.
- If a class or file handles more than one conceptual responsibility (e.g., parsing diffs AND writing to disk), split it into separate cohesive units.

### Invariant 5: Explicit Interfaces for All Boundaries
- Subsystems must expose strict abstract interfaces (`IModelProvider`, `IContextEngine`, `IToolRuntime`).
- Concrete implementations are wired via dependency injection or factory patterns, enabling 100% test isolation with mocks.

### Invariant 6: Validate All External Inputs
- All data entering the extension—whether from webview RPC, user settings, or local files—must be validated at runtime.
- Never cast untyped JSON directly (`as MyType`) without schema validation.

### Invariant 7: Zero-Trust for Model-Generated Tool Arguments
- LLMs hallucinate parameter types, file paths, and syntax.
- Every tool parameter must be strictly parsed using Zod schemas. If validation fails, return an actionable schema error back to the model rather than crashing.

### Invariant 8: Mandatory Permission Checks Before Command Execution
- The agent must NEVER execute shell commands or file deletions without passing through the Permission Gate.
- Bypassing the permission check is treated as a critical security vulnerability.

### Invariant 9: Never Silently Modify Files on Disk
- No tool shall write directly to a workspace file on disk without either staging the change in the Shadow Buffer or receiving explicit developer authorization.
- The developer must always have the opportunity to inspect what changed.

### Invariant 10: Always Maintain a Reviewable Diff
- Every modification must be convertible to a standard unified Myers diff.
- Changes must support per-hunk inspection, per-file acceptance, and total rollback.

### Invariant 11: First-Class Cancellation Support
- Every async operation—whether an LLM HTTP stream, a ripgrep regex scan, or a terminal child process—must listen to an `AbortSignal` or `CancellationToken`.
- When the developer presses `Escape` or clicks cancel, all downstream child processes and network sockets must terminate within 200ms.

### Invariant 12: Automated Tests for Every Feature
- Code without tests is considered incomplete and cannot be merged.
- Unit tests must accompany every tool, parser, and state transition.
- Complex workflows must include regression tests.

### Invariant 13: Avoid Hidden Global State
- Singletons and mutable global variables are strictly banned.
- State must be encapsulated within session instances or passed explicitly through constructor injection.

### Invariant 14: Document Architectural Decisions (ADRs)
- Significant architectural choices (introducing a new subsystem, changing an IPC protocol, adding an external dependency) must be recorded as an ADR in `docs/adr/`.

### Invariant 15: Clean Separation of AI Logic and Editor Logic
- AI-specific logic (prompts, tool schemas, token estimation, LLM clients) must reside in `packages/jaggu-core` and `packages/jaggu-models`, completely decoupled from VS Code APIs.
- The VS Code package (`packages/jaggu-vscode`) serves purely as a thin host adapter. This ensures JAGGU core can run headlessly in CI or CLI environments.

### Invariant 16: Never Leak Secrets into Prompts or Logs
- All strings destined for model prompts or disk audit logs must pass through the `SecretSanitizer`.
- API keys must never be stored in plain text files.

### Invariant 17: Do Not Duplicate VS Code Core Subsystems
- Do not build custom syntax highlighters; use VS Code's TextMate / Tree-sitter tokens.
- Do not build a custom terminal emulator; use VS Code's integrated terminal and `Pseudoterminal` API.
- Do not build a custom language server; leverage existing LSP extensions.
