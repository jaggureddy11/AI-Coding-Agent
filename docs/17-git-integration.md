# 17 — Git Integration & Working Tree Safety

## 1. Safety Invariant: No Unattended Commits

JAGGU treats the Git repository as the developer's sacred source of truth.
> **Cardinal Invariant**: JAGGU shall NEVER execute `git commit`, `git push`, `git checkout`, or `git reset` automatically without explicit, interactive developer authorization.

The primary role of the Git subsystem in JAGGU is **context awareness, safety snapshotting, and assisted commit generation**.

---

## 2. Subsystem Capabilities

```
+-----------------------------------------------------------------------------------------+
|                                JAGGU GIT SUBSYSTEM                                    |
|                                                                                         |
|  [VS Code Git Extension API Bridge (`vscode.extensions.getExtension('vscode.git')`)]    |
|                                       │                                                 |
|        ┌──────────────────────────────┼──────────────────────────────┐                  |
|        ▼                              ▼                              ▼                  |
| [1. CONTEXT SENSING]        [2. SAFETY SNAPSHOTS]        [3. ASSISTED WORKFLOW]         |
| - Inspect working tree      - Auto-create temporary       - Generate Conventional       |
| - Read staged/unstaged diff   checkpoint stash before      Commit message from diff     |
| - Detect active branch        mutating operations        - Explain commit history       |
| - Identify merge conflicts  - Instant 1-click rollback    - Staged vs Unstaged review   |
+-----------------------------------------------------------------------------------------+
```

### 2.1 Capability 1: Working Tree Context Sensing
- **Branch & Remote Detection**: Identifies current branch (e.g., `feature/oauth-login`) and tracking status (ahead/behind remote).
- **Modified & Untracked Files**: Queries `git status --porcelain` to determine if the workspace has uncommitted manual changes prior to agent task execution.
- **Merge Conflict Detection**: If the working tree is in an active merge conflict (`<<<<<<< HEAD`), JAGGU detects this state and can assist the developer in resolving conflicting hunks.

### 2.2 Capability 2: Pre-Task Safety Checkpoints
Before executing any mutating plan involving multiple files, JAGGU creates an internal safety checkpoint:
```typescript
export interface GitCheckpoint {
  checkpointId: string;
  createdAt: number;
  baseCommitHash: string;
  stashRef?: string;
  modifiedFiles: string[];
}
```
If the agent fails or the developer clicks `"Revert All Agent Changes"`, JAGGU can cleanly roll back modified files to the exact pre-task snapshot without affecting pre-existing uncommitted manual edits.

### 2.3 Capability 3: Conventional Commit Message Generation
Once a task is verified and diffs are accepted, JAGGU can analyze the unified diff and generate a semantic Conventional Commit message:
```
feat(auth): implement GitHub OAuth login flow with refresh token support

- Add OAuth callback handler in src/auth/github.ts
- Register route in src/routes/auth.ts
- Add unit tests verifying token exchange and cookie serialization in tests/auth.test.ts
- All 14 tests passing
```
The developer can inspect, edit, and click `[Commit Changes]` directly from the JAGGU UI.

---

## 3. Integration Mechanism: VS Code Git API vs CLI Fallback

JAGGU uses a two-layer Git strategy:
1. **Primary**: VS Code Built-in Git Extension API (`vscode.git` API version 1).
   - Provides clean reactive event listeners: `repository.state.onDidChange`.
   - Zero process spawning overhead.
2. **Fallback**: Direct `git` CLI invocation via `child_process.execFile('git', args)` if the workspace is running in a minimal or headless environment where `vscode.git` is disabled.

---

## 4. Future Roadmap Capabilities (Phase 6+)
- **Smart Branch Creation**: Recommending branch creation based on user prompt (e.g., `git checkout -b feat/add-healthcheck`).
- **PR Description Synthesis**: Formulating complete GitHub/GitLab Pull Request descriptions with summaries, test proofs, and checklist items.
