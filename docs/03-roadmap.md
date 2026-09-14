# 03 — Product Roadmap (Phases 0 through 10)

## 1. Roadmap Architecture Overview

The development of ForgeAI follows an incremental, risk-mitigated **Vertical Slice Progression**. Rather than attempting to patch the complex C++/TypeScript core of VS Code up front, ForgeAI delivers an autonomous, production-ready engineering agent within the official VS Code Extension Architecture (Ring 0) before progressively evaluating selective workbench core integrations (Ring 1).

```
[Phase 0] Architecture & Repo Analysis (Current)
    │
[Phase 1] AI Chat Foundation & Streaming Gateway
    │
[Phase 2] Repository Intelligence (Ripgrep & Context Engine)
    │
[Phase 3] Code Editing & Interactive Diff Engine
    │
[Phase 4] Agent Execution & Tool Runtime
    │
[Phase 5] Autonomous Testing & Self-Healing Loop
    │
[Phase 6] Git Integration & Working Tree Safety
    │
[Phase 7] Security, Permissions & Sandboxing
    │
[Phase 8] Performance Optimization & Token Economy
    │
[Phase 9] UX Polish & Editor Integrations
    │
[Phase 10] Production Readiness & Packaging
```

---

## 2. Phase-by-Phase Specification

### Phase 0: Repository Analysis & Architecture Foundation
- **Objective**: Establish the technical architecture, boundary conditions, repository analysis, design documents, and ADRs.
- **Features**: Complete documentation package (`docs/00` to `docs/29`), ADRs 001–008, toolchain verification.
- **Dependencies**: None.
- **Deliverables**: All 30 specification documents and ADR records in `/docs`.
- **Acceptance Criteria**: All documents validated, zero technical ambiguity, explicit MVP scope approved by user.
- **Risks**: Over-engineering or assuming core modifications without proving extension viability.

### Phase 1: AI Chat Foundation & Model Gateway
- **Objective**: Implement a rock-solid streaming chat interface and unified multi-provider LLM gateway.
- **Features**: Dedicated ForgeAI Activity Bar icon, Webview chat sidebar, provider abstraction (Anthropic, OpenAI, Gemini, Ollama), SSE streaming parser, token counting, cancel stream.
- **Dependencies**: Phase 0.
- **Deliverables**: `packages/forgeai-models`, `packages/forgeai-ui`, initial `packages/forgeai-vscode` shell.
- **Acceptance Criteria**: User can send a prompt to any configured provider and see real-time markdown token streaming in the sidebar with <800ms time-to-first-token.
- **Risks**: API rate limits and provider breaking changes.

### Phase 2: Repository Intelligence & Context Retrieval
- **Objective**: Empower the agent to rapidly locate relevant code across the workspace without loading entire codebases into memory.
- **Features**: Embedded ripgrep integration, fuzzy filename search, VS Code LSP symbol lookup (`vscode.executeWorkspaceSymbolProvider`), active editor context extractor, token budget trimmer.
- **Dependencies**: Phase 1.
- **Deliverables**: `packages/forgeai-context`.
- **Acceptance Criteria**: Agent locates target functions or definitions across a 50,000-LOC repo in under 300ms and constructs a focused context payload (<8k tokens).
- **Risks**: Excessive context consumption leading to LLM truncation.

### Phase 3: Code Editing & Interactive Diff Engine
- **Objective**: Enable the agent to formulate surgical file edits and present non-destructive Myers diffs to the user.
- **Features**: In-memory shadow file staging, line-level diff calculation, visual side-by-side and inline diff preview, per-hunk "Accept / Reject", transactional disk commit.
- **Dependencies**: Phase 2.
- **Deliverables**: `packages/forgeai-core/diff`, VS Code Diff Viewer webview.
- **Acceptance Criteria**: Agent generates a 3-file patch; user inspects changes in visual diff view and accepts or rejects specific changes before any disk write.
- **Risks**: Patch application drift if the user simultaneously edits files manually.

### Phase 4: Agent Execution & Tool Runtime
- **Objective**: Wire the deterministic agent state machine and standardized tool execution engine.
- **Features**: Finite state machine (`IDLE` -> `UNDERSTAND` -> `PLAN` -> `APPROVAL` -> `EXECUTE` -> `VERIFY`), tool schemas (`read_file`, `write_file`, `create_file`, `list_dir`, `search_code`), structured reasoning loop.
- **Dependencies**: Phase 3.
- **Deliverables**: `packages/forgeai-core/agent`, `packages/forgeai-core/tools`.
- **Acceptance Criteria**: Agent autonomously breaks a prompt into a 4-step plan, executes file reads, synthesizes changes, and reports progress at each transition.
- **Risks**: Model entering infinite tool-call loops (mitigated by hard loop counters and cycle detectors).

### Phase 5: Autonomous Testing & Self-Healing Loop
- **Objective**: Enable ForgeAI to execute test runners in pseudo-terminals, parse errors, and heal its own mistakes.
- **Features**: Node PTY / Pseudoterminal runner, exit code capture, stack trace and compiler diagnostic parser (`vscode.languages.getDiagnostics`), diagnostic injection prompt, max-retry self-healing loop.
- **Dependencies**: Phase 4.
- **Deliverables**: `packages/forgeai-core/runtime`, Terminal Tool integration.
- **Acceptance Criteria**: Agent writes a deliberately failing unit test, detects failure, modifies code to fix the assertion, re-runs tests, and succeeds within 2 iterations.
- **Risks**: Hanging tests or infinite loops in user scripts (mitigated by hard execution timeouts).

### Phase 6: Git Integration & Working Tree Safety
- **Objective**: Protect user code from accidental corruption through automated snapshotting and Git awareness.
- **Features**: `git status` / `git diff` query tool, automatic pre-task temporary stash/snapshot, rollback command, semantic commit message generator.
- **Dependencies**: Phase 5.
- **Deliverables**: `packages/forgeai-core/git`.
- **Acceptance Criteria**: Agent creates an automatic checkpoint before multi-file edits; user can hit "Revert All Agent Changes" to restore exact initial working tree.
- **Risks**: Dirty git workspaces with untracked merge conflicts.

### Phase 7: Security, Permissions & Sandboxing
- **Objective**: Establish strict enterprise-grade execution boundaries and human-in-the-loop controls.
- **Features**: Three-tier permission classifier (Safe, Moderate, High-Risk), explicit approval modals, command allowlist/denylist, API key encryption via VS Code `SecretStorage`, secret leak scrubber.
- **Dependencies**: Phase 6.
- **Deliverables**: `packages/forgeai-core/security`.
- **Acceptance Criteria**: Commands such as `rm -rf`, `curl | bash`, or destructive git commands are blocked or require explicit double confirmation.
- **Risks**: Command injection via shell metacharacters (mitigated by strict argument array spawning).

### Phase 8: Performance Optimization & Token Economy
- **Objective**: Optimize execution speed, reduce model latency, and minimize token costs.
- **Features**: Context caching (Anthropic Prompt Caching), AST-based symbol pruning, lazy tool schema loading, sub-process pooling for ripgrep.
- **Dependencies**: Phase 7.
- **Deliverables**: Performance benchmarks and telemetry hooks.
- **Acceptance Criteria**: First-token latency reduced by 40%; average prompt token consumption decreased by 35% on multi-step tasks.
- **Risks**: Cache invalidation bugs causing stale context retrieval.

### Phase 9: UX Polish & Deep Editor Integrations
- **Objective**: Deliver a seamless, delightful developer experience rivaling commercial proprietary editors.
- **Features**: Floating inline prompt widget (Ctrl/Cmd+K), editor gutter agent indicators, quick action code lenses ("Explain", "Fix with ForgeAI"), keyboard shortcut mastery.
- **Dependencies**: Phase 8.
- **Deliverables**: `packages/forgeai-vscode/editor-decorations`.
- **Acceptance Criteria**: Developer triggers inline code refactor via `Cmd+K` directly on an editor line without opening the sidebar.
- **Risks**: Clashing with native VS Code keybindings.

### Phase 10: Production Readiness & Packaging
- **Objective**: Finalize packaging, automated regression testing, telemetry, documentation, and distribution.
- **Features**: VS Code `.vsix` packaging, CI/CD automated test pipeline, offline evaluation benchmark suite, user onboarding guide.
- **Dependencies**: Phase 9.
- **Deliverables**: Production `.vsix` release build and evaluation dashboard.
- **Acceptance Criteria**: Clean `.vsix` install on pristine VS Code instance; passes 100% of integration benchmarks.
- **Risks**: Cross-platform OS discrepancies (Windows PowerShell vs macOS/Linux zsh).
