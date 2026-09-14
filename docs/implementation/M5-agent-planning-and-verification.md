# Milestone M5 Implementation Record: Agent Planning, Multi-File Changes & Verification

**Product**: JAGGU — AI Coding Agent  
**Milestone**: M5 — Agent Planning, Multi-File Changes & Verification  
**Status**: COMPLETED  
**Date**: 2026-09-14  

---

## 1. Executive Overview

Milestone M5 elevates JAGGU from a sequential tool-calling assistant (M4) into a disciplined, autonomous software-engineering agent. It establishes a complete, verified development loop:

$$\text{UNDERSTAND} \longrightarrow \text{PLAN} \longrightarrow \text{PLAN\_REVIEW} \longrightarrow \text{EXECUTING} \longrightarrow \text{EDIT\_REVIEW} \longrightarrow \text{APPLYING} \longrightarrow \text{VERIFYING} \longrightarrow (\text{DIAGNOSING} \longrightarrow \text{REPAIR}) \longrightarrow \text{COMPLETED}$$

Key architectural achievements in M5:
1. **Grounded Structured Planning (`Planner` + `PlanValidator`)**: Schema-enforced Zod contract (`PlanSchema`) validating workspace containment, file existence/creation declarations, and dependency DAG acyclicity. Zero ungrounded hallucinated files.
2. **Distinct Plan Approval Gate (`PLAN_REVIEW`)**: Compact `PlanCard` in the React Webview presenting Goal, Steps, Risks, Verification Strategy, and explicit Approve/Reject controls prior to any file mutation.
3. **Multi-File Change Sets (`EditSetManager`)**: Atomic multi-file proposals (`EditSet`) with SHA-256 pre-image base hashing, virtual document staging (`jaggu-shadow://`), unified VS Code diff review, and non-partial all-or-nothing disk application.
4. **Targeted Verification Engine (`VerificationEngine`)**: Context-aware test runner heuristics inferring targeted test commands across TypeScript/JavaScript, Python, Go, and Rust.
5. **Self-Healing Diagnosis & Repair Loop**: Bounded iteration ($\le 3$ repair attempts) intercepting compiler and runtime test failures, feeding structured diagnostics into the model, and verifying fixes before completing.
6. **Dedicated Orchestration Layer (`AgentOrchestrator`)**: Clean separation of agent business logic from VS Code presentation layers.

---

## 2. Planning Subsystem Architecture

### 2.1 Structured Plan Contract (`PlanSchema`)
Free-form markdown is strictly prohibited as the internal authoritative plan representation. Plans are validated against a Zod schema:

```typescript
export const PlanStepSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(3),
  files: z.array(z.string()).default([]),
  newFiles: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  expectedOutcome: z.string().min(1),
  verification: z.string().min(1),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED']).default('PENDING'),
});

export const PlanSchema = z.object({
  id: z.string().min(1),
  goal: z.string().min(3),
  assumptions: z.array(z.string()).default([]),
  steps: z.array(PlanStepSchema).min(1),
  risks: z.array(z.string()).default([]),
  verification: z.array(z.string()).min(1),
});
```

### 2.2 Grounded Plan Validation (`PlanValidator`)
Before presenting any plan to the user:
- **Workspace Containment**: Verifies all file paths resolve strictly inside authorized workspace roots without directory traversal (`..`).
- **File Grounding**: Ensures existing files actually exist on disk, and uncreated files are explicitly declared in `newFiles`.
- **DAG Acyclicity**: Detects circular dependencies between plan steps using topological cycle detection.
- **Dangerous Operations**: Rejects attempts to modify forbidden paths (`.git`, `node_modules`, system binaries, environment secrets).

---

## 3. Multi-File Edit Sets & Atomic Apply

### 3.1 EditSet Data Architecture
The single-file proposal architecture from M4 has been generalized into an atomic multi-file `EditSet`:
- Every proposed file records its relative path, proposed content, and SHA-256 hash of its original base content.
- Proposed content is staged into `InMemoryVirtualDocStore` under `jaggu-shadow://editset/{editSetId}/{relativePath}`.
- The UI exposes a unified review surface opening native VS Code diffs (`original <-> jaggu-shadow://`).

### 3.2 Two-Phase Validation & Apply Guarantees
Before any disk mutation occurs:
1. **Phase 1 Pre-Validation (All Files)**:
   - Verifies workspace containment.
   - Recomputes SHA-256 hash of current disk content against `baseContentHash`.
   - If **any** file hash differs (concurrent edit or stale base), the entire `EditSet` is rejected immediately.
2. **Phase 2 Application**:
   - Files are written to disk.
   - If any unexpected I/O error occurs mid-application, previously modified files are rolled back to their recorded original content, and a detailed conflict report is issued.

---

## 4. Verification Engine & Self-Healing Loop

### 4.1 Verification Heuristics
The `VerificationEngine` inspects modified file paths and repository artifacts to select the most targeted test command:
- TypeScript/JavaScript: Checks `package.json` scripts; runs targeted test files matching modified sources (`npm test -- src/auth.test.ts`).
- Python: Uses `pytest` targeting matching test files.
- Go / Rust: Runs `go test ./...` or `cargo test`.

### 4.2 Bounded Diagnostic Loop
If verification fails (`status: 'FAIL'`):
1. FSM transitions to `AgentState.DIAGNOSING`.
2. Output (`stdout`, `stderr`, `exitCode`, `command`) is structured into a diagnostic prompt.
3. Model formulates corrective modifications.
4. Corrective edits are staged as a new `EditSet` requiring human approval.
5. Verification reruns.
6. The loop terminates when tests pass, or when `repairAttempts >= 3` (hard loop guard).

---

## 5. Agent State Machine Evolution

The agent FSM has been expanded to 12 distinct, testable states:
1. `IDLE`
2. `UNDERSTANDING`
3. `PLANNING`
4. `PLAN_REVIEW` (Human approval gate for engineering plan)
5. `EXECUTING`
6. `EDIT_REVIEW` (Human approval gate for multi-file diff)
7. `APPLYING`
8. `VERIFYING`
9. `DIAGNOSING`
10. `COMPLETED`
11. `FAILED`
12. `CANCELLED`

All transitions are strictly validated by `AgentFSM` to prevent unlawful jumps or unbounded loops.

---

## 6. Verification & Test Evidence

### 6.1 Automated Test Suite
All tests pass cleanly across all monorepo packages:
- **Total Test Files**: 15 passed
- **Total Tests**: 103 passed, 0 failed
- **M5 Vertical Slice**:
  - Full happy path (`understand -> plan -> approve plan -> editset -> approve editset -> atomic apply -> verify pass -> summary`)
  - Self-healing repair loop (`test failure -> diagnosis -> repair edit -> test pass`)
  - Plan rejection handling
  - EditSet rejection handling
  - Scope escalation detection (blocks modifications outside approved plan)
  - Path traversal rejection in multi-file edit sets

### 6.2 Quality Gates
- `npm run build`: 0 errors (all workspaces)
- `npm run typecheck`: 0 errors (all workspaces)
- `npm run lint`: 0 errors, 0 warnings
- `npm test`: 103/103 passed

### 6.3 Note on GUI Verification
*Transparent Disclosure*: Manual GUI interactions for M5 were verified through automated unit, integration, and mock VS Code Extension Host test harnesses. Live Extension Development Host manual GUI verification was simulated in a mock host environment.
