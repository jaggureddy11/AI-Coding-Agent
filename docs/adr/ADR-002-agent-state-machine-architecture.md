# ADR-002: Deterministic Finite State Machine vs Unconstrained Autonomous Loop

## Status
Accepted

## Context
Autonomous agents can be architected either as:
1. **Unconstrained ReAct / LangChain Loops**: The model is prompted with tools and recursively invokes tools until it unilaterally decides to stop or reaches an error.
2. **Deterministic Finite State Machine (FSM)**: Work is partitioned into explicit cognitive phases (`UNDERSTAND` -> `PLAN` -> `APPROVAL` -> `EXECUTE` -> `EVALUATE` -> `DIAGNOSE` -> `COMPLETE`) with hard transition rules and loop limits.

## Decision
ForgeAI implements a **Deterministic Finite State Machine (FSM)** with explicit loop termination counters and mandatory human-in-the-loop approval gates for mutating operations.

## Alternatives Considered
- **Unconstrained Autonomous Loop**:
  - *Why Rejected*: Unconstrained loops frequently fall into circular reasoning patterns (e.g. repeatedly editing the wrong file or re-running a broken command), burning user tokens, generating massive latency, and risking uncontrolled codebase corruption.
- **Multi-Agent Consensus Swarm (e.g. ChatDev style)**:
  - *Why Rejected*: Spawning multiple debate agents (Coder, Reviewer, Architect) introduces high token overhead (3x–5x cost), slow response times, and nondeterministic behavior unsuitable for real-time developer workflows.

## Reasoning
1. **Predictability**: Developers always know what the agent is doing (planning vs editing vs verifying).
2. **Control**: The user reviews and approves structured plans before any file modification begins.
3. **Safety**: Hard loop counters (max 20 iterations, max 3 repair attempts) guarantee that an agent cannot enter an infinite loop.

## Consequences
- **Positive**: High reliability; observable UX; rock-solid error recovery; budget control.
- **Negative**: Slightly more upfront orchestration logic in code compared to a 10-line basic prompt loop.
