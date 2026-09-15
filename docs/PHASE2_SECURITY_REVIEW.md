# Phase 2 — Security Review & Audit

## 1. Credential Storage & Isolation
- **SecretStorage**: Tokens are stored exclusively in VS Code's encrypted `SecretStorage`.
- **Zero Token Leakage**:
  - Webview state and RPC messages contain only sanitized model names and provider IDs.
  - EventBus and logger do not record auth headers or bearer tokens.
  - Repository scan confirmed zero hardcoded API keys (`hf_`, `sk-`, `Bearer`).

## 2. Guarded Model Invocations
- **Free-First Protection**: Paid models are strictly blocked from Auto routing (`allowPaidFallbackInAuto: false` by default). Accidental billing is impossible.
- **Bounded Fallbacks**: Fallback attempts are capped at 2 to prevent runaway API requests.

## 3. Sandboxed Tool Execution & Human Approval Gates
- **Shadow Staging**: Model edits are staged in an in-memory `VirtualDocStore` (`jaggu-shadow://`).
- **Conflict Prevention**: Pre-apply SHA and line verification checks prevent overwriting concurrent user changes.
- **Approval Gates**: Every execution plan, multi-file edit set, and scope expansion requires explicit human developer approval before filesystem mutation.
- **Workspace Boundary Containment**: ToolExecutor blocks path traversal and restricts all file reading/writing to workspace roots.
- **Destructive Command Blocking**: Prohibits destructive Git commands (`git reset --hard`, `git push --force`) and arbitrary shell operations.
