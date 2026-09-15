# JAGGU Trust & Security Architecture Guide

**For Developers, Security Teams, and Code Reviewers**

This document explains what JAGGU trusts, what it refuses to trust, and how its security controls protect your codebase.

---

## 1. What JAGGU Trusts vs. What JAGGU Rejects

### What JAGGU Trusts
1. **Explicit Developer Actions:** Clicking "Approve Plan", "Approve Changes", or initiating a prompt in the VS Code sidebar.
2. **VS Code Host APIs:** `vscode.workspace`, `vscode.window`, and VS Code `SecretStorage`.
3. **Physical Workspace Roots:** The canonical folders opened in the current VS Code window (`workspaceFolders`).
4. **Empirical Evidence:** Actual compiler diagnostics from the VS Code language server and the real exit codes of your project's test runners.

### What JAGGU Does NOT Inherently Trust
1. **Model Output:** Large language models hallucinate, get jailbroken, and can propose malicious code. Model output is treated as **untrusted user input** that must be validated through schemas, path containment, and human approval.
2. **Repository Files:** Code comments, READMEs, and issue descriptions can contain indirect prompt injection attacks (e.g. `"Ignore previous instructions"`). They are treated strictly as passive data inside an isolated sandbox.
3. **External Model Providers:** Network endpoints can disconnect, return invalid JSON, or emit HTTP 4xx/5xx errors. All calls have timeouts and strict validation.
4. **Webview Messages:** Webview events are validated through typed Zod schemas. Forged or malformed payloads cannot trigger unauthorized extension host actions.
5. **Arbitrary File Paths:** Paths like `../../etc/passwd`, null bytes, Windows UNC paths, or symlinks pointing outside the workspace are blocked before disk access.

---

## 2. The 5 Security Gates of JAGGU

Every mutating action requested by an AI model must pass five distinct gates:

```text
[Model Proposal]
       │
       ▼ Gate 1: Schema Validation (Strict Zod types)
[Valid Proposal]
       │
       ▼ Gate 2: Workspace Boundary Check (Canonical realpath containment)
[Workspace-Contained Proposal]
       │
       ▼ Gate 3: Sensitive File Shielding (.env, .pem, id_rsa filtered)
[Safe Staged Diff (In-Memory Shadow Buffer: jaggu-shadow://)]
       │
       ▼ Gate 4: Developer Approval Gate (Interactive review & consent)
[Approved Proposal]
       │
       ▼ Gate 5: SHA-256 Base Content Hash Check (Conflict Prevention)
[Atomic Disk Mutation]
```

### Gate 1: Schema Validation
Tool calls and plan proposals must strictly match typed Zod schemas. If the model produces malformed arguments or unrecognized parameters, the tool executor halts with a structured error.

### Gate 2: Workspace Containment (`resolveAndValidateWorkspacePath`)
- Resolves the canonical path using `fs.realpathSync` to prevent symlink traversal attacks.
- Confirms the target file resides strictly within an authorized workspace root.
- Rejects null bytes, `../` escapes, and unanchored absolute paths.

### Gate 3: Sensitive File Shielding
- Files matching credential patterns (`.env*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `credentials.json`) are shielded from automatic background retrieval into the LLM context.
- Prevents accidental secret exfiltration in multi-file context collections.

### Gate 4: Developer Approval Gate
- Diff previews are staged **in-memory** in an isolated virtual document store (`jaggu-shadow://`).
- Nothing touches your disk until you inspect the diff and click **Approve**.
- You can selectively approve specific files and reject others. Rejected files remain byte-for-byte untouched.

### Gate 5: SHA-256 Conflict Detection
- When proposing changes, JAGGU records the SHA-256 hash of the file on disk.
- Before writing approved changes, it re-reads the disk file and verifies the hash.
- If you modified the file while the AI was planning, JAGGU detects the conflict and refuses to overwrite your work.

---

## 3. Command Execution & Subprocess Safety

- **No Arbitrary Shell Access:** JAGGU does NOT provide an arbitrary bash tool to models.
- **Controlled Test Execution:** The `run_tests` tool is restricted to whitelisted test prefixes (`npm test`, `npx vitest`, `pytest`, `cargo test`, `go test`).
- **No Shell Interpolation (`shell: false`):** Commands are spawned directly with `child_process.spawn()` without shell wrapping. Metacharacters (`;`, `&`, `|`, `>`, `<`, `$`, `` ` ``) are rejected.
- **Output Clamping & Process Killing:** Test outputs are clamped to 64KB to prevent memory exhaustion, and runaway processes are killed after a 30-second timeout.

---

## 4. Credential & Privacy Architecture

- **Encrypted SecretStorage:** Provider API keys are stored in VS Code's encrypted `SecretStorage`, backed by the operating system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- **Zero Local Telemetry:** JAGGU contains zero analytics, tracking scripts, or telemetry relays.
- **Transparent Remote Transfer:** When using cloud models (OpenAI, Anthropic, Gemini, Hugging Face), requests travel directly from your machine to the provider's HTTPS endpoint. When using Ollama or local OpenAI-compatible runtimes, everything stays 100% on your local machine.
