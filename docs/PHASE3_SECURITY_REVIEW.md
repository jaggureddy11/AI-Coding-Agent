# Phase 3 — Production Security Review & Audit

## 1. Credential Security & Isolation
- **Storage Tier**: All credentials (Hugging Face tokens, OpenAI, Anthropic, Gemini API keys) are stored strictly in VS Code's encrypted `SecretStorage` (`vscode.ExtensionContext.secrets`).
- **Webview Isolation**: The Webview UI receives zero secrets, keys, or authorization tokens. Only sanitized metadata (model display name, provider ID, availability status) is transferred via RPC.
- **Log & Error Sanitization**: `sanitizeSecretStrings` strips sensitive patterns (`Bearer ...`, `sk-...`, `hf_...`, `AIza...`) before output is written to debug logs or error events.
- **Repository Cleanliness**: Scanned entire codebase for token patterns — verified zero hardcoded credentials in source files, test fixtures, snapshots, documentation, or Git history.

## 2. Model & Cost Safeguards
- **Free-First Enforcement**: Auto mode defaults to free open-weight cloud models (`Qwen3-Coder-30B`) or local Ollama models (`qwen2.5-coder:7b`).
- **Zero Silent Paid Activation**: Paid providers (OpenAI, Claude, Gemini) remain strictly disabled unless `jaggu.allowPaidFallbackInAuto` is explicitly set to `true` by the developer.
- **Bounded Fallback**: Fallback retry depth is strictly capped at 2 attempts to eliminate runaway billing or infinite routing loops.

## 3. Sandboxed Tool Execution & Approval Gates
- **Human-in-the-Loop Gate**: The model cannot write to disk or run commands directly. All proposed changes must be reviewed and explicitly approved by the developer.
- **Shadow Staging (`jaggu-shadow://`)**: Proposed file modifications reside exclusively in an in-memory `VirtualDocStore`. Rejected changes are purged with zero disk mutation.
- **Conflict Prevention**: Pre-apply SHA and line verification checks prevent accidental overwrite of concurrent user modifications.
- **Workspace Boundary Containment**: `resolveAndValidateWorkspacePath` validates every path against workspace roots, blocking `../` traversal, symlink escapes, and null-byte injection.
- **Sensitive File Protection**: Excludes `.env`, `*.pem`, `*.key`, `id_rsa`, `credentials.json` from repository discovery and context indexing.
- **Destructive Command Blocking**: Prohibits destructive Git operations (`git reset --hard`, `git push --force`, `git clean -fd`) and arbitrary shell commands.

## 4. Webview & RPC Security
- **Content Security Policy**: Strict nonce-based CSP (`default-src 'none'; script-src 'nonce-...'; style-src 'nonce-...';`) prevents XSS and unauthorized remote script execution.
- **Typed RPC Validation**: All incoming Webview messages are validated against strict TypeScript runtime schemas (`isValidWebviewMessage`).
