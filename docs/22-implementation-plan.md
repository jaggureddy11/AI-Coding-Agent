# 22 — Phased Implementation Plan (Milestones M0 through M16)

## 1. Implementation Phasing Strategy

JAGGU is implemented in 17 rigorous, sequentially verifiable milestones (M0–M16). Every milestone produces working, testable code with defined rollback strategies. No milestone begins until its predecessor satisfies 100% of its acceptance criteria.

---

## 2. Detailed Milestone Specifications

### M0: Repository Architecture & Package Scaffolding
- **Goal**: Establish the monorepo workspace, TypeScript configs, ESLint/Prettier rules, and documentation package.
- **Affected Packages**: Root configuration, `package.json`, `tsconfig.json`, `docs/`.
- **Steps**: Initialize pnpm/npm monorepo structure with `packages/jaggu-core`, `packages/jaggu-models`, `packages/jaggu-context`, `packages/jaggu-ui`, `packages/jaggu-vscode`.
- **Tests**: Monorepo build script executes with zero errors.
- **Acceptance Criteria**: `npm run build` cleanly compiles all packages.
- **Dependencies**: Node.js v20+, TypeScript 5.4+.
- **Rollback**: Delete package directories.

### M1: Basic JAGGU Extension Shell & Webview UI *(COMPLETED - Sep 14, 2026)*
- **Goal**: Scaffold the VS Code Extension shell, Activity Bar icon, and React Webview sidebar.
- **Affected Packages**: `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Implementation Details**: Bundled production Webview via `esbuild` (151KB), implemented typed RPC message dispatcher (`user.submit`, `agent.status`, `agent.message`, `agent.error`, `agent.cancel`), created conversational thread with empty state, cancel controls, clear button, and dynamic status bar item (`$(sparkle) JAGGU: Ready`).
- **Tests**: 6 test suites passed, 25/25 unit & integration tests passing (`npm test`).
- **Acceptance Criteria**: Full Webview ↔ Extension Host communication verified; status transitions and cancellation functional.
- **Record**: See [`docs/implementation/M1-extension-shell.md`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M1-extension-shell.md).

### M2: Multi-Provider Model Gateway *(COMPLETED - Sep 14, 2026)*
- **Goal**: Implement `IModelProvider` abstraction and `ModelGateway` supporting OpenAI, Anthropic, Gemini, Ollama, and Mock.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Implementation Details**: Implemented native `fetch` transport with SSE/NDJSON streaming, jittered exponential backoff retry for 429/5xx, fail-fast for 401/403 credentials, first-class `AbortController` cancellation, `CredentialManager` backed by VS Code `SecretStorage` (`context.secrets`), real-time token streaming (`token.delta`, `token.complete`), and provider configuration switching (`jaggu.setApiKey`, `jaggu.selectProvider`, `jaggu.selectModel`).
- **Tests**: 7 test suites passed, 41/41 unit & integration tests passing (`npm test`).
- **Acceptance Criteria**: Normalized stream parsing, tool calling abstraction, capability querying, hardware cancellation, and zero-leak credential storage verified.
- **Record**: See [`docs/implementation/M2-model-gateway.md`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M2-model-gateway.md).

### M3: Repository Context & Code Intelligence *(COMPLETED - Sep 14, 2026)*
- **Goal**: Turn JAGGU into a repository-aware AI coding assistant that discovers, indexes, and retrieves bounded workspace context.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Implementation Details**: Multi-root workspace discovery, native `@vscode/ripgrep` search with in-memory fallback, lightweight `RepositoryMap` with incremental `markDirty` invalidation, `ContextEngine` deterministic ranking (recency, filename matching, symbol matching, ripgrep density), strict context budget enforcement (6 files, 32KB/file, 128KB total, 12k tokens max), full provenance metadata tracking, and active prompt-injection defense with XML boundaries.
- **Tests**: 10 test suites passed, 58/58 unit & integration tests passing (`npm test`).
- **Acceptance Criteria**: Grounded answers referencing actual workspace files with verified provenance.
- **Record**: See [`docs/implementation/M3-repository-context.md`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M3-repository-context.md).

### M4: Tool Execution, File Editing & Safe Workspace Mutation *(COMPLETED - Sep 14, 2026)*
- **Goal**: Implement provider-independent tool architecture, ToolExecutor, workspace security, shadow document staging, native VS Code diff review, explicit user approval flow, concurrent conflict detection, controlled test runner, and bounded agent loop.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Implementation Details**: Standardized `ITool` interface with Zod schema validation; `PermissionTier` (`SAFE`, `MUTATING`, `EXECUTION`); `read_file`, `search_code`, `list_directory`, `propose_edit`, `apply_edit`, `run_tests`; `ToolExecutor` with lifecycle event bus; `resolveAndValidateWorkspacePath` with null-byte, `../` traversal, and macOS symlink canonicalization; `jaggu-shadow://` virtual document staging; native `vscode.diff` review; approval card UI; base SHA-256 hash conflict detection on apply; controlled test runner policy blocking dangerous commands; bounded agent loop with 20 tool calls / 10 iterations limits and first-class cancellation.
- **Tests**: 11 test suites passed, 78/78 unit & integration tests passing (`npm test`).
- **Acceptance Criteria**: Full vertical slice verified ("Add input validation to this API endpoint" -> search -> read -> propose edit -> review diff -> approve -> apply -> run tests -> final summary).
- **Record**: See [`docs/implementation/M4-tool-execution.md`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M4-tool-execution.md).
- **Dependencies**: M0.
- **Rollback**: Disable native binary spawn.

### M5: Agent Planning, Multi-File Changes & Verification *(COMPLETED - Sep 14, 2026)*
- **Goal**: Make JAGGU behave like a serious software-engineering agent: grounded repository planning, explicit plan approval, atomic multi-file change sets (`EditSet`), native unified diff review, conflict detection, verification engine with targeted testing heuristics, bounded self-healing diagnosis/repair loop ($\le 3$ attempts), and transparent task progression.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Implementation Details**: Strict Zod `PlanSchema` and `PlanStepSchema`; `PlanValidator` with workspace containment, file existence/creation checks, and dependency DAG cycle detection; `PLAN_REVIEW` state with compact `PlanCard` in Webview; `EditSetManager` with SHA-256 base hashes, `jaggu-shadow://` multi-file staging, and atomic apply rollback; `VerificationEngine` with framework-aware test runners; self-healing diagnosis loop; 12-state `AgentFSM`; dedicated `AgentOrchestrator` decoupled from VS Code UI; typed lifecycle events (`plan.*`, `editset.*`, `verification.*`, `agent.*`).
- **Tests**: 15 test suites passed, 103/103 unit & integration tests passing (`npm test`).
- **Acceptance Criteria**: Full vertical slice verified: understand -> plan -> approve plan -> edit 2 files -> review diff -> approve edit set -> atomic apply -> run tests -> diagnosis -> repair -> pass -> final summary.
- **Record**: See [`docs/implementation/M5-agent-planning-and-verification.md`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M5-agent-planning-and-verification.md).
- **Dependencies**: M0, M1, M2, M3, M4.
- **Rollback**: Halt task or reject plan/editset.

### M6: Code Intelligence, Git Safety & Developer Feedback *(COMPLETED - Sep 14, 2026)*
- **Goal**: Add LSP-based compiler diagnostics, Git-aware task checkpoints with pre-existing user change preservation, selective/partial file approval, post-apply diagnostic repair loop, and suggested commit message generation.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Implementation Details**: Implemented abstract `IDiagnosticsProvider` and `VSCodeDiagnosticsProvider` (`vscode.languages.getDiagnostics`); post-apply diagnostic harvesting and bounded self-repair ($\le 3$ attempts); `GitCliService` with strict read-only query whitelist disallowing mutating verbs (`commit`, `push`, `reset`, `checkout`, `clean`, `rebase`, `stash`); `TaskCheckpointManager` capturing pre-existing user changes and generating Conventional Commit proposals; selective `EditSet` approval allowing file-level selection where rejected files are never written to disk; Webview `ApprovalCard` with interactive checkboxes and dynamic approval actions.
- **Tests**: 19 test suites passed, 117/117 unit & integration tests passing (`npm test`).
- **Acceptance Criteria**: Full M6 vertical slice verified ("Add authentication rate limiting and tests" -> understand -> plan -> approve plan -> Git checkpoint -> 3-file proposal -> reject 1 file -> apply approved files -> LSP diagnostic error -> diagnose -> repair -> pass -> test verification -> final Git summary -> suggested commit message).
- **Record**: See [`docs/implementation/M6-code-intelligence-git-safety.md`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M6-code-intelligence-git-safety.md).
- **Dependencies**: M0, M1, M2, M3, M4, M5.
- **Rollback**: Disable diagnostic collector or fallback to binary EditSet approval.

### M7: Native VS Code Diff Review & Virtual Document Staging
- **Goal**: Provide native side-by-side and inline diff review using VS Code's built-in diff editor.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`.
- **Steps**: Register `TextDocumentContentProvider` with `jaggu-shadow://` scheme; hook `vscode.diff`; implement `WorkspaceEdit` on approval.
- **Tests**: Unit tests confirm virtual document resolution; opening diff triggers native Monaco diff tab.
- **Acceptance Criteria**: User reviews staged edits in native diff editor; clicking "Accept" applies clean `WorkspaceEdit` with `Cmd+Z` undo support.
- **Dependencies**: M6.
- **Rollback**: Revert to single-file edit application.

### M8: Agent State Machine & Autonomous Planner
- **Goal**: Implement the deterministic FSM (`IDLE` -> `THINKING` -> `PLANNING` -> `APPROVAL` -> `EXECUTING` -> `VERIFYING`).
- **Affected Packages**: `packages/jaggu-core`.
- **Steps**: Build FSM transition coordinator; generate structured plan cards; enforce loop limits (max 20 steps).
- **Tests**: FSM transitions sequentially through mock plan; terminates cleanly on complete or cancel.
- **Acceptance Criteria**: Complex prompt generates an interactive step-by-step plan card in UI.
- **Dependencies**: M3, M6, M7.
- **Rollback**: Revert to single-turn prompt-response mode.

### M9: Background Command Runner & Test Execution Tool
- **Goal**: Enable JAGGU to execute test runners and build commands via Node `child_process.spawn()` with non-blocking stream capture.
- **Affected Packages**: `packages/jaggu-core`, `packages/jaggu-vscode`.
- **Steps**: Implement command runner with timeout (default 60s); capture stdout, stderr, and exit codes; pipe output to `Output -> JAGGU Task Trace`.
- **Tests**: Executes `node -e "console.log('test')"` and captures exit code 0; enforces timeout kill with `SIGTERM`/`SIGKILL`.
- **Acceptance Criteria**: Background test suite runs autonomously; exit code and failure trace captured cleanly for agent diagnosis.
- **Dependencies**: M8.
- **Rollback**: Disable command runner tool.

### M10: Three-Tier Permission & Safety System
- **Goal**: Implement human-in-the-loop approvals, command allowlist/denylist, and secret scrubbing.
- **Affected Packages**: `packages/jaggu-core/security`.
- **Steps**: Wire approval modal; implement regex command blocker; sanitize secrets before prompt dispatch.
- **Tests**: Destructive commands (`rm -rf`) are blocked; file deletions require manual confirmation modal.
- **Acceptance Criteria**: High-risk actions cannot execute without explicit developer authorization.
- **Dependencies**: M8, M9.
- **Rollback**: Default to manual confirmation on all actions.

### M11: Self-Healing Debugging Loop
- **Goal**: Enable the agent to run tests, parse failures, patch code, and iterate autonomously.
- **Affected Packages**: `packages/jaggu-core/agent`, `packages/jaggu-core/runtime`.
- **Steps**: Wire stack trace parser; implement diagnostic injection prompt; limit repair loop to 3 attempts.
- **Tests**: Failing unit test is autonomously diagnosed and fixed in under 2 iterations.
- **Acceptance Criteria**: Task completes with green test pass badge without developer manual editing.
- **Dependencies**: M9, M10.
- **Rollback**: Stop execution on first test failure.

### M12: Git Integration & Safety Checkpoints
- **Goal**: Automatic pre-task working tree snapshotting and assisted commit generation.
- **Affected Packages**: `packages/jaggu-core/git`.
- **Steps**: Connect to `vscode.git`; create temporary git stash snapshot; generate Conventional Commit text.
- **Tests**: "Revert All Agent Changes" restores working tree to pristine pre-task state.
- **Acceptance Criteria**: Developer can inspect git diff and commit with one click.
- **Dependencies**: M11.
- **Rollback**: Disable automatic snapshotting.

### M13: Scientific Evaluation & Benchmark Harness
- **Goal**: Implement `packages/jaggu-eval` with SWE-bench style automated evaluation tasks.
- **Affected Packages**: `packages/jaggu-eval`.
- **Steps**: Create 25 benchmark tasks; automate headless runner; generate scorecard report.
- **Tests**: Benchmark harness executes 5 test tasks and outputs valid `eval-report.json`.
- **Acceptance Criteria**: Task success rate and latency metrics tracked automatically.
- **Dependencies**: M11.
- **Rollback**: Run manual verification scripts.

### M14: Performance Optimization & Token Caching
- **Goal**: Optimize startup time, enable Anthropic prompt caching, and throttle stream rendering.
- **Affected Packages**: All packages.
- **Steps**: Implement micro-batch rendering (16ms); add `cache_control` tags; pool ripgrep workers.
- **Tests**: First-token latency drops below 800ms; UI maintains solid 60 FPS under heavy streaming.
- **Acceptance Criteria**: Profiling shows zero dropped frames during active code generation.
- **Dependencies**: M13.
- **Rollback**: Disable rendering throttle.

### M15: UX Polish & Inline Editor Integrations
- **Goal**: Implement floating prompt (`Cmd+K`), editor gutter status indicators, and keyboard shortcuts.
- **Affected Packages**: `packages/jaggu-vscode`, `packages/jaggu-ui`.
- **Steps**: Register Monaco inline editor actions; bind `Cmd+K` floating widget; refine animations.
- **Tests**: User selects code, presses `Cmd+K`, types prompt, and sees inline diff preview.
- **Acceptance Criteria**: Smooth, frictionless inline editing experience matching modern commercial tools.
- **Dependencies**: M14.
- **Rollback**: Fall back to sidebar-only interaction.

### M16: Production Hardening, Packaging & Distribution
- **Goal**: Finalize packaging, automated regression testing, telemetry, documentation, and `.vsix` build.
- **Affected Packages**: Root, CI/CD workflows.
- **Steps**: Configure `vsce package`; set up GitHub Actions CI; audit package dependencies and licenses.
- **Tests**: Clean `.vsix` installs and executes successfully on clean VS Code test environment.
- **Acceptance Criteria**: Production-ready `.vsix` artifact generated and verified.
- **Dependencies**: M0–M15.
- **Rollback**: Revert package version.
