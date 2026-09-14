# JAGGU — Architectural & Engineering Documentation Master Index

Welcome to the comprehensive product, architecture, security, and engineering documentation suite for **JAGGU**: an AI-native autonomous software engineering environment built on the Visual Studio Code foundation.

---

## Document Taxonomy & Navigation

### 01 Product & Strategy
- [01 — Product Vision & Core Philosophy](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/01-product-vision.md)
  *Mission, the "Act, Do Not Merely Chat" philosophy, and engineering tenets.*
- [02 — Product Requirements Document (PRD)](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/02-PRD.md)
  *Problem statement, target personas, 5 core use cases, MVP vs Non-MVP scope, and requirements.*
- [03 — Product Development Roadmap](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/03-roadmap.md)
  *Phased execution roadmap across Milestones Phase 0 through Phase 10.*
- [26 — Product Differentiation & Positioning](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/26-product-differentiation.md)
  *The 3 MVP pillars: Controllable Autonomy, Runtime Verification, and Provider Independence.*
- [27 — Competitive & Architectural Analysis](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/27-competitive-analysis.md)
  *Benchmark comparison against Cursor, Copilot, Windsurf, Claude Code, Cline, and Aider.*

### 02 User Experience & Interaction Flows
- [04 — User Flows & Interaction Lifecycles](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/04-user-flows.md)
  *End-to-end specifications for all 21 user workflows with sequence diagrams.*
- [05 — UI/UX Specification & Design System](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/05-ui-ux-spec.md)
  *VS Code surface integrations: Sidebar, Plan View, Diff Reviewer, and Terminal Cards.*

### 03 System Architecture & Subsystems
- [00 — VS Code Repository Analysis & Integration](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/00-repository-analysis.md)
  *Decomposition of VS Code layers, Dual-Ring architecture, and integration boundaries.*
- [06 — System Architecture & Component Design](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/06-system-architecture.md)
  *Multi-process topology, Extension Host IPC, and component responsibilities.*
- [14 — Internal API Contracts & IPC Protocols](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/14-api-contracts.md)
  *Typed TypeScript contracts between UI, Agent Orchestrator, Model Gateway, and Tools.*
- [15 — Event System & Lifecycle Event Bus](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/15-event-system.md)
  *Master catalog of 14 lifecycle events, payloads, and subsystem consumer mappings.*
- [30 — Architecture Validation & Source-Level Audit](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/30-architecture-validation.md)
  *Final source-level validation against VS Code, eliminating premature complexity and validating native APIs.*

### 04 AI Agent & Context Engine
- [07 — Autonomous Agent Architecture & State Machine](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/07-agent-architecture.md)
  *Deterministic FSM, transition rules, loop guard limits, and human approval gates.*
- [08 — Standardized Tool Specification](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/08-tool-specification.md)
  *Complete schemas for all 14 tools (read, write, search, terminal, git).*
- [10 — Context Engine & Retrieval Architecture](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/10-context-engine.md)
  *The 8-tier context priority hierarchy, sliding token budgets, and prompt assembly.*
- [11 — Code Indexing & Search Engine Analysis](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/11-code-indexing.md)
  *Hybrid Lexical + Structural retrieval strategy (Ripgrep + LSP vs Vector DB).*
- [12 — Model Gateway & Provider Abstraction](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/12-model-layer.md)
  *Polymorphic gateway supporting Anthropic, OpenAI, Google Gemini, and local Ollama.*
- [25 — Prompt Architecture & Loop Directives](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/25-prompt-architecture.md)
  *Multi-layer prompt engineering, system templates, and the 10 Cardinal Loop Rules.*

### 05 Security, Permissions & Governance
- [09 — Security, Permissions & Sandboxing Model](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/09-security-and-permissions.md)
  *Three-tier classification (Safe/Moderate/High-Risk), command allowlists, and secret protection.*
- [16 — Error Handling, Fault Recovery & Self-Healing](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/16-error-handling.md)
  *Recoverable vs fatal taxonomy, autonomous error diagnosis, and self-healing test loops.*
- [17 — Git Integration & Working Tree Safety](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/17-git-integration.md)
  *Safety checkpoints, working tree inspection, and assisted conventional commit synthesis.*
- [28 — License, Compliance & IP Review](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/28-license-and-compliance.md)
  *VS Code MIT licensing, Microsoft trademark constraints, and third-party compliance.*

### 06 Data & State Management
- [13 — Data Schema & State Management](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/13-data-schema.md)
  *Persistent vs ephemeral entities, TypeScript interfaces, and disk storage layout.*

### 07 Engineering Guidelines & Planning
- [21 — Performance Targets, Latency & Optimization](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/21-performance.md)
  *Latency budgets, the 60-FPS UI invariant, worker thread isolation, and stream batching.*
- [22 — Phased Implementation Plan (M0–M16)](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/22-implementation-plan.md)
  *Sequential roadmap breaking delivery into 17 rigorously verifiable milestones.*
- [23 — Granular Task Breakdown (TASK-001–030)](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/23-task-breakdown.md)
  *30 atomic, independently executable implementation tasks with acceptance criteria.*
- [24 — Engineering Guidelines & Coding Invariants](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/24-engineering-guidelines.md)
  *The 17 non-negotiable coding rules: strict TypeScript, minimal deps, clean architecture.*
- [29 — Definition of Done (DoD)](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/29-definition-of-done.md)
  *The 9 engineering quality gates required for every feature and milestone.*

### 08 Architecture Decision Records (ADRs)
- [ADR-001: Extension Architecture vs Wholesale Core Fork](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-001-extension-vs-core-modification.md)
- [ADR-002: Deterministic Finite State Machine vs Unconstrained Loop](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-002-agent-state-machine-architecture.md)
- [ADR-003: Multi-Tier Context Retrieval & Token Budgeting](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-003-context-retrieval-strategy.md)
- [ADR-004: Model Provider Abstraction Layer](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-004-model-provider-abstraction.md)
- [ADR-005: Tool Execution Architecture & Shadow Buffer Staging](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-005-tool-execution-architecture.md)
- [ADR-006: Three-Tier Safety & Permission Verification Model](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-006-permission-and-safety-model.md)
- [ADR-007: Persistence Architecture & Session Storage Strategy](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-007-persistence-strategy.md)
- [ADR-008: Code Indexing & Search Engine Strategy (Ripgrep+LSP vs Vector DB)](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/adr/ADR-008-code-indexing-strategy.md)

### 09 Testing & Scientific Evaluation
- [18 — Comprehensive Testing Strategy](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/18-test-strategy.md)
  *Four-tier testing pyramid: Unit, Integration, Headless E2E, and Benchmarks.*
- [19 — AI Agent Scientific Evaluation & Benchmarking](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/19-agent-evaluation.md)
  *Evaluation framework, Benchmark-25 dataset, and quantitative metrics (TSR, FAS, TPR).*
- [20 — Observability, Structured Logging & Telemetry](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/20-observability.md)
  *NDJSON audit schema, dedicated output channels, and regex secret sanitizer.*

### 10 Milestone Implementation Records
- [Milestone M0: Repository Architecture & Package Scaffolding](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M0-scaffolding.md)
- [Milestone M1: Basic JAGGU Extension Shell & Webview UI](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M1-extension-shell.md)
- [Milestone M2: JAGGU Multi-Provider Model Gateway](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M2-model-gateway.md)
- [Milestone M3: JAGGU Repository Context & Code Intelligence](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M3-repository-context.md)
- [Milestone M4: JAGGU Tool Execution, File Editing & Safe Workspace Mutation](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/docs/implementation/M4-tool-execution.md)
