# JAGGU M7-A: Security & Trust Boundary Review

## Core Principle

$$\text{Model Switching changes WHO proposes, NOT what JAGGU permits.}$$

Regardless of whether the developer chooses an open-weight local model running on their GPU or a proprietary frontier model running in the cloud, all security gates, sandbox restrictions, and human approvals implemented across M0–M6 remain strictly invariant.

---

## Threat Modeling & Security Invariants

### 1. Untrusted Model Output
- **Threat**: A compromised or hallucinating local or cloud model attempts to execute shell commands, inject malicious code paths, or escape the workspace.
- **Mitigation**:
  - Model outputs are treated strictly as untrusted data.
  - All tool calls pass through Zod schema validation in `ToolExecutor`.
  - Tool arguments cannot contain path traversal (`..` escapes workspace roots).
  - Dangerous commands and arbitrary shell execution remain completely prohibited.

### 2. Approval Gates Remain Enforced
- **Threat**: A model attempts to apply file edits directly without developer review.
- **Mitigation**:
  - Two independent human gates remain mandatory:
    1. **Plan Approval**: Requires explicit developer consent before generating code changes.
    2. **EditSet Approval**: Multi-file diffs are presented in shadow documents. The developer must approve each file change before any disk mutation.
  - Selective rejection removes unapproved files prior to atomic write operations.

### 3. Credential Isolation & Hugging Face Access Token Flow
- **Threat**: Cloud API secrets (OpenAI, Anthropic, Gemini, Hugging Face) leak into the Webview, logs, RPC payloads, Git commits, or local network payloads.
- **Mitigation**:
  - API keys are stored exclusively in VS Code's native encrypted `SecretStorage` (`jaggu.apiKey.huggingface`, `jaggu.apiKey.openai`, etc.).
  - The Webview RPC protocol (`ExtensionToWebviewMessage`) only transmits sanitized `ModelDescriptor` metadata containing non-secret health statuses (`available`, `missing_credentials`, etc.).
  - The Hugging Face token flows strictly:
    $$\text{VS Code SecretStorage} \longrightarrow \text{Extension Host In-Memory} \longrightarrow \text{HTTPS Authorization Header} \longrightarrow \text{HF Router}$$
  - Token is never printed to logs, diagnostics, telemetry, or error messages.
  - Local endpoints (`http://localhost:11434`, `http://localhost:1234/v1`) do not require secrets unless explicitly configured.
  - Logging and event telemetry mask sensitive authorization headers.

### 4. Bounded Context & Provenance
- **Threat**: Model prompts consume untrusted binary data or exfiltrate private files.
- **Mitigation**:
  - Context discovery respects `.gitignore`, binary filters, and token budgets.
  - Every snippet embedded in the prompt includes cryptographic SHA-256 provenance hashes.
  - If a local model has a smaller context limit (e.g. 32K vs 200K), JAGGU refuses to truncate silently without warning the developer.

### 5. Git Safety & User-Change Preservation
- **Threat**: Local or cloud models overwrite uncommitted developer edits.
- **Mitigation**:
  - Checkpoints are created prior to applying changes.
  - Pre-existing user modifications are detected via base hash validation; conflicted files are rejected with clear diagnostics.

---

## Security Review Checklist

| Check | Description | Status |
| :--- | :--- | :--- |
| **C-1** | Model output treated as untrusted input | Passed |
| **C-2** | Changing models cannot bypass JAGGU permission tiers | Passed |
| **C-3** | Local models cannot bypass tool validation | Passed |
| **C-4** | Tool schemas validated by Zod | Passed |
| **C-5** | Workspace containment enforced (no path traversal) | Passed |
| **C-6** | Git safety & user-change preservation enforced | Passed |
| **C-7** | Plan and EditSet approval gates enforced | Passed |
| **C-8** | API credentials never reach the Webview | Passed |
| **C-9** | Provider errors do not leak secrets | Passed |
| **C-10** | Logs do not contain API keys or sensitive payloads | Passed |
| **C-11** | Arbitrary shell execution prohibited | Passed |
| **C-12** | Model cannot override agent orchestrator safety rules | Passed |
| **C-13** | Hugging Face token isolated in SecretStorage | Passed |
