# 09 — Security, Permissions & Sandboxing Model

## 1. Security Philosophy: Defense in Depth

An autonomous AI coding agent wields the potential to read sensitive information, overwrite critical files, and execute arbitrary commands in the user's local operating system. Without strict, defense-in-depth security controls, an agent could accidentally delete databases, execute malicious injected commands, or leak proprietary secrets to model providers.

ForgeAI establishes a **Zero-Implicit-Trust Architecture**:
1. Every tool call must pass through an automated risk evaluation gate before execution.
2. Destructive operations require explicit, cryptographic/tokenized human consent.
3. Environment variables, API keys, and credential stores are isolated and scrubbed.
4. Shell execution occurs within controlled process boundaries with strict timeouts.

---

## 2. Three-Tier Operation Classification

```
   [Incoming Tool Request]
              │
              ▼
   [Permission Evaluator]
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
 [SAFE]   [MODERATE]  [HIGH_RISK]
   │          │          │
   │      (Policy Check) │
   │          │          │
   │     ┌────┴────┐     │
   │   (Auto)   (Prompt) │
   │     │         └─────┤
   ▼     ▼               ▼
[Execute]         [Render Approval Modal]
                         │
                    ┌────┴────┐
                    ▼         ▼
                [Confirm]  [Deny]
                    │         │
                    ▼         ▼
                [Execute] [Abort with Reason]
```

### 2.1 Tier 1: SAFE (Auto-Execute)
- **Characteristics**: Read-only, non-mutating, zero side effects on disk or OS state.
- **Permitted Operations**:
  - `read_file` (within workspace boundary).
  - `list_directory`.
  - `search_files` / `search_code` (ripgrep).
  - `find_symbol` (LSP lookup).
  - `get_git_status` / `get_git_diff`.
- **User Prompt**: None. Execution is logged silently to the telemetry audit trail.

### 2.2 Tier 2: MODERATE (Configurable / One-Click Approval)
- **Characteristics**: Modifies workspace files or executes deterministic build/test runners.
- **Permitted Operations**:
  - `create_file`, `write_file`, `apply_patch` (staged in shadow buffer first).
  - Standard test and build commands (`npm test`, `pytest`, `cargo test`, `go test`, `npm run build`).
- **User Control**: By default, ForgeAI asks for approval once per plan, allowing the user to approve a batch of file edits and test runs. The user can toggle: *"Auto-apply file diffs during active plan"*.

### 2.3 Tier 3: HIGH_RISK (Mandatory Human Authorization)
- **Characteristics**: Destructive, irreversible, or affects system resources outside the workspace.
- **Permitted Operations**:
  - `delete_file` / directory removal.
  - Shell commands modifying system packages (`brew install`, `apt-get`, `sudo`).
  - Network operations (`curl`, `wget`, `ssh`, raw socket connections).
  - Destructive Git operations (`git reset --hard`, `git push --force`, `git clean -f`).
  - Accessing environment or dotfiles containing secrets (`.env`, `id_rsa`, `credentials`).
- **User Prompt**: An un-dismissible high-visibility amber/red modal requiring deliberate confirmation. Execution blocks until the user clicks `[Authorize]` or `[Block]`.

---

## 3. Command Allowlist, Denylist & Sanitization

### 3.1 Hard Denylist (Instantly Blocked)
Any command containing the following patterns or executables is rejected outright with error `SECURITY_VIOLATION_BLOCKED`:
- `sudo`, `su`, `doas`
- `rm -rf /`, `rm -rf ~`, `rm -rf *`
- `mkfs`, `dd if=/dev/`
- `:(){ :|:& };:` (fork bombs)
- `curl * | sh`, `wget * | bash`
- Raw pipeline writes to `/etc/`, `/bin/`, `/usr/`, `/System/`

### 3.2 Dynamic Allowlist
Commands matching common development toolchains are permitted under Tier 2:
- `npm (test|run|install|ci)`
- `yarn (test|build)`
- `pnpm (test|build)`
- `pytest`, `python -m unittest`
- `cargo (test|check|build)`
- `go (test|build)`
- `git (status|diff|log)`

### 3.3 Shell Argument Injection Prevention
- Shell commands are never passed directly to raw shell strings if avoidable; ForgeAI invokes commands using structured argument arrays via `child_process.spawn(executable, args, { shell: false })`.
- When shell piping is genuinely required, all file paths and user arguments are escaped with strict shell-quote sanitization.

---

## 4. Secret Protection & Credential Isolation

1. **Model Gateway Scrubbing**:
   - Before prompt payloads are transmitted over the wire to Anthropic, OpenAI, or Gemini, ForgeAI runs an automated RegEx scrubber scanning for:
     - AWS Access Keys (`AKIA[0-9A-Z]{16}`)
     - GitHub Tokens (`ghp_[a-zA-Z0-9]{36}`)
     - Private RSA Keys (`-----BEGIN RSA PRIVATE KEY-----`)
     - Generic API Keys (`api_key=[a-zA-Z0-9_\-]{20,}`)
   - Matched strings are replaced with redacted markers: `[REDACTED_SECRET_KEY]`.
2. **Dotenv & Credentials Protection**:
   - Files matching `.env*`, `*.pem`, `*.key`, `credentials.json`, or `.npmrc` are blocked from `read_file` by default unless the developer explicitly adds the file to an allowlist in `.vscode/forgeai/security.json`.
3. **Storage of API Keys**:
   - ForgeAI never stores provider API keys in plaintext files, workspace settings, or git repositories. Keys are stored exclusively in VS Code's encrypted OS keyring via `ExtensionContext.secrets`.

---

## 5. Sandboxing & Workspace Boundary Enforcement

- **Boundary Invariant**: All file paths supplied to tools are resolved against `vscode.workspace.workspaceFolders[0].uri.fsPath`.
- **Path Traversal Trap**: Any path attempting directory escape (e.g., `../../../../etc/passwd` or symlinks pointing outside the workspace tree) throws `PATH_TRAVERSAL_DETECTED` and immediately terminates the task.
- **Execution Timeout**: Default terminal execution ceiling is 120 seconds. Any process failing to exit within the window receives `SIGTERM`, followed by `SIGKILL` after 2,000ms.
