# ADR-001: Extension Architecture vs Wholesale VS Code Core Fork

## Status
Accepted (MVP Architectural Invariant)

## Context
A central question in building an AI-native code editor inspired by Cursor is whether to:
1. Immediately fork the ~2.5-million-line Visual Studio Code core codebase (`microsoft/vscode`), modifying the Monaco renderer and workbench directly.
2. Implement JAGGU primarily as a clean, decoupled VS Code Extension package using official extension APIs (Webviews, Custom Editors, LSP, Pseudoterminal, Decorations), and only selectively patch VS Code core where extension APIs prove fundamentally insufficient.

## Decision
We adopt the **Dual-Ring Architecture**:
- **Ring 0 (Primary / MVP)**: Build 80–90% of JAGGU as a high-performance VS Code Extension accompanied by a decoupled Node.js agent engine.
- **Ring 1 (Selective Post-MVP)**: Deep workbench modifications in a VS Code fork are strictly reserved for features that cannot be achieved via Extension APIs (such as native multi-file inline ghost-text diff projections directly in the Monaco text buffer).

## Alternatives Considered
- **Wholesale Day-1 Fork (Cursor approach)**: Forking `microsoft/vscode` immediately and rewriting `src/vs/workbench/contrib/`.
  - *Why Rejected*: Upstream VS Code receives hundreds of commits weekly. Maintaining a massive fork creates crushing merge debt, slows down CI builds from seconds to 30+ minutes, prevents straightforward installation as a `.vsix` on standard VS Code, and distracts from core AI agent engineering.
- **Pure Web-Based IDE**: Building a browser-only Monaco application.
  - *Why Rejected*: Loses the entire VS Code extension ecosystem (debuggers, language servers, themes, git tools) and cannot access local OS file systems and shells natively without heavy remote server infrastructure.

## Reasoning
1. **Speed to Value**: Extension APIs provide rich webviews, native terminals, full file access, and LSP integration out of the box.
2. **Upstream Compatibility**: Users can install JAGGU on their existing VS Code setup without migrating editors.
3. **Decoupled Engine**: The core agent engine (`packages/jaggu-core`) remains independent of VS Code, allowing it to run headlessly in CI or CLI tools.

## Consequences
- **Positive**: Blazing fast iteration; modular testability; zero upstream rebase overhead during early development; easy distribution via `.vsix`.
- **Negative**: Certain deep editor canvas modifications (e.g. multi-line ghost text with interactive button widgets embedded between editor lines) require creative use of editor decorations or custom webview diff overlays until Ring 1.
