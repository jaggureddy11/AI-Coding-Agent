# ADR-003: Multi-Tier Context Retrieval & Token Budgeting Strategy

## Status
Accepted

## Context
Supplying relevant repository context to an LLM is the single most critical factor determining coding accuracy. However, modern LLM context windows, while large (128k–2M tokens), suffer from:
1. "Lost in the middle" retrieval degradation when filled with thousands of lines of irrelevant code.
2. Exponential cost scaling and high latency.
3. Wasteful token burn.

## Decision
ForgeAI implements an **8-Tier Context Priority Hierarchy** governed by a strict sliding token budget (default: 12,000 tokens). Higher-tier sources (Active Selection, Active File, Diagnostic Errors, LSP Symbols) take precedence over lower-tier sources (Imported files, Ripgrep search, Tests, Docs), with automatic middle-file truncation when budget ceilings are approached.

## Alternatives Considered
- **Dump All Open Files into Prompt**:
  - *Why Rejected*: Irrelevant open files confuse the model and waste tokens.
- **Rely Exclusively on User @mentions**:
  - *Why Rejected*: High cognitive burden on the developer to manually specify all related dependencies and types.

## Reasoning
1. **Precision**: Focusing on the active selection and its immediate call graph yields higher generation accuracy than broad repository dumping.
2. **Deterministic Budgets**: Guarantees that prompt costs remain bounded regardless of repository size.
3. **LSP Leverage**: Uses compiler ground truth (via VS Code LSP) to locate exact type definitions.

## Consequences
- **Positive**: Low token costs; fast response times; high code generation accuracy; works across massive enterprise repos without choking.
- **Negative**: Requires careful tuning of token estimation heuristics.
