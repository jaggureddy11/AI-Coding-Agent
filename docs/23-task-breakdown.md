# 23 — Granular Task Breakdown (TASK-001 to TASK-030)

## 1. Task Management Principles

Every task defined below is **atomic, independently implementable, and independently verifiable**. No task shall be marked complete without accompanying automated tests and validated acceptance criteria.

---

## 2. Granular Task Catalog

### TASK-001: Monorepo Workspace & Build Toolchain Setup
- **Objective**: Scaffold the root repository with pnpm/npm workspaces and unified TypeScript build configs.
- **Prerequisites**: Node.js v20+, npm/pnpm.
- **Files**: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`.
- **Implementation**: Set up workspaces for `packages/jaggu-core`, `packages/jaggu-models`, `packages/jaggu-context`, `packages/jaggu-ui`, `packages/jaggu-vscode`, `packages/jaggu-eval`.
- **Tests**: Run `npm run build` across all packages.
- **Acceptance Criteria**: All packages compile with `tsc --noEmit` with zero errors.

### TASK-002: Base Types & Event Bus Implementation
- **Objective**: Implement shared agent primitives, state enums, and typed event emitter.
- **Prerequisites**: TASK-001.
- **Files**: `packages/jaggu-core/src/types/index.ts`, `packages/jaggu-core/src/events/eventBus.ts`.
- **Implementation**: Port `AgentState`, `JagguEvents`, `ITool`, and `EventEmitter` class.
- **Tests**: Unit test event subscription, dispatch, and unsubscription.
- **Acceptance Criteria**: 100% test pass on event bus dispatch.

### TASK-003: Model Gateway Interface & Types *(COMPLETED - M2)*
- **Objective**: Define polymorphic `IModelProvider`, chunk stream types, capability interfaces, and error hierarchies.
- **Prerequisites**: TASK-001.
- **Files**: `packages/jaggu-core/src/types/models.ts`, `packages/jaggu-core/src/models/gateway.ts`.
- **Implementation**: Defined `streamChat`, `ModelMessage`, `ModelToolDefinition`, `ModelCapabilities`, `ModelStreamChunk`, and `ModelError`.
- **Tests**: Comprehensive unit tests validating capabilities and interface contracts.
- **Acceptance Criteria**: Clean TypeScript compilation with strict types.

### TASK-004: Anthropic Claude Provider Implementation *(COMPLETED - M2)*
- **Objective**: Build production Anthropic provider supporting Claude 3.5 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus with streaming.
- **Prerequisites**: TASK-003.
- **Files**: `packages/jaggu-core/src/models/anthropic.ts`.
- **Implementation**: Implemented native `fetch` SSE stream parser (`message_start`, `content_block_delta`, `message_delta`), system prompt extraction, and usage accounting.
- **Tests**: Mock server replay test streaming text deltas and error handling.
- **Acceptance Criteria**: Emits `token` and `usage` chunks matching schema.

### TASK-005: OpenAI & Gemini Provider Implementations *(COMPLETED - M2)*
- **Objective**: Build OpenAI (GPT-4o, o1, o3-mini) and Gemini (2.0 Flash, 1.5 Pro) provider adapters.
- **Prerequisites**: TASK-003.
- **Files**: `packages/jaggu-core/src/models/openai.ts`, `packages/jaggu-core/src/models/gemini.ts`.
- **Implementation**: Native fetch with SSE parsing, parallel tool-call aggregation, and token usage accounting.
- **Tests**: Unit tests with recorded and simulated stream payloads.
- **Acceptance Criteria**: Both providers stream chunks into common `ModelStreamChunk` format.

### TASK-006: Local Ollama Provider Implementation *(COMPLETED - M2)*
- **Objective**: Build privacy-first offline provider connecting to local Ollama daemon.
- **Prerequisites**: TASK-003.
- **Files**: `packages/jaggu-core/src/models/ollama.ts`.
- **Implementation**: Stream from `http://localhost:11434/api/chat` with NDJSON parsing and fail-fast network classification.
- **Tests**: Unit test with simulated Ollama NDJSON streaming output and local connection failure classification.
- **Acceptance Criteria**: Works with zero external internet connectivity.

### TASK-007: Ripgrep Search Service
- **Objective**: Build high-performance file and content search using bundled ripgrep binary.
- **Prerequisites**: TASK-001.
- **Files**: `packages/jaggu-context/src/ripgrep.ts`.
- **Implementation**: Wrap `@vscode/ripgrep` binary spawn with regex query, glob filters, and path normalization.
- **Tests**: Search mock directory for keyword; verify line numbers and file paths.
- **Acceptance Criteria**: Sub-50ms execution on 1,000 files; respects `.gitignore`.

### TASK-008: VS Code Language Server Protocol (LSP) Bridge
- **Objective**: Connect to VS Code language features for symbol declaration and reference lookup.
- **Prerequisites**: TASK-001.
- **Files**: `packages/jaggu-context/src/lspBridge.ts`.
- **Implementation**: Wrap `vscode.executeWorkspaceSymbolProvider` and `executeDefinitionProvider`.
- **Tests**: Stub VS Code command execution; verify structured symbol mapping.
- **Acceptance Criteria**: Returns function and class locations with line ranges.

### TASK-009: Multi-Tier Context Priority & Token Budgeter
- **Objective**: Assemble ranked context payload within strict token budget limit.
- **Prerequisites**: TASK-007, TASK-008.
- **Files**: `packages/jaggu-context/src/assembler.ts`, `packages/jaggu-context/src/ranker.ts`.
- **Implementation**: Implement 8-tier priority ranking, middle-file compaction, and token estimator.
- **Tests**: Input 25,000 tokens of candidates; assert output is exactly $\le 12,000$ tokens with Tier 1/2 preserved.
- **Acceptance Criteria**: Deterministic token budget adherence.

### TASK-010: Standardized File System Tools (`read_file`, `list_dir`)
- **Objective**: Implement read-only file exploration tools with Zod schema validation.
- **Prerequisites**: TASK-002.
- **Files**: `packages/jaggu-core/src/tools/readFile.ts`, `packages/jaggu-core/src/tools/listDir.ts`.
- **Implementation**: Enforce workspace boundary checks; support line-range slicing; reject binary files.
- **Tests**: Unit test reading line ranges; assert path traversal attempt throws `SECURITY_ERROR`.
- **Acceptance Criteria**: Clean file reading with path sanitization.

### TASK-011: Mutating File Tools & Shadow Buffer (`write_file`, `create_file`, `delete_file`)
- **Objective**: Implement file mutation tools staging into an in-memory virtual buffer.
- **Prerequisites**: TASK-010.
- **Files**: `packages/jaggu-core/src/tools/writeFile.ts`, `packages/jaggu-core/src/diff/shadowBuffer.ts`.
- **Implementation**: Staged file buffers hold original vs proposed content before disk flush.
- **Tests**: Write file in shadow buffer; assert disk file remains unchanged until explicit commit.
- **Acceptance Criteria**: Non-destructive staged file mutations.

### TASK-012: Virtual Document Content Provider (`jaggu-shadow://`)
- **Objective**: Implement `vscode.workspace.registerTextDocumentContentProvider` for the `jaggu-shadow://` URI scheme.
- **Prerequisites**: TASK-011.
- **Files**: `packages/jaggu-vscode/src/shadowDocProvider.ts`.
- **Implementation**: Serve in-memory proposed file contents to VS Code's virtual document system.
- **Tests**: Request virtual URI; assert returned string matches in-memory staged buffer.
- **Acceptance Criteria**: Seamless integration with VS Code's document reader.

### TASK-013: Native VS Code Diff Review & WorkspaceEdit Applier
- **Objective**: Open native VS Code diff editor and apply approved edits via `vscode.WorkspaceEdit`.
- **Prerequisites**: TASK-012.
- **Files**: `packages/jaggu-vscode/src/diffReviewer.ts`.
- **Implementation**: Call `vscode.commands.executeCommand('vscode.diff', diskUri, shadowUri)`; apply `WorkspaceEdit` on approval.
- **Tests**: Open diff tab; approve change; assert disk file updates and undo history works with `Cmd+Z`.
- **Acceptance Criteria**: Flawless, non-destructive diff review using Monaco's native diff editor.

### TASK-014: Agent State Machine (FSM) Implementation
- **Objective**: Build the core Finite State Machine with transition guards and event triggers.
- **Prerequisites**: TASK-002, TASK-003, TASK-010.
- **Files**: `packages/jaggu-core/src/agent/stateMachine.ts`.
- **Implementation**: Implement states `IDLE` through `COMPLETED`/`FAILED`; wire event bus emissions.
- **Tests**: Step through FSM transitions programmatically; assert illegal transitions throw error.
- **Acceptance Criteria**: Clean state transitions with full observability.

### TASK-015: Task Planner & Milestone Breakdown Engine
- **Objective**: Implement structured planning logic that decomposes prompts into actionable steps.
- **Prerequisites**: TASK-014.
- **Files**: `packages/jaggu-core/src/agent/planner.ts`.
- **Implementation**: Generate `Plan` entity containing ordered `PlanStep` items with target files.
- **Tests**: Verify plan parser generates structured steps from LLM JSON response.
- **Acceptance Criteria**: Plan cards render with status checkboxes.

### TASK-016: Background Command Runner & Stream Manager
- **Objective**: Implement command runner via Node `child_process.spawn()` with non-blocking stdout/stderr stream capture.
- **Prerequisites**: TASK-002.
- **Files**: `packages/jaggu-core/src/tools/runCommand.ts`, `packages/jaggu-core/src/runtime/processManager.ts`.
- **Implementation**: Stream stdout/stderr; capture exit codes; pipe output to OutputChannel; enforce 60s timeout with `SIGKILL`.
- **Tests**: Run `node -e "console.log('hello')"`; assert stdout contains 'hello' and exitCode is 0.
- **Acceptance Criteria**: Asynchronous non-blocking command execution with deterministic exit code capture.

### TASK-017: Three-Tier Permission Gate
- **Objective**: Intercept tool calls and enforce Safe, Moderate, and High-Risk approval policies.
- **Prerequisites**: TASK-010, TASK-016.
- **Files**: `packages/jaggu-core/src/security/permissionGate.ts`.
- **Implementation**: Match commands against allowlist/denylist; trigger approval events for high risk.
- **Tests**: Assert `rm -rf /` is immediately blocked; assert `delete_file` pauses for user approval.
- **Acceptance Criteria**: Zero unapproved high-risk executions.

### TASK-018: Secret Sanitization Engine
- **Objective**: Prevent API keys and private credentials from entering prompts or log files.
- **Prerequisites**: TASK-002.
- **Files**: `packages/jaggu-core/src/security/sanitizer.ts`.
- **Implementation**: Regex replacement for AWS, GitHub, OpenAI, and private RSA keys.
- **Tests**: Pass string with simulated API key; assert output replaces key with `[REDACTED_SECRET]`.
- **Acceptance Criteria**: 100% pattern redaction across all logs and outbound model payloads.

### TASK-019: Self-Healing Diagnostic & Test Loop
- **Objective**: Implement autonomous error detection, trace parsing, and corrective patch generation.
- **Prerequisites**: TASK-014, TASK-016.
- **Files**: `packages/jaggu-core/src/agent/selfHealer.ts`.
- **Implementation**: Parse test failure output; inject diagnostic prompt into LLM loop; limit to 3 retries.
- **Tests**: Simulate test failure; verify agent dispatches corrective patch and re-runs test.
- **Acceptance Criteria**: Autonomous error recovery within retry budget.

### TASK-020: Git Context & Safety Snapshot Checkpointer
- **Objective**: Inspect working tree state and create pre-task safety snapshots.
- **Prerequisites**: TASK-002.
- **Files**: `packages/jaggu-core/src/git/gitManager.ts`.
- **Implementation**: Query `git status` / `git diff`; create temporary snapshot stash; support rollback.
- **Tests**: Create mock git repo; stage file; create checkpoint; modify file; rollback; verify pristine state.
- **Acceptance Criteria**: Reliable 1-click working tree rollback.

### TASK-021: Conventional Commit Message Generator
- **Objective**: Analyze unified diff of completed task and generate semantic commit message.
- **Prerequisites**: TASK-020.
- **Files**: `packages/jaggu-core/src/git/commitGenerator.ts`.
- **Implementation**: Prompt model with diff summary; format Conventional Commit (`feat(...)`, `fix(...)`).
- **Tests**: Pass 3-file diff; verify generated message conforms to Conventional Commits format.
- **Acceptance Criteria**: Clean, descriptive commit message generation.

### TASK-022: VS Code Extension Host Shell Setup *(COMPLETED - M1)*
- **Objective**: Implement the VS Code extension entry point and register view containers.
- **Prerequisites**: TASK-001.
- **Files**: `packages/jaggu-vscode/src/extension.ts`, `packages/jaggu-vscode/package.json`.
- **Implementation**: Registered `jaggu-activity-bar` container, `jaggu.sidebarView`, `jaggu.openChat`, and status bar item.
- **Tests**: Automated extension host lifecycle tests passing in `packages/jaggu-vscode/test/extension.test.ts`.
- **Acceptance Criteria**: Extension activates cleanly; providers and status bar item registered.

### TASK-023: Webview Sidebar Implementation (React 18) *(COMPLETED - M1)*
- **Objective**: Build modern, responsive Webview UI with conversation stream and task state.
- **Prerequisites**: TASK-022.
- **Files**: `packages/jaggu-ui/src/App.tsx`, `packages/jaggu-ui/src/components/StatusPill.tsx`, `packages/jaggu-vscode/media/webview.js`.
- **Implementation**: Built React 18 UI with conversational thread, empty state, suggestion prompts, status pill, and cancel/clear controls bundled via `esbuild`.
- **Tests**: React DOM and rendering unit tests in `packages/jaggu-ui/test/ui.test.tsx`.
- **Acceptance Criteria**: Native VS Code look-and-feel using CSS variables; responsive across dark, light, and high contrast themes.

### TASK-024: Webview RPC Protocol Bridge *(COMPLETED - M1)*
- **Objective**: Establish bidirectional typed RPC between Webview and Extension Host.
- **Prerequisites**: TASK-023.
- **Files**: `packages/jaggu-vscode/src/sidebarProvider.ts`, `packages/jaggu-ui/src/types/rpc.ts`.
- **Implementation**: Implemented `postMessage` protocol with runtime schema guards (`isValidWebviewMessage`, `isValidExtensionMessage`), deterministic mock agent response pipeline, and cancel handler.
- **Tests**: Automated end-to-end integration tests in `packages/jaggu-vscode/test/integration.test.ts` and schema validation in `packages/jaggu-ui/test/rpc.test.ts`.
- **Acceptance Criteria**: Typed bi-directional messaging verified; sub-millisecond dispatch.

### TASK-025: Visual Diff Reviewer Webview Component
- **Objective**: Build the interactive visual diff review card in the sidebar and Monaco diff integration.
- **Prerequisites**: TASK-013, TASK-023.
- **Files**: `packages/jaggu-ui/src/components/DiffReview.tsx`.
- **Implementation**: Display list of changed files; render additions/deletions; wire Accept/Reject buttons.
- **Tests**: Click "Accept All"; verify message dispatched over RPC.
- **Acceptance Criteria**: Intuitive, high-density diff review experience.

### TASK-026: Terminal Execution Card Component
- **Objective**: Render real-time terminal output cards in the chat stream.
- **Prerequisites**: TASK-016, TASK-023.
- **Files**: `packages/jaggu-ui/src/components/TerminalCard.tsx`.
- **Implementation**: Stream output lines; show running spinner; display exit code badge.
- **Tests**: Simulate 100 lines of terminal output; verify smooth scrolling and zero lag.
- **Acceptance Criteria**: Clear, readable command execution cards.

### TASK-027: Approval Modal & Permission Prompt Component
- **Objective**: Render non-dismissible approval cards for Moderate and High-Risk actions.
- **Prerequisites**: TASK-017, TASK-023.
- **Files**: `packages/jaggu-ui/src/components/ApprovalCard.tsx`.
- **Implementation**: Render amber/red action card with details and `[Authorize]` / `[Reject]` buttons.
- **Tests**: Trigger approval request; verify execution halts until user clicks button.
- **Acceptance Criteria**: Unambiguous, safe human-in-the-loop control.

### TASK-028: Floating Inline Prompt Widget (Cmd+K)
- **Objective**: Implement floating inline prompt widget anchored directly over active Monaco editor line.
- **Prerequisites**: TASK-022.
- **Files**: `packages/jaggu-vscode/src/inlinePrompt.ts`.
- **Implementation**: Register `Cmd+K` keybinding; render custom editor overlay input bar.
- **Tests**: Press `Cmd+K` on selected lines; verify input opens with selection pre-attached.
- **Acceptance Criteria**: Frictionless inline prompt triggering.

### TASK-029: Offline Evaluation Benchmark Runner
- **Objective**: Build the automated evaluation CLI harness (`packages/jaggu-eval`).
- **Prerequisites**: TASK-014, TASK-019.
- **Files**: `packages/jaggu-eval/src/runner.ts`, `packages/jaggu-eval/src/scorecard.ts`.
- **Implementation**: Execute 25 benchmark tasks against mock or real LLM; output `eval-report.json`.
- **Tests**: Run evaluation on 3 mock tasks; verify valid scorecard output.
- **Acceptance Criteria**: Scientific benchmarking operational.

### TASK-030: Packaging, CI/CD Pipeline & Documentation
- **Objective**: Configure `.vsix` build scripts, GitHub Actions automated test matrix, and user manual.
- **Prerequisites**: TASK-001 through TASK-029.
- **Files**: `.github/workflows/ci.yml`, `README.md`, `packages/jaggu-vscode/package.json`.
- **Implementation**: Automated lint, test, build, and `vsce package` workflow.
- **Tests**: CI passes 100% on macOS, Linux, and Windows runners.
- **Acceptance Criteria**: Distributable `.vsix` bundle created and verified.
