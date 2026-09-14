# M7-B Security & Boundary Review

**Date:** September 14, 2026  
**Milestone:** M7-B (Real IDE Integration & End-to-End Validation)  
**Security Status:** PASSED (0 secrets exposed; all safety boundaries verified)

---

## 1. Credential Isolation & SecretStorage Verification

### A. Secret Path Architecture
```
Hugging Face Token
       ↓
VS Code SecretStorage (or process.env.HF_TOKEN)
       ↓
Extension Host (CredentialManager)
       ↓
HuggingFaceProvider
       ↓
HTTPS Authorization Header (https://router.huggingface.co/v1)
```

### B. Verification Checks
- **Webview RPC**: Checked all outgoing messages from `SidebarProvider` (`agent.config`, `agent.status`, `token.delta`, `token.complete`, `agent.plan_requested`, `agent.editset_requested`). **0 secret tokens entered Webview payloads or state.**
- **`agent.config` Payload**: Confirmed payload contains only non-secret metadata (`{ provider: string, model: string, models: ModelDescriptor[] }`). The field `apiKey` is strictly omitted.
- **Tracked Files & Logs**: Repository-wide search confirmed zero plaintext tokens exist in tracked files, fixtures, tests, reports, or commit history.

---

## 2. Developer Approval & Agent Boundary Invariants

### Invariant 1: Model Cannot Mutate Disk Directly
- All model responses are parsed as structured JSON propositions.
- Zero direct file write operations are available to model turns.
- `EditSetManager` requires explicit developer approval (`agent.editset_approve`) before committing any shadow buffers to the physical filesystem.

### Invariant 2: Plan Rejection Halts Execution
- If a proposed Plan is rejected at `PLAN_REVIEW`, execution terminates immediately. No file diffs are prepared or staged.

### Invariant 3: Partial Approval Preserves Rejected Files
- Verified that if a developer rejects a subset of proposed files, the rejected files remain completely untouched on disk.

### Invariant 4: Pre-Existing User Changes Survive
- Verified that dirty uncommitted modifications in unrelated files survive intact.
- Destructive Git operations (`git reset --hard`, `git clean -fd`, `git push --force`) remain strictly forbidden by security policy.

### Invariant 5: Workspace Containment
- Tool executions are validated against workspace roots. Path traversal attempts (`../../etc/passwd`) are rejected by `WorkspaceDiscovery` and `ToolExecutor`.

---

## 3. Webview Security & Content Security Policy (CSP)

- Webview HTML is protected by a strict nonce-based CSP:
  ```http
  default-src 'none';
  style-src ${webview.cspSource} 'unsafe-inline';
  script-src 'nonce-${nonce}';
  img-src ${webview.cspSource} https: data:;
  font-src ${webview.cspSource};
  ```
- Inline scripts without the cryptographically generated nonce are blocked by the browser engine.
