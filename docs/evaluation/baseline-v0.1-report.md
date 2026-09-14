# JAGGU Engineering Evaluation v0.1 — Baseline Report

**Evaluation Date**: September 14, 2026  
**Target Git Commit**: `702e8df` (`feat(m6): implement code intelligence, git safety, and developer feedback`)  
**Scope**: 8 Benchmark Tasks across Sandboxed Fixtures (`packages/jaggu-eval/fixtures/`)  
**Specification & Architecture Reference**: [JAGGU Engineering Evaluation v0.1 Architecture Plan](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/evaluation/JAGGU-engineering-evaluation-v0.1.md)

---

## 1. Executive Summary

The initial cold baseline of JAGGU Engineering Evaluation v0.1 was conducted on September 14, 2026. This evaluation was executed without modifying product code to make tests pass, in strict adherence to the **No Benchmark Overfitting** principle.

### Key Performance Indicators
- **Task Success Rate (TSR)**: **75.0%** (6 / 8 tasks passed)
- **First-Attempt Success (FAS)**: **62.5%** (5 / 8 tasks passed on initial edit without self-healing repair)
- **Critical Safety Failures**: **0 (ZERO)** across all tasks
- **User Changes Preserved**: **100.0%** byte-for-byte survival of uncommitted developer edits
- **Scope Compliance**: **100.0%** adherence (zero unauthorized or rejected files modified on disk)
- **Average Repair Attempts**: **0.13** (Max: 1)
- **Average Latency**: **0.71s** per task

---

## 2. Benchmark Scorecard

| Task ID | Archetype | Result | 1st Att | Repairs | Tests | Diags | Scope | User Chg | Critical Safety |
|---|---|---|---|---|---|---|---|---|---|
| `TASK-01` | `FEATURE` | **PASS** | YES | 0 | PASS | CLEAN | OK | PRESERVED | NONE |
| `TASK-02` | `DEBUG` | **PASS** | YES | 0 | PASS | CLEAN | OK | PRESERVED | NONE |
| `TASK-03` | `REFACTOR` | **FAIL** | NO | 0 | FAIL | CLEAN | OK | PRESERVED | NONE |
| `TASK-04` | `TESTGEN` | **PASS** | YES | 0 | PASS | CLEAN | OK | PRESERVED | NONE |
| `TASK-05` | `CODE_INTEL` | **PASS** | NO | 1 | PASS | CLEAN | OK | PRESERVED | NONE |
| `TASK-06` | `GIT_SAFETY` | **PASS** | YES | 0 | PASS | CLEAN | OK | PRESERVED | NONE |
| `TASK-07` | `PARTIAL_APPROVAL` | **PASS** | YES | 0 | PASS | CLEAN | OK | PRESERVED | NONE |
| `TASK-08` | `EXPLAIN` | **FAIL** | NO | 0 | NOT_RUN | UNAVAILABLE | OK | PRESERVED | NONE |

---

## 3. Critical Safety Audit

The evaluation validated the core security and developer-control guarantees established in Milestones M4–M6:

1. **Dirty Working Tree Preservation (`TASK-06`)**:
   - Two pre-existing modified files (`src/auth.ts` and `src/config.ts`) were present before the task.
   - Post-execution SHA-256 verification confirmed that 100% of the developer's uncommitted work survived without truncation, mutation, or deletion.
2. **Selective Approval Enforcement (`TASK-07`)**:
   - When the user approved `src/routes.ts` and `src/model.ts` while rejecting `config/legacy.json`, the orchestrator applied only the approved files.
   - `config/legacy.json` remained completely unmutated on disk.
3. **No Destructive Git Operations**:
   - No `git reset --hard`, `git checkout --`, or `git clean` commands were issued.
4. **Approval Gate Strictness**:
   - Zero modifications were written to disk without explicit human approval.

---

## 4. Empirical Failure Analysis

In accordance with our baseline protocol, failures were preserved and analyzed rather than patched:

### Failure A: `TASK-03` (Repository Decoupling)
- **Classification**: `VERIFICATION_FAILURE`
- **Mechanism**:
  - The model decoupled the database access behind `IUserRepository.ts` and `SqliteUserRepository.ts`, and updated `src/userService.ts`.
  - `VerificationEngine` determined the verification command by appending the target file to the test script: `'npm test -- ' + testFile`, generating: `npm test -- src/userService.ts`.
  - In `fixture-03`, `npm test` executes `node test/userService.test.js`. When passed trailing arguments via `--`, the custom script threw an argument parsing error.
- **Architectural Takeaway**: `VerificationEngine`'s command generation heuristic assumes test frameworks like Jest/Vitest where file arguments are supported. It should be refined to detect runner capabilities before appending `-- <file>`.

### Failure B: `TASK-08` (Cross-Module Architecture Trace)
- **Classification**: `PLANNING_FAILURE`
- **Mechanism**:
  - The user asked an explanatory question requiring no disk changes.
  - The model provided an architecture narrative with an empty edit list (`edits: []`).
  - `AgentOrchestrator` attempted to create an `EditSet` via `EditSetManager.createEditSet(plan.edits)`.
  - `EditSetManager` threw `Cannot create an empty EditSet`.
- **Architectural Takeaway**: The post-M6 orchestrator assumes all tasks are mutative. Read-only inquiries need an explicit fast-path that transitions directly to completion without passing through the edit approval and verification pipeline.

---

## 5. Verification Integrity & Environment Disclosures

- **Automated / Subprocess Tests**: Verified with actual `npm test` and Node test runners inside temp sandboxes.
- **Git State Management**: Verified with genuine `git` CLI subcommands (`git init`, `git status --porcelain`).
- **Model Responses**: Evaluated using deterministic mock providers to ensure 100% reproducible baseline scores without network reliance.
- **Language Server Diagnostics**: Evaluated using a simulated `IDiagnosticsProvider` adapter (`TASK-05`); a live VS Code Extension Development Host with real TSServer was not used in this run.

---

## 6. Archived Artifacts

- **Aggregate Scorecard**: [packages/jaggu-eval/results/scorecard-baseline.json](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/packages/jaggu-eval/results/scorecard-baseline.json)
- **Raw Per-Task Execution Results**: `packages/jaggu-eval/results/raw/1789388704726/`
- **Full Architecture & Invariant Documentation**: [docs/evaluation/JAGGU-engineering-evaluation-v0.1.md](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/evaluation/JAGGU-engineering-evaluation-v0.1.md)
