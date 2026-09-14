# 02 — Product Requirements Document (PRD)

## 1. Document Overview
- **Product**: ForgeAI
- **Status**: Draft / Approved for Architecture Phase
- **Target Release**: MVP v0.1.0
- **Author**: Lead Product Architect & Staff Engineer

---

## 2. Problem Statement & Market Opportunity

Modern software engineering involves severe cognitive fragmentation. A typical engineering task requires context switching across at least six distinct domains:
1. **Repository Exploration**: Locating relevant files, symbols, and dependencies across tens of thousands of lines of code.
2. **Context Synthesis**: Understanding conventions, data schemas, and runtime configurations.
3. **Multi-File Authoring**: Making coordinated edits across routes, controllers, services, database models, and type definitions.
4. **Build & Test Iteration**: Switching to external terminals, running commands, reading cryptic stack traces, and fixing compilation errors.
5. **Git Version Control**: Staging hunks, inspecting diffs, resolving conflicts, and drafting commit messages.
6. **AI Translation Overhead**: Copy-pasting code snippets back and forth into web-based AI chat tools, losing project context and introducing hallucinations.

**ForgeAI unifies these fragmented loops directly inside the developer's core workspace.**

---

## 3. Target Users & Personas

### 3.1 Primary Personas
- **Full-Stack & Backend Engineers**: Building features across microservices, REST/GraphQL APIs, database models, and integration tests.
- **Frontend Engineers**: Modernizing UI components, managing application state, wiring APIs, and eliminating accessibility issues.
- **Startup Engineers & Solopreneurs**: Needing 10x engineering leverage to ship complete features and debug production issues rapidly.
- **Computer Science Students & Open Source Contributors**: Navigating large, unfamiliar codebases and needing guided codebase understanding.

### 3.2 Secondary Personas
- **DevOps & Infrastructure Engineers**: Writing Terraform, Dockerfiles, GitHub Actions workflows, and diagnosing CI/CD failures.
- **Data & AI/ML Engineers**: Writing Python data pipelines, pandas transformations, and model evaluation suites.

---

## 4. Core User Scenarios & Use Cases

### Use Case 1: Repository Onboarding & Architecture Exploration
- **Trigger**: Developer opens an unfamiliar 100k-LOC codebase and asks: *"How does the payment webhook verification and retry pipeline work?"*
- **Agent Behavior**:
  1. Executes lexical and AST search to locate webhook handler controllers, signature verifiers, and background queue workers.
  2. Synthesizes a structured architectural summary citing concrete file paths and line numbers (e.g., `src/webhooks/stripe.ts#L45-L82`).
  3. Generates a Mermaid sequence diagram illustrating the lifecycle of an incoming payload.

### Use Case 2: End-to-End Multi-File Feature Implementation
- **Trigger**: Developer instructs: *"Add rate limiting to all authenticated `/api/v1/projects` endpoints using Redis token bucket."*
- **Agent Behavior**:
  1. Inspects existing middleware architecture and Redis connection pools.
  2. Generates a phased implementation plan and prompts the developer for approval.
  3. Creates `src/middleware/rateLimiter.ts`, updates `src/routes/projects.ts`, and updates `tests/projects.test.ts`.
  4. Runs the project test runner in a pseudo-terminal to verify that legitimate requests pass and throttled requests return `429 Too Many Requests`.
  5. Presents a clean diff review interface.

### Use Case 3: Autonomous Diagnostic & Self-Healing Debugging Loop
- **Trigger**: Developer instructs: *"Run the test suite and fix all failing test cases."*
- **Agent Behavior**:
  1. Launches `npm test` or `pytest` via the terminal tool.
  2. Parses the resulting failure trace: `AssertionError: Expected 200 OK but received 403 Forbidden at tests/auth.test.ts:34`.
  3. Inspects `tests/auth.test.ts` and the associated authentication middleware.
  4. Discovers a missing authorization header in the test setup fixture.
  5. Modifies the fixture, re-runs the tests, confirms 100% pass rate, and summarizes the exact fix.

### Use Case 4: Safe Architectural Refactoring
- **Trigger**: Developer highlights a legacy monolithic class: *"Refactor this service to use dependency injection and extract database queries into a repository pattern."*
- **Agent Behavior**:
  1. Identifies all callers and consumers of the service across the workspace.
  2. Creates interface definitions and a decoupled repository layer.
  3. Updates constructors across all dependent services.
  4. Runs the typechecker (`tsc --noEmit`) and test suite to ensure zero behavioral regression.

### Use Case 5: Automated Test Generation with Edge Case Coverage
- **Trigger**: Developer selects an untested utility module: *"Write comprehensive unit tests for this pricing calculation engine."*
- **Agent Behavior**:
  1. Analyzes branch complexity, edge conditions, null handling, and currency rounding rules.
  2. Creates a dedicated test file matching repository naming conventions.
  3. Executes the test runner to verify all generated tests pass and do not contain false positives.

---

## 5. Scope: MVP vs Non-MVP Boundaries

### 5.1 MVP Scope (Must Have for v0.1.0)
1. **Interactive AI Sidebar**: Persistent chat panel embedded natively in VS Code layout.
2. **Context Engine**: Fast lexical ripgrep file/content search + AST symbol resolution.
3. **Tool Execution Runtime**: Read file, write file, create file, delete file, list directory, search symbols.
4. **Sandboxed Terminal Execution**: Controlled command runner for tests, linters, and compilers.
5. **Interactive Myers Diff Review**: Visual staging area allowing per-file and per-hunk Accept/Reject.
6. **Task Planner & State Machine**: Explicit step-by-step planning and real-time execution tracking.
7. **Autonomous Debugging Loop**: Run tests → read failure → modify code → re-run tests (max 3 iterations).
8. **Multi-Provider LLM Gateway**: Support for Anthropic Claude 3.5/3.7, OpenAI GPT-4o, Google Gemini 2.0, and local Ollama.
9. **Streaming Responses**: Real-time token streaming with tool-call boundary parsing.
10. **Three-Tier Permission System**: Safe (auto), Moderate (confirmable), High-Risk (explicit developer authorization).
11. **Instant Cancellation**: Immediate abort button terminating active LLM streams and subshell processes.
12. **Git Awareness**: Reading `git status` and `git diff` to provide context and prevent unstaged loss.
13. **Token & Budget Management**: Automatic prompt window trimming and sliding context budget.
14. **Structured Error Handling**: Graceful recovery from model timeouts, tool failures, and rate limits.

### 5.2 Explicit Non-MVP Scope (Post-v0.1.0)
- **Vector Database Pre-Indexing**: Heavy local embeddings and Pinecone/Milvus integrations (lexical + AST is strictly sufficient and faster for MVP).
- **Multi-Agent Swarm Delegations**: Complex multi-agent consensus networks (single state-machine agent is cleaner, faster, and more deterministic).
- **Direct Remote Cloud Sandbox Deployment**: Spin-up of remote AWS/GCP execution containers.
- **Direct GitHub PR Creation / Merge**: Automated Git push or PR creation without human intervention.
- **Proprietary VS Code Forking**: Deep core workbench forks prior to proving the Ring 0 Extension architecture.

---

## 6. Functional Requirements

| ID | Module | Requirement Description | Priority |
|---|---|---|---|
| **FR-01** | UI | Dedicated ForgeAI Activity Bar icon and primary Sidebar panel. | P0 |
| **FR-02** | UI | Chat interface supporting markdown rendering, code fences with syntax highlighting, and copy buttons. | P0 |
| **FR-03** | UI | Interactive Plan View displaying checklist of tasks with real-time status indicators. | P0 |
| **FR-04** | UI | Side-by-side and inline visual Diff Review viewer before writing changes to disk. | P0 |
| **FR-05** | Context | File and content retrieval using embedded ripgrep executable. | P0 |
| **FR-06** | Context | Active editor context capture (cursor position, highlighted text, open tabs). | P0 |
| **FR-07** | Context | VS Code Language Server Protocol integration for workspace symbol definitions. | P0 |
| **FR-08** | Tools | Standardized tool execution: `read_file`, `write_file`, `list_dir`, `search_code`, `run_command`. | P0 |
| **FR-09** | Tools | Command execution via pseudo-terminal with real-time stdout/stderr capture and exit code extraction. | P0 |
| **FR-10** | Agent | Deterministic finite state machine: `IDLE` -> `UNDERSTAND` -> `PLAN` -> `APPROVAL` -> `EXECUTE` -> `VERIFY` -> `DONE`. | P0 |
| **FR-11** | Safety | Human approval dialogue triggered for moderate and high-risk operations. | P0 |
| **FR-12** | Safety | Hard abort mechanism instantly terminating child processes and cancelling active HTTP streams. | P0 |
| **FR-13** | Model | Unified model gateway supporting Anthropic, OpenAI, Gemini, and Ollama APIs. | P0 |
| **FR-14** | Storage | Local encrypted storage of API keys using VS Code's `SecretStorage` API. | P0 |

---

## 7. Non-Functional Requirements

- **UI Responsiveness**: The main VS Code UI thread must never experience blocking or dropped frames (>60 FPS maintained during indexing or streaming).
- **Latency**: First-token streaming latency must not exceed 800ms on broadband connections.
- **Resource Footprint**: ForgeAI background idle memory consumption must stay below 120MB RSS.
- **Data Privacy**: No workspace source code or metadata is sent to any external server other than the user's explicitly configured LLM provider.
- **Zero Data Loss**: Every file modification must support immediate undo and state restoration.
