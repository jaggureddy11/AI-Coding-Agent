# ADR-005: Tool Execution Architecture & Shadow Buffer Staging

## Status
Accepted

## Context
When an AI agent modifies code, executing direct writes to disk immediately causes severe problems:
1. **Unreviewable Changes**: If an agent edits 4 files across 200 lines, the developer cannot easily see what changed before the files are overwritten.
2. **Accidental Corruption**: If an agent generates bad syntax or partial code and crashes halfway, the user's working tree is left broken.
3. **Loss of Undo History**: Standard editor undo stacks are disrupted by external disk modifications.

## Decision
JAGGU implements an **In-Memory Virtual Document Provider & Native VS Code Diff Architecture**:
1. Mutating tools (`write_file`, `apply_patch`, `create_file`) stage their proposed modifications in an in-memory virtual document map.
2. The extension registers a `vscode.workspace.registerTextDocumentContentProvider` for the custom URI scheme `jaggu-shadow://`.
3. Diff review triggers the native VS Code side-by-side or inline diff tab: `vscode.commands.executeCommand('vscode.diff', diskUri, shadowUri, 'JAGGU Diff: ' + fileName)`.
4. When the user approves changes, JAGGU constructs and applies a `vscode.WorkspaceEdit()`, which natively modifies the files, integrates seamlessly with VS Code's undo/redo history (`Cmd+Z`), and saves to disk cleanly.

## Alternatives Considered
- **Direct Disk Overwrite with Git Commit Undo**:
  - *Why Rejected*: Clutters Git commit history with unwanted temporary AI commits; fails if the repo has uncommitted manual changes; slow on large repos.
- **Custom Webview-Based Diff Viewer**:
  - *Why Rejected*: Highly complex and redundant. Monaco editor's built-in diff viewer already has syntax highlighting, code folding, font zoom, and side-by-side rendering. Rebuilding this inside a Webview is an anti-pattern.

## Reasoning
1. **Zero Risk**: Disk files remain 100% untouched until developer confirmation.
2. **Native UX**: Leverages Monaco's battle-tested diff viewer with syntax highlighting and theme compatibility.
3. **Clean Undo History**: `vscode.WorkspaceEdit` writes directly through the editor buffer, allowing immediate native `Cmd+Z` rollbacks.
4. **Massive Simplification**: Cuts hundreds of lines of fragile manual file patching code.

## Consequences
- **Positive**: Complete developer confidence; non-destructive experimentation; 100% native VS Code diff experience; zero redundant UI development.
- **Negative**: Multi-file diff review opens standard VS Code diff editor tabs rather than a single continuous vertical webview stream.
