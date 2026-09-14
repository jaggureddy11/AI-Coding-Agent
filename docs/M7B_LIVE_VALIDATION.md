# M7-B Live IDE Validation & Evidence Matrix

**Date:** September 14, 2026  
**Milestone:** M7-B (Real IDE Integration & End-to-End Validation)  
**Target:** Proving JAGGU in a Real Extension Development Host, Webview, Fixture Workspace, with Real Approval Gates, Git Safety, Diagnostics, and Tests.

---

## 1. Executive Summary

Milestone M7-B systematically validates the full JAGGU agent stack inside the VS Code Extension Host environment. All architectural components — from extension activation and Webview RPC to multi-file edit application, language service diagnostics, and subprocess verification — were exercised against a real deterministic fixture workspace.

---

## 2. Evidence Matrix

| Capability | Status | Evidence Type | Notes / Verification Details |
|---|---|---|---|
| **Extension Activation** | **PASS** | **LIVE EXTENSION HOST** | Verified `activate()` initializes all subsystems, commands, statusBar, and providers without error. |
| **Webview Rendering** | **PASS** | **LIVE GUI / ASSETS** | Real compiled `webview.js` and `webview.css` generated with strict nonce-based CSP (`default-src 'none'`). |
| **Bidirectional RPC** | **PASS** | **LIVE RPC** | Full handshake verified: `ui.ready` → `agent.config` + `agent.status`. Payload schemas strictly validated with Zod. |
| **Model Selector** | **PASS** | **LIVE RPC / UI** | `model.select` updates provider/model in state and propagates to `ModelGateway` without exposing credentials. |
| **Hugging Face Inference** | **PASS** | **LIVE ONLINE** | Real online inference verified against `https://router.huggingface.co/v1` (`Qwen/Qwen2.5-Coder-32B-Instruct`). |
| **Repository Context** | **PASS** | **LIVE WORKSPACE** | `WorkspaceDiscovery` & `ContextEngine` harvested and packaged deterministic fixture files (`userService.ts`, `authService.ts`). |
| **Plan Generation** | **PASS** | **LIVE PIPELINE** | Model generated valid structured Plan validated by `PlanValidator`. |
| **Plan Approval Gate** | **PASS** | **LIVE APPROVAL** | Verified `agent.plan_requested` triggers user approval via `agent.plan_approve` before any file modifications are prepared. |
| **Multi-File EditSet** | **PASS** | **LIVE WORKSPACE** | Staged multi-file changes across `src/user/userService.ts` and `test/userService.test.js`. |
| **Partial Approval** | **PASS** | **LIVE APPROVAL** | Approved `userService.ts` and rejected `test/userService.test.js`. Verified `userService.ts` modified on disk while rejected file remained 100% byte-for-byte identical to baseline. |
| **Atomic Apply** | **PASS** | **LIVE WORKSPACE** | `EditSetManager` applied approved changes directly to disk in the fixture workspace. |
| **VS Code Diagnostics** | **PASS** | **LIVE DIAGNOSTICS** | Diagnostic harvesting via `IDiagnosticsProvider` verified; errors successfully mapped into `DiagnosticsSummary`. |
| **Subprocess Tests** | **PASS** | **LIVE SUBPROCESS** | Subprocess test runner (`node --test test/*.test.js`) executed by `VerificationEngine` capturing exit code and output. |
| **Self-Healing Repair** | **PASS** | **LIVE PIPELINE** | Diagnostic/test failure correctly triggered `DIAGNOSING` → repair turn proposal → approval → fix verified clean. |
| **Git Safety** | **PASS** | **LIVE WORKSPACE** | Pre-existing uncommitted modifications in unrelated `src/auth/authService.ts` survived completely intact without modification or reset. |
| **Task Cancellation** | **PASS** | **LIVE CANCELLATION** | Mid-flight `agent.cancel` cleanly triggered abort signal, halted FSM, emitted `CANCELLED` status, and prevented rogue mutations. |
| **Ollama Local Inference** | **NOT AVAILABLE** | **PENDING WEIGHT DOWNLOAD** | Ollama daemon v0.34.0 is live and responsive on localhost:11434; weight inference pending local model weight download due to CDN throttling. |

---

## 3. Detailed Walkthrough of Key Capabilities

### A. End-to-End Workflow Execution
- **Task**: `"Add input validation to user registration in userService.ts. Reject empty usernames, invalid emails, and short passwords. Add tests."`
- **Flow**:
  1. Discovery indexed fixture workspace (`test/fixtures/m7b-fixture-repo`).
  2. ContextEngine assembled relevant context package.
  3. Planner formulated structured plan (`plan_user_validation`).
  4. Plan approval requested via Webview RPC; developer approved.
  5. Multi-file edits proposed for `userService.ts` and `userService.test.js`.
  6. EditSet approval requested via Webview RPC; developer approved.
  7. Edits applied atomically to filesystem.
  8. Diagnostics checked clean.
  9. Verification tests executed (`node --test test/*.test.js`) with exit code 0.
  10. Final task completion summary emitted with `status: SUCCESS`.

### B. Partial Approval Invariant Verification
- Model proposed changes to `src/user/userService.ts` and `test/userService.test.js`.
- Developer submitted selective approval decision: `{ approvedFiles: ['src/user/userService.ts'], rejectedFiles: ['test/userService.test.js'] }`.
- Verification confirmed:
  - `src/user/userService.ts` was updated with the approved content.
  - `test/userService.test.js` was NOT updated, remaining byte-for-byte identical to original baseline.

### C. Git Safety & User Changes Survival
- Before task execution, a dirty uncommitted modification was written to `src/auth/authService.ts`:
  `// Developer WIP: Custom JWT Secret\nexport const WIP_SECRET = "dev_secret_123";\n`
- The agent executed a coding task modifying `src/user/userService.ts`.
- Post-execution verification asserted `src/auth/authService.ts` content was completely unchanged.
- Zero destructive git commands (`git reset --hard`, `git clean -fd`, `git push --force`) were executed.
