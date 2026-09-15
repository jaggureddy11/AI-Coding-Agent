# JAGGU Security Architecture & Credential Isolation

## Core Security Invariants

JAGGU is built from the ground up to prevent unauthorized code execution, accidental paid API usage, secret leakage, and destructive filesystem mutations.

---

## 1. Zero Credential Exposure Policy

- **Storage**: All API tokens (Hugging Face, OpenAI, Anthropic, Gemini) are stored exclusively in VS Code's encrypted `SecretStorage`.
- **No Token Transmission to Webview**: Webview messages contain only sanitized model descriptors (`provider`, `modelName`, `badges`), never API keys, tokens, or authorization headers.
- **No Token Logging**: Logging pipelines and event emitters strictly scrub sensitive authorization headers.
- **Repository Cleanliness**: The repository is continuously audited to guarantee no hardcoded tokens exist in source files, tests, fixtures, or documentation.

---

## 2. Guarded Model Execution & Free-First Safety

- **Default Zero-Cost Policy**: By default, JAGGU blocks all paid cloud API endpoints. Accidental paid calls are impossible unless `jaggu.allowPaidFallback: true` is explicitly configured.
- **Bounded Fallbacks**: Fallback attempts are capped at a maximum of 2 tries to eliminate recursive billing loops or runaway requests.

---

## 3. Human-in-the-Loop File Mutation Pipeline

Language models **NEVER** write directly to the user's filesystem or execute shell commands silently.

All proposed changes adhere to the invariant workflow:

```text
Model Tool Proposal (propose_edit / edit_set)
        │
        ▼
VirtualDocStore Shadow Staging (`jaggu-shadow://`)
        │
        ▼
Conflict Detection (Base SHA & Line Divergence Check)
        │
        ▼
Interactive Webview Diff Review & Approval Gate
        │
        ├── Approved ──► Atomic Filesystem Apply ──► Diagnostics / Tests
        │
        └── Rejected ──► Staged Buffers Purged (Zero disk mutation)
```

---

## 4. Sandboxed Tool Execution

The `ToolExecutor` strictly enforces:
- **Workspace Boundary Containment**: All file operations (`read_file`, `search_code`, `list_directory`, `propose_edit`) are restricted to workspace root folders. Path traversal (`../../`) is rejected with `PERMISSION_DENIED`.
- **Destructive Command Blocking**: Arbitrary shell commands, destructive git operations (`git reset --hard`, `git push --force`, `rm -rf /`), and environment variable dumping are blocked.
