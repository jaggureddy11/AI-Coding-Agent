# M6 Implementation Report: Code Intelligence, Git Safety & Developer Feedback

**Status**: COMPLETED  
**Date**: September 14, 2026  
**Scope**: Code Intelligence, Git Safety & Developer Feedback (LSP Diagnostics, Git Task Checkpoints & User Change Preservation, Selective/Partial Approval)  
**Verification**: 19 test suites, 117/117 passing automated unit and integration tests (`npm test`), full TypeScript strict typechecking (`tsc --noEmit`), ESLint clean (`npm run lint`).

---

## 1. Executive Summary

Milestone M6 elevates JAGGU from a multi-file planning and editing agent (M5) into a developer-grade coding assistant equipped with **compiler-level code intelligence**, **Git-aware task safety**, and **fine-grained developer control**:

1. **LSP Diagnostics**: Harvests post-apply compiler diagnostics (`vscode.languages.getDiagnostics`) normalized via an abstract, testable `IDiagnosticsProvider` interface. When language servers or compilers flag errors, JAGGU automatically enters a diagnostic repair loop to propose and verify corrections before proceeding to test execution.
2. **Git-Aware Task Checkpoints & User Change Preservation**: Captures a non-destructive Git baseline prior to any task mutations. Distinguishes pre-existing developer modifications from JAGGU-specific changes, strictly disallows destructive Git verbs (`commit`, `push`, `reset`, `checkout`, `clean`, `rebase`, `stash`), prevents path traversal, and produces Conventional Commit proposals without automatic committing or pushing.
3. **Selective / Partial Approval**: Transitions the approval model from a binary "All-or-Nothing" gate into granular file-level selection. Developers can approve a subset of proposed files while rejecting others; rejected files are guaranteed to never be touched or written on disk.

---

## 2. Architectural Pillars

### Pillar 1: LSP Diagnostics & Compiler-Driven Repair

#### Architecture & Decoupling
VS Code diagnostic APIs (`vscode.languages.getDiagnostics`) are isolated within `packages/jaggu-vscode/src/diagnostics/vscodeDiagnosticsProvider.ts`. The core orchestration logic (`packages/jaggu-core`) relies exclusively on the abstract `IDiagnosticsProvider` interface defined in `packages/jaggu-core/src/types/diagnostics.ts`:

```
VS Code Languages API (vscode.languages.getDiagnostics)
       │
       ▼
VSCodeDiagnosticsProvider (@jaggu/vscode)
       │
       ▼ (implements IDiagnosticsProvider)
Normalized Diagnostic[] (@jaggu/core)
       │
       ▼
AgentOrchestrator (DIAGNOSING & bounded repair loop)
```

#### Normalized Diagnostic Model
```typescript
export interface Diagnostic {
  file: string;
  severity: DiagnosticSeverity; // ERROR, WARNING, INFORMATION, HINT
  message: string;
  line: number;
  column: number;
  source?: string;
  code?: string | number;
}
```

#### Diagnostic Flow & Bounded Repair Loop
1. **Apply Approved Edits**: The orchestrator applies approved changes.
2. **Diagnostics Harvest**: Queries `IDiagnosticsProvider.getDiagnostics(workspacePath, affectedFiles)`.
3. **Evaluation**:
   - If clean (0 errors, 0 warnings) or warnings only: proceeds to verification/tests.
   - If errors present: transitions FSM to `DIAGNOSING`, publishes `agent.diagnostics` event, and generates a structured repair proposal targeting the compiler failure.
4. **Bounded Loop**: Repair attempts are hard-capped at $\le 3$ iterations. If errors persist beyond the limit, JAGGU terminates gracefully with `AgentState.FAILED` or escalates to the developer rather than looping infinitely.
5. **Fault Tolerance**: If diagnostics are unavailable (e.g., no language server installed or disabled), the system records `available: false` and proceeds safely to test execution without crashing.

---

### Pillar 2: Git-Aware Task Checkpoints & User Change Preservation

#### The Preservation Guarantee
> **JAGGU MUST NEVER DESTROY PRE-EXISTING USER CHANGES.**

When a developer starts a task, existing uncommitted changes in the repository are cataloged into a `TaskGitBaseline`. JAGGU:
- Never executes `git reset --hard`.
- Never executes `git checkout -- <file>`.
- Never executes `git clean -fd`.
- Never drops stashes or runs automated rebase commands.

#### Core Git Layer (`@jaggu/core`)
- `packages/jaggu-core/src/types/git.ts`: Defines `GitFileState`, `TaskGitBaseline`, and `TaskGitDiffSummary`.
- `packages/jaggu-core/src/git/gitService.ts` (`GitCliService`):
  - Strict read-only whitelist: Only non-mutating subcommands (`status`, `rev-parse`, `diff`, `log`, `branch`, `show`) are allowed.
  - Security validation: Disallows destructive verbs (`commit`, `push`, `reset`, `checkout`, `clean`, `rebase`, `stash`).
  - Path traversal protection: Rejects arguments containing `../` or null bytes.
- `packages/jaggu-core/src/git/taskCheckpointManager.ts` (`TaskCheckpointManager`):
  - `captureBaseline(taskId, workspaceRoot)`: Snapshots pre-existing dirty/clean files and HEAD commit.
  - `detectPreExistingModifications(baseline)`: Returns list of files modified prior to JAGGU's execution.
  - `calculateTaskSummary(baseline, filesTouchedByJaggu)`: Partitions changes into `preExistingUserChanges`, `jagguTaskChanges`, and `unrelatedChanges`.
  - `generateSuggestedCommitMessage(summary, taskPrompt)`: Proposes a Conventional Commit message (e.g., `feat(auth): add authentication rate limiting and tests`).

---

### Pillar 3: Selective / Partial Approval

#### Data Model & Lifecycle
`packages/jaggu-core/src/types/editSet.ts` and `editSetManager.ts`:
- Each proposed file in an `EditSet` carries a status: `PENDING`, `APPROVED`, `REJECTED`, `APPLIED`, or `CONFLICTED`.
- Approval decisions include an optional file filter:
  ```typescript
  export interface EditApprovalDecision {
    approved: boolean;
    approvedFiles?: string[];
    rejectedFiles?: string[];
  }
  ```
- **Execution Safety**: When applying with a filter, rejected files have their shadow documents purged and are never touched on disk. If all files are rejected, zero disk writes occur.

#### User Interface (`@jaggu/ui`)
- `packages/jaggu-ui/src/components/ApprovalCard.tsx`:
  - Renders per-file selection checkboxes for proposed changes.
  - Displays dynamic action buttons: `Approve Selected (N)`, `Approve Changes` (when all selected), and `Reject`.
  - Emits typed RPC event `agent.editset_approve` with `approvedFiles` and `rejectedFiles` arrays.
- Bundled into `packages/jaggu-vscode/media/webview.js` via `esbuild`.

---

## 3. End-to-End M6 Vertical Slice Test

The M6 vertical slice is exercised deterministically in `packages/jaggu-vscode/test/m6VerticalSlice.test.ts`:

```
User Task: "Add authentication rate limiting and tests."
  │
  ├─► 1. Understands repository & captures Git baseline (identifies pre-existing changes)
  ├─► 2. Generates structured 3-file plan -> Developer approves plan
  ├─► 3. Creates Git task checkpoint
  ├─► 4. Proposes 3-file EditSet:
  │      - src/auth/rateLimiter.ts
  │      - src/routes/authRoutes.ts
  │      - src/config/appConfig.ts
  ├─► 5. Developer selectively rejects 'src/config/appConfig.ts' and approves the other 2 files
  ├─► 6. Applies only approved files (confirms 'src/config/appConfig.ts' is untouched on disk)
  ├─► 7. Post-apply LSP diagnostics detect TypeScript error in 'src/routes/authRoutes.ts'
  ├─► 8. Agent enters DIAGNOSING state -> diagnoses missing import
  ├─► 9. Proposes corrective EditSet -> Developer approves
  ├─► 10. Correction applied -> diagnostics rechecked (0 errors)
  ├─► 11. Verification engine executes unit tests -> tests pass
  ├─► 12. Calculates final Git diff summary (distinguishes user changes from JAGGU changes)
  └─► 13. Produces suggested commit message ("feat(auth): add authentication rate limiting and tests")
```

---

## 4. Test Suite Summary

Total test count across all 4 monorepo packages: **117 tests passing across 19 suites** (0 failures).

| Package | Test Suite | Tests | Highlights |
|---|---|---|---|
| `@jaggu/core` | `diagnostics.test.ts` | 4 | Diagnostic normalization, summary calculation, error/warning classification |
| `@jaggu/core` | `gitCheckpoint.test.ts` | 6 | Read-only CLI safety, forbidden verb rejection, baseline capture, user change separation |
| `@jaggu/core` | `selectiveApproval.test.ts` | 3 | Partial file application, disk immutability for rejected files, total rejection handling |
| `@jaggu/core` | `tools.test.ts` | 13 | File tools, path safety, tool schemas |
| `@jaggu/core` | `planning.test.ts` | 6 | Plan validation, dependency DAG cycles |
| `@jaggu/core` | `context.test.ts` | 11 | Multi-root discovery, ranking, budget limits |
| `@jaggu/core` | `editSet.test.ts` | 6 | Multi-file staging, rollback, conflict detection |
| `@jaggu/core` | `models.test.ts` | 16 | Multi-provider streaming, gateway routing |
| `@jaggu/core` | `fsm.test.ts` | 7 | State transitions, loop guards |
| `@jaggu/core` | `security.test.ts` | 7 | Symlink escape, path traversal, permission tiers |
| `@jaggu/core` | `verification.test.ts` | 5 | Test runner heuristics, failure parsing |
| `@jaggu/ui` | `ui.test.tsx` | 5 | Webview rendering, theme syncing |
| `@jaggu/ui` | `rpc.test.ts` | 9 | Typed message dispatching, approval RPC |
| `@jaggu/eval` | `runner.test.ts` | 1 | Evaluation framework baseline |
| `@jaggu-vscode` | `m6VerticalSlice.test.ts` | 1 | Complete M6 target demo end-to-end |
| `@jaggu-vscode` | `m5VerticalSlice.test.ts` | 6 | M5 end-to-end lifecycle & test repair |
| `@jaggu-vscode` | `agentLoop.test.ts` | 5 | M4 action loop & tool execution |
| `@jaggu-vscode` | `integration.test.ts` | 3 | VS Code integration & shadow provider |
| `@jaggu-vscode` | `extension.test.ts` | 3 | Activation & sidebar registration |
| **Total** | **19 suites** | **117 tests** | **100% Passing** |

---

## 5. Security & Safety Review

1. **Pre-Existing User Change Preservation**: Checkpoint tracking explicitly identifies dirty files before task start. Rollback mechanisms operate via memory and shadow files rather than `git checkout` or `git reset`.
2. **Git Command Whitelist**: `GitCliService` blocks any mutating or destructive Git commands at the process invocation layer.
3. **Selective Disk Writes**: Unapproved/rejected files are completely filtered prior to disk writing routines.
4. **Bounded Diagnostic Repair**: Max 3 iterations prevent runaway cycles when facing stubborn syntax/type errors.
5. **Zero Auto-Commit / Auto-Push**: Commit messages are suggested as read-only text; the developer retains sole authority over Git history mutations.

---

## 6. Verification Status & Environment Limitations

- **Automated Tests**: 117/117 automated unit and integration tests passing.
- **Typecheck & Lint**: TypeScript 5.4+ compiler check (`tsc --noEmit`) and ESLint pass cleanly across all workspace packages.
- **Mock Extension Host Verification**: Verified via mocked VS Code workspace and language diagnostic adapters.
- **Live Extension Development Host GUI Verification**: Not performed in this automated headless environment. Manual verification in a live VS Code instance with active language servers (e.g., TSServer) is recommended for end-user visual inspection.
- **External Provider Verification**: Integration tests use deterministic mock intelligence to ensure offline repeatability.
