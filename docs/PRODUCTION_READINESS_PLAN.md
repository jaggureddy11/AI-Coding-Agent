# JAGGU — Production Readiness, Security & Trust Hardening Plan

**Milestone Target:** Public 0.1.x Release  
**Objective:** Audit, harden, and empirically verify JAGGU against adversarial model outputs, workspace escapes, command injection, approval bypasses, concurrency races, credential leakage, and supply-chain vulnerabilities.

---

## 1. Security Architecture & Threat Boundaries

### Core Philosophy
- **Untrusted Model Output:** Model proposals, file paths, tool arguments, and test commands are treated as **untrusted user input**.
- **Defense in Depth:** No single component (prompt, schema, or UI check) is trusted exclusively. Every mutating operation passes through 5 distinct gates:
  1. *Schema Validation (Zod)*
  2. *Policy & Whitelist Validation*
  3. *Workspace Boundary & Canonical Path Validation (`resolveAndValidateWorkspacePath`)*
  4. *Explicit Developer Approval Gate (Milestone Plan & Multi-file EditSet)*
  5. *Base Content Hash Pre-Verification (SHA-256 Conflict Detection)*

---

## 2. Reliability

- **FSM Guarantee:** Transitions are enforced via `AgentStateMachine`. Unhandled errors or cancellation must cleanly resolve active tasks to terminal states (`COMPLETED`, `FAILED`, `CANCELLED`).
- **Idempotent Cleanup:** When tasks complete or fail, virtual shadow buffers, event listeners, and timers must be released without memory leaks.
- **Fail-Safe Defaults:** If optional services (diagnostics provider, checkpoint manager, git cli) fail or are unavailable, the agent logs a warning and proceeds safely without crashing the Extension Host.

---

## 3. AI / Model Safety

- **Scope Boundary Enforcement:** If the model proposes edits to files outside the approved plan steps, mutation must be blocked. If `onRequestScopeApproval` is not configured or rejected, the task fails immediately rather than silently proceeding.
- **Prompt Injection Defense:** Repository files, comments, and readme instructions must remain passive data. `PromptInjectionSanitizer` defangs boundary tags (`<untrusted_repository_context>`, `<repository_file>`) and warns the model with system directives.
- **Hallucination Containment:** Phantom files or unanchored relative paths are validated against physical workspace roots before being presented to the user.

---

## 4. Filesystem Safety

- **Canonical Path Containment:** `resolveAndValidateWorkspacePath` resolves symlinks via `fs.realpathSync`. Both existing paths and parent directories of new files are tested to prevent symlink traversal escapes (e.g., symlink pointing to `/etc` or `~/.ssh`).
- **Forbidden Path Patterns:** Null bytes (`\0`), root escapes (`../`), Windows UNC paths, and absolute paths resolving outside workspace roots throw typed `WorkspaceSecurityError` exceptions before any I/O occurs.
- **Atomic Staging:** Diffs are written only to memory (`InMemoryVirtualDocStore`) under `jaggu-shadow://`. Physical disk writes occur strictly during `applyEditSet` after human review.

---

## 5. Command Execution Safety

- **Zero Shell Interpolation:** `RunTestsTool` executes test commands strictly via `spawn(executable, args, { shell: false })`.
- **Command Prefix Whitelist:** Only recognized test runners (`npm test`, `npx vitest`, `pytest`, `cargo test`, `go test`, etc.) are permitted.
- **Metacharacter Rejection:** Commands containing shell chaining characters (`;`, `&`, `|`, `>`, `<`, `$`, `` ` ``, `\`) or destructive binaries (`rm`, `del`, `curl`, `wget`, `sudo`, `chmod`, `bash`, `sh`, `zsh`, `cmd`, `powershell`) are rejected before execution.
- **Timeouts & Output Clamping:** Subprocesses have strict timeouts (default 30s, max 60s) with SIGTERM/SIGKILL escalation and 64KB stdout/stderr truncation.

---

## 6. Webview Security

- **Strict CSP:** Content-Security-Policy with unique cryptographic nonces for script tags, `default-src 'none'`, and isolated styles/fonts.
- **Strict RPC Schema Validation:** All messages from the Webview pass through `isValidWebviewMessage()` before dispatch. Malformed, oversized, or prototype-polluting payloads return structured errors without crashing the Extension Host.
- **Zero Direct Privilege:** The Webview cannot execute shell commands, access file contents, or query SecretStorage directly; it communicates exclusively through declarative RPC request/response events.

---

## 7. Credential Security

- **VS Code SecretStorage:** API keys (OpenAI, Anthropic, Gemini, Hugging Face) are stored exclusively in VS Code's encrypted `SecretStorage`.
- **Zero Disk / Settings Persistence:** Keys are never stored in `settings.json`, workspace files, logs, or Webview state.
- **Sanitized Events & Logs:** Model streaming events, error traces, and diagnostic summaries redact authorization headers and API tokens.

---

## 8. Git Safety

- **Strict Non-Destructive Policy:** `GitCliService` enforces a strict whitelist of read-only Git verbs (`status`, `rev-parse`). Mutating/destructive commands (`reset`, `clean`, `checkout`, `push --force`, `rebase`) are hard-blocked with security exceptions.
- **Pre-Existing Change Preservation:** Dirty worktree baselines are recorded before execution. Edits to pre-modified user files are flagged, and rejected files remain byte-for-byte identical.
- **Safe Staged Porcelain Parsing:** Uses zero-delimited `git status --porcelain=v1 -z -uall` to safely handle spaces, symbols, and Unicode in filenames.

---

## 9. Cancellation

- **Universal Abort Propagation:** An `AbortController` signal is wired through Context Assembly, Model Streaming, Subprocess Execution, and Repair Loops.
- **Immediate Process Teardown:** Subprocesses receive SIGTERM immediately upon cancellation, and pending approval promises resolve to false.
- **Post-Cancel Mutation Prohibition:** Once cancelled, no staged EditSet can transition to `APPLYING` or mutate disk files.

---

## 10. Concurrency

- **Task Serialization:** Rapid successive prompt submissions or duplicate clicks reject or queue cleanly while an active task is running.
- **Stale Token / RPC Invalidation:** Responses or approval decisions from older task IDs cannot mutate newer or active tasks.
- **Isolated DocStore:** Shadow buffers are indexed by unique URI and evicted upon completion, rejection, or cancellation.

---

## 11. Error Handling

- **Crash Resilience:** Exceptions in tool execution, LLM streaming, or Git baseline capture are caught in structured try/catch blocks and converted to user-facing status messages.
- **Bounded Self-Healing:** The diagnostic and test repair loop has an enforced limit (`maxRepairAttempts`, default 2). If repairs fail, the agent cleanly transitions to `FAILED` with a diagnostic summary.

---

## 12. Provider Failures

- **Network & Endpoint Classification:** Connection refusals, timeouts, HTTP 401/403/404/429/500, and truncated SSE streams are categorized into structured `ModelError` codes (`NETWORK_ERROR`, `AUTH_FAILURE`, `RATE_LIMITED`, `TIMEOUT`).
- **No Unbounded Retries:** Requests fail fast or use bounded backoff (max 2 attempts) to prevent lockups.
- **Zero Secret Echoing:** Provider error messages are sanitized before displaying in UI or emitting to EventBus.

---

## 13. Dependency & Supply-Chain Security

- **Zero Runtime Dependencies in VSIX:** Extension Host bundle (`dist/extension.js`) and UI bundle (`media/webview.js`) are compiled with esbuild. The packaged VSIX installs with `--no-dependencies`.
- **Audit Review:** Development-only audit warnings in Vitest/Vite are verified to ensure no vulnerable code is packaged into production runtime artifacts.

---

## 14. VSIX Integrity

- **Clean Package Verification:** VSIX package built with `@vscode/vsce package --no-dependencies --no-git-tag-version`.
- **Exclusion Verification:** `.vscodeignore` strictly excludes tests, fixtures, source maps, benchmark results, git history, and monorepo configurations.
- **Independent Runtime Test:** Verified that the packaged `.vsix` can be extracted and run in a standard VS Code extension environment.

---

## 15. Privacy

- **Local-First Processing:** Prompts and context are processed locally when using Ollama or local OpenAI-compatible runtimes.
- **Transparent Remote Transfer:** When cloud providers (OpenAI, Anthropic, Gemini, HF) are selected, only the minimal retrieved context snippets and prompt text are sent to the provider's API.
- **No Telemetry / Exfiltration:** Zero analytics SDKs, user tracking, or telemetry collection endpoints.

---

## 16. Performance

- **Bounded Discovery:** `WorkspaceDiscovery` enforces a file limit (20,000 files) and directory depth limit (20 levels) with skip lists for `node_modules`, `.git`, `dist`, and binary extensions.
- **Sub-Second Token Streaming:** Local Ollama and streaming providers stream directly to the Webview via lightweight IPC events without blocking the Extension Host event loop.

---

## 17. Logging

- **Zero Sensitive Data:** Logs never record raw API keys, bearer tokens, or full file contents of sensitive files.
- **Structured Activity Events:** Activity messages inform the user of current operational phase (e.g., "Collecting compiler diagnostics", "Formulating plan") without spamming output channels.

---

## 18. Testing & Verification

- **Multi-Level Suite:**
  1. *Unit Tests:* Core FSM, tool schemas, path validator, git service.
  2. *Integration Tests:* Multi-file editsets, selective approval, conflict detection.
  3. *Adversarial Security Tests:* Path traversals (`../../etc/passwd`), null bytes, symlink escapes, command injection metacharacters, prompt injection attempts.
  4. *Benchmark Evaluation:* 12-task SWE benchmark suite evaluating task success rate and safety preservation.

---

## 19. Upgrade & Migration Behavior

- **Stateless Agent Sessions:** Session state is held in memory during the active task. Extension updates or reloads do not leave corrupted state files on disk.
- **Backward-Compatible Configuration:** Setting keys (`jaggu.provider`, `jaggu.model`, `jaggu.ollama.endpoint`) use stable schemas with fallback defaults.

---

## 20. Disaster & Failure Recovery

- **Atomic Write Rollback:** If a multi-file write fails midway through disk I/O, `applyEditSet` rolls back all previously written files in the set, restoring original disk contents.
- **Conflict Prevention:** Base SHA-256 validation prevents overwriting concurrent edits made by the developer while the agent was planning.

---

## 21. Observability

- **EventBus Architecture:** Emits strongly typed events (`agent.started`, `context.assembled`, `plan.created`, `editset.applied`, `agent.error`) allowing the UI and diagnostic logs to trace task lifecycle deterministically.

---

## 22. Documentation

- `docs/THREAT_MODEL.md` (Trust boundaries, attack vectors, security controls).
- `docs/TRUST_AND_SECURITY.md` (Developer-facing transparency guide).
- `docs/PRODUCTION_RUNBOOK.md` (Setup, model configuration, troubleshooting).
- `docs/INCIDENT_RESPONSE.md` (Vulnerability disclosure and patch runbook).
- `SECURITY.md` (Private security reporting policy).

---

## 23. Release Process

1. Clean build & typecheck across monorepo (`npm run build`, `npm run typecheck`).
2. Automated test suite pass (`npm test`).
3. Benchmark evaluation verification (`npm run eval`).
4. Production package bundling (`npm run package:extension`).
5. Manifest, license, and VSIX inspection (`npx @vscode/vsce ls --no-dependencies`).

---

## 24. Known Limitations

- **Single Active Workspace Task:** Parallel concurrent agent tasks in the same workspace are serialized.
- **Terminal Execution Scope:** Shell command execution is intentionally limited to whitelisted test runners; general arbitrary bash execution is disabled by design.
- **Network Dependency for Cloud Models:** Cloud model execution requires active internet access; local execution requires Ollama or an OpenAI-compatible daemon.
