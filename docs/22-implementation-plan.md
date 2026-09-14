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

### M3: Streaming AI Chat Experience
- **Goal**: Connect Webview UI to Model Gateway via Webview RPC for interactive conversation.
- **Affected Packages**: `packages/jaggu-ui`, `packages/jaggu-vscode`.
- **Steps**: Implement markdown message rendering, code syntax highlighting, copy-to-clipboard, cancel button.
- **Tests**: Send prompt -> stream tokens -> hit cancel -> verify socket disconnects.
- **Acceptance Criteria**: Real-time token streaming rendered with zero UI lag (<16ms frame render).
- **Dependencies**: M1, M2.
- **Rollback**: Disconnect RPC message handler.

### M4: Fast Ripgrep Repository Search
- **Goal**: Embed native ripgrep binary and implement file and content search services.
- **Affected Packages**: `packages/jaggu-context`.
- **Steps**: Integrate `@vscode/ripgrep`; build async regex search worker with `.gitignore` filtering.
- **Tests**: Benchmark search across 20,000 files completes in <50ms.
- **Acceptance Criteria**: Returns structured JSON matches with line numbers and file paths.
- **Dependencies**: M0.
- **Rollback**: Disable native binary spawn.

### M5: Context Engine & Token Budgeter
- **Goal**: Implement multi-tier priority ranking and token compaction for prompt assembly.
- **Affected Packages**: `packages/jaggu-context`.
- **Steps**: Integrate active editor harvesting, LSP symbol lookup, and sliding-window token trimmer.
- **Tests**: Context budget enforcer guarantees payload stays under 12,000 tokens.
- **Acceptance Criteria**: Prompt payload includes active file, selection, and top 5 relevant symbols.
- **Dependencies**: M4.
- **Rollback**: Revert to raw active file context.

### M6: File Operation Tools
- **Goal**: Implement `read_file`, `write_file`, `create_file`, `delete_file`, `list_directory`.
- **Affected Packages**: `packages/jaggu-core/tools`.
- **Steps**: Build Zod runtime schemas; implement directory traversal protection; wire in-memory shadow buffer.
- **Tests**: Unit tests verify malicious paths (`../../etc/passwd`) are blocked with security errors.
- **Acceptance Criteria**: Agent safely reads and stages file modifications in memory.
- **Dependencies**: M0.
- **Rollback**: Unregister tool schemas.

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
