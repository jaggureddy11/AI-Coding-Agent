# M7-B Implementation & Validation Plan: Real IDE Integration & End-to-End Validation

**Date:** September 14, 2026  
**Milestone:** M7-B (Real IDE Integration & End-to-End Validation)  
**Target:** Validating JAGGU inside a real VS Code Extension Development Host / Webview environment on a deterministic fixture workspace with real Hugging Face online AI inference, approval gates, diagnostics, tests, and Git safety.

---

## 1. Current Live-IDE Architecture

JAGGU's architecture connects the VS Code environment to the core orchestration pipeline through typed boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension Host                          │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │   SidebarProvider     │◄────────────►│     AgentOrchestrator     │  │
│  │  (Webview RPC Bridge) │              │    (FSM State Machine)    │  │
│  └───────────┬───────────┘              └─────────────┬─────────────┘  │
│              │                                        │                │
│              │ (PostMessage JSON-RPC)                 │                │
│              ▼                                        ▼                │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │  React UI (Webview)   │              │       ModelGateway        │  │
│  │  • ModelSelector      │              │  • HuggingFaceProvider    │  │
│  │  • Chat & Activity    │              │  • OllamaProvider         │  │
│  │  • Plan Review UI     │              │  • Context Limiting       │  │
│  │  • EditSet Diff UI    │              └─────────────┬─────────────┘  │
│  │  • Diagnostics Banner │                            │                │
│  └───────────────────────┘                            ▼                │
│                                         ┌───────────────────────────┐  │
│                                         │      Tool Subsystems      │  │
│                                         │  • WorkspaceDiscovery     │  │
│                                         │  • ToolExecutor           │  │
│                                         │  • VSCodeDiagnostics      │  │
│                                         │  • VerificationEngine     │  │
│                                         │  • TaskCheckpointManager  │  │
│                                         └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

* **Webview Bridge (`SidebarProvider` & `@jaggu/ui`)**: Implements strict bidirectional RPC with nonce-based CSP (`default-src 'none'`), type-safe JSON messages (`isValidWebviewMessage`, `isValidExtensionMessage`), and isolated credentials.
* **Orchestration Layer (`AgentOrchestrator` & `Planner`)**: Governs task execution through strict FSM states (`UNDERSTAND` → `PLAN` → `PLAN_REVIEW` → `PROPOSE_EDITS` → `EDIT_REVIEW` → `APPLY_EDITS` → `DIAGNOSTICS` → `VERIFY` → `DIAGNOSE` / `REPAIR` → `COMPLETED`).
* **Model Layer (`ModelGateway` & Providers)**: Routes LLM requests to either online endpoints (`HuggingFaceProvider`) or local daemons (`OllamaProvider`, `OpenAICompatibleProvider`).
* **Developer Approval Invariants**: No file mutations or non-whitelisted commands occur without explicit human approval at `PLAN_REVIEW` and `EDIT_REVIEW`.

---

## 2. Current Gaps & Limitations

1. **Automated vs. Live IDE Gap**: Prior milestones verified components using headless unit tests, mock providers, and virtual VS Code APIs (`test/vscode-mock.ts`). Live Extension Development Host execution has not yet been exercised end-to-end.
2. **Webview Interactivity Evidence**: Visual verification previously used static headless HTML rendering rather than interacting live inside a running VS Code process with live RPC.
3. **Local Weight Constraint**: While Ollama daemon connectivity and error handling are live-verified, local weights (`qwen2.5-coder:0.5b`) could not be downloaded due to bandwidth limits. Live model inference will focus on the verified **Hugging Face online router (`Qwen/Qwen2.5-Coder-32B-Instruct`)**.
4. **Hunk-Level Approval**: The current `EditSetManager` supports **file-level selective approval** (approving/rejecting individual files within a multi-file set). Hunk-level approval is an explicit non-goal for M7-B.

---

## 3. Extension Development Host Strategy

To validate the extension inside a real VS Code environment:
1. **VS Code Extension Test Infrastructure**:
   - Utilize `@vscode/test-electron` (or script-driven headless Code-OSS launch) to bootstrap a real VS Code Extension Development Host instance.
   - Load the compiled extension package (`packages/jaggu-vscode`), ensuring activation events (`onStartupFinished`, commands, sidebar view provider) register against real VS Code APIs.
2. **Real Extension Lifecycle Execution**:
   - Verify `activate(context)` completes against real `ExtensionContext`, `SecretStorage`, and `languages.getDiagnostics()`.
   - Verify `jaggu.sidebarView` registers successfully and responds to `resolveWebviewView`.
   - Verify status bar item registration and dynamic state updates (`IDLE` → `PROCESSING` → `SUCCESS`).

---

## 4. Webview Verification Strategy

1. **Asset Compilation & Integrity**:
   - Verify `packages/jaggu-ui` compiles to `packages/jaggu-vscode/media/webview.js` and `webview.css` via esbuild.
   - Verify CSP headers match VS Code Webview security standards (`default-src 'none'`, `nonce-*`, `vscode-webview:` schemes).
2. **RPC Handshake & Event Flow**:
   - Webview emits `ui.ready` upon DOM mount.
   - Extension Host responds with `agent.config` (active provider/model options) and `agent.status` (`IDLE`).
   - Webview emits `user.submit`, receives `token.delta` streaming, `context.assembled`, `agent.activity`, `agent.plan_requested`, `agent.approval_requested`, and `token.complete`.
3. **Interactive UI Components**:
   - ModelSelector: Verify provider and model switches update configuration and emit status.
   - Plan Review: Verify goal, steps, and target files render with Approve / Reject actions.
   - EditSet Review: Verify multi-file diff summary with selective file rejection switches.

---

## 5. Real-Model Strategy (Online Hugging Face)

1. **Endpoint & Model**:
   - Endpoint: `https://router.huggingface.co/v1`
   - Model: `Qwen/Qwen2.5-Coder-32B-Instruct` (or `meta-llama/Llama-3.1-8B-Instruct`)
   - Provider: `HuggingFaceProvider`
2. **Credential Security**:
   - In live IDE, credentials are read exclusively from VS Code `SecretStorage` (`context.secrets.get('jaggu.apiKey.huggingface')`) or `process.env.HF_TOKEN` in test harnesses.
   - Zero credentials passed to Webview, RPC payloads, logs, or reports.
3. **Model Request Protocol**:
   - Standardized `ModelRequest` with system prompt, conversation history, and repository context.
   - Streaming SSE responses parsed incrementally with usage metrics.

---

## 6. Deterministic Fixture Workspace Strategy

A dedicated fixture workspace (`test/fixtures/m7b-fixture-repo`) will be constructed with realistic TypeScript code:

```
test/fixtures/m7b-fixture-repo/
├── package.json               # Scripts: "test": "vitest run" or custom runner
├── tsconfig.json              # Strict TS configuration
├── src/
│   ├── auth/
│   │   └── authService.ts     # User authentication logic
│   └── user/
│       ├── userRepository.ts  # In-memory user data store
│       └── userService.ts     # User registration logic (target for validation)
└── test/
    ├── auth.test.ts           # Existing auth test suite
    └── userService.test.ts    # Tests asserting registration validation rules
```

This workspace is completely separate from JAGGU's source code, deterministic, Git-initialized, and contains valid unit tests.

---

## 7. End-to-End Task Specification

**Task Prompt:**
> "Add input validation to user registration in `userService.ts`. Reject empty usernames, reject malformed email addresses (must contain '@' and a dot), and enforce a minimum password length of 8 characters. Update `userService.test.ts` to test these validation cases without breaking existing tests."

**Expected Pipeline:**
1. **UNDERSTAND & CONTEXT**: Discovery indexes files; ContextEngine packages `userService.ts`, `userRepository.ts`, `userService.test.ts`, and `package.json`.
2. **PLAN**: Model generates structured plan; `PlanValidator` validates; `PLAN_REVIEW` requests human approval.
3. **PLAN APPROVAL**: Developer approves plan in Webview.
4. **PROPOSE EDITS**: Multi-file `EditSet` generated for `src/user/userService.ts` and `test/userService.test.ts`.
5. **EDIT REVIEW**: Developer reviews diffs and approves edits.
6. **APPLY & CHECKPOINT**: Shadow documents applied atomically to disk; Git checkpoint recorded.
7. **DIAGNOSTICS**: `VSCodeDiagnosticsProvider` reads diagnostics from language services.
8. **TEST VERIFICATION**: `VerificationEngine` executes `npm test` against fixture repo.
9. **COMPLETED**: Success summary emitted with diff overview and test results.

---

## 8. Diagnostic Verification

1. **Mechanism**: `VSCodeDiagnosticsProvider` integrates with `vscode.languages.getDiagnostics()`.
2. **Controlled Failure Scenario**:
   - Introduce a deliberate syntax/type mismatch in a proposed repair turn (e.g. missing return type or parameter mismatch).
   - Verify diagnostics are retrieved, mapped to `DiagnosticRecord`, and fed into `AgentOrchestrator`'s repair loop.
   - Verify self-healing proposal corrects the diagnostic and re-verifies.
3. **Honest Claim**: Documented as "VS Code Language Service Diagnostics Integration".

---

## 9. Real Test Execution

1. **Runner**: `VerificationEngine` executing subprocesses in the fixture root.
2. **Detection**: Framework-aware heuristics (`vitest`, `jest`, `npm test`) dynamically identifying package scripts.
3. **Safety & Containment**:
   - Subprocess spawned with timeouts (e.g. 15s) and bounded buffers.
   - Non-zero exit codes captured and formatted into structured verification errors for diagnosis.

---

## 10. Git Safety Verification

1. **Pre-Existing Modifications**:
   - Prior to running the task, create an uncommitted modification in `src/auth/authService.ts`.
2. **Verification Invariants**:
   - `TaskCheckpointManager` detects existing dirty files and isolates them.
   - JAGGU applies changes ONLY to approved target files (`userService.ts`, `userService.test.ts`).
   - `src/auth/authService.ts` remains byte-for-byte untouched.
   - No destructive commands (`git reset --hard`, `git clean -fd`, `git push`) are executed.

---

## 11. Approval Verification & Invariant Enforcement

1. **Plan Gate**: If plan is rejected, agent immediately terminates or requests task reformulation; no files are modified.
2. **EditSet Gate**: If edits are rejected, zero shadow buffers are committed to disk.
3. **Partial Approval**:
   - Model proposes changes to File A and File B.
   - User approves File A and rejects File B.
   - File A is updated on disk; File B remains 100% unchanged.
   - Orchestrator receives partial application result and runs verification on approved changes.

---

## 12. Cancellation Verification

1. **Mid-Flight Abort**:
   - Trigger cancellation while model is streaming tokens or while waiting at an approval gate.
2. **Verification Invariants**:
   - Underlying `AbortController` signals HTTP abort to provider.
   - FSM transitions to `CANCELLED`.
   - Webview updates to `CANCELLED` status.
   - No lingering background processes or orphaned shadow edits remain.

---

## 13. Security Verification Checklist

- [ ] **Zero Exposed Secrets**: No API keys in Webview, RPC messages, logs, reports, or Git commits.
- [ ] **SecretStorage Isolation**: Keys stored securely in VS Code `SecretStorage`.
- [ ] **Strict CSP**: Webview HTML restricted with nonce and `default-src 'none'`.
- [ ] **Workspace Containment**: Tools reject path traversal outside fixture workspace.
- [ ] **Command Whitelisting**: Subprocesses restricted to verified testing/search commands.

---

## 14. Failure Criteria

The M7-B validation fails if:
- Real Webview fails to render or load assets.
- Extension Host throws unhandled exceptions during activation or task execution.
- A model proposal writes directly to disk without developer approval.
- Pre-existing user modifications in unrelated files are overwritten or corrupted.
- A rejected file in a partial-approval flow is modified on disk.
- Any secret token is leaked into UI state, RPC payloads, or logs.
- Existing 175 unit/integration tests fail.

---

## 15. Automated vs. Live Evidence Classification

| Category | Classification | Verification Method |
|---|---|---|
| Unit / Subsystem Tests (175 tests) | **AUTOMATED / MOCKED** | Vitest suite across core, vscode, ui, eval |
| Real Hugging Face Inference | **LIVE** | Live HTTPS connection to `router.huggingface.co` with `Qwen2.5-Coder-32B` |
| Extension Host Activation | **LIVE EXTENSION HOST** | Extension activation inside VS Code / test-electron |
| Webview Rendering & RPC | **LIVE GUI / RPC** | Webview bootstrapping with real compiled bundle |
| Fixture Workspace Coding Task | **LIVE WORKSPACE** | Real filesystem mutation, Git checkpoints, subprocess tests |
| VS Code Diagnostics | **LIVE DIAGNOSTICS** | Real language service diagnostics capture |
| Ollama Local Model Inference | **PENDING WEIGHT DOWNLOAD** | Accurately stated as unverified for local weights |

---

## 16. Exact Files Expected to Change / Be Added

1. **New Documentation**:
   - `docs/M7B_IMPLEMENTATION_PLAN.md` (this file)
   - `docs/M7B_IMPLEMENTATION.md`
   - `docs/M7B_LIVE_VALIDATION.md`
   - `docs/M7B_SECURITY_REVIEW.md`
2. **Fixture Workspace**:
   - `test/fixtures/m7b-fixture-repo/*` (sample files, tests, configs)
3. **IDE Validation Harness / Integration Suites**:
   - `packages/jaggu-vscode/test/m7bLiveIdeIntegration.test.ts`
   - `scripts/run-m7b-validation.ts` (if needed for headless launcher)
4. **Minimal Bug Fixes (if defects discovered during live validation)**:
   - `packages/jaggu-vscode/src/sidebarProvider.ts`
   - `packages/jaggu-vscode/src/extension.ts`

---

## 17. Rollback Strategy

- All changes are isolated on branch `main`.
- In the event of an unexpected regression or defect:
  1. Any newly created test fixtures or reports can be reverted cleanly using Git.
  2. The 175 baseline tests guarantee core stability across M0–M7A.

---

## 18. Explicit Non-Goals

- ❌ Automatic model routing / model marketplace
- ❌ Multi-agent swarm architectures
- ❌ RAG / Vector databases / embeddings
- ❌ Autonomous Git commit or Git push
- ❌ Hunk-level interactive diff editing
- ❌ Custom VS Code core modifications / forks
- ❌ Premature performance micro-benchmarking

---

**Next Step:** STOP and await user review of `docs/M7B_IMPLEMENTATION_PLAN.md` before proceeding to implementation.
