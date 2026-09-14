# 29 — Definition of Done (DoD) & Engineering Quality Gates

## 1. The Quality Invariant

In ForgeAI, **a feature or task is NOT complete merely because the code compiles or a basic demo functions.**

Every feature, tool, parser, and milestone must satisfy an unbending set of engineering quality criteria before being considered done and ready for integration.

---

## 2. Master Definition of Done Checklist

Every pull request and milestone must satisfy all 9 criteria:

```
+-------------------------------------------------------------------------+
|                      FORGEAI DEFINITION OF DONE (DoD)                   |
+---+----------------------------+----------------------------------------+
| # | Dimension                  | Strict Verification Requirement        |
+---+----------------------------+----------------------------------------+
| 1 | Implementation             | Production-quality TypeScript; zero    |
|   |                            | 'any' types; zero placeholder stubs.   |
+---+----------------------------+----------------------------------------+
| 2 | Automated Tests            | Unit and/or integration tests exist;   |
|   |                            | 100% passing; covers error paths.      |
+---+----------------------------+----------------------------------------+
| 3 | Visual & UI Polish         | Theme-adaptive; responsive; zero text  |
|   |                            | truncation; follows VS Code styling.   |
+---+----------------------------+----------------------------------------+
| 4 | Error Handling             | Graceful recovery from timeouts, schema|
|   |                            | violations, rate limits; zero crashes. |
+---+----------------------------+----------------------------------------+
| 5 | Cancellation & Cleanup     | Immediate response to AbortSignal/Esc; |
|   |                            | child processes killed; no disk debris.|
+---+----------------------------+----------------------------------------+
| 6 | Permission Enforcement     | Tool calls pass through PermissionGate;|
|   |                            | high-risk operations block for consent.|
+---+----------------------------+----------------------------------------+
| 7 | Observability & Scrubbing  | Emits structured NDJSON audit logs;    |
|   |                            | all secrets redacted by sanitizer.     |
+---+----------------------------+----------------------------------------+
| 8 | Documentation Integrity    | Architecture docs & ADRs updated; APIs |
|   |                            | typed and documented with TSDoc.       |
+---+----------------------------+----------------------------------------+
| 9 | Acceptance Criteria        | All milestone acceptance criteria met  |
|   |                            | and empirically verified.              |
+---+----------------------------+----------------------------------------+
```

---

## 3. Detailed Verification Standards

### 3.1 Standard 1: Code Rigor & Type Safety
- Strict mode compilation: `tsc --noEmit` exits with code 0.
- Zero lint warnings: `npm run lint` passes without warnings.
- Dead code, debug statements (`console.log`), and test bypasses (`it.only`) are eliminated.

### 3.2 Standard 2: Testing Verification
- Every new tool has a test suite covering:
  1. Happy path execution.
  2. Missing or malformed parameters.
  3. Path traversal or security boundary violation attempts.
  4. Execution timeout handling.
- Regression tests accompany every bug fix.

### 3.3 Standard 3: UI & Non-Blocking Performance
- UI rendering maintains 60 FPS during active token streaming.
- Memory leak checks: Disposables registered in `DisposableStore` are cleaned up on unmount.

### 3.4 Standard 4: Cancellation Verification
- Triggering cancellation during:
  - Active model streaming -> closes HTTP socket.
  - Active ripgrep scan -> kills child process.
  - Active terminal test run -> sends `SIGTERM` / `SIGKILL`.
  - Staged diff review -> flushes shadow buffer without writing to workspace disk.

### 3.5 Standard 5: Security & Audit Audit
- Passes verification against `SecretSanitizer` test vectors.
- Tool commands audit to `.vscode/forgeai/audit.log` with sanitized arguments.
